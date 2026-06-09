namespace SenicBilling.Application.Interfaces;

public interface IPaymentService
{
    Task<(string ChargeId, string QrCodeUrl)> CreatePromptPayChargeAsync(decimal amount, string referenceId, string returnUrl = "");
    Task<string> CreatePaymentLinkAsync(decimal amount, string title, string description, string referenceId);
    Task<bool> VerifyChargeAsync(string chargeId);
    
    // SaaS Subscription Methods
    Task<string> CreateCustomerAsync(string email, string description, string cardToken);
    Task<string> CreateCardChargeAsync(decimal amount, string customerId, string referenceId);
}
