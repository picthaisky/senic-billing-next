namespace SenicBilling.Domain.Entities;

/// <summary>
/// Line item within a billing document.
/// Supports both product-linked and ad-hoc (free text) items.
/// All monetary values use decimal(18,4) for exact precision.
/// </summary>
public class DocumentLine
{
    public Guid Id { get; set; }
    public Guid DocumentHeaderId { get; set; }

    /// <summary>ลำดับรายการ</summary>
    public int SortOrder { get; set; }

    /// <summary>สินค้า (nullable for ad-hoc/free-text items)</summary>
    public Guid? ProductId { get; set; }

    /// <summary>รายละเอียดรายการ (denormalized product name or free text)</summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>จำนวน</summary>
    public decimal Quantity { get; set; }

    /// <summary>หน่วยนับ</summary>
    public string Unit { get; set; } = "ชิ้น";

    /// <summary>ราคาต่อหน่วย</summary>
    public decimal UnitPrice { get; set; }

    /// <summary>ส่วนลดต่อรายการ</summary>
    public decimal DiscountAmount { get; set; }

    /// <summary>ยอดรวมรายการ = (Quantity × UnitPrice) - DiscountAmount</summary>
    public decimal LineTotal { get; set; }

    // Navigation properties
    public DocumentHeader DocumentHeader { get; set; } = null!;
    public Product? Product { get; set; }
}
