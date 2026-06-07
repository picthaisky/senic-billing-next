using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Infrastructure.Data;
using System.Text.Json;

namespace SenicBilling.API.Controllers;

public class CheckoutRequest
{
    public Guid PlanId { get; set; }
    public string CardToken { get; set; } = string.Empty;
}

[ApiController]
[Route("api/subscriptions")]
public class TenantSubscriptionController : ControllerBase
{
    private readonly SenicBillingDbContext _dbContext;
    private readonly IPaymentService _paymentService;
    private readonly ILogger<TenantSubscriptionController> _logger;

    public TenantSubscriptionController(
        SenicBillingDbContext dbContext,
        IPaymentService paymentService,
        ILogger<TenantSubscriptionController> logger)
    {
        _dbContext = dbContext;
        _paymentService = paymentService;
        _logger = logger;
    }

    [HttpPost("checkout")]
    [Authorize]
    public async Task<IActionResult> Checkout([FromBody] CheckoutRequest req, CancellationToken ct)
    {
        var tenantIdString = User.FindFirst("tenantId")?.Value;
        if (!Guid.TryParse(tenantIdString, out var tenantId))
            return Unauthorized();

        var tenant = await _dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null) return NotFound("Tenant not found");

        var plan = await _dbContext.SubscriptionPlans.FirstOrDefaultAsync(p => p.Id == req.PlanId, ct);
        if (plan == null) return NotFound("Plan not found");

        try
        {
            // 1. Create Customer in Omise if not exists (For simplicity, we create a new customer each time here, but ideally we'd store OmiseCustomerId in Tenant table)
            var customerId = await _paymentService.CreateCustomerAsync(tenant.Email ?? "no-email@example.com", $"Tenant: {tenant.CompanyName}", req.CardToken);

            // 2. Charge the customer for the plan amount
            var chargeId = await _paymentService.CreateCardChargeAsync(plan.MonthlyPrice, customerId, tenant.Id.ToString());

            // 3. Record Subscription History
            var subscription = new TenantSubscription
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PlanId = plan.Id,
                StartDate = DateTime.UtcNow,
                EndDate = DateTime.UtcNow.AddMonths(1),
                Status = "Active",
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.TenantSubscriptions.Add(subscription);

            // 4. Update Tenant Status
            tenant.SubscriptionStatus = "Active";
            tenant.CurrentPlanId = plan.Id;
            tenant.SubscriptionValidUntil = subscription.EndDate;
            tenant.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync(ct);

            return Ok(new { success = true, chargeId, validUntil = tenant.SubscriptionValidUntil });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process checkout for Tenant {TenantId}", tenantId);
            return StatusCode(500, new { success = false, message = "Payment processing failed" });
        }
    }

    [HttpPost("webhook/omise")]
    [AllowAnonymous]
    public async Task<IActionResult> OmiseWebhook([FromBody] JsonElement payload)
    {
        // This endpoint will handle recurring charges if schedules are used in Omise
        // For phase 4, we implemented the card charge which handles the immediate payment.
        // In a full recurring setup, we would listen to `charge.complete` where `schedule` is not null.
        
        try
        {
            var key = payload.GetProperty("key").GetString();
            if (key == "charge.complete")
            {
                var data = payload.GetProperty("data");
                var status = data.GetProperty("status").GetString();
                // If it's a successful recurring charge, we would extend the Tenant's SubscriptionValidUntil by 1 month.
                _logger.LogInformation("Omise subscription webhook received. Status: {Status}", status);
            }

            return Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing Omise subscription webhook");
            return BadRequest();
        }
    }
}
