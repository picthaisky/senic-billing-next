using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/admin/roles")]
[Authorize(Roles = "Admin,SystemAdmin")]
public class AdminRolesController(SenicBillingDbContext dbContext) : ControllerBase
{
    [HttpGet("permissions")]
    public async Task<ActionResult<ApiResponse<List<PermissionDto>>>> GetPermissions(CancellationToken ct)
    {
        var permissions = await dbContext.Set<Permission>()
            .OrderBy(p => p.Category)
            .ThenBy(p => p.Name)
            .ToListAsync(ct);

        var dtos = permissions.Select(p => new PermissionDto(p.Id, p.Name, p.Description, p.Category)).ToList();
        return Ok(new ApiResponse<List<PermissionDto>>(true, "สำเร็จ", dtos));
    }

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<RoleWithPermissionsDto>>>> GetRoles(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        
        // Find all roles associated with this tenant, plus distinct Role names from Users
        var rolePermissions = await dbContext.Set<RolePermission>()
            .Where(rp => rp.TenantId == tenantId)
            .ToListAsync(ct);

        var usersRoles = await dbContext.AppUsers
            .Where(u => u.TenantId == tenantId)
            .Select(u => u.Role)
            .Distinct()
            .ToListAsync(ct);

        // Standard roles to always show
        var standardRoles = new[] { "Admin", "User", "Viewer", "Manager" };
        var allRoles = standardRoles.Union(usersRoles).Distinct().OrderBy(r => r).ToList();

        var dtos = new List<RoleWithPermissionsDto>();
        foreach (var role in allRoles)
        {
            var pIds = rolePermissions.Where(rp => rp.RoleName == role).Select(rp => rp.PermissionId).ToList();
            dtos.Add(new RoleWithPermissionsDto(role, pIds));
        }

        return Ok(new ApiResponse<List<RoleWithPermissionsDto>>(true, "สำเร็จ", dtos));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<RoleWithPermissionsDto>>> SaveRolePermissions([FromBody] SaveRolePermissionsRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.RoleName))
        {
            return BadRequest(new ApiResponse<RoleWithPermissionsDto>(false, "ชื่อ Role ไม่ถูกต้อง", null));
        }

        var tenantId = GetTenantId();

        // 1. Delete existing
        var existing = await dbContext.Set<RolePermission>()
            .Where(rp => rp.TenantId == tenantId && rp.RoleName == request.RoleName)
            .ToListAsync(ct);
        
        dbContext.Set<RolePermission>().RemoveRange(existing);

        // 2. Add new
        var newPermissions = request.PermissionIds.Select(pid => new RolePermission
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RoleName = request.RoleName,
            PermissionId = pid
        }).ToList();

        dbContext.Set<RolePermission>().AddRange(newPermissions);
        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<RoleWithPermissionsDto>(true, "บันทึกสิทธิ์สำเร็จ", new RoleWithPermissionsDto(request.RoleName, request.PermissionIds)));
    }

    private Guid GetTenantId()
    {
        var claim = User.FindFirst("tenantId")?.Value;
        return claim is not null ? Guid.Parse(claim) : throw new UnauthorizedAccessException("Tenant ID claim not found");
    }
}

public record PermissionDto(Guid Id, string Name, string Description, string Category);
public record RoleWithPermissionsDto(string RoleName, List<Guid> PermissionIds);
public record SaveRolePermissionsRequest(string RoleName, List<Guid> PermissionIds);
