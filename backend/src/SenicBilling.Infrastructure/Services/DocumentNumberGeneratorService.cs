using Microsoft.EntityFrameworkCore;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Domain.Interfaces;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.Infrastructure.Services;

/// <summary>
/// Generates unique, sequential document numbers under high concurrency.
/// Uses optimistic concurrency with retry logic on DbUpdateConcurrencyException.
/// Format: {PREFIX}-{YYYYMM}-{NNNN}
/// Prefixes: RCP (Receipt), CSB (CashBill), DLV (DeliveryNote), INV (TaxInvoice)
/// </summary>
public class DocumentNumberGeneratorService(SenicBillingDbContext dbContext) : IDocumentNumberGeneratorService
{
    private const int MaxRetries = 5;

    private static readonly Dictionary<DocumentType, string> Prefixes = new()
    {
        [DocumentType.Receipt] = "RCP",
        [DocumentType.CashBill] = "CSB",
        [DocumentType.DeliveryNote] = "DLV",
        [DocumentType.TaxInvoice] = "INV"
    };

    public async Task<string> GenerateNextNumberAsync(
        Guid tenantId,
        DocumentType documentType,
        CancellationToken cancellationToken = default)
    {
        var yearMonth = DateTime.UtcNow.ToString("yyyyMM");
        var prefix = Prefixes[documentType];

        for (int attempt = 0; attempt < MaxRetries; attempt++)
        {
            try
            {
                // Try to find existing sequence
                var sequence = await dbContext.DocumentNumberSequences
                    .FirstOrDefaultAsync(s =>
                        s.TenantId == tenantId &&
                        s.DocumentType == documentType &&
                        s.YearMonth == yearMonth,
                        cancellationToken);

                if (sequence is null)
                {
                    // Create new sequence for this tenant/type/month
                    sequence = new DocumentNumberSequence
                    {
                        Id = Guid.NewGuid(),
                        TenantId = tenantId,
                        DocumentType = documentType,
                        YearMonth = yearMonth,
                        LastNumber = 1
                    };
                    dbContext.DocumentNumberSequences.Add(sequence);
                }
                else
                {
                    // Increment the counter
                    sequence.LastNumber++;
                }

                await dbContext.SaveChangesAsync(cancellationToken);

                // Format: INV-202606-0001
                return $"{prefix}-{yearMonth}-{sequence.LastNumber:D4}";
            }
            catch (DbUpdateConcurrencyException) when (attempt < MaxRetries - 1)
            {
                // Another request incremented the counter simultaneously.
                // Detach the conflicting entity and retry with fresh data.
                foreach (var entry in dbContext.ChangeTracker.Entries())
                {
                    entry.State = EntityState.Detached;
                }
            }
        }

        throw new InvalidOperationException(
            $"Failed to generate document number after {MaxRetries} retries. " +
            $"TenantId: {tenantId}, DocumentType: {documentType}");
    }
}
