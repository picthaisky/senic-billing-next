using SenicBilling.Domain.Enums;

namespace SenicBilling.Domain.Entities;

/// <summary>รายการเดินบัญชีธนาคารสำหรับกระทบยอดอัตโนมัติ (Bank Statement Reconciliation)</summary>
public class BankStatementTransaction
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }

    public DateTime TransactionDate { get; set; }
    public string? BankName { get; set; }
    public string? AccountNumber { get; set; }
    public string? ReferenceNo { get; set; }
    public string Description { get; set; } = string.Empty;
    public string? CounterpartyName { get; set; }

    public decimal DepositAmount { get; set; }
    public decimal WithdrawalAmount { get; set; }
    public decimal? Balance { get; set; }

    public BankMatchStatus MatchStatus { get; set; } = BankMatchStatus.Unmatched;
    public Guid? MatchedDocumentId { get; set; }
    public string? MatchedDocumentNumber { get; set; }
    public Guid? MatchedExpenseId { get; set; }
    public string? MatchedExpenseNumber { get; set; }

    public DateTime? MatchedAt { get; set; }
    public string? MatchedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Tenant Tenant { get; set; } = null!;
}

