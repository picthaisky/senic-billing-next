namespace SenicBilling.Domain.Entities;

public class RecurringInvoice
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    /// <summary>เอกสารต้นฉบับที่จะใช้เป็น Template ในการสร้างเอกสารใหม่</summary>
    public Guid SourceDocumentId { get; set; }

    /// <summary>ความถี่ในการออกเอกสาร (Daily, Weekly, Monthly, Yearly)</summary>
    public string Frequency { get; set; } = "Monthly";

    /// <summary>วันที่เริ่มออกเอกสารรอบถัดไป</summary>
    public DateTime NextRunDate { get; set; }

    /// <summary>สถานะการทำงาน</summary>
    public bool IsActive { get; set; } = true;

    /// <summary>จำนวนครั้งสูงสุดที่จะออก (ถ้ามี), null = ออกไปเรื่อยๆ</summary>
    public int? MaxOccurrences { get; set; }

    /// <summary>จำนวนครั้งที่ออกไปแล้ว</summary>
    public int CurrentOccurrence { get; set; } = 0;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    public Tenant Tenant { get; set; } = null!;
    public DocumentHeader SourceDocument { get; set; } = null!;
}
