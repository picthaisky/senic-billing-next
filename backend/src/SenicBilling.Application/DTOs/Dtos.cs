using SenicBilling.Domain.Enums;

namespace SenicBilling.Application.DTOs;

// ──────────────────────────────────────────────
// Standard API Response Wrapper
// ──────────────────────────────────────────────

public record ApiResponse<T>(bool Success, string Message, T? Data, IEnumerable<string>? Errors = null);

// ──────────────────────────────────────────────
// Authentication DTOs
// ──────────────────────────────────────────────

public record LoginRequest(string Username, string Password);

public record LoginResponse(string Token, string RefreshToken, DateTime ExpiresAt, UserInfo User);

public record UserInfo(Guid Id, string Username, string DisplayName, string Role, Guid TenantId, string TenantName);

public record RegisterRequest(string Username, string Password, string DisplayName, string? Email, string Role = "User");

// ──────────────────────────────────────────────
// ──────────────────────────────────────────────
// User & Tenant Profile DTOs
// ──────────────────────────────────────────────

public record TenantProfileDto(Guid Id, string CompanyName, string? TaxId, string? Address, string? Phone, string? Email, string? LogoUrl, string? BranchName, string? LineNotifyToken);

public record UpdateTenantProfileRequest(string CompanyName, string? TaxId, string? Address, string? Phone, string? Email, string? LogoUrl, string? BranchName, string? LineNotifyToken);

public record UserProfileDto(Guid Id, string Username, string DisplayName, string? Email, string Role);

public record UpdateProfileRequest(string DisplayName, string? Email);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

// ──────────────────────────────────────────────
// Document DTOs
// ──────────────────────────────────────────────

public record DocumentLineDto(
    Guid? Id,
    int SortOrder,
    Guid? ProductId,
    string Description,
    decimal Quantity,
    string Unit,
    decimal UnitPrice,
    decimal DiscountAmount,
    decimal LineTotal
);

public record CreateDocumentRequest(
    DocumentType DocumentType,
    DateTime DocumentDate,
    DateTime? DueDate,
    Guid? CustomerId,
    string? CustomerName,
    string? CustomerAddress,
    string? CustomerBranch,
    string? CustomerTaxId,
    VatCalculationMode VatMode,
    decimal VatRate,
    decimal DiscountAmount,
    decimal WhtRate,
    string? Notes,
    Guid? ReferenceDocumentId,
    string? DeliveryStatus,
    List<DocumentLineDto> Lines
);

public record UpdateDocumentRequest(
    DateTime DocumentDate,
    DateTime? DueDate,
    Guid? CustomerId,
    string? CustomerName,
    string? CustomerAddress,
    string? CustomerBranch,
    string? CustomerTaxId,
    VatCalculationMode VatMode,
    decimal VatRate,
    decimal DiscountAmount,
    decimal WhtRate,
    string? Notes,
    string? DeliveryStatus,
    List<DocumentLineDto> Lines
);

public record DocumentResponse(
    Guid Id,
    DocumentType DocumentType,
    string DocumentNumber,
    DateTime DocumentDate,
    DateTime? DueDate,
    Guid? CustomerId,
    string? CustomerName,
    string? CustomerAddress,
    string? CustomerBranch,
    string? CustomerTaxId,
    DocumentStatus Status,
    VatCalculationMode VatMode,
    decimal VatRate,
    decimal Subtotal,
    decimal DiscountAmount,
    decimal TotalBeforeVat,
    decimal VatAmount,
    decimal WhtRate,
    decimal WhtAmount,
    decimal GrandTotal,
    string? Notes,
    Guid? ReferenceDocumentId,
    Guid? ConvertedFromDocumentId,
    string? DeliveryStatus,
    string? CancellationReason,
    DateTime? SentAt,
    DateTime? ViewedAt,
    DateTime CreatedAt,
    string? CreatedBy,
    List<DocumentLineDto> Lines
);

public record CancelDocumentRequest(string Reason);

/// <summary>Request to convert one document type to another (1-Click Convert)</summary>
public record ConvertDocumentRequest(
    DocumentType TargetType,
    DateTime? DocumentDate,
    DateTime? DueDate,
    string? Notes
);

/// <summary>Request to create a Credit Note or Debit Note against a source document</summary>
public record CreateCreditDebitNoteRequest(
    DocumentType NoteType,
    Guid SourceDocumentId,
    DateTime DocumentDate,
    string Reason,
    decimal AdjustmentAmount,
    VatCalculationMode VatMode,
    decimal VatRate,
    decimal WhtRate,
    List<DocumentLineDto> Lines
);

// ──────────────────────────────────────────────
// Customer DTOs
// ──────────────────────────────────────────────

public record CustomerDto(
    Guid Id, string Name, string? TaxId, string? Branch, string? Address,
    string? Phone, string? Email, string? ContactPerson, string? Notes, bool IsActive
);

public record CreateCustomerRequest(
    string Name, string? TaxId, string? Branch, string? Address,
    string? Phone, string? Email, string? ContactPerson, string? Notes
);

public record UpdateCustomerRequest(
    string Name, string? TaxId, string? Branch, string? Address,
    string? Phone, string? Email, string? ContactPerson, string? Notes, bool IsActive
);

// ──────────────────────────────────────────────
// Product DTOs
// ──────────────────────────────────────────────

public record ProductDto(
    Guid Id, string? Sku, string? Barcode, string Name, string? Description,
    string Unit, decimal UnitPrice, string? Category, decimal? StockQuantity, bool IsActive
);

public record CreateProductRequest(
    string? Sku, string? Barcode, string Name, string? Description,
    string Unit, decimal UnitPrice, string? Category, decimal? StockQuantity
);

public record UpdateProductRequest(
    string? Sku, string? Barcode, string Name, string? Description,
    string Unit, decimal UnitPrice, string? Category, decimal? StockQuantity, bool IsActive
);

// ──────────────────────────────────────────────
// Dashboard DTOs
// ──────────────────────────────────────────────

public record DashboardSummary(
    decimal TotalRevenue,
    int DocumentsIssued,
    int PendingDocuments,
    decimal MonthlyGrowthPercent
);

public record MonthlyRevenueData(string Month, decimal GoodsValue, decimal VatAmount);

public record TopProductData(string ProductName, decimal TotalRevenue, decimal TotalQuantity);

public record RecentDocumentActivity(
    Guid Id, string DocumentNumber, DocumentType DocumentType,
    string? CustomerName, decimal GrandTotal, DateTime CreatedAt
);

// ──────────────────────────────────────────────
// Pagination
// ──────────────────────────────────────────────

public record PaginatedResponse<T>(IEnumerable<T> Items, int TotalCount, int Page, int PageSize);

// ──────────────────────────────────────────────
// Analytics & Reporting DTOs
// ──────────────────────────────────────────────

public record TaxEstimatorDto(
    int Year,
    int Month,
    decimal TotalSales,
    decimal TotalVatCollected,
    decimal TotalPurchases,
    decimal TotalVatPaid,
    decimal NetVatPayable
);

public record AgingReportDto(
    Guid CustomerId,
    string CustomerName,
    decimal Current,
    decimal Overdue1To30Days,
    decimal Overdue31To60Days,
    decimal Overdue61To90Days,
    decimal OverdueOver90Days,
    decimal TotalOverdue
);

public record CustomerPurchaseHistoryDto(
    Guid CustomerId,
    string CustomerName,
    int TotalOrders,
    decimal TotalSpent,
    DateTime? LastPurchaseDate,
    List<DocumentResponse> RecentDocuments
);
// ──────────────────────────────────────────────
// Automation DTOs
// ──────────────────────────────────────────────

public record RecurringInvoiceDto(
    Guid Id,
    Guid SourceDocumentId,
    string Frequency,
    DateTime NextRunDate,
    bool IsActive,
    int? MaxOccurrences,
    int CurrentOccurrence
);

public record CreateRecurringInvoiceRequest(
    Guid SourceDocumentId,
    string Frequency,
    DateTime NextRunDate,
    int? MaxOccurrences
);

public record UpdateRecurringInvoiceRequest(
    string Frequency,
    DateTime NextRunDate,
    bool IsActive,
    int? MaxOccurrences
);
