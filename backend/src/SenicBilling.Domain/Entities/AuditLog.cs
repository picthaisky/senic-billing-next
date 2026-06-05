namespace SenicBilling.Domain.Entities;

public class AuditLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    /// <summary>ชื่อผู้ใช้งานที่ทำการแก้ไข</summary>
    public string Username { get; set; } = string.Empty;

    /// <summary>ประเภทของการกระทำ: Create, Update, Delete</summary>
    public string Action { get; set; } = string.Empty;

    /// <summary>ชื่อ Table หรือ Entity ที่ถูกแก้ไข</summary>
    public string EntityName { get; set; } = string.Empty;

    /// <summary>Primary Key ของแถวที่ถูกแก้ไข</summary>
    public string EntityId { get; set; } = string.Empty;

    /// <summary>ข้อมูลก่อนการแก้ไข (JSON)</summary>
    public string? OldValues { get; set; }

    /// <summary>ข้อมูลหลังการแก้ไข (JSON)</summary>
    public string? NewValues { get; set; }

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    // Navigation
    public Tenant Tenant { get; set; } = null!;
}
