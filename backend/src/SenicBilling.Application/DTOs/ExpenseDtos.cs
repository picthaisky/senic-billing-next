using SenicBilling.Domain.Enums;

namespace SenicBilling.Application.DTOs;

// ──────────────────────────────────────────────
// Expense Voucher / Input VAT / WHT DTOs (Phase 9)
// ──────────────────────────────────────────────

public record ExpenseResponse(
    Guid Id,
    string VoucherNumber,
    DateTime ExpenseDate,
    string? TaxInvoiceNumber,
    DateTime? TaxInvoiceDate,
    string VendorName,
    string? VendorTaxId,
    string? VendorBranch,
    string? VendorAddress,
    ExpenseCategory Category,
    string Description,
    VatCalculationMode VatMode,
    decimal Subtotal,
    decimal DiscountAmount,
    decimal TotalBeforeVat,
    decimal VatRate,
    decimal VatAmount,
    decimal GrandTotal,
    bool IsRefundableVat,
    decimal WhtRate,
    decimal WhtAmount,
    PndType PndType,
    string? IncomeTypeDescription,
    decimal NetPaidAmount,
    ExpenseStatus Status,
    string? AttachmentUrl,
    string? Notes,
    string? CancellationReason,
    DateTime CreatedAt
);

public record CreateExpenseRequest(
    DateTime ExpenseDate,
    string VendorName,
    string Description,
    decimal Amount,
    string? TaxInvoiceNumber = null,
    DateTime? TaxInvoiceDate = null,
    string? VendorTaxId = null,
    string? VendorBranch = null,
    string? VendorAddress = null,
    ExpenseCategory Category = ExpenseCategory.Other,
    VatCalculationMode VatMode = VatCalculationMode.Exclusive,
    decimal DiscountAmount = 0m,
    decimal VatRate = 7m,
    bool IsRefundableVat = true,
    decimal WhtRate = 0m,
    PndType PndType = PndType.None,
    string? IncomeTypeDescription = null,
    ExpenseStatus Status = ExpenseStatus.Approved,
    string? AttachmentUrl = null,
    string? Notes = null
);

public record CancelExpenseRequest(string? Reason);

public record ExpenseSummaryDto(
    int Count,
    decimal TotalBeforeVat,
    decimal TotalInputVat,
    decimal TotalRefundableInputVat,
    decimal TotalWht,
    decimal TotalPnd3Wht,
    decimal TotalPnd53Wht,
    decimal TotalGrandTotal,
    decimal TotalNetPaid
);

public record ExpenseListResponse(
    IEnumerable<ExpenseResponse> Items,
    ExpenseSummaryDto Summary
);

/// <summary>ผลลัพธ์จาก AI Smart Receipt Parser</summary>
public record ParsedExpenseDto(
    string? VendorName,
    string? VendorTaxId,
    string? VendorBranch,
    string? TaxInvoiceNumber,
    DateTime? TaxInvoiceDate,
    decimal? TotalBeforeVat,
    decimal? VatAmount,
    decimal? GrandTotal,
    ExpenseCategory? SuggestedCategory,
    decimal? SuggestedWhtRate,
    PndType? SuggestedPndType,
    string? Description,
    bool UsedAi
);

public record ParseExpenseRequest(string Text);

/// <summary>Pure calculation result for an expense</summary>
public record ExpenseAmounts(
    decimal Subtotal,
    decimal DiscountAmount,
    decimal TotalBeforeVat,
    decimal VatAmount,
    decimal GrandTotal,
    decimal WhtAmount,
    decimal NetPaidAmount
);

