namespace SenicBilling.Domain.Entities;

public class PaymentTransaction
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;

    public Guid DocumentId { get; set; }
    public DocumentHeader Document { get; set; } = null!;

    public decimal Amount { get; set; }
    public string Currency { get; set; } = "THB";

    /// <summary>
    /// เช่น promptpay, credit_card, truemoney
    /// </summary>
    public string PaymentMethod { get; set; } = string.Empty;

    /// <summary>
    /// ID ของ Charge หรือ Transaction จาก Payment Gateway (เช่น Omise charge_id)
    /// </summary>
    public string GatewayReference { get; set; } = string.Empty;

    /// <summary>
    /// URL ของ PromptPay QR Code (ถ้ามี)
    /// </summary>
    public string? QrCodeUrl { get; set; }

    /// <summary>
    /// pending, successful, failed
    /// </summary>
    public string Status { get; set; } = "pending";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }
}
