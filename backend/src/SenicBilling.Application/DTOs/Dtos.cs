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
    string? CustomerTaxId,
    VatCalculationMode VatMode,
    decimal VatRate,
    decimal DiscountAmount,
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
    string? CustomerTaxId,
    VatCalculationMode VatMode,
    decimal VatRate,
    decimal DiscountAmount,
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
    string? CustomerTaxId,
    DocumentStatus Status,
    VatCalculationMode VatMode,
    decimal VatRate,
    decimal Subtotal,
    decimal DiscountAmount,
    decimal TotalBeforeVat,
    decimal VatAmount,
    decimal GrandTotal,
    string? Notes,
    Guid? ReferenceDocumentId,
    string? DeliveryStatus,
    string? CancellationReason,
    DateTime CreatedAt,
    string? CreatedBy,
    List<DocumentLineDto> Lines
);

public record CancelDocumentRequest(string Reason);

// ──────────────────────────────────────────────
// Customer DTOs
// ──────────────────────────────────────────────

public record CustomerDto(
    Guid Id, string Name, string? TaxId, string? Address,
    string? Phone, string? Email, string? ContactPerson, string? Notes, bool IsActive
);

public record CreateCustomerRequest(
    string Name, string? TaxId, string? Address,
    string? Phone, string? Email, string? ContactPerson, string? Notes
);

public record UpdateCustomerRequest(
    string Name, string? TaxId, string? Address,
    string? Phone, string? Email, string? ContactPerson, string? Notes, bool IsActive
);

// ──────────────────────────────────────────────
// Product DTOs
// ──────────────────────────────────────────────

public record ProductDto(
    Guid Id, string? Sku, string Name, string? Description,
    string Unit, decimal UnitPrice, string? Category, decimal? StockQuantity, bool IsActive
);

public record CreateProductRequest(
    string? Sku, string Name, string? Description,
    string Unit, decimal UnitPrice, string? Category, decimal? StockQuantity
);

public record UpdateProductRequest(
    string? Sku, string Name, string? Description,
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
