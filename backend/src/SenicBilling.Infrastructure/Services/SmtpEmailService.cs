using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using SenicBilling.Application.Interfaces;

namespace SenicBilling.Infrastructure.Services;

public class SmtpEmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(IConfiguration configuration, ILogger<SmtpEmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendEmailAsync(string to, string subject, string body, CancellationToken ct = default)
    {
        try
        {
            var host = _configuration["SmtpSettings:Host"];
            var portString = _configuration["SmtpSettings:Port"];
            var username = _configuration["SmtpSettings:Username"];
            var password = _configuration["SmtpSettings:Password"];
            var fromName = _configuration["SmtpSettings:FromName"] ?? "Senic Billing";
            var fromEmail = _configuration["SmtpSettings:FromEmail"];

            if (string.IsNullOrEmpty(host) || string.IsNullOrEmpty(username) || string.IsNullOrEmpty(password) || string.IsNullOrEmpty(fromEmail))
            {
                _logger.LogWarning("SMTP Settings are missing. Cannot send email.");
                return;
            }

            int.TryParse(portString, out int port);
            if (port == 0) port = 587;

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(fromName, fromEmail));
            message.To.Add(new MailboxAddress("", to));
            message.Subject = subject;

            message.Body = new TextPart("plain")
            {
                Text = body
            };

            using var client = new SmtpClient();
            await client.ConnectAsync(host, port, SecureSocketOptions.StartTls, ct);
            await client.AuthenticateAsync(username, password, ct);
            await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);

            _logger.LogInformation("EMAIL SENT to {To}: [{Subject}]", to, subject);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {To}", to);
            throw;
        }
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
