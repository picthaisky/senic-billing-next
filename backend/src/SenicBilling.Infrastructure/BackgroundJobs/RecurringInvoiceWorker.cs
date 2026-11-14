using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.Infrastructure.BackgroundJobs;

public class RecurringInvoiceWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<RecurringInvoiceWorker> _logger;

    public RecurringInvoiceWorker(IServiceProvider serviceProvider, ILogger<RecurringInvoiceWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("RecurringInvoiceWorker started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessDueRecurringInvoicesAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing recurring invoices");
            }

            // Run once a day at a specific time, or sleep for an hour. For demo, we sleep 1 hour.
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);
        }
    }

    public async Task<int> ProcessDueRecurringInvoicesAsync(CancellationToken stoppingToken = default)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<SenicBillingDbContext>();
        var docNumberService = scope.ServiceProvider.GetService<IDocumentNumberGeneratorService>();
        
        var today = DateTime.UtcNow.Date;
        var generatedCount = 0;

        var dueInvoices = await dbContext.RecurringInvoices
            .Include(r => r.SourceDocument)
            .ThenInclude(d => d.Lines)
            .Where(r => r.IsActive && r.NextRunDate.Date <= today)
            .ToListAsync(stoppingToken);

        var tenantLookup = await dbContext.Tenants
            .AsNoTracking()
            .Include(t => t.CurrentPlan)
            .ToDictionaryAsync(t => t.Id, stoppingToken);

        var startOfMonth = new DateTime(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var currentMonthDocCounts = new Dictionary<Guid, int>();

        foreach (var recurring in dueInvoices)
        {
            if (recurring.MaxOccurrences.HasValue && recurring.CurrentOccurrence >= recurring.MaxOccurrences.Value)
            {
                recurring.IsActive = false;
                continue;
            }

            if (recurring.SourceDocument is null || recurring.SourceDocument.Status == DocumentStatus.Cancelled)
            {
                recurring.IsActive = false;
                continue;
            }

            if (tenantLookup.TryGetValue(recurring.TenantId, out var tenant))
            {
                if (!tenant.IsActive || string.Equals(tenant.SubscriptionStatus, "Suspended", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogInformation("Skipping recurring invoice {RecurringId} because Tenant {TenantId} is suspended/inactive.", recurring.Id, recurring.TenantId);
                    continue;
                }

                if (tenant.CurrentPlan is { MaxDocumentsPerMonth: > 0 } plan)
                {
                    if (!currentMonthDocCounts.TryGetValue(recurring.TenantId, out var currentCount))
                    {
                        currentCount = await dbContext.DocumentHeaders
                            .CountAsync(
                                d => d.TenantId == recurring.TenantId &&
                                     d.CreatedAt >= startOfMonth &&
                                     d.Status != DocumentStatus.Cancelled,
                                stoppingToken);
                        currentMonthDocCounts[recurring.TenantId] = currentCount;
                    }

                    if (currentCount >= plan.MaxDocumentsPerMonth)
                    {
                        _logger.LogInformation(
                            "Skipping recurring invoice {RecurringId} for Tenant {TenantId}: monthly document quota reached ({Current}/{Max}).",
                            recurring.Id,
                            recurring.TenantId,
                            currentCount,
                            plan.MaxDocumentsPerMonth);
                        continue;
                    }

                    currentMonthDocCounts[recurring.TenantId] = currentCount + 1;
                }
            }

            var source = recurring.SourceDocument;

            var generatedDocNumber = docNumberService is not null
                ? await docNumberService.GenerateNextNumberAsync(recurring.TenantId, source.DocumentType, stoppingToken)
                : $"REC-{source.DocumentNumber}-{recurring.CurrentOccurrence + 1}";
            
            // Create new document (Draft)
            var newDoc = new DocumentHeader
            {
                Id = Guid.NewGuid(),
                TenantId = recurring.TenantId,
                DocumentType = source.DocumentType,
                DocumentNumber = generatedDocNumber,
                DocumentDate = DateTime.UtcNow,
                DueDate = DateTime.UtcNow.AddDays(30), // Default 30 days term
                CustomerId = source.CustomerId,
                CustomerName = source.CustomerName,
                CustomerAddress = source.CustomerAddress,
                CustomerTaxId = source.CustomerTaxId,
                Status = DocumentStatus.Draft,
                VatMode = source.VatMode,
                VatRate = source.VatRate,
                Subtotal = source.Subtotal,
                DiscountAmount = source.DiscountAmount,
                TotalBeforeVat = source.TotalBeforeVat,
                VatAmount = source.VatAmount,
                WhtRate = source.WhtRate,
                WhtAmount = source.WhtAmount,
                GrandTotal = source.GrandTotal,
                Notes = source.Notes,
                CreatedBy = "System_Recurring"
            };

            foreach (var line in source.Lines)
            {
                newDoc.Lines.Add(new DocumentLine
                {
                    Id = Guid.NewGuid(),
                    DocumentHeaderId = newDoc.Id,
                    SortOrder = line.SortOrder,
                    ProductId = line.ProductId,
                    Description = line.Description,
                    Quantity = line.Quantity,
                    Unit = line.Unit,
                    UnitPrice = line.UnitPrice,
                    DiscountAmount = line.DiscountAmount,
                    LineTotal = line.LineTotal
                });
            }

            dbContext.DocumentHeaders.Add(newDoc);
            generatedCount++;

            var yearMonth = DateTime.UtcNow.ToString("yyyy-MM");
            var usageStat = dbContext.TenantUsageStats.Local
                .FirstOrDefault(u => u.TenantId == recurring.TenantId && u.YearMonth == yearMonth)
                ?? await dbContext.TenantUsageStats
                    .FirstOrDefaultAsync(u => u.TenantId == recurring.TenantId && u.YearMonth == yearMonth, stoppingToken);
            if (usageStat is null)
            {
                dbContext.TenantUsageStats.Add(new TenantUsageStat
                {
                    TenantId = recurring.TenantId,
                    YearMonth = yearMonth,
                    DocumentsCreated = 1
                });
            }
            else
            {
                usageStat.DocumentsCreated += 1;
            }

            // Update recurring metadata
            recurring.CurrentOccurrence++;
            recurring.UpdatedAt = DateTime.UtcNow;

            switch (recurring.Frequency.ToLower())
            {
                case "daily": recurring.NextRunDate = recurring.NextRunDate.AddDays(1); break;
                case "weekly": recurring.NextRunDate = recurring.NextRunDate.AddDays(7); break;
                case "monthly": recurring.NextRunDate = recurring.NextRunDate.AddMonths(1); break;
                case "yearly": recurring.NextRunDate = recurring.NextRunDate.AddYears(1); break;
                default: recurring.NextRunDate = recurring.NextRunDate.AddMonths(1); break;
            }

            if (recurring.MaxOccurrences.HasValue && recurring.CurrentOccurrence >= recurring.MaxOccurrences.Value)
            {
                recurring.IsActive = false;
            }

            _logger.LogInformation("Generated recurring invoice {DocNumber} for Tenant {TenantId}", newDoc.DocumentNumber, newDoc.TenantId);
        }

        if (dueInvoices.Any())
        {
            await dbContext.SaveChangesAsync(stoppingToken);
        }

        return generatedCount;
    }
}
