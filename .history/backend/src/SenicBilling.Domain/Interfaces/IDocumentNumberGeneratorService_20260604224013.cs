using SenicBilling.Domain.Enums;

namespace SenicBilling.Domain.Interfaces;

/// <summary>
/// Service for generating unique, sequential document numbers under high concurrency.
/// Uses optimistic concurrency with retry logic to prevent duplicate numbers.
/// Format: {PREFIX}-{YYYYMM}-{NNNN} (e.g., INV-202606-0001)
/// </summary>
public interface IDocumentNumberGeneratorService
{
    /// <summary>
    /// Generates the next sequential document number for the specified tenant and document type.
    /// Thread-safe and concurrency-safe using optimistic locking with retries.
    /// </summary>
    /// <param name="tenantId">The tenant's unique identifier</param>
    /// <param name="documentType">The type of document (Receipt, CashBill, DeliveryNote, TaxInvoice, Quotation)</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Formatted document number string (e.g., "INV-202606-0001")</returns>
    Task<string> GenerateNextNumberAsync(Guid tenantId, DocumentType documentType, CancellationToken cancellationToken = default);
}
