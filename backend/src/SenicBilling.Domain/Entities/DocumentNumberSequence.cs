using SenicBilling.Domain.Enums;

namespace SenicBilling.Domain.Entities;

/// <summary>
/// Tracks the last used sequential number for document generation per tenant/type/month.
/// Uses optimistic concurrency (RowVersion) to prevent race conditions under high concurrency.
/// Unique constraint on (TenantId, DocumentType, YearMonth) ensures one sequence per combination.
/// </summary>
public class DocumentNumberSequence
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }

    /// <summary>ประเภทเอกสาร</summary>
    public DocumentType DocumentType { get; set; }

    /// <summary>ปี-เดือน (format: "YYYYMM", e.g. "202606")</summary>
    public string YearMonth { get; set; } = string.Empty;

    /// <summary>เลขลำดับล่าสุดที่ใช้ไปแล้ว</summary>
    public int LastNumber { get; set; }

    /// <summary>Concurrency token for optimistic locking — prevents race conditions</summary>
    public uint RowVersion { get; set; }

    // Navigation
    public Tenant Tenant { get; set; } = null!;
}
