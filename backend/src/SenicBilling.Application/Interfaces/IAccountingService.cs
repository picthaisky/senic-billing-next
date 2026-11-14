using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;

namespace SenicBilling.Application.Interfaces;

public interface IAccountingService
{
    Task EnsureDefaultChartOfAccountsAsync(Guid tenantId, CancellationToken ct = default);
    Task<JournalEntry?> PostSalesDocumentAsync(DocumentHeader document, string? createdBy = null, CancellationToken ct = default);
    Task<JournalEntry?> PostPaymentAsync(DocumentHeader document, decimal amountPaid, string? createdBy = null, CancellationToken ct = default);
    Task<JournalEntry?> PostExpenseAsync(ExpenseRecord expense, string? createdBy = null, CancellationToken ct = default);
    Task<JournalEntry?> ReverseSourceEntriesAsync(
        Guid tenantId,
        JournalSourceType sourceType,
        Guid sourceId,
        string? reason = null,
        string? createdBy = null,
        CancellationToken ct = default);
    Task<bool> IsPeriodLockedAsync(Guid tenantId, DateTime date, CancellationToken ct = default);
    Task EnsurePeriodUnlockedAsync(Guid tenantId, DateTime date, CancellationToken ct = default);
}

