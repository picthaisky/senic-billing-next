namespace SenicBilling.Domain.Entities;

public class BillingInvoice
{
    public Guid Id { get; set; } = Guid.NewGuid();
    
    public Guid TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    
    /// <summary>เลขบิลเรียกเก็บเงิน (เช่น SAAS-2026-0001)</summary>
    public string InvoiceNumber { get; set; } = string.Empty;
    
    public decimal Amount { get; set; }
    
    public DateTime DueDate { get; set; }
    
    /// <summary>สถานะบิล (Pending, Paid, Failed)</summary>
    public string Status { get; set; } = "Pending";
    
    /// <summary>Charge ID จาก Payment Gateway (เช่น Omise)</summary>
    public string? PaymentGatewayRef { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
