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

    [HttpGet("plans")]
    [Authorize]
    public async Task<IActionResult> GetAvailablePlans(CancellationToken ct)
    {
        var plans = await _dbContext.SubscriptionPlans
            .Where(p => p.IsActive)
            .OrderBy(p => p.MonthlyPrice)
            .ToListAsync(ct);

        return Ok(new { success = true, data = plans });
    }

    [HttpGet("current")]
    [Authorize]
    public async Task<IActionResult> GetCurrentSubscription(CancellationToken ct)
    {
        var tenantIdString = User.FindFirst("tenantId")?.Value;
        if (!Guid.TryParse(tenantIdString, out var tenantId))
            return Unauthorized();

        var tenant = await _dbContext.Tenants
            .Include(t => t.CurrentPlan)
            .FirstOrDefaultAsync(t => t.Id == tenantId, ct);

        if (tenant == null) return NotFound("Tenant not found");

        var now = DateTime.UtcNow;
        var currentMonthDocuments = await _dbContext.DocumentHeaders
            .CountAsync(d =>
                d.TenantId == tenantId &&
                d.Status != DocumentStatus.Cancelled &&
                d.CreatedAt.Year == now.Year &&
                d.CreatedAt.Month == now.Month, ct);

        var currentUsers = await _dbContext.AppUsers
            .CountAsync(u => u.TenantId == tenantId && u.IsActive, ct);

        var availablePlans = await _dbContext.SubscriptionPlans
            .Where(p => p.IsActive)
            .OrderBy(p => p.MonthlyPrice)
            .ToListAsync(ct);

        return Ok(new
        {
            success = true,
            data = new
            {
                tenantId = tenant.Id,
                companyName = tenant.CompanyName,
                subscriptionStatus = tenant.SubscriptionStatus,
                subscriptionValidUntil = tenant.SubscriptionValidUntil,
                currentPlan = tenant.CurrentPlan != null
                    ? new
                    {
                        tenant.CurrentPlan.Id,
                        tenant.CurrentPlan.Name,
                        tenant.CurrentPlan.MonthlyPrice,
                        tenant.CurrentPlan.YearlyPrice,
                        tenant.CurrentPlan.MaxUsers,
                        tenant.CurrentPlan.MaxDocumentsPerMonth,
                        tenant.CurrentPlan.Features
                    }
                    : null,
                usage = new
                {
                    currentMonthDocuments,
                    maxDocumentsPerMonth = tenant.CurrentPlan?.MaxDocumentsPerMonth ?? 2000,
                    currentUsers,
                    maxUsers = tenant.CurrentPlan?.MaxUsers ?? 20
                },
                availablePlans
            }
        });
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
            string chargeId = "FREE_OR_DIRECT_" + Guid.NewGuid().ToString("N")[..8];

            if (plan.MonthlyPrice > 0 && !string.IsNullOrWhiteSpace(req.CardToken))
            {
                var customerId = await _paymentService.CreateCustomerAsync(
                    tenant.Email ?? "no-email@example.com",
                    $"Tenant: {tenant.CompanyName}",
                    req.CardToken);

                chargeId = await _paymentService.CreateCardChargeAsync(
                    plan.MonthlyPrice,
                    customerId,
                    tenant.Id.ToString());
            }

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

            tenant.SubscriptionStatus = "Active";
            tenant.IsActive = true;
            tenant.CurrentPlanId = plan.Id;
            tenant.SubscriptionValidUntil = subscription.EndDate;
            tenant.UpdatedAt = DateTime.UtcNow;

            await _dbContext.SaveChangesAsync(ct);

            return Ok(new
            {
                success = true,
                chargeId,
                planName = plan.Name,
                validUntil = tenant.SubscriptionValidUntil
            });
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
