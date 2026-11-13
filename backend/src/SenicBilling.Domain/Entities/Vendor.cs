using SenicBilling.Domain.Enums;

namespace SenicBilling.Domain.Entities;

/// <summary>ทะเบียนผู้ขาย / ซัพพลายเออร์ (Vendor Master)</summary>
public class Vendor
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? TaxId { get; set; }
    public string? Branch { get; set; } = "00000";
    public string? Address { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? ContactPerson { get; set; }
    public int PaymentTermsDays { get; set; } = 30;
    public decimal DefaultWhtRate { get; set; }
    public PndType DefaultPndType { get; set; } = PndType.None;
    public string? Notes { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public Tenant Tenant { get; set; } = null!;
}

