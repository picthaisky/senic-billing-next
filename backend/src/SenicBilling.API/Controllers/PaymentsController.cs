using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SenicBilling.API.Hubs;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Infrastructure.Data;
using System.Text.Json;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly SenicBillingDbContext _dbContext;
    private readonly IPaymentService _paymentService;
    private readonly IHubContext<SenicBillingHub> _hubContext;
    private readonly ILineNotifyService _lineNotifyService;
    private readonly ILogger<PaymentsController> _logger;

    public PaymentsController(
        SenicBillingDbContext dbContext,
        IPaymentService paymentService,
        IHubContext<SenicBillingHub> hubContext,
        ILineNotifyService lineNotifyService,
        ILogger<PaymentsController> logger)
    {
        _dbContext = dbContext;
        _paymentService = paymentService;
        _hubContext = hubContext;
        _lineNotifyService = lineNotifyService;
        _logger = logger;
    }

    [HttpPost("{documentId}/promptpay")]
    [AllowAnonymous]
    public async Task<IActionResult> CreatePromptPayCharge(Guid documentId)
    {
        var hasTenantClaim = Guid.TryParse(User.FindFirst("tenantId")?.Value, out var callerTenantId);

        var query = _dbContext.DocumentHeaders.AsQueryable();
        if (hasTenantClaim)
        {
            query = query.Where(d => d.TenantId == callerTenantId);
        }

        var document = await query.FirstOrDefaultAsync(d => d.Id == documentId);

        if (document == null)
            return NotFound("Document not found");

        var tenantId = document.TenantId;

        if (document.Status == DocumentStatus.Paid)
            return BadRequest("Document is already paid");

        try
        {
            // Amount is GrandTotal
            var amount = document.GrandTotal;
            var reference = document.Id.ToString();

            var (chargeId, qrCodeUrl) = await _paymentService.CreatePromptPayChargeAsync(amount, reference);

            var transaction = new PaymentTransaction
            {
                TenantId = tenantId,
                DocumentId = documentId,
                Amount = amount,
                PaymentMethod = "promptpay",
                GatewayReference = chargeId,
                QrCodeUrl = qrCodeUrl,
                Status = "pending"
            };

            _dbContext.PaymentTransactions.Add(transaction);
            await _dbContext.SaveChangesAsync();

            return Ok(new { chargeId, qrCodeUrl, amount });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating PromptPay charge for Document {DocumentId}", documentId);
            return StatusCode(500, "Payment gateway error");
        }
    }

    [HttpPost("{documentId}/payment-link")]
    [AllowAnonymous]
    public async Task<IActionResult> CreatePaymentLink(Guid documentId)
    {
        var hasTenantClaim = Guid.TryParse(User.FindFirst("tenantId")?.Value, out var callerTenantId);

        var query = _dbContext.DocumentHeaders.AsQueryable();
        if (hasTenantClaim)
        {
            query = query.Where(d => d.TenantId == callerTenantId);
        }

        var document = await query.FirstOrDefaultAsync(d => d.Id == documentId);

        if (document == null)
            return NotFound("Document not found");

        var tenantId = document.TenantId;

        if (document.Status == DocumentStatus.Paid)
            return BadRequest("Document is already paid");

        try
        {
            var amount = document.GrandTotal;
            var reference = document.Id.ToString();
            var title = $"Invoice {document.DocumentNumber}";
            var description = $"Payment for {document.CustomerName}";

            var paymentUrl = await _paymentService.CreatePaymentLinkAsync(amount, title, description, reference);

            if (string.IsNullOrEmpty(paymentUrl))
                return StatusCode(500, "Failed to create payment link");

            var transaction = new PaymentTransaction
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                DocumentId = documentId,
                Amount = amount,
                PaymentMethod = "payment_link",
                GatewayReference = "LINK_" + Guid.NewGuid().ToString("N").Substring(0, 8),
                QrCodeUrl = paymentUrl, // Reuse QrCodeUrl for the link URL
                Status = "pending",
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.PaymentTransactions.Add(transaction);
            await _dbContext.SaveChangesAsync();

            return Ok(new { paymentUrl, amount });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating Payment Link for Document {DocumentId}", documentId);
            return StatusCode(500, "Payment gateway error");
        }
    }

    // Omise Webhook Endpoint (No Authorization needed, it's called by Omise)
    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> OmiseWebhook([FromBody] JsonElement payload)
    {
        try
        {
            var key = payload.GetProperty("key").GetString();
            if (key != "charge.complete")
            {
                return Ok(); // Ignore other events
            }

            var data = payload.GetProperty("data");
            var chargeId = data.GetProperty("id").GetString();
            var status = data.GetProperty("status").GetString();
            var metadata = data.GetProperty("metadata");
            
            var documentIdString = metadata.GetProperty("DocumentId").GetString();
            if (string.IsNullOrEmpty(documentIdString) || !Guid.TryParse(documentIdString, out var documentId))
            {
                return Ok();
            }

            // Optional: You can verify with Omise API again to be absolutely secure against spoofing
            // var isValid = await _paymentService.VerifyChargeAsync(chargeId);
            // if (!isValid) return BadRequest();

            if (status == "successful")
            {
                var transaction = await _dbContext.PaymentTransactions
                    .FirstOrDefaultAsync(t => t.GatewayReference == chargeId);

                if (transaction != null)
                {
                    transaction.Status = "successful";
                    transaction.PaidAt = DateTime.UtcNow;
                }

                var document = await _dbContext.DocumentHeaders
                    .FirstOrDefaultAsync(d => d.Id == documentId);

                if (document != null && document.Status != DocumentStatus.Paid)
                {
                    document.Status = DocumentStatus.Paid;
                    document.UpdatedAt = DateTime.UtcNow;

                    await _dbContext.SaveChangesAsync();

                    var accounting = HttpContext?.RequestServices?.GetService<IAccountingService>();
                    if (accounting is not null)
                    {
                        await accounting.PostPaymentAsync(document, document.GrandTotal, "OmiseWebhook");
                    }

                    // Notify Frontend Real-time via SignalR
                    await _hubContext.Clients.Group($"Tenant_{document.TenantId}")
                        .SendAsync("PaymentReceived", new { documentId = document.Id, amount = document.GrandTotal });

                    // Notify via LINE (Messaging API or Notify) if configured for this Tenant
                    var tenant = await _dbContext.Tenants
                        .AsNoTracking()
                        .FirstOrDefaultAsync(t => t.Id == document.TenantId);
                    if (tenant != null && tenant.HasAnyLineChannel())
                    {
                        _ = _lineNotifyService.NotifyTenantAsync(
                            tenant,
                            $"\nรับชำระเงินสำเร็จ!\nเลขที่เอกสาร: {document.DocumentNumber}\nลูกค้า: {document.CustomerName}\nยอดชำระ: {document.GrandTotal:N2} บาท");
                    }
                }
                else if (transaction != null)
                {
                    // If document was already paid but we missed the transaction status update
                    await _dbContext.SaveChangesAsync();
                }
            }

            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing Omise webhook");
            return BadRequest();
        }
    }
}
