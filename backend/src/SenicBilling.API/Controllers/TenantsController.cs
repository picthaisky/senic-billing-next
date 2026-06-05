using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Data;
using System.Security.Claims;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TenantsController(SenicBillingDbContext dbContext) : ControllerBase
{
    private Guid GetTenantId() => Guid.Parse(User.FindFirst("tenantId")!.Value);

    public record TenantDto(Guid Id, string CompanyName, string? TaxId, string? Email, string? Phone, string? Address, string? BranchName);
    public record UpdateTenantRequest(string CompanyName, string? TaxId, string? Email, string? Phone, string? Address, string? BranchName);

    [HttpGet("current")]
    public async Task<IActionResult> GetCurrentTenant(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var tenant = await dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null) return NotFound();

        return Ok(new
        {
            success = true,
            data = new TenantDto(tenant.Id, tenant.CompanyName, tenant.TaxId, tenant.Email, tenant.Phone, tenant.Address, tenant.BranchName)
        });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateTenant(Guid id, [FromBody] UpdateTenantRequest req, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        if (id != tenantId) return Forbid(); // Users can only update their own tenant

        var tenant = await dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null) return NotFound();

        tenant.CompanyName = req.CompanyName;
        tenant.TaxId = req.TaxId;
        tenant.Email = req.Email;
        tenant.Phone = req.Phone;
        tenant.Address = req.Address;
        tenant.BranchName = req.BranchName;
        tenant.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(ct);

        return Ok(new { success = true, message = "Tenant updated successfully" });
    }
}
