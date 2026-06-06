using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "Admin,SystemAdmin")]
public class AdminUsersController(SenicBillingDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<UserProfileDto>>>> GetUsers(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var users = await dbContext.AppUsers
            .Where(u => u.TenantId == tenantId)
            .OrderByDescending(u => u.CreatedAt)
            .ToListAsync(ct);

        var dtos = users.Select(u => new UserProfileDto(u.Id, u.Username, u.DisplayName, u.Email, u.Role)).ToList();
        
        return Ok(new ApiResponse<List<UserProfileDto>>(true, "สำเร็จ", dtos));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<UserProfileDto>>> CreateUser([FromBody] CreateUserRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();

        if (await dbContext.AppUsers.AnyAsync(u => u.TenantId == tenantId && u.Username == request.Username, ct))
        {
            return BadRequest(new ApiResponse<UserProfileDto>(false, "ชื่อผู้ใช้งานนี้มีอยู่ในระบบแล้ว", null));
        }

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Username = request.Username,
            DisplayName = request.DisplayName ?? request.Username,
            Email = request.Email,
            PasswordHash = HashPassword(request.Password),
            Role = string.IsNullOrWhiteSpace(request.Role) ? "User" : request.Role,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        dbContext.AppUsers.Add(user);
        await dbContext.SaveChangesAsync(ct);

        var dto = new UserProfileDto(user.Id, user.Username, user.DisplayName, user.Email, user.Role);
        return Ok(new ApiResponse<UserProfileDto>(true, "สร้างผู้ใช้งานสำเร็จ", dto));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<UserProfileDto>>> UpdateUser(Guid id, [FromBody] UpdateUserRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var user = await dbContext.AppUsers.FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId, ct);
        
        if (user is null)
            return NotFound(new ApiResponse<UserProfileDto>(false, "ไม่พบผู้ใช้งาน", null));

        user.DisplayName = request.DisplayName ?? user.DisplayName;
        user.Email = request.Email ?? user.Email;
        if (!string.IsNullOrWhiteSpace(request.Role))
        {
            user.Role = request.Role;
        }

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            user.PasswordHash = HashPassword(request.Password);
        }

        await dbContext.SaveChangesAsync(ct);

        var dto = new UserProfileDto(user.Id, user.Username, user.DisplayName, user.Email, user.Role);
        return Ok(new ApiResponse<UserProfileDto>(true, "อัปเดตผู้ใช้งานสำเร็จ", dto));
    }

    [HttpPut("{id:guid}/status")]
    public async Task<ActionResult<ApiResponse<bool>>> ToggleUserStatus(Guid id, [FromBody] ToggleStatusRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var user = await dbContext.AppUsers.FirstOrDefaultAsync(u => u.Id == id && u.TenantId == tenantId, ct);
        
        if (user is null)
            return NotFound(new ApiResponse<bool>(false, "ไม่พบผู้ใช้งาน", false));

        // Prevent admin from disabling themselves
        var currentUserId = GetUserId();
        if (user.Id == currentUserId && !request.IsActive)
        {
            return BadRequest(new ApiResponse<bool>(false, "ไม่สามารถระงับการใช้งานบัญชีของตนเองได้", false));
        }

        user.IsActive = request.IsActive;
        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<bool>(true, "อัปเดตสถานะสำเร็จ", true));
    }

    private Guid GetTenantId()
    {
        var claim = User.FindFirst("tenantId")?.Value;
        return claim is not null ? Guid.Parse(claim) : throw new UnauthorizedAccessException("Tenant ID claim not found");
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirst("userId")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return claim is not null ? Guid.Parse(claim) : Guid.Empty;
    }

    private static string HashPassword(string password)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(password));
        return Convert.ToBase64String(hash);
    }
}

public record CreateUserRequest(string Username, string? DisplayName, string? Email, string Password, string Role);
public record UpdateUserRequest(string? DisplayName, string? Email, string? Password, string? Role);
public record ToggleStatusRequest(bool IsActive);
