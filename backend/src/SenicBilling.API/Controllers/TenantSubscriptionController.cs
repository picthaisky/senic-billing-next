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
    public string BillingCycle { get; set; } = "Monthly";
    public string PaymentMethod { get; set; } = "card";
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
            var now = DateTime.UtcNow;
            var isYearly = string.Equals(req.BillingCycle, "Yearly", StringComparison.OrdinalIgnoreCase);
            var billingCycle = isYearly ? "Yearly" : "Monthly";
            var extensionMonths = isYearly ? 12 : 1;
            var chargeAmount = isYearly && plan.YearlyPrice > 0m ? plan.YearlyPrice : plan.MonthlyPrice;
            var paymentMethod = string.IsNullOrWhiteSpace(req.PaymentMethod)
                ? "card"
                : req.PaymentMethod.Trim().ToLowerInvariant();

            if (paymentMethod is not ("card" or "promptpay" or "bank_transfer"))
            {
                return BadRequest(new { success = false, message = "ช่องทางชำระเงินไม่ถูกต้อง (รองรับ card, promptpay, bank_transfer)" });
            }

            var startDate = now;
            var endDate = now.AddMonths(extensionMonths);
            var username = User.FindFirst(ClaimTypes.Name)?.Value ?? User.Identity?.Name ?? "Admin";

            // 1) Free plans (amount <= 0) activate immediately without payment gateway
            if (chargeAmount <= 0m)
            {
                var freeChargeId = "FREE_" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
                var subscription = new TenantSubscription
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    PlanId = plan.Id,
                    BillingCycle = billingCycle,
                    StartDate = startDate,
                    EndDate = endDate,
                    Status = "Active",
                    PaymentMethod = "free",
                    OmiseChargeId = freeChargeId,
                    CreatedAt = now
                };

                _dbContext.TenantSubscriptions.Add(subscription);
                var oldPlanId = tenant.CurrentPlanId;
                tenant.SubscriptionStatus = "Active";
                tenant.IsActive = true;
                tenant.CurrentPlanId = plan.Id;
                tenant.SubscriptionValidUntil = endDate;
                tenant.UpdatedAt = now;

                _dbContext.AuditLogs.Add(new AuditLog
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    Username = username,
                    Action = "CheckoutSubscriptionPlan",
                    EntityName = "TenantSubscription",
                    EntityId = subscription.Id.ToString(),
                    OldValues = JsonSerializer.Serialize(new { PlanId = oldPlanId }),
                    NewValues = JsonSerializer.Serialize(new { PlanId = plan.Id, PlanName = plan.Name, BillingCycle = billingCycle, ChargeId = freeChargeId }),
                    Timestamp = now
                });

                await _dbContext.SaveChangesAsync(ct);

                return Ok(new
                {
                    success = true,
                    requiresPayment = false,
                    status = "Active",
                    subscriptionId = subscription.Id,
                    chargeId = freeChargeId,
                    planName = plan.Name,
                    billingCycle,
                    amount = 0m,
                    validUntil = tenant.SubscriptionValidUntil
                });
            }

            // 2) Paid plans: PromptPay QR checkout (Pending until Omise webhook / verification)
            if (paymentMethod == "promptpay")
            {
                var subscriptionId = Guid.NewGuid();
                var (chargeId, qrCodeUrl) = await _paymentService.CreatePromptPayChargeAsync(
                    chargeAmount,
                    $"SUB:{tenant.Id}:{subscriptionId}");

                var subscription = new TenantSubscription
                {
                    Id = subscriptionId,
                    TenantId = tenant.Id,
                    PlanId = plan.Id,
                    BillingCycle = billingCycle,
                    StartDate = startDate,
                    EndDate = endDate,
                    Status = "Pending",
                    PaymentMethod = "promptpay",
                    OmiseChargeId = chargeId,
                    CreatedAt = now
                };

                _dbContext.TenantSubscriptions.Add(subscription);
                _dbContext.AuditLogs.Add(new AuditLog
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    Username = username,
                    Action = "InitiateSubscriptionPromptPay",
                    EntityName = "TenantSubscription",
                    EntityId = subscription.Id.ToString(),
                    NewValues = JsonSerializer.Serialize(new { PlanId = plan.Id, PlanName = plan.Name, BillingCycle = billingCycle, Amount = chargeAmount, ChargeId = chargeId }),
                    Timestamp = now
                });

                await _dbContext.SaveChangesAsync(ct);

                return Ok(new
                {
                    success = true,
                    requiresPayment = true,
                    paymentMethod = "promptpay",
                    status = "Pending",
                    subscriptionId = subscription.Id,
                    chargeId,
                    qrCodeUrl,
                    amount = chargeAmount,
                    billingCycle,
                    planName = plan.Name
                });
            }

            // 3) Paid plans: Bank transfer invoice request (Pending until Super Admin marks paid)
            if (paymentMethod == "bank_transfer")
            {
                var subscriptionId = Guid.NewGuid();
                var bankRef = "BANK-" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();

                var subscription = new TenantSubscription
                {
                    Id = subscriptionId,
                    TenantId = tenant.Id,
                    PlanId = plan.Id,
                    BillingCycle = billingCycle,
                    StartDate = startDate,
                    EndDate = endDate,
                    Status = "Pending",
                    PaymentMethod = "bank_transfer",
                    OmiseChargeId = bankRef,
                    CreatedAt = now
                };

                _dbContext.TenantSubscriptions.Add(subscription);
                _dbContext.AuditLogs.Add(new AuditLog
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenant.Id,
                    Username = username,
                    Action = "RequestSubscriptionBankTransfer",
                    EntityName = "TenantSubscription",
                    EntityId = subscription.Id.ToString(),
                    NewValues = JsonSerializer.Serialize(new { PlanId = plan.Id, PlanName = plan.Name, BillingCycle = billingCycle, Amount = chargeAmount, Reference = bankRef }),
                    Timestamp = now
                });

                await _dbContext.SaveChangesAsync(ct);

                return Ok(new
                {
                    success = true,
                    requiresPayment = true,
                    paymentMethod = "bank_transfer",
                    status = "Pending",
                    subscriptionId = subscription.Id,
                    chargeId = bankRef,
                    amount = chargeAmount,
                    billingCycle,
                    planName = plan.Name
                });
            }

            // 4) Paid plans: Credit/Debit card checkout (requires real Omise CardToken)
            if (string.IsNullOrWhiteSpace(req.CardToken))
            {
                return BadRequest(new
                {
                    success = false,
                    message = "แพ็กเกจแบบมีค่าบริการต้องระบุ CardToken หรือเลือกชำระผ่าน PromptPay / โอนเงิน"
                });
            }

            var customerId = await _paymentService.CreateCustomerAsync(
                tenant.Email ?? "no-email@example.com",
                $"Tenant: {tenant.CompanyName}",
                req.CardToken);

            var cardChargeId = await _paymentService.CreateCardChargeAsync(
                chargeAmount,
                customerId,
                tenant.Id.ToString());

            var paidSub = new TenantSubscription
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                PlanId = plan.Id,
                BillingCycle = billingCycle,
                StartDate = startDate,
                EndDate = endDate,
                Status = "Active",
                PaymentMethod = "card",
                OmiseChargeId = cardChargeId,
                CreatedAt = now
            };

            _dbContext.TenantSubscriptions.Add(paidSub);

            var previousPlanId = tenant.CurrentPlanId;
            tenant.SubscriptionStatus = "Active";
            tenant.IsActive = true;
            tenant.CurrentPlanId = plan.Id;
            tenant.SubscriptionValidUntil = paidSub.EndDate;
            tenant.UpdatedAt = now;

            _dbContext.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenant.Id,
                Username = username,
                Action = "CheckoutSubscriptionPlan",
                EntityName = "TenantSubscription",
                EntityId = paidSub.Id.ToString(),
                OldValues = JsonSerializer.Serialize(new { PlanId = previousPlanId }),
                NewValues = JsonSerializer.Serialize(new { PlanId = plan.Id, PlanName = plan.Name, BillingCycle = billingCycle, Amount = chargeAmount, ChargeId = cardChargeId }),
                Timestamp = now
            });

            await _dbContext.SaveChangesAsync(ct);

            return Ok(new
            {
                success = true,
                requiresPayment = false,
                status = "Active",
                subscriptionId = paidSub.Id,
                chargeId = cardChargeId,
                planName = plan.Name,
                billingCycle,
                amount = chargeAmount,
                validUntil = tenant.SubscriptionValidUntil
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process checkout for Tenant {TenantId}", tenantId);
            return StatusCode(500, new { success = false, message = "Payment processing failed" });
        }
    }

    [HttpGet("status/{subscriptionId:guid}")]
    public async Task<IActionResult> GetCheckoutStatus(Guid subscriptionId, CancellationToken ct)
    {
        var tenantIdString = User.FindFirst("tenantId")?.Value;
        if (!Guid.TryParse(tenantIdString, out var tenantId))
            return Unauthorized();

        var sub = await _dbContext.TenantSubscriptions
            .Include(s => s.Tenant)
            .Include(s => s.Plan)
            .FirstOrDefaultAsync(s => s.Id == subscriptionId && s.TenantId == tenantId, ct);

        if (sub is null)
            return NotFound(new { success = false, message = "ไม่พบรายการสมัครแพ็กเกจ" });

        if (string.Equals(sub.Status, "Pending", StringComparison.OrdinalIgnoreCase) &&
            !string.IsNullOrWhiteSpace(sub.OmiseChargeId) &&
            sub.OmiseChargeId.StartsWith("chrg_", StringComparison.Ordinal))
        {
            var paid = await _paymentService.VerifyChargeAsync(sub.OmiseChargeId);
            if (paid && sub.Tenant is not null)
            {
                ActivatePendingSubscription(sub.Tenant, sub, "OmiseStatusPoll");
                await _dbContext.SaveChangesAsync(ct);
            }
        }

        var isCompleted = sub.Status is "Active" or "Paid";
        return Ok(new
        {
            success = true,
            status = sub.Status,
            isPaid = isCompleted,
            subscriptionId = sub.Id,
            planId = sub.PlanId,
            planName = sub.Plan?.Name,
            billingCycle = sub.BillingCycle,
            validUntil = sub.Tenant?.SubscriptionValidUntil
        });
    }

    private void ActivatePendingSubscription(Tenant tenant, TenantSubscription subscription, string actor)
    {
        var now = DateTime.UtcNow;
        var extensionMonths = string.Equals(subscription.BillingCycle, "Yearly", StringComparison.OrdinalIgnoreCase) ? 12 : 1;
        var baseDate = tenant.SubscriptionValidUntil.HasValue && tenant.SubscriptionValidUntil.Value > now
            ? tenant.SubscriptionValidUntil.Value
            : now;
        var newValidUntil = baseDate.AddMonths(extensionMonths);

        subscription.StartDate = now;
        subscription.EndDate = newValidUntil;
        subscription.Status = "Active";
        subscription.UpdatedAt = now;

        var oldPlanId = tenant.CurrentPlanId;
        tenant.CurrentPlanId = subscription.PlanId;
        tenant.SubscriptionValidUntil = newValidUntil;
        tenant.SubscriptionStatus = "Active";
        tenant.IsActive = true;
        tenant.UpdatedAt = now;

        _dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Username = actor,
            Action = "RenewSubscriptionWebhook",
            EntityName = "Tenant",
            EntityId = tenant.Id.ToString(),
            OldValues = JsonSerializer.Serialize(new { PlanId = oldPlanId }),
            NewValues = JsonSerializer.Serialize(new { PlanId = tenant.CurrentPlanId, SubscriptionValidUntil = newValidUntil, Status = "Active" }),
            Timestamp = now
        });
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
                var chargeId = data.TryGetProperty("id", out var idEl) ? idEl.GetString() : null;
                _logger.LogInformation("Omise subscription webhook received. Status: {Status}, ChargeId: {ChargeId}", status, chargeId);

                if (!string.IsNullOrWhiteSpace(chargeId))
                {
                    var isValid = await _paymentService.VerifyChargeAsync(chargeId);
                    if (!isValid)
                    {
                        _logger.LogWarning("Rejected unverified Omise subscription webhook for ChargeId {ChargeId}", chargeId);
                        return BadRequest(new { message = "Invalid or unverified Omise charge" });
                    }
                }

                if (string.Equals(status, "successful", StringComparison.OrdinalIgnoreCase))
                {
                    Guid tenantId = Guid.Empty;
                    Guid subscriptionId = Guid.Empty;

                    if (data.TryGetProperty("description", out var descEl))
                    {
                        var desc = descEl.GetString();
                        if (!string.IsNullOrWhiteSpace(desc))
                        {
                            if (desc.StartsWith("SUB:", StringComparison.OrdinalIgnoreCase))
                            {
                                var parts = desc.Split(':');
                                if (parts.Length >= 2) Guid.TryParse(parts[1], out tenantId);
                                if (parts.Length >= 3) Guid.TryParse(parts[2], out subscriptionId);
                            }
                            else
                            {
                                Guid.TryParse(desc, out tenantId);
                            }
                        }
                    }

                    if (tenantId == Guid.Empty &&
                        data.TryGetProperty("metadata", out var metaEl) &&
                        metaEl.ValueKind == JsonValueKind.Object)
                    {
                        if (metaEl.TryGetProperty("tenantId", out var metaTenantEl))
                            Guid.TryParse(metaTenantEl.GetString(), out tenantId);
                        if (metaEl.TryGetProperty("subscriptionId", out var metaSubEl))
                            Guid.TryParse(metaSubEl.GetString(), out subscriptionId);
                    }

                    TenantSubscription? matchedSub = null;
                    if (subscriptionId != Guid.Empty)
                    {
                        matchedSub = await _dbContext.TenantSubscriptions
                            .Include(s => s.Tenant)
                            .FirstOrDefaultAsync(s => s.Id == subscriptionId, ct);
                    }
                    else if (!string.IsNullOrWhiteSpace(chargeId))
                    {
                        matchedSub = await _dbContext.TenantSubscriptions
                            .Include(s => s.Tenant)
                            .FirstOrDefaultAsync(s => s.OmiseChargeId == chargeId, ct);
                    }

                    if (matchedSub is not null && tenantId == Guid.Empty)
                        tenantId = matchedSub.TenantId;

                    if (tenantId != Guid.Empty)
                    {
                        var tenant = matchedSub?.Tenant ?? await _dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
                        if (tenant != null)
                        {
                            if (matchedSub is not null)
                            {
                                ActivatePendingSubscription(tenant, matchedSub, "OmiseWebhook");
                            }
                            else
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
                            }

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
