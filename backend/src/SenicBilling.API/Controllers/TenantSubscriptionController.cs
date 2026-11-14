using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.API.Extensions;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Infrastructure.Data;
using System.Security.Claims;
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
        if (!User.TryGetTenantId(out var tenantId))
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
    [Authorize(Roles = "Admin,SystemAdmin,SuperAdmin")]
    public async Task<IActionResult> Checkout([FromBody] CheckoutRequest req, CancellationToken ct)
    {
        if (!User.TryGetTenantId(out var tenantId))
            return Unauthorized();

        var tenant = await _dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null) return NotFound("Tenant not found");

        var plan = await _dbContext.SubscriptionPlans.FirstOrDefaultAsync(p => p.Id == req.PlanId, ct);
        if (plan == null) return NotFound("Plan not found");
        if (!plan.IsActive)
        {
            return BadRequest(new { success = false, message = "แพ็กเกจนี้ไม่เปิดใช้งานแล้ว" });
        }

        if (plan.MaxUsers > 0)
        {
            var activeUsers = await _dbContext.AppUsers.CountAsync(u => u.TenantId == tenantId && u.IsActive, ct);
            if (activeUsers > plan.MaxUsers)
            {
                return BadRequest(new
                {
                    success = false,
                    message = $"ไม่สามารถเปลี่ยนเป็นแพ็กเกจ {plan.Name} ได้เนื่องจากมีผู้ใช้งานที่เปิดอยู่ ({activeUsers} บัญชี) เกินโควต้าของแพ็กเกจ ({plan.MaxUsers} บัญชี)"
                });
            }
        }

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

            var oldPlanId = tenant.CurrentPlanId;
            tenant.SubscriptionStatus = "Active";
            tenant.IsActive = true;
            tenant.CurrentPlanId = plan.Id;
            tenant.SubscriptionValidUntil = subscription.EndDate;
            tenant.UpdatedAt = DateTime.UtcNow;

            var username = User.FindFirst(ClaimTypes.Name)?.Value ?? User.Identity?.Name ?? "Admin";
            _dbContext.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                Username = username,
                Action = "CheckoutSubscriptionPlan",
                EntityName = "TenantSubscription",
                EntityId = subscription.Id.ToString(),
                OldValues = JsonSerializer.Serialize(new { PlanId = oldPlanId }),
                NewValues = JsonSerializer.Serialize(new { PlanId = plan.Id, PlanName = plan.Name, ChargeId = chargeId }),
                Timestamp = DateTime.UtcNow
            });

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
    public async Task<IActionResult> OmiseWebhook([FromBody] JsonElement payload, CancellationToken ct = default)
    {
        try
        {
            if (payload.ValueKind != JsonValueKind.Object)
                return BadRequest();

            if (!payload.TryGetProperty("key", out var keyEl))
                return Ok(new { received = true });

            var key = keyEl.GetString();
            if (key == "charge.complete" && payload.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Object)
            {
                var status = data.TryGetProperty("status", out var statusEl) ? statusEl.GetString() : null;
                _logger.LogInformation("Omise subscription webhook received. Status: {Status}", status);

                if (string.Equals(status, "successful", StringComparison.OrdinalIgnoreCase))
                {
                    Guid tenantId = Guid.Empty;
                    if (data.TryGetProperty("description", out var descEl) && Guid.TryParse(descEl.GetString(), out var parsedFromDesc))
                    {
                        tenantId = parsedFromDesc;
                    }
                    else if (data.TryGetProperty("metadata", out var metaEl) &&
                             metaEl.ValueKind == JsonValueKind.Object &&
                             metaEl.TryGetProperty("tenantId", out var metaTenantEl) &&
                             Guid.TryParse(metaTenantEl.GetString(), out var parsedFromMeta))
                    {
                        tenantId = parsedFromMeta;
                    }

                    if (tenantId != Guid.Empty)
                    {
                        var tenant = await _dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
                        if (tenant != null)
                        {
                            var baseDate = tenant.SubscriptionValidUntil.HasValue && tenant.SubscriptionValidUntil.Value > DateTime.UtcNow
                                ? tenant.SubscriptionValidUntil.Value
                                : DateTime.UtcNow;
                            var newValidUntil = baseDate.AddMonths(1);

                            tenant.SubscriptionValidUntil = newValidUntil;
                            tenant.SubscriptionStatus = "Active";
                            tenant.IsActive = true;
                            tenant.UpdatedAt = DateTime.UtcNow;

                            var latestSub = await _dbContext.TenantSubscriptions
                                .Where(s => s.TenantId == tenantId)
                                .OrderByDescending(s => s.EndDate)
                                .FirstOrDefaultAsync(ct);

                            if (latestSub != null)
                            {
                                latestSub.EndDate = newValidUntil;
                                latestSub.Status = "Active";
                                latestSub.UpdatedAt = DateTime.UtcNow;
                            }

                            _dbContext.AuditLogs.Add(new AuditLog
                            {
                                Id = Guid.NewGuid(),
                                TenantId = tenant.Id,
                                Username = "OmiseWebhook",
                                Action = "RenewSubscriptionWebhook",
                                EntityName = "Tenant",
                                EntityId = tenant.Id.ToString(),
                                NewValues = JsonSerializer.Serialize(new { SubscriptionValidUntil = newValidUntil, Status = "Active" }),
                                Timestamp = DateTime.UtcNow
                            });

                            await _dbContext.SaveChangesAsync(ct);
                        }
                    }
                }
            }

            return Ok(new { received = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing Omise subscription webhook");
            return BadRequest();
        }
    }
}
