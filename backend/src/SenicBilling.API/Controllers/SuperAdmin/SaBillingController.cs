using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers.SuperAdmin;

[ApiController]
[Route("api/superadmin/billing")]
[Authorize(Roles = "Admin,SystemAdmin,SuperAdmin")]
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
                Amount = s.Plan != null ? s.Plan.MonthlyPrice : 0m,
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
                Amount = s.Plan != null ? s.Plan.MonthlyPrice : 0m,
                s.Status,
                s.StartDate,
                s.EndDate,
                s.CreatedAt
            })
            .ToListAsync(ct);

        return Ok(new { success = true, data = subscriptions });
    }
}
