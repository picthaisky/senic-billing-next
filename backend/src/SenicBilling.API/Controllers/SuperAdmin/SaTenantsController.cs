using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers.SuperAdmin;

[ApiController]
[Route("api/superadmin/tenants")]
// [Authorize(Roles = "SuperAdmin")] // Uncomment when SuperAdmin role is implemented securely
public class SaTenantsController(SenicBillingDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAllTenants(CancellationToken ct)
    {
        var tenants = await dbContext.Tenants
            .Include(t => t.CurrentPlan)
            .Select(t => new
            {
                t.Id,
                t.CompanyName,
                t.Email,
                t.Phone,
                t.CreatedAt,
                t.IsActive,
                CurrentPlan = t.CurrentPlan != null ? t.CurrentPlan.Name : "N/A",
                t.SubscriptionStatus
            })
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

        return Ok(new { success = true, data = tenants });
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
