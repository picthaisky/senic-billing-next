using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SenicBilling.API.Hubs;
using SenicBilling.Application.DTOs;
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

        if (document.Status == DocumentStatus.Cancelled)
            return BadRequest("Document is cancelled");

        if (document.Status == DocumentStatus.Draft)
            return BadRequest("Document is in draft status");

        if (document.DocumentType is DocumentType.Quotation or DocumentType.DeliveryNote or DocumentType.CreditNote)
            return BadRequest("Document type does not support online payment");

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

        if (document.Status == DocumentStatus.Cancelled)
            return BadRequest("Document is cancelled");

        if (document.Status == DocumentStatus.Draft)
            return BadRequest("Document is in draft status");

        if (document.DocumentType is DocumentType.Quotation or DocumentType.DeliveryNote or DocumentType.CreditNote)
            return BadRequest("Document type does not support online payment");

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

    [HttpGet("callback-status")]
    [AllowAnonymous]
    public async Task<IActionResult> GetCallbackStatus(
        [FromQuery] Guid? documentId = null,
        [FromQuery] string? reference = null,
        [FromQuery] string? chargeId = null)
    {
        Guid? targetDocId = documentId;
        if (!targetDocId.HasValue && Guid.TryParse(reference, out var parsedRef))
        {
            targetDocId = parsedRef;
        }

        if (!targetDocId.HasValue && !string.IsNullOrWhiteSpace(chargeId))
        {
            targetDocId = await _dbContext.PaymentTransactions
                .AsNoTracking()
                .Where(t => t.GatewayReference == chargeId)
                .OrderByDescending(t => t.CreatedAt)
                .Select(t => (Guid?)t.DocumentId)
                .FirstOrDefaultAsync();
        }

        if (!targetDocId.HasValue)
        {
            return NotFound(new { success = false, message = "Payment document reference not found" });
        }

        var hasTenantClaim = Guid.TryParse(User.FindFirst("tenantId")?.Value, out var callerTenantId);
        var query = _dbContext.DocumentHeaders.AsNoTracking().Where(d => d.Id == targetDocId.Value);
        if (hasTenantClaim)
        {
            query = query.Where(d => d.TenantId == callerTenantId);
        }

        var document = await query.FirstOrDefaultAsync();
        if (document == null)
        {
            return NotFound(new { success = false, message = "Document not found" });
        }

        var latestTx = await _dbContext.PaymentTransactions
            .AsNoTracking()
            .Where(t => t.DocumentId == document.Id && t.TenantId == document.TenantId)
            .OrderByDescending(t => t.CreatedAt)
            .FirstOrDefaultAsync();

        var isPaid = document.Status == DocumentStatus.Paid ||
                     string.Equals(latestTx?.Status, "successful", StringComparison.OrdinalIgnoreCase);

        return Ok(new
        {
            success = true,
            documentId = document.Id,
            documentNumber = document.DocumentNumber,
            documentType = document.DocumentType.ToString(),
            status = document.Status.ToString(),
            isPaid,
            grandTotal = document.GrandTotal,
            paymentStatus = latestTx?.Status ?? (isPaid ? "successful" : "pending"),
            paidAt = latestTx?.PaidAt
        });
    }

    // Omise Webhook Endpoint (No Authorization needed, it's called by Omise)
    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> OmiseWebhook([FromBody] JsonElement payload)
    {
        try
        {
            if (payload.ValueKind != JsonValueKind.Object ||
                !payload.TryGetProperty("key", out var keyProp) ||
                keyProp.GetString() != "charge.complete")
            {
                return Ok(); // Ignore other events
            }

            if (!payload.TryGetProperty("data", out var data) || data.ValueKind != JsonValueKind.Object)
            {
                return Ok();
            }

            var chargeId = data.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;
            var status = data.TryGetProperty("status", out var statusProp) ? statusProp.GetString() : null;

            string? documentIdString = null;
            if (data.TryGetProperty("metadata", out var metadata) && metadata.ValueKind == JsonValueKind.Object)
            {
                if (metadata.TryGetProperty("DocumentId", out var docIdProp))
                    documentIdString = docIdProp.GetString();
                else if (metadata.TryGetProperty("documentId", out docIdProp))
                    documentIdString = docIdProp.GetString();
            }

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

                if (document != null && document.Status != DocumentStatus.Paid && document.Status != DocumentStatus.Cancelled)
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

                    await _hubContext.Clients.Group($"Tenant_{document.TenantId}")
                        .SendAsync("NotificationReceived", new NotificationFeedItemDto(
                            Id: $"paid-{document.Id}",
                            Title: $"รับชำระเงินสำเร็จ {document.DocumentNumber}",
                            Detail: $"{document.CustomerName ?? "ลูกค้าทั่วไป"} • ฿{document.GrandTotal:N2}",
                            TimeLabel: "เมื่อสักครู่",
                            OccurredAt: DateTime.UtcNow,
                            Tone: "success",
                            Route: $"/documents/{document.DocumentType.ToString().ToLowerInvariant()}"
                        ));

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
