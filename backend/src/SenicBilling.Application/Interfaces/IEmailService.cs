namespace SenicBilling.Application.Interfaces;

public interface IEmailService
{
    Task SendEmailAsync(string to, string subject, string body, CancellationToken ct = default);
    Task SendDocumentLinkAsync(string to, string customerName, string documentNumber, string link, CancellationToken ct = default);
    Task SendPaymentReminderAsync(string to, string customerName, string documentNumber, decimal amount, DateTime dueDate, string paymentLink, CancellationToken ct = default);
}
