namespace SenicBilling.Domain.Entities;

/// <summary>
/// Product/Service catalog — items that can be added to billing documents.
/// Supports both physical products and services.
/// </summary>
public class Product
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }

    /// <summary>รหัสสินค้า (SKU)</summary>
    public string? Sku { get; set; }

    /// <summary>บาร์โค้ด</summary>
    public string? Barcode { get; set; }

    /// <summary>ชื่อสินค้า/บริการ</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>รายละเอียดสินค้า</summary>
    public string? Description { get; set; }

    /// <summary>หน่วยนับ (ชิ้น, กล่อง, รีม, ชั่วโมง, etc.)</summary>
    public string Unit { get; set; } = "ชิ้น";

    /// <summary>ราคาต่อหน่วย - precision(18,4) for exact currency</summary>
    public decimal UnitPrice { get; set; }

    /// <summary>หมวดหมู่สินค้า</summary>
    public string? Category { get; set; }

    /// <summary>จำนวนในสต๊อก (nullable for services)</summary>
    public decimal? StockQuantity { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation properties
    public Tenant Tenant { get; set; } = null!;
}
