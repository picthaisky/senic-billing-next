namespace SenicBilling.Domain.Entities;

public class TenantSubscription
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    
    public Guid PlanId { get; set; }
    public SubscriptionPlan Plan { get; set; } = null!;
    
    /// <summary>รอบบิล (Monthly/Yearly)</summary>
    public string BillingCycle { get; set; } = "Monthly";
    
    public DateTime StartDate { get; set; }
    public DateTime EndDate { get; set; }
    
    /// <summary>สถานะของรอบบิลนี้ (Active, Canceled, Expired)</summary>
    public string Status { get; set; } = "Active";
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
