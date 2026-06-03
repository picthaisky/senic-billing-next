namespace SenicBilling.Application.Interfaces;

public interface IPaymentService
{
    Task<(string ChargeId, string QrCodeUrl)> CreatePromptPayChargeAsync(decimal amount, string referenceId, string returnUrl = "");
    Task<bool> VerifyChargeAsync(string chargeId);
}
