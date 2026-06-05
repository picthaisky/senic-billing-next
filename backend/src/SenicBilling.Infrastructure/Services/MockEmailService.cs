using Microsoft.Extensions.Logging;
using SenicBilling.Application.Interfaces;

namespace SenicBilling.Infrastructure.Services;

/// <summary>
/// Mock email service that logs emails to the console.
/// In production, replace with SmtpEmailService or SendGridEmailService.
/// </summary>
public class MockEmailService(ILogger<MockEmailService> logger) : IEmailService
{
    public Task SendEmailAsync(string to, string subject, string body, CancellationToken ct = default)
    {
        logger.LogInformation("EMAIL SENT to {To}: [{Subject}] {Body}", to, subject, body);
        return Task.CompletedTask;
    }

    public Task SendDocumentLinkAsync(string to, string customerName, string documentNumber, string link, CancellationToken ct = default)
    {
        var subject = $"เอกสารใหม่จาก Senic Billing: {documentNumber}";
        var body = $"เรียนคุณ {customerName},\n\nสามารถเปิดดูเอกสาร {documentNumber} ได้ที่ลิงก์นี้: {link}\n\nขอบคุณครับ";
        return SendEmailAsync(to, subject, body, ct);
    }

    public Task SendPaymentReminderAsync(string to, string customerName, string documentNumber, decimal amount, DateTime dueDate, string paymentLink, CancellationToken ct = default)
    {
        var subject = $"แจ้งเตือนการชำระเงิน: {documentNumber}";
        var body = $"เรียนคุณ {customerName},\n\nเอกสาร {documentNumber} ยอด {amount:N2} บาท จะครบกำหนดชำระในวันที่ {dueDate:dd/MM/yyyy}\n\nสามารถชำระผ่านลิงก์นี้: {paymentLink}\n\nขอบคุณครับ";
        return SendEmailAsync(to, subject, body, ct);
    }
}
