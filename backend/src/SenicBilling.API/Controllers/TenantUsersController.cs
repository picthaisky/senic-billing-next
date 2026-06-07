using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Data;
using System.Security.Cryptography;
using System.Text;

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

    private Guid GetTenantId()
    {
        var claim = User.FindFirst("tenantId")?.Value;
        return claim is not null ? Guid.Parse(claim) : throw new UnauthorizedAccessException("Tenant claim not found");
    }

    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetUsers(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var users = await _dbContext.AppUsers
            .Where(u => u.TenantId == tenantId && u.IsActive)
            .Select(u => new UserProfileDto(u.Id, u.Username, u.DisplayName, u.Email, u.Role))
            .ToListAsync(ct);

        return Ok(new ApiResponse<List<UserProfileDto>>(true, "สำเร็จ", users));
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> InviteUser([FromBody] RegisterRequest req, CancellationToken ct)
    {
        var tenantId = GetTenantId();

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
            Role = req.Role
        };

        _dbContext.AppUsers.Add(user);
        await _dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<UserProfileDto>(true, "เพิ่มผู้ใช้สำเร็จ", 
            new UserProfileDto(user.Id, user.Username, user.DisplayName, user.Email, user.Role)));
    }

    [HttpPut("{id}/role")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateRole(Guid id, [FromBody] UpdateRoleRequest req, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var user = await _dbContext.AppUsers.FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId, ct);
        
        if (user == null) return NotFound("User not found");
        
        user.Role = req.Role;
        await _dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<object>(true, "อัปเดตสิทธิ์สำเร็จ", null));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteUser(Guid id, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var user = await _dbContext.AppUsers.FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId, ct);
        
        if (user == null) return NotFound("User not found");

        // Soft delete
        user.IsActive = false;
        await _dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<object>(true, "ลบผู้ใช้สำเร็จ", null));
    }

    private static string HashPassword(string password)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(password));
        return Convert.ToBase64String(hash);
    }
}

public class UpdateRoleRequest
{
    public string Role { get; set; } = string.Empty;
}
