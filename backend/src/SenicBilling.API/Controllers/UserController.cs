using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UserController(SenicBillingDbContext dbContext) : ControllerBase
{
    /// <summary>Get current user profile</summary>
    [HttpGet("profile")]
    public async Task<ActionResult<ApiResponse<UserProfileDto>>> GetProfile(CancellationToken ct)
    {
        var userId = GetUserId();
        var user = await dbContext.AppUsers.FindAsync([userId], ct);
        
        if (user is null || !user.IsActive)
        {
            return NotFound(new ApiResponse<UserProfileDto>(false, "ไม่พบข้อมูลผู้ใช้งาน", null));
        }

        var profile = new UserProfileDto(user.Id, user.Username, user.DisplayName, user.Email, user.Role);
        return Ok(new ApiResponse<UserProfileDto>(true, "ดึงข้อมูลสำเร็จ", profile));
    }

    /// <summary>Update current user profile</summary>
    [HttpPut("profile")]
    public async Task<ActionResult<ApiResponse<UserProfileDto>>> UpdateProfile(
        [FromBody] UpdateProfileRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        var user = await dbContext.AppUsers.FindAsync([userId], ct);
        
        if (user is null || !user.IsActive)
        {
            return NotFound(new ApiResponse<UserProfileDto>(false, "ไม่พบข้อมูลผู้ใช้งาน", null));
        }

        user.DisplayName = request.DisplayName;
        user.Email = request.Email;

        await dbContext.SaveChangesAsync(ct);

        var profile = new UserProfileDto(user.Id, user.Username, user.DisplayName, user.Email, user.Role);
        return Ok(new ApiResponse<UserProfileDto>(true, "อัปเดตข้อมูลสำเร็จ", profile));
    }

    /// <summary>Change password for current user</summary>
    [HttpPut("change-password")]
    public async Task<ActionResult<ApiResponse<string>>> ChangePassword(
        [FromBody] ChangePasswordRequest request, CancellationToken ct)
    {
        var userId = GetUserId();
        var user = await dbContext.AppUsers.FindAsync([userId], ct);
        
        if (user is null || !user.IsActive)
        {
            return NotFound(new ApiResponse<string>(false, "ไม่พบข้อมูลผู้ใช้งาน", null));
        }

        if (!VerifyPassword(request.CurrentPassword, user.PasswordHash))
        {
            return BadRequest(new ApiResponse<string>(false, "รหัสผ่านปัจจุบันไม่ถูกต้อง", null));
        }

        user.PasswordHash = HashPassword(request.NewPassword);

        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<string>(true, "เปลี่ยนรหัสผ่านสำเร็จ", null));
    }

    private Guid GetUserId()
    {
        var claim = User.FindFirst("userId")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return claim is not null ? Guid.Parse(claim) : throw new UnauthorizedAccessException("User ID claim not found");
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
