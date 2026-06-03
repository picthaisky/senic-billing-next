using SenicBilling.Domain.Enums;

namespace SenicBilling.Domain.Entities;

/// <summary>
/// Unified document header for all 4 billing document types.
/// Uses DocumentType enum to differentiate: Receipt, CashBill, DeliveryNote, TaxInvoice.
/// All monetary values use decimal(18,4) for exact precision.
/// </summary>
public class DocumentHeader
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }

    /// <summary>ประเภทเอกสาร</summary>
    public DocumentType DocumentType { get; set; }

    /// <summary>เลขที่เอกสาร (e.g., INV-202606-0001) - auto-generated on Issue</summary>
    public string DocumentNumber { get; set; } = string.Empty;

    /// <summary>วันที่เอกสาร</summary>
    public DateTime DocumentDate { get; set; } = DateTime.UtcNow;

    /// <summary>วันครบกำหนดชำระ (for credit terms)</summary>
    public DateTime? DueDate { get; set; }

    /// <summary>ลูกค้า (nullable for walk-in Cash Bills)</summary>
    public Guid? CustomerId { get; set; }

    /// <summary>ชื่อลูกค้า (denormalized for walk-in or snapshot)</summary>
    public string? CustomerName { get; set; }

    /// <summary>ที่อยู่ลูกค้า (snapshot at time of issue)</summary>
    public string? CustomerAddress { get; set; }

    /// <summary>เลขประจำตัวผู้เสียภาษี (snapshot)</summary>
    public string? CustomerTaxId { get; set; }

    /// <summary>สถานะเอกสาร</summary>
    public DocumentStatus Status { get; set; } = DocumentStatus.Draft;

    /// <summary>โหมดการคำนวณ VAT</summary>
    public VatCalculationMode VatMode { get; set; } = VatCalculationMode.Exclusive;

    /// <summary>อัตราภาษีมูลค่าเพิ่ม (default 7%)</summary>
    public decimal VatRate { get; set; } = 7m;

    /// <summary>ยอดรวมก่อนส่วนลด</summary>
    public decimal Subtotal { get; set; }

    /// <summary>ส่วนลดรวม</summary>
    public decimal DiscountAmount { get; set; }

    /// <summary>ยอดรวมหลังส่วนลด (ก่อน VAT)</summary>
    public decimal TotalBeforeVat { get; set; }

    /// <summary>จำนวนเงินภาษีมูลค่าเพิ่ม</summary>
    public decimal VatAmount { get; set; }

    /// <summary>ยอดรวมสุทธิ (Grand Total)</summary>
    public decimal GrandTotal { get; set; }

    /// <summary>หมายเหตุ</summary>
    public string? Notes { get; set; }

    /// <summary>อ้างอิงเอกสารต้นทาง (e.g., DeliveryNote → TaxInvoice)</summary>
    public Guid? ReferenceDocumentId { get; set; }

    /// <summary>เหตุผลการยกเลิก (required when Status = Cancelled)</summary>
    public string? CancellationReason { get; set; }

    /// <summary>สถานะการส่งของ (for DeliveryNote only)</summary>
    public string? DeliveryStatus { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public string? CreatedBy { get; set; }

    // Navigation properties
    public Tenant Tenant { get; set; } = null!;
    public Customer? Customer { get; set; }
    public DocumentHeader? ReferenceDocument { get; set; }
    public ICollection<DocumentLine> Lines { get; set; } = [];
}
