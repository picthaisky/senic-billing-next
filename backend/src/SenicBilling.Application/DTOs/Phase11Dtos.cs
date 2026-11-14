using SenicBilling.Domain.Enums;

namespace SenicBilling.Application.DTOs;

// ── Customer Online Approval & Payment Reminders ──
public record CustomerApproveDocumentRequest(
    string SignerName,
    string? SignatureText = null,
    string? Comment = null);

public record CustomerRejectDocumentRequest(
    string SignerName,
    string Reason);

public record DocumentApprovalResultDto(
    Guid DocumentId,
    string DocumentNumber,
    CustomerApprovalStatus ApprovalStatus,
    string? ApprovedByName,
    DateTime? ApprovedAt,
    string? Comment);

// ── Bank Statement Reconciliation ──
public record BankStatementTransactionDto(
    Guid Id,
    DateTime TransactionDate,
    string? BankName,
    string? AccountNumber,
    string? ReferenceNo,
    string Description,
    string? CounterpartyName,
    decimal DepositAmount,
    decimal WithdrawalAmount,
    decimal? Balance,
    BankMatchStatus MatchStatus,
    Guid? MatchedDocumentId,
    string? MatchedDocumentNumber,
    Guid? MatchedExpenseId,
    string? MatchedExpenseNumber,
    DateTime? MatchedAt,
    string? MatchedBy,
    Guid? SuggestedDocumentId = null,
    string? SuggestedDocumentNumber = null,
    string? SuggestedCustomerName = null,
    decimal? SuggestedDocumentAmount = null,
    Guid? SuggestedExpenseId = null,
    string? SuggestedExpenseNumber = null,
    string? SuggestedVendorName = null);

public record ImportBankStatementItemRequest(
    DateTime TransactionDate,
    string? BankName,
    string? AccountNumber,
    string? ReferenceNo,
    string Description,
    string? CounterpartyName,
    decimal DepositAmount,
    decimal WithdrawalAmount,
    decimal? Balance = null);

public record ImportBankStatementRequest(
    string? BankName = null,
    string? AccountNumber = null,
    string? CsvContent = null,
    List<ImportBankStatementItemRequest>? Transactions = null);

public record MatchBankTransactionRequest(
    Guid? DocumentId = null,
    Guid? ExpenseId = null);

public record BankReconciliationSummaryDto(
    int TotalTransactions,
    int MatchedCount,
    int SuggestedCount,
    int UnmatchedCount,
    decimal MatchedDepositsTotal,
    decimal UnmatchedDepositsTotal);

public record BankReconciliationCandidatesDto(
    List<ReconciliationDocumentCandidateDto> Documents,
    List<ReconciliationExpenseCandidateDto> Expenses);

public record ReconciliationDocumentCandidateDto(
    Guid Id,
    string DocumentNumber,
    DocumentType DocumentType,
    DateTime DocumentDate,
    DateTime? DueDate,
    string? CustomerName,
    decimal GrandTotal,
    decimal NetReceivable,
    DocumentStatus Status);

public record ReconciliationExpenseCandidateDto(
    Guid Id,
    string VoucherNumber,
    DateTime ExpenseDate,
    string VendorName,
    string Description,
    decimal NetPaidAmount,
    ExpenseStatus Status);

// ── Financial Statements & Period Lock ──
public record BalanceSheetDto(
    DateTime AsOfDate,
    decimal TotalAssets,
    decimal TotalLiabilities,
    decimal TotalEquity,
    decimal CurrentPeriodNetIncome,
    decimal TotalLiabilitiesAndEquity,
    bool IsBalanced,
    List<TrialBalanceRowDto> AssetAccounts,
    List<TrialBalanceRowDto> LiabilityAccounts,
    List<TrialBalanceRowDto> EquityAccounts);

public record CashFlowItemDto(
    string Label,
    decimal Amount,
    string Category);

public record CashFlowStatementDto(
    DateTime StartDate,
    DateTime EndDate,
    decimal OpeningCashBalance,
    decimal OperatingCashInflows,
    decimal OperatingCashOutflows,
    decimal FinancingOrOtherNet,
    decimal NetCashFlow,
    decimal EndingCashBalance,
    List<CashFlowItemDto> Breakdown);

public record ProductMarginDto(
    Guid? ProductId,
    string? Sku,
    string ProductName,
    decimal QuantitySold,
    decimal Revenue,
    decimal EstimatedCost,
    decimal GrossProfit,
    decimal MarginPercent);

public record StaffSalesSummaryDto(
    string StaffName,
    int DocumentCount,
    decimal TotalBeforeVat,
    decimal GrandTotal,
    decimal PaidTotal);

public record SalesMarginReportDto(
    DateTime StartDate,
    DateTime EndDate,
    decimal TotalRevenue,
    decimal TotalEstimatedCost,
    decimal TotalGrossProfit,
    decimal OverallMarginPercent,
    List<ProductMarginDto> ByProduct,
    List<StaffSalesSummaryDto> ByStaff);

public record AccountingPeriodDto(
    int Year,
    int Month,
    string PeriodLabel,
    bool IsLocked,
    DateTime? LockedAt,
    string? LockedBy,
    string? Notes,
    int JournalCount);

public record LockAccountingPeriodRequest(
    int Year,
    int Month,
    string? Notes = null);

