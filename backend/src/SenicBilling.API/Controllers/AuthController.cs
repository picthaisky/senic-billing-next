using System.Security.Cryptography;
using System.Text;
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

        if (user is null || !PasswordHasher.VerifyPassword(request.Password, user.PasswordHash, out var needsUpgrade))
        {
            return Unauthorized(new ApiResponse<LoginResponse>(false, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง", null));
        }

        var isPlatformAdmin = user.Role is "SuperAdmin" or "SystemAdmin";
        if (!isPlatformAdmin && user.Tenant is not null &&
            (!user.Tenant.IsActive || string.Equals(user.Tenant.SubscriptionStatus, "Suspended", StringComparison.OrdinalIgnoreCase)))
        {
            return StatusCode(StatusCodes.Status403Forbidden,
                new ApiResponse<LoginResponse>(false, "บัญชีองค์กรถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ", null));
        }

        if (needsUpgrade)
        {
            user.PasswordHash = PasswordHasher.HashPassword(request.Password);
        }

        user.LastLoginAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);

        var tenantName = user.Tenant?.CompanyName ?? string.Empty;
        var token = jwtTokenService.GenerateToken(user, tenantName);
        var refreshToken = jwtTokenService.GenerateRefreshToken();

        var response = new LoginResponse(
            Token: token,
            RefreshToken: refreshToken,
            ExpiresAt: DateTime.UtcNow.AddHours(8),
            User: new UserInfo(
                user.Id,
                user.Username,
                user.DisplayName,
                user.Role,
                user.TenantId,
                tenantName,
                ClaimsPrincipalExtensions.IsPlatformAdminUser(user.Role, user.TenantId))
        );

        return Ok(new ApiResponse<LoginResponse>(true, "เข้าสู่ระบบสำเร็จ", response));
    }

    [HttpPost("demo-login")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<LoginResponse>>> DemoLogin(CancellationToken ct)
    {
        var user = await dbContext.AppUsers
            .Include(u => u.Tenant)
            .Where(u =>
                u.TenantId == ClaimsPrincipalExtensions.PlatformOwnerTenantId &&
                u.IsActive &&
                (u.Role == "Admin" || u.Role == "SystemAdmin" || u.Role == "SuperAdmin"))
            .OrderByDescending(u => u.Username == "admin")
            .FirstOrDefaultAsync(ct);

        if (user is null)
            return NotFound(new ApiResponse<LoginResponse>(false, "ไม่พบบัญชีตัวอย่างที่ใช้งานได้ในระบบ", null));

        if (user.Tenant is null || !user.Tenant.IsActive || string.Equals(user.Tenant.SubscriptionStatus, "Suspended", StringComparison.OrdinalIgnoreCase))
            return StatusCode(StatusCodes.Status403Forbidden, new ApiResponse<LoginResponse>(false, "บัญชีองค์กรตัวอย่างถูกระงับการใช้งานชั่วคราว", null));

        var tenantName = user.Tenant?.CompanyName ?? string.Empty;
        var token = jwtTokenService.GenerateToken(user, tenantName);
        var refreshToken = jwtTokenService.GenerateRefreshToken();

        var response = new LoginResponse(
            Token: token,
            RefreshToken: refreshToken,
            ExpiresAt: DateTime.UtcNow.AddHours(8),
            User: new UserInfo(
                user.Id,
                user.Username,
                user.DisplayName,
                user.Role,
                user.TenantId,
                tenantName,
                ClaimsPrincipalExtensions.IsPlatformAdminUser(user.Role, user.TenantId))
        );

        return Ok(new ApiResponse<LoginResponse>(true, "เข้าสู่ระบบตัวอย่างสำเร็จ", response));
    }

    /// <summary>Register a new user (Admin only)</summary>
    [HttpPost("register")]
    [Authorize(Roles = "Admin,SystemAdmin,SuperAdmin")]
    public async Task<ActionResult<ApiResponse<UserInfo>>> Register(
        [FromBody] RegisterRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();

        var tenant = await dbContext.Tenants
            .Include(t => t.CurrentPlan)
            .FirstOrDefaultAsync(t => t.Id == tenantId, ct);

        if (tenant?.CurrentPlan != null && tenant.CurrentPlan.MaxUsers > 0)
        {
            var activeUsersCount = await dbContext.AppUsers
                .CountAsync(u => u.TenantId == tenantId && u.IsActive, ct);

            if (activeUsersCount >= tenant.CurrentPlan.MaxUsers)
            {
                return BadRequest(new ApiResponse<UserInfo>(
                    false,
                    $"จำนวนผู้ใช้งานครบโควต้าของแพ็กเกจ {tenant.CurrentPlan.Name} ({tenant.CurrentPlan.MaxUsers} บัญชี) กรุณาอัปเกรดแพ็กเกจ",
                    null));
            }
        }

        var existingUser = await dbContext.AppUsers
            .AnyAsync(u => u.TenantId == tenantId && u.Username == request.Username, ct);

        if (existingUser)
        {
            return Conflict(new ApiResponse<UserInfo>(false, "ชื่อผู้ใช้นี้มีในระบบแล้ว", null));
        }

        var user = new AppUser
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Username = request.Username,
            DisplayName = request.DisplayName,
            Email = request.Email,
            PasswordHash = HashPassword(request.Password),
            Role = string.IsNullOrWhiteSpace(request.Role) ? "User" : request.Role
        };

        dbContext.AppUsers.Add(user);
        await dbContext.SaveChangesAsync(ct);

        var info = new UserInfo(
            user.Id,
            user.Username,
            user.DisplayName,
            user.Role,
            tenantId,
            tenant?.CompanyName ?? "",
            ClaimsPrincipalExtensions.IsPlatformAdminUser(user.Role, tenantId));
        return CreatedAtAction(nameof(Register), new ApiResponse<UserInfo>(true, "สร้างผู้ใช้สำเร็จ", info));
    }

    /// <summary>Return current authenticated user identity from verified JWT and database</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<ApiResponse<UserInfo>>> GetCurrentUser(CancellationToken ct)
    {
        var userId = User.TryGetUserId();
        if (!userId.HasValue)
            return Unauthorized(new ApiResponse<UserInfo>(false, "Token ไม่ถูกต้อง", null));

        var user = await dbContext.AppUsers
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(u => u.Id == userId.Value && u.IsActive, ct);

        if (user is null)
            return Unauthorized(new ApiResponse<UserInfo>(false, "ไม่พบผู้ใช้งาน", null));

        var info = new UserInfo(
            user.Id,
            user.Username,
            user.DisplayName,
            user.Role,
            user.TenantId,
            user.Tenant?.CompanyName ?? string.Empty,
            ClaimsPrincipalExtensions.IsPlatformAdminUser(user.Role, user.TenantId));
        return Ok(new ApiResponse<UserInfo>(true, "สำเร็จ", info));
    }

    private Guid GetTenantId()
    {
        var claim = User.FindFirst("tenantId")?.Value;
        return claim is not null ? Guid.Parse(claim) : throw new UnauthorizedAccessException("Tenant claim not found");
    }

    private static string HashPassword(string password) =>
        PasswordHasher.HashPassword(password);
}
