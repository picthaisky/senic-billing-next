using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers.SuperAdmin;

public record AssignTenantPlanRequest(Guid PlanId);

[ApiController]
[Route("api/superadmin/tenants")]
[Authorize(Roles = "Admin,SystemAdmin,SuperAdmin")]
public class SaTenantsController(SenicBillingDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAllTenants([FromQuery] string? search, CancellationToken ct)
    {
        var query = dbContext.Tenants
            .Include(t => t.CurrentPlan)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(t =>
                t.CompanyName.Contains(s) ||
                (t.Email != null && t.Email.Contains(s)) ||
                (t.TaxId != null && t.TaxId.Contains(s)));
        }

        var tenants = await query
            .Select(t => new
            {
                t.Id,
                t.CompanyName,
                t.Email,
                t.Phone,
                t.CreatedAt,
                t.IsActive,
                t.CurrentPlanId,
                CurrentPlan = t.CurrentPlan != null ? t.CurrentPlan.Name : "N/A",
                t.SubscriptionStatus,
                t.SubscriptionValidUntil
            })
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

        return Ok(new { success = true, data = tenants });
    }

    [HttpPut("{id}/plan")]
    public async Task<IActionResult> AssignPlan(Guid id, [FromBody] AssignTenantPlanRequest request, CancellationToken ct)
    {
        var tenant = await dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (tenant == null) return NotFound();

        var plan = await dbContext.SubscriptionPlans.FirstOrDefaultAsync(p => p.Id == request.PlanId, ct);
        if (plan == null) return BadRequest(new { success = false, message = "Plan not found" });

        tenant.CurrentPlanId = plan.Id;
        tenant.SubscriptionStatus = "Active";
        tenant.SubscriptionValidUntil = DateTime.UtcNow.AddMonths(1);
        tenant.IsActive = true;
        tenant.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(ct);
        return Ok(new { success = true, message = $"Assigned plan {plan.Name} successfully" });
    }

    [HttpPost("{id}/suspend")]
    public async Task<IActionResult> SuspendTenant(Guid id, CancellationToken ct)
    {
        var tenant = await dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (tenant == null) return NotFound();

        tenant.SubscriptionStatus = "Suspended";
        tenant.IsActive = false;
        await dbContext.SaveChangesAsync(ct);

        return Ok(new { success = true, message = "Tenant suspended successfully" });
    }

    [HttpPost("{id}/activate")]
    public async Task<IActionResult> ActivateTenant(Guid id, CancellationToken ct)
    {
        var tenant = await dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (tenant == null) return NotFound();

        tenant.SubscriptionStatus = "Active";
        tenant.IsActive = true;
        await dbContext.SaveChangesAsync(ct);

        return Ok(new { success = true, message = "Tenant activated successfully" });
    }
}
