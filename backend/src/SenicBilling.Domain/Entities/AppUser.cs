namespace SenicBilling.Domain.Entities;

/// <summary>
/// Application user for JWT authentication.
/// Users belong to a Tenant for row-level data isolation.
/// </summary>
public class AppUser
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }

    /// <summary>ชื่อผู้ใช้งาน</summary>
    public string Username { get; set; } = string.Empty;

    /// <summary>ชื่อที่แสดง</summary>
    public string DisplayName { get; set; } = string.Empty;

    /// <summary>อีเมล</summary>
    public string? Email { get; set; }

    /// <summary>BCrypt hashed password</summary>
    public string PasswordHash { get; set; } = string.Empty;

    /// <summary>บทบาท: Admin, User, Viewer</summary>
    public string Role { get; set; } = "User";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLoginAt { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation
    public Tenant Tenant { get; set; } = null!;
}
