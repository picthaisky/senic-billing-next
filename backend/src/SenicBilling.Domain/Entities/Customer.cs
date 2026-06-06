namespace SenicBilling.Domain.Entities;

/// <summary>
/// Customer master data — stores client/buyer information for document generation.
/// Supports both individual (บุคคลธรรมดา) and corporate (นิติบุคคล) customers.
/// </summary>
public class Customer
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }

    /// <summary>ชื่อลูกค้า/บริษัท</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>เลขประจำตัวผู้เสียภาษี (13 หลัก) - required for Tax Invoice</summary>
    public string? TaxId { get; set; }

    /// <summary>ที่อยู่</summary>
    public string? Address { get; set; }

    /// <summary>เบอร์โทรศัพท์</summary>
    public string? Phone { get; set; }

    /// <summary>สาขา</summary>
    public string? Branch { get; set; }

    /// <summary>อีเมล</summary>
    public string? Email { get; set; }

    /// <summary>ชื่อผู้ติดต่อ</summary>
    public string? ContactPerson { get; set; }

    /// <summary>หมายเหตุภายใน</summary>
    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation properties
    public Tenant Tenant { get; set; } = null!;
    public ICollection<DocumentHeader> Documents { get; set; } = [];
}
