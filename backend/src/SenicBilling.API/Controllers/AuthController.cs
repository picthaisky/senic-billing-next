using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Auth;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(SenicBillingDbContext dbContext, JwtTokenService jwtTokenService) : ControllerBase
{
    /// <summary>Login and receive JWT token</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<LoginResponse>>> Login(
        [FromBody] LoginRequest request, CancellationToken ct)
    {
        var user = await dbContext.AppUsers
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.Username == request.Username && u.IsActive, ct);

        if (user is null || !VerifyPassword(request.Password, user.PasswordHash))
        {
            return Unauthorized(new ApiResponse<LoginResponse>(false, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", null));
        }

        user.LastLoginAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);

        var token = jwtTokenService.GenerateToken(user, user.Tenant.CompanyName);
        var refreshToken = jwtTokenService.GenerateRefreshToken();

        var response = new LoginResponse(
            Token: token,
            RefreshToken: refreshToken,
            ExpiresAt: DateTime.UtcNow.AddHours(8),
            User: new UserInfo(user.Id, user.Username, user.DisplayName, user.Role, user.TenantId, user.Tenant.CompanyName)
        );

        return Ok(new ApiResponse<LoginResponse>(true, "เข้าสู่ระบบสำเร็จ", response));
    }

    /// <summary>Register a new user (Admin only)</summary>
    [HttpPost("register")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<ApiResponse<UserInfo>>> Register(
        [FromBody] RegisterRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();

        var existingUser = await dbContext.AppUsers
            .AnyAsync(u => u.TenantId == tenantId && u.Username == request.Username, ct);

        if (existingUser)
        {
            return Conflict(new ApiResponse<UserInfo>(false, "ชื่อผู้ใช้นี้มีในระบบแล้ว", null));
        }

        var tenant = await dbContext.Tenants.FindAsync([tenantId], ct);

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Username = request.Username,
            DisplayName = request.DisplayName,
            Email = request.Email,
            PasswordHash = HashPassword(request.Password),
            Role = request.Role
        };

        dbContext.AppUsers.Add(user);
        await dbContext.SaveChangesAsync(ct);

        var info = new UserInfo(user.Id, user.Username, user.DisplayName, user.Role, tenantId, tenant?.CompanyName ?? "");
        return CreatedAtAction(nameof(Register), new ApiResponse<UserInfo>(true, "สร้างผู้ใช้สำเร็จ", info));
    }

    private Guid GetTenantId()
    {
        var claim = User.FindFirst("tenantId")?.Value;
        return claim is not null ? Guid.Parse(claim) : throw new UnauthorizedAccessException("Tenant claim not found");
    }

    private static string HashPassword(string password)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(password));
        return Convert.ToBase64String(hash);
    }

    private static bool VerifyPassword(string password, string storedHash)
    {
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes(password));
        return Convert.ToBase64String(hash) == storedHash;
    }
}
