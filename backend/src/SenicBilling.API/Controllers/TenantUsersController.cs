using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.API.Extensions;
using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Auth;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/tenant-users")]
[Authorize]
public class TenantUsersController : ControllerBase
{
    private readonly SenicBillingDbContext _dbContext;

    public TenantUsersController(SenicBillingDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    private static bool IsReservedPlatformRole(string? role) =>
        string.Equals(role?.Trim(), "SuperAdmin", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(role?.Trim(), "SystemAdmin", StringComparison.OrdinalIgnoreCase);

    private Guid GetTenantId() => User.GetTenantId();

    [HttpGet]
    [Authorize(Roles = "Admin,SystemAdmin,SuperAdmin")]
    public async Task<IActionResult> GetUsers(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var users = await _dbContext.AppUsers
            .Where(u => u.TenantId == tenantId && u.IsActive)
            .Select(u => new UserProfileDto(u.Id, u.Username, u.DisplayName, u.Email, u.Role, u.IsActive))
            .ToListAsync(ct);

        return Ok(new ApiResponse<List<UserProfileDto>>(true, "สำเร็จ", users));
    }

    [HttpPost]
    [Authorize(Roles = "Admin,SystemAdmin,SuperAdmin")]
    public async Task<IActionResult> InviteUser([FromBody] RegisterRequest req, CancellationToken ct)
    {
        var tenantId = GetTenantId();

        if (IsReservedPlatformRole(req.Role) && !User.IsPlatformAdmin())
        {
            return Forbid();
        }

        var tenant = await _dbContext.Tenants
            .Include(t => t.CurrentPlan)
            .FirstOrDefaultAsync(t => t.Id == tenantId, ct);

        if (tenant?.CurrentPlan != null && tenant.CurrentPlan.MaxUsers > 0)
        {
            var activeUsersCount = await _dbContext.AppUsers
                .CountAsync(u => u.TenantId == tenantId && u.IsActive, ct);

            if (activeUsersCount >= tenant.CurrentPlan.MaxUsers)
            {
                return BadRequest(new ApiResponse<object>(
                    false,
                    $"จำนวนผู้ใช้งานครบโควต้าของแพ็กเกจ {tenant.CurrentPlan.Name} ({tenant.CurrentPlan.MaxUsers} บัญชี) กรุณาอัปเกรดแพ็กเกจ",
                    null));
            }
        }

        var existingUser = await _dbContext.AppUsers
            .AnyAsync(u => u.TenantId == tenantId && u.Username == req.Username, ct);

        if (existingUser)
            return Conflict(new ApiResponse<object>(false, "ชื่อผู้ใช้นี้มีในระบบแล้ว", null));

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Username = req.Username,
            DisplayName = req.DisplayName,
            Email = req.Email,
            PasswordHash = HashPassword(req.Password),
            Role = string.IsNullOrWhiteSpace(req.Role) ? "User" : req.Role.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _dbContext.AppUsers.Add(user);
        await _dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<UserProfileDto>(true, "เพิ่มผู้ใช้สำเร็จ", 
            new UserProfileDto(user.Id, user.Username, user.DisplayName, user.Email, user.Role, user.IsActive)));
    }

    [HttpPut("{id}/role")]
    [Authorize(Roles = "Admin,SystemAdmin,SuperAdmin")]
    public async Task<IActionResult> UpdateRole(Guid id, [FromBody] UpdateRoleRequest req, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var user = await _dbContext.AppUsers.FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId, ct);
        
        if (user == null) return NotFound("User not found");

        if (IsReservedPlatformRole(req.Role) && !User.IsPlatformAdmin())
        {
            return Forbid();
        }
        
        user.Role = string.IsNullOrWhiteSpace(req.Role) ? user.Role : req.Role.Trim();
        await _dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<object>(true, "อัปเดตสิทธิ์สำเร็จ", null));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin,SystemAdmin,SuperAdmin")]
    public async Task<IActionResult> DeleteUser(Guid id, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var user = await _dbContext.AppUsers.FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId, ct);
        
        if (user == null) return NotFound("User not found");

        var callerId = User.TryGetUserId();
        if (callerId.HasValue && callerId.Value == user.Id)
            return BadRequest(new ApiResponse<object>(false, "ไม่สามารถระงับการใช้งานบัญชีของตนเองได้", null));

        // Soft delete
        user.IsActive = false;
        await _dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<object>(true, "ลบผู้ใช้สำเร็จ", null));
    }

    private static string HashPassword(string password) =>
        PasswordHasher.HashPassword(password);
}

public class UpdateRoleRequest
{
    public string Role { get; set; } = string.Empty;
}
