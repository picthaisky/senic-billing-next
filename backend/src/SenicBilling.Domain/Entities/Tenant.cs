namespace SenicBilling.Domain.Entities;

/// <summary>
/// Represents a tenant (organization/company) in the multi-tenant SaaS system.
/// All business data is isolated by TenantId.
/// </summary>
public class Tenant
{
    public Guid Id { get; set; }

    /// <summary>ชื่อบริษัท/ร้านค้า</summary>
    public string CompanyName { get; set; } = string.Empty;

    /// <summary>เลขประจำตัวผู้เสียภาษี 13 หลัก</summary>
    public string? TaxId { get; set; }

    /// <summary>ที่อยู่บริษัท</summary>
    public string? Address { get; set; }

    /// <summary>เบอร์โทรศัพท์</summary>
    public string? Phone { get; set; }

    /// <summary>อีเมลบริษัท</summary>
    public string? Email { get; set; }

    /// <summary>URL ของโลโก้บริษัท (Cloud Storage)</summary>
    public string? LogoUrl { get; set; }

    /// <summary>สาขา (e.g., "สำนักงานใหญ่", "สาขาที่ 1")</summary>
    public string? BranchName { get; set; }

    // Notifications
    public string? LineNotifyToken { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation properties
    public ICollection<Customer> Customers { get; set; } = [];
    public ICollection<Product> Products { get; set; } = [];
    public ICollection<DocumentHeader> Documents { get; set; } = [];
    public ICollection<AppUser> Users { get; set; } = [];
    public ICollection<DocumentNumberSequence> NumberSequences { get; set; } = [];

    // Subscription & Package
    public Guid? CurrentPlanId { get; set; }
    public SubscriptionPlan? CurrentPlan { get; set; }
    
    /// <summary>สถานะปัจจุบัน (Trial, Active, PastDue, Suspended)</summary>
    public string SubscriptionStatus { get; set; } = "Trial";
    
    /// <summary>วันที่รอบบิลปัจจุบันหมดอายุ</summary>
    public DateTime? SubscriptionValidUntil { get; set; }
    
    public ICollection<TenantSubscription> Subscriptions { get; set; } = [];
    public ICollection<BillingInvoice> BillingInvoices { get; set; } = [];
    public ICollection<TenantUsageStat> UsageStats { get; set; } = [];
}
