using Microsoft.EntityFrameworkCore;
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
                await CheckOverdueAndSendRemindersAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking overdue documents");
            }

            // Run once every 12 hours
            await Task.Delay(TimeSpan.FromHours(12), stoppingToken);
        }
    }

    private async Task CheckOverdueAndSendRemindersAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<SenicBillingDbContext>();
        var emailService = scope.ServiceProvider.GetRequiredService<IEmailService>();
        var paymentService = scope.ServiceProvider.GetRequiredService<IPaymentService>();

        var today = DateTime.UtcNow.Date;

        var documentsToCheck = await dbContext.DocumentHeaders
            .Include(d => d.Customer)
            .Where(d => 
                (d.Status == DocumentStatus.Issued || d.Status == DocumentStatus.Sent || d.Status == DocumentStatus.Viewed) &&
                d.DueDate.HasValue && 
                d.DueDate.Value.Date < today &&
                d.DocumentType != DocumentType.Quotation &&
                d.DocumentType != DocumentType.DeliveryNote &&
                d.DocumentType != DocumentType.Receipt)
            .ToListAsync(stoppingToken);

        foreach (var doc in documentsToCheck)
        {
            doc.Status = DocumentStatus.Overdue;
            doc.UpdatedAt = DateTime.UtcNow;

            _logger.LogInformation("Document {DocNumber} marked as Overdue.", doc.DocumentNumber);

            // Send Auto-Reminder if customer has email
            var customerEmail = doc.Customer?.Email;
            if (!string.IsNullOrEmpty(customerEmail))
            {
                // Create payment link dynamically for reminder
                var link = await paymentService.CreatePaymentLinkAsync(
                    doc.GrandTotal, 
                    $"Invoice {doc.DocumentNumber}", 
                    $"Overdue Payment for {doc.CustomerName}", 
                    doc.Id.ToString());

                if (string.IsNullOrEmpty(link))
                {
                    link = $"http://localhost:5173/payment/{doc.Id}"; // Fallback
                }

                await emailService.SendPaymentReminderAsync(
                    customerEmail,
                    doc.CustomerName ?? "Customer",
                    doc.DocumentNumber,
                    doc.GrandTotal,
                    doc.DueDate!.Value,
                    link,
                    stoppingToken
                );
            }
        }

        if (documentsToCheck.Any())
        {
            await dbContext.SaveChangesAsync(stoppingToken);
        }
    }
}
