namespace SenicBilling.Domain.Entities;

public class TenantUsageStat
{
    public Guid TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    
    /// <summary>เดือนปีเกิด (เช่น 2026-06)</summary>
    public string YearMonth { get; set; } = string.Empty;
    
    /// <summary>จำนวนเอกสารที่สร้างไปแล้วในเดือนนี้</summary>
    public int DocumentsCreated { get; set; }
    
    /// <summary>พื้นที่ไฟล์ที่ใช้ไป (Bytes)</summary>
    public long StorageUsedBytes { get; set; }
}
