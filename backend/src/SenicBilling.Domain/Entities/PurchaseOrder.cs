using SenicBilling.Domain.Enums;

namespace SenicBilling.Domain.Entities;

/// <summary>ใบสั่งซื้อ (Purchase Order — PO-YYYYMM-XXXX)</summary>
public class PurchaseOrder
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string PoNumber { get; set; } = string.Empty;
    public DateTime OrderDate { get; set; } = DateTime.UtcNow;
    public DateTime? ExpectedDeliveryDate { get; set; }

    public Guid? VendorId { get; set; }
    public string VendorName { get; set; } = string.Empty;
    public string? VendorTaxId { get; set; }
    public string? VendorBranch { get; set; }
    public string? VendorAddress { get; set; }

    public Guid? WarehouseId { get; set; }

    public VatCalculationMode VatMode { get; set; } = VatCalculationMode.Exclusive;
    public decimal Subtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TotalBeforeVat { get; set; }
    public decimal VatRate { get; set; } = 7m;
    public decimal VatAmount { get; set; }
    public decimal GrandTotal { get; set; }

    public PurchaseOrderStatus Status { get; set; } = PurchaseOrderStatus.Draft;
    public string? Notes { get; set; }
    public string? CancellationReason { get; set; }
    public DateTime? ReceivedAt { get; set; }
    public Guid? LinkedExpenseId { get; set; }

    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public Tenant Tenant { get; set; } = null!;
    public Vendor? Vendor { get; set; }
    public Warehouse? Warehouse { get; set; }
    public ICollection<PurchaseOrderLine> Lines { get; set; } = [];
}

public class PurchaseOrderLine
{
    public Guid Id { get; set; }
    public Guid PurchaseOrderId { get; set; }
    public int SortOrder { get; set; }
    public Guid? ProductId { get; set; }
    public string Description { get; set; } = string.Empty;
    public string Unit { get; set; } = "ชิ้น";
    public decimal Quantity { get; set; }
    public decimal ReceivedQuantity { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal LineTotal { get; set; }

    public PurchaseOrder PurchaseOrder { get; set; } = null!;
    public Product? Product { get; set; }
}

