using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Data;
using System.Security.Claims;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TenantsController(SenicBillingDbContext dbContext, ILineNotifyService lineNotifyService) : ControllerBase
{
    private Guid GetTenantId() => Guid.Parse(User.FindFirst("tenantId")!.Value);

    [HttpGet("current")]
    public async Task<ActionResult<ApiResponse<TenantProfileDto>>> GetCurrentTenant(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var tenant = await dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null) return NotFound(new ApiResponse<TenantProfileDto>(false, "ไม่พบข้อมูลองค์กร", null));

        return Ok(new ApiResponse<TenantProfileDto>(true, "สำเร็จ", MapToDto(tenant)));
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
        if (!string.IsNullOrWhiteSpace(req.LineChannelAccessToken))
            tenant.LineChannelAccessToken = req.LineChannelAccessToken.Trim();
        if (!string.IsNullOrWhiteSpace(req.LineChannelSecret))
            tenant.LineChannelSecret = req.LineChannelSecret.Trim();
        if (req.LineDefaultTargetId != null)
            tenant.LineDefaultTargetId = string.IsNullOrWhiteSpace(req.LineDefaultTargetId) ? null : req.LineDefaultTargetId.Trim();
        if (req.LogoUrl != null) tenant.LogoUrl = req.LogoUrl;
        
        tenant.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<TenantProfileDto>(true, "อัปเดตข้อมูลองค์กรสำเร็จ", MapToDto(tenant)));
    }

    [HttpPost("test-line-notify")]
    public async Task<ActionResult<ApiResponse<bool>>> TestLineNotify(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var tenant = await dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null || !tenant.HasAnyLineChannel())
        {
            return BadRequest(new ApiResponse<bool>(false, "ยังไม่ได้ตั้งค่า LINE Messaging API หรือ LINE Notify Token", false));
        }

        var sent = await lineNotifyService.NotifyTenantAsync(
            tenant,
            $"\nทดสอบการแจ้งเตือนจาก {tenant.CompanyName} (Senic Billing Next)",
            ct);

        return sent
            ? Ok(new ApiResponse<bool>(true, "ส่งข้อความทดสอบ LINE สำเร็จ", true))
            : BadRequest(new ApiResponse<bool>(false, "ไม่สามารถส่งข้อความ LINE ได้ กรุณาตรวจสอบการตั้งค่า", false));
    }

    private static TenantProfileDto MapToDto(Tenant tenant) => new(
        tenant.Id,
        tenant.CompanyName,
        tenant.TaxId,
        tenant.Address,
        tenant.Phone,
        tenant.Email,
        tenant.LogoUrl,
        tenant.BranchName,
        tenant.LineNotifyToken,
        tenant.LineDefaultTargetId,
        !string.IsNullOrWhiteSpace(tenant.LineChannelAccessToken),
        !string.IsNullOrWhiteSpace(tenant.LineChannelSecret));
}
