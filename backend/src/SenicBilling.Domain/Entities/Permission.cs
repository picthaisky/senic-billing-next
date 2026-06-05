namespace SenicBilling.Domain.Entities;

public class Permission
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>ชื่อสิทธิ์ (e.g., Documents.Create, Reports.View)</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>คำอธิบาย</summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>หมวดหมู่ (e.g., Documents, Customers, Settings)</summary>
    public string Category { get; set; } = string.Empty;
}
