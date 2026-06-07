using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
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

    [HttpGet("current")]
    public async Task<ActionResult<ApiResponse<TenantProfileDto>>> GetCurrentTenant(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var tenant = await dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null) return NotFound(new ApiResponse<TenantProfileDto>(false, "ไม่พบข้อมูลองค์กร", null));

        return Ok(new ApiResponse<TenantProfileDto>(true, "สำเร็จ", 
            new TenantProfileDto(tenant.Id, tenant.CompanyName, tenant.TaxId, tenant.Address, tenant.Phone, tenant.Email, tenant.LogoUrl, tenant.BranchName, tenant.LineNotifyToken)));
    }

    [HttpPut("profile")]
    public async Task<ActionResult<ApiResponse<TenantProfileDto>>> UpdateProfile([FromBody] UpdateTenantProfileRequest req, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var tenant = await dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null) return NotFound(new ApiResponse<TenantProfileDto>(false, "ไม่พบข้อมูลองค์กร", null));

        tenant.CompanyName = req.CompanyName;
        tenant.TaxId = req.TaxId;
        tenant.Email = req.Email;
        tenant.Phone = req.Phone;
        tenant.Address = req.Address;
        tenant.BranchName = req.BranchName;
        tenant.LineNotifyToken = req.LineNotifyToken;
        if (req.LogoUrl != null) tenant.LogoUrl = req.LogoUrl;
        
        tenant.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<TenantProfileDto>(true, "อัปเดตข้อมูลองค์กรสำเร็จ", 
            new TenantProfileDto(tenant.Id, tenant.CompanyName, tenant.TaxId, tenant.Address, tenant.Phone, tenant.Email, tenant.LogoUrl, tenant.BranchName, tenant.LineNotifyToken)));
    }
}
