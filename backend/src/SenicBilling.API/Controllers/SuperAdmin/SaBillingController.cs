using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.API.Extensions;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers.SuperAdmin;

[ApiController]
[Route("api/superadmin/billing")]
[Authorize(Policy = "PlatformAdmin")]
public class SaBillingController(SenicBillingDbContext dbContext) : ControllerBase
{
    [HttpGet("stats")]
    public async Task<IActionResult> GetPlatformStats(CancellationToken ct)
    {
        var totalTenants = await dbContext.Tenants.CountAsync(ct);
        var activeTenants = await dbContext.Tenants.CountAsync(t => t.IsActive && t.SubscriptionStatus == "Active", ct);
        var totalUsers = await dbContext.AppUsers.IgnoreQueryFilters().CountAsync(ct);

        var mrr = await dbContext.Tenants
            .Include(t => t.CurrentPlan)
            .Where(t => t.IsActive && t.SubscriptionStatus == "Active" && t.CurrentPlan != null)
            .SumAsync(t => (decimal?)t.CurrentPlan!.MonthlyPrice, ct) ?? 0m;

        var recentSubscriptions = await dbContext.TenantSubscriptions
            .Include(s => s.Tenant)
            .Include(s => s.Plan)
            .OrderByDescending(s => s.CreatedAt)
            .Take(10)
            .Select(s => new
            {
                s.Id,
                TenantName = s.Tenant != null ? s.Tenant.CompanyName : "N/A",
                PlanName = s.Plan != null ? s.Plan.Name : "N/A",
                Amount = s.Plan != null
                    ? (s.BillingCycle.ToLower() == "yearly"
                        ? s.Plan.YearlyPrice
                        : s.Plan.MonthlyPrice)
                    : 0m,
                s.BillingCycle,
                s.PaymentMethod,
                s.Status,
                s.StartDate,
                s.EndDate,
                s.CreatedAt
            })
            .ToListAsync(ct);

        return Ok(new
        {
            success = true,
            data = new
            {
                totalTenants,
                activeTenants,
                totalUsers,
                mrr,
                recentInvoices = recentSubscriptions
            }
        });
    }

    [HttpGet("invoices")]
    public async Task<IActionResult> GetSaaSInvoices(CancellationToken ct)
    {
        var subscriptions = await dbContext.TenantSubscriptions
            .Include(s => s.Tenant)
            .Include(s => s.Plan)
            .OrderByDescending(s => s.CreatedAt)
            .Take(50)
            .Select(s => new
            {
                s.Id,
                TenantName = s.Tenant != null ? s.Tenant.CompanyName : "N/A",
                PlanName = s.Plan != null ? s.Plan.Name : "N/A",
                Amount = s.Plan != null
                    ? (s.BillingCycle.ToLower() == "yearly"
                        ? s.Plan.YearlyPrice
                        : s.Plan.MonthlyPrice)
                    : 0m,
                s.BillingCycle,
                s.PaymentMethod,
                s.Status,
                s.StartDate,
                s.EndDate,
                s.CreatedAt
            })
            .ToListAsync(ct);

        return Ok(new { success = true, data = subscriptions });
    }

    [HttpPost("invoices/{id:guid}/mark-paid")]
    public async Task<IActionResult> MarkInvoicePaid(Guid id, CancellationToken ct)
    {
        var subscription = await dbContext.TenantSubscriptions
            .Include(s => s.Tenant)
            .Include(s => s.Plan)
            .FirstOrDefaultAsync(s => s.Id == id, ct);

        if (subscription is null)
            return NotFound(new { success = false, message = "ไม่พบบิลค่าบริการที่ระบุ" });

        var now = DateTime.UtcNow;
        var extensionMonths = string.Equals(subscription.BillingCycle, "Yearly", StringComparison.OrdinalIgnoreCase) ? 12 : 1;
        var oldStatus = subscription.Status;
        var oldEndDate = subscription.EndDate;

        subscription.Status = "Paid";
        if (subscription.EndDate <= now)
        {
            subscription.EndDate = now.AddMonths(extensionMonths);
        }

        if (subscription.Tenant is not null)
        {
            subscription.Tenant.IsActive = true;
            subscription.Tenant.SubscriptionStatus = "Active";
            subscription.Tenant.CurrentPlanId = subscription.PlanId;
            subscription.Tenant.SubscriptionValidUntil = subscription.EndDate;
            subscription.Tenant.UpdatedAt = now;
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = subscription.TenantId,
            Username = User.GetUsername(),
            Action = "MarkSaaSInvoicePaid",
            EntityName = "TenantSubscription",
            EntityId = subscription.Id.ToString(),
            OldValues = System.Text.Json.JsonSerializer.Serialize(new { Status = oldStatus, EndDate = oldEndDate }),
            NewValues = System.Text.Json.JsonSerializer.Serialize(new { subscription.Status, subscription.EndDate }),
            Timestamp = now
        });

        await dbContext.SaveChangesAsync(ct);

        return Ok(new
        {
            success = true,
            message = "ยืนยันการชำระเงินและต่ออายุแพ็กเกจสำเร็จ",
            data = new
            {
                subscription.Id,
                subscription.Status,
                subscription.EndDate,
                TenantName = subscription.Tenant?.CompanyName ?? "N/A",
                PlanName = subscription.Plan?.Name ?? "N/A"
            }
        });
    }
}
