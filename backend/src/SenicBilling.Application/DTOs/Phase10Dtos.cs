using SenicBilling.Domain.Enums;

namespace SenicBilling.Application.DTOs;

// ── Vendor Master ──
public record VendorDto(
    Guid Id, string Name, string? TaxId, string? Branch, string? Address,
    string? Phone, string? Email, string? ContactPerson, int PaymentTermsDays,
    decimal DefaultWhtRate, PndType DefaultPndType, string? Notes, bool IsActive, DateTime CreatedAt);

public record UpsertVendorRequest(
    string Name, string? TaxId = null, string? Branch = "00000", string? Address = null,
    string? Phone = null, string? Email = null, string? ContactPerson = null,
    int PaymentTermsDays = 30, decimal DefaultWhtRate = 0m,
    PndType DefaultPndType = PndType.None, string? Notes = null, bool IsActive = true);

// ── Purchase Order ──
public record PurchaseOrderLineDto(
    Guid Id, int SortOrder, Guid? ProductId, string Description, string Unit,
    decimal Quantity, decimal ReceivedQuantity, decimal UnitPrice, decimal DiscountAmount, decimal LineTotal);

public record PurchaseOrderDto(
    Guid Id, string PoNumber, DateTime OrderDate, DateTime? ExpectedDeliveryDate,
    Guid? VendorId, string VendorName, string? VendorTaxId, string? VendorBranch, string? VendorAddress,
    Guid? WarehouseId, string? WarehouseName,
    VatCalculationMode VatMode, decimal Subtotal, decimal DiscountAmount, decimal TotalBeforeVat,
    decimal VatRate, decimal VatAmount, decimal GrandTotal, PurchaseOrderStatus Status,
    string? Notes, DateTime? ReceivedAt, Guid? LinkedExpenseId, DateTime CreatedAt,
    List<PurchaseOrderLineDto> Lines);

public record CreatePurchaseOrderLineRequest(
    Guid? ProductId, string Description, string Unit, decimal Quantity, decimal UnitPrice, decimal DiscountAmount = 0m);

public record CreatePurchaseOrderRequest(
    DateTime OrderDate,
    DateTime? ExpectedDeliveryDate,
    Guid? VendorId,
    string VendorName,
    string? VendorTaxId,
    string? VendorBranch,
    string? VendorAddress,
    Guid? WarehouseId,
    VatCalculationMode VatMode,
    decimal DiscountAmount,
    decimal VatRate,
    string? Notes,
    List<CreatePurchaseOrderLineRequest> Lines);

public record ReceivePurchaseOrderLineRequest(Guid LineId, decimal ReceiveQuantity);

public record ReceivePurchaseOrderRequest(
    Guid? WarehouseId = null,
    bool CreateExpenseRecord = true,
    string? VendorTaxInvoiceNumber = null,
    DateTime? VendorTaxInvoiceDate = null,
    List<ReceivePurchaseOrderLineRequest>? Lines = null,
    decimal? WhtRate = null,
    PndType? PndType = null,
    string? IncomeTypeDescription = null);

// ── Multi-Warehouse & Stock Ledger ──
public record WarehouseDto(
    Guid Id, string Code, string Name, string? Address, bool IsDefault, bool IsActive,
    int ProductCount, decimal TotalUnits);

public record UpsertWarehouseRequest(string Code, string Name, string? Address = null, bool IsDefault = false, bool IsActive = true);

public record WarehouseStockItemDto(
    Guid ProductId, string? Sku, string ProductName, string Unit,
    Guid WarehouseId, string WarehouseCode, string WarehouseName,
    decimal Quantity, decimal ReorderLevel, bool IsLowStock);

public record TransferStockRequest(
    Guid ProductId, Guid FromWarehouseId, Guid ToWarehouseId, decimal Quantity, string? Notes = null);

public record AdjustStockRequest(
    Guid ProductId, Guid WarehouseId, decimal NewQuantity, decimal? ReorderLevel = null, string? Notes = null);

public record StockMovementDto(
    Guid Id, Guid ProductId, string ProductName, Guid WarehouseId, string WarehouseName,
    StockMovementType MovementType, decimal QuantityDelta, decimal BalanceAfter,
    string? ReferenceNumber, string? Notes, string? CreatedBy, DateTime CreatedAt);

// ── Auto-Accounting & Financial Statements ──
public record ChartOfAccountDto(Guid Id, string Code, string Name, AccountType AccountType, bool IsSystem, bool IsActive);

public record JournalEntryLineDto(Guid Id, Guid AccountId, string AccountCode, string AccountName, decimal Debit, decimal Credit, string? Memo);

public record JournalEntryDto(
    Guid Id, string JournalNumber, DateTime EntryDate, string Description,
    JournalSourceType SourceType, Guid? SourceId, string? SourceNumber, bool IsPosted,
    DateTime CreatedAt, List<JournalEntryLineDto> Lines);

public record CreateJournalLineRequest(Guid AccountId, decimal Debit, decimal Credit, string? Memo = null);

public record CreateJournalEntryRequest(DateTime EntryDate, string Description, List<CreateJournalLineRequest> Lines);

public record TrialBalanceRowDto(
    Guid AccountId, string AccountCode, string AccountName, AccountType AccountType,
    decimal TotalDebit, decimal TotalCredit, decimal NetBalance);

public record TrialBalanceDto(
    decimal TotalDebit, decimal TotalCredit, bool IsBalanced, List<TrialBalanceRowDto> Rows);

public record ProfitLossDto(
    DateTime StartDate, DateTime EndDate,
    decimal TotalRevenue, decimal TotalExpense, decimal NetProfit,
    List<TrialBalanceRowDto> RevenueAccounts, List<TrialBalanceRowDto> ExpenseAccounts);

