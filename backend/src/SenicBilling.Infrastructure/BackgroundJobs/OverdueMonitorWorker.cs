using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Enums;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.Infrastructure.BackgroundJobs;

public class OverdueMonitorWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<OverdueMonitorWorker> _logger;

    public OverdueMonitorWorker(IServiceProvider serviceProvider, ILogger<OverdueMonitorWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("OverdueMonitorWorker started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunOverdueCheckAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking overdue documents");
            }

            // Run once every 12 hours
            await Task.Delay(TimeSpan.FromHours(12), stoppingToken);
        }
    }

    public async Task<int> RunOverdueCheckAsync(CancellationToken stoppingToken = default)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<SenicBillingDbContext>();
        var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();
        var paymentService = scope.ServiceProvider.GetRequiredService<IPaymentService>();
        var lineNotify = scope.ServiceProvider.GetService<ILineNotifyService>();
        var configuration = scope.ServiceProvider.GetService<IConfiguration>();
        var frontendBaseUrl = (configuration?["App:FrontendBaseUrl"] ?? "http://localhost:5173").Trim().TrimEnd('/');

        var now = DateTime.UtcNow;
        var today = now.Date;
        var upcomingWindow = today.AddDays(3);
        var cooldownCutoff = now.AddHours(-24);

        var tenantLookup = await dbContext.Tenants
            .AsNoTracking()
            .ToDictionaryAsync(t => t.Id, stoppingToken);

        var candidateDocs = await dbContext.DocumentHeaders
            .Include(d => d.Customer)
            .Where(d =>
                (d.Status == DocumentStatus.Issued || d.Status == DocumentStatus.Sent || d.Status == DocumentStatus.Viewed || d.Status == DocumentStatus.Overdue) &&
                d.DueDate.HasValue &&
                d.DueDate.Value.Date <= upcomingWindow &&
                d.DocumentType != DocumentType.Quotation &&
                d.DocumentType != DocumentType.DeliveryNote &&
                d.DocumentType != DocumentType.Receipt &&
                d.DocumentType != DocumentType.CreditNote)
            .ToListAsync(stoppingToken);

        var anyChanged = false;
        var processedCount = 0;
        foreach (var doc in candidateDocs)
        {
            if (tenantLookup.TryGetValue(doc.TenantId, out var docTenant) &&
                (!docTenant.IsActive || string.Equals(docTenant.SubscriptionStatus, "Suspended", StringComparison.OrdinalIgnoreCase)))
            {
                continue;
            }

            var isPastDue = doc.DueDate!.Value.Date < today;
            if (isPastDue && doc.Status != DocumentStatus.Overdue)
            {
                doc.Status = DocumentStatus.Overdue;
                doc.UpdatedAt = now;
                anyChanged = true;
                _logger.LogInformation("Document {DocNumber} marked as Overdue.", doc.DocumentNumber);
            }

            if (doc.LastReminderSentAt.HasValue && doc.LastReminderSentAt.Value > cooldownCutoff)
            {
                continue;
            }

            var customerEmail = doc.Customer?.Email;
            if (!string.IsNullOrEmpty(customerEmail))
            {
                var link = await paymentService.CreatePaymentLinkAsync(
                    doc.GrandTotal,
                    $"Invoice {doc.DocumentNumber}",
                    $"Payment Reminder for {doc.CustomerName}",
                    doc.Id.ToString());

                if (string.IsNullOrEmpty(link))
                {
                    link = $"{frontendBaseUrl}/print/{doc.Id}";
                }

                await emailService.SendPaymentReminderAsync(
                    customerEmail,
                    doc.CustomerName ?? "Customer",
                    doc.DocumentNumber,
                    doc.GrandTotal,
                    doc.DueDate!.Value,
                    link,
                    stoppingToken);
            }

            if (lineNotify is not null &&
                tenantLookup.TryGetValue(doc.TenantId, out var tenant) &&
                tenant.HasAnyLineChannel())
            {
                var statusLabel = isPastDue ? "เกินกำหนดชำระแล้ว" : $"ครบกำหนดวันที่ {doc.DueDate:dd/MM/yyyy}";
                await lineNotify.NotifyTenantAsync(
                    tenant,
                    $"\nแจ้งเตือนวางบิล/ตามหนี้ ({statusLabel})\nเลขที่เอกสาร: {doc.DocumentNumber}\nลูกค้า: {doc.CustomerName ?? "-"}\nยอดรวม: {doc.GrandTotal:N2} บาท",
                    stoppingToken);
            }

            doc.LastReminderSentAt = now;
            anyChanged = true;
            processedCount++;
        }

        if (anyChanged)
        {
            await dbContext.SaveChangesAsync(stoppingToken);
        }

        return processedCount;
    }
}
