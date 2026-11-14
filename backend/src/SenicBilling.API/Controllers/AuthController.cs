using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SenicBilling.API.Extensions;
using SenicBilling.API.Services;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Auth;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly SenicBillingDbContext dbContext;
    private readonly JwtTokenService jwtTokenService;
    private readonly IEmailService? _emailService;
    private readonly IConfiguration? _configuration;
    private readonly IAccountingService? _accountingService;

    public AuthController(SenicBillingDbContext dbContext, JwtTokenService jwtTokenService)
        : this(dbContext, jwtTokenService, null, null, null)
    {
    }

    [ActivatorUtilitiesConstructor]
    public AuthController(
        SenicBillingDbContext dbContext,
        JwtTokenService jwtTokenService,
        IEmailService? emailService,
        IConfiguration? configuration,
        IAccountingService? accountingService)
    {
        this.dbContext = dbContext;
        this.jwtTokenService = jwtTokenService;
        _emailService = emailService;
        _configuration = configuration;
        _accountingService = accountingService;
    }
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

    /// <summary>Self-service tenant organization signup creating Tenant, Admin User, Default Warehouse, and COA</summary>
    [HttpPost("signup-tenant")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<LoginResponse>>> SignupTenant(
        [FromBody] SignupTenantRequest request, CancellationToken ct)
    {
        var result = await TenantOnboardingHelper.ProvisionTenantAsync(
            dbContext,
            _accountingService,
            request.CompanyName,
            request.TaxId,
            request.Email,
            request.Phone,
            request.Address,
            request.BranchName,
            request.Username,
            request.Password,
            request.DisplayName,
            request.PlanId,
            auditActor: request.Username.Trim(),
            auditAction: "SelfServiceSignupTenant",
            auditTenantId: null,
            ct: ct);

        if (!result.Success || result.Tenant is null || result.AdminUser is null)
            return BadRequest(new ApiResponse<LoginResponse>(false, result.Message, null));

        var user = result.AdminUser;
        var tenant = result.Tenant;
        var token = jwtTokenService.GenerateToken(user, tenant.CompanyName);
        var refreshToken = jwtTokenService.GenerateRefreshToken();
        var expiresAt = DateTime.UtcNow.AddHours(8);

        var response = new LoginResponse(
            token,
            refreshToken,
            expiresAt,
            new UserInfo(
                user.Id,
                user.Username,
                user.DisplayName,
                user.Role,
                user.TenantId,
                tenant.CompanyName,
                ClaimsPrincipalExtensions.IsPlatformAdminUser(user.Role, user.TenantId)));

        return Ok(new ApiResponse<LoginResponse>(true, "สมัครเปิดใช้งานองค์กรสำเร็จ", response));
    }

    /// <summary>Request a password reset email link with 30-minute expiring single-use token</summary>
    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<object>>> ForgotPassword(
        [FromBody] ForgotPasswordRequest request, CancellationToken ct)
    {
        var identifier = (request.EmailOrUsername ?? request.Email ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(identifier))
            return BadRequest(new ApiResponse<object>(false, "กรุณาระบุชื่อผู้ใช้หรืออีเมล", null));

        var lower = identifier.ToLowerInvariant();
        var user = await dbContext.AppUsers
            .IgnoreQueryFilters()
            .Include(u => u.Tenant)
            .FirstOrDefaultAsync(
                u => u.IsActive &&
                     ((u.Email != null && u.Email.ToLower() == lower) || u.Username.ToLower() == lower),
                ct);

        if (user is not null && !string.IsNullOrWhiteSpace(user.Email ?? user.Tenant?.Email))
        {
            var rawTokenBytes = RandomNumberGenerator.GetBytes(32);
            var rawToken = Convert.ToBase64String(rawTokenBytes)
                .Replace("+", "-")
                .Replace("/", "_")
                .TrimEnd('=');

            user.PasswordResetTokenHash = ComputeSha256Hex(rawToken);
            user.PasswordResetTokenExpiresAt = DateTime.UtcNow.AddMinutes(30);
            await dbContext.SaveChangesAsync(ct);

            var recipient = !string.IsNullOrWhiteSpace(user.Email) ? user.Email : user.Tenant!.Email!;
            var baseUrl = (_configuration?["App:FrontendBaseUrl"] ?? "http://localhost:5173").Trim().TrimEnd('/');
            var resetUrl = $"{baseUrl}/login?resetToken={Uri.EscapeDataString(rawToken)}";

            if (_emailService is not null)
            {
                try
                {
                    await _emailService.SendEmailAsync(
                        recipient,
                        "คำขอตั้งรหัสผ่านใหม่ — Senic Billing Next",
                        $"""
                        <p>สวัสดีคุณ {System.Net.WebUtility.HtmlEncode(user.DisplayName)},</p>
                        <p>คุณได้ส่งคำขอตั้งรหัสผ่านใหม่สำหรับบัญชี <strong>{System.Net.WebUtility.HtmlEncode(user.Username)}</strong></p>
                        <p><a href="{resetUrl}" style="display:inline-block;padding:10px 20px;background:#f97316;color:#fff;border-radius:8px;text-decoration:none;font-weight:bold;">ตั้งรหัสผ่านใหม่</a></p>
                        <p>หรือคัดลอกลิงก์: {resetUrl}</p>
                        <p><small>ลิงก์นี้จะหมดอายุภายใน 30 นาที</small></p>
                        """,
                        ct);
                }
                catch
                {
                    // Do not leak email transport status externally
                }
            }
        }

        return Ok(new ApiResponse<object>(
            true,
            "หากพบบัญชีผู้ใช้ในระบบ ระบบได้ส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลที่ลงทะเบียนไว้แล้ว",
            null));
    }

    /// <summary>Verify single-use password reset token and update password hash</summary>
    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<object>>> ResetPassword(
        [FromBody] ResetPasswordRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            return BadRequest(new ApiResponse<object>(false, "Token ไม่ถูกต้องหรือหมดอายุแล้ว", null));

        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
            return BadRequest(new ApiResponse<object>(false, "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร", null));

        var incomingHash = ComputeSha256Hex(request.Token.Trim());
        var now = DateTime.UtcNow;

        var user = await dbContext.AppUsers
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(
                u => u.PasswordResetTokenHash == incomingHash &&
                     u.PasswordResetTokenExpiresAt.HasValue &&
                     u.PasswordResetTokenExpiresAt.Value > now &&
                     u.IsActive,
                ct);

        if (user is null ||
            user.PasswordResetTokenHash is null ||
            !CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(user.PasswordResetTokenHash),
                Encoding.UTF8.GetBytes(incomingHash)))
        {
            return BadRequest(new ApiResponse<object>(false, "ลิงก์ตั้งรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว", null));
        }

        user.PasswordHash = HashPassword(request.NewPassword);
        user.PasswordResetTokenHash = null;
        user.PasswordResetTokenExpiresAt = null;

        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = user.TenantId,
            Username = user.Username,
            Action = "ResetPassword",
            EntityName = "AppUser",
            EntityId = user.Id.ToString(),
            Timestamp = now
        });

        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<object>(true, "ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่", null));
    }

    private static string ComputeSha256Hex(string input) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(input)));

    private Guid GetTenantId()
    {
        var claim = User.FindFirst("tenantId")?.Value;
        return claim is not null ? Guid.Parse(claim) : throw new UnauthorizedAccessException("Tenant claim not found");
    }

    private static string HashPassword(string password) =>
        PasswordHasher.HashPassword(password);
}

public record SignupTenantRequest(
    string CompanyName,
    string Username,
    string Password,
    string? DisplayName = null,
    string? TaxId = null,
    string? Email = null,
    string? Phone = null,
    string? Address = null,
    string? BranchName = null,
    Guid? PlanId = null);

public record ForgotPasswordRequest(string? EmailOrUsername = null, string? Email = null);

public record ResetPasswordRequest(string Token, string NewPassword);
