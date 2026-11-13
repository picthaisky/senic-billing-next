using SenicBilling.Domain.Enums;

namespace SenicBilling.Domain.Entities;

/// <summary>
/// ใบสำคัญจ่าย / บันทึกค่าใช้จ่าย พร้อมภาษีซื้อ (Input VAT) และภาษีหัก ณ ที่จ่าย (WHT / 50 ทวิ).
/// All monetary fields use decimal(18,4) and are isolated by TenantId.
/// </summary>
public class ExpenseRecord
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }

    /// <summary>เลขที่ใบสำคัญจ่าย (EXP-YYYYMM-NNNN)</summary>
    public string VoucherNumber { get; set; } = string.Empty;

    /// <summary>วันที่จ่าย / วันที่เกิดรายการ</summary>
    public DateTime ExpenseDate { get; set; } = DateTime.UtcNow;

    /// <summary>เลขที่ใบกำกับภาษีซื้อที่ได้รับจากผู้ขาย</summary>
    public string? TaxInvoiceNumber { get; set; }

    /// <summary>วันที่ในใบกำกับภาษีซื้อ</summary>
    public DateTime? TaxInvoiceDate { get; set; }

    // ── Vendor (ผู้ขาย / ผู้ถูกหักภาษี ณ ที่จ่าย) ──
    public string VendorName { get; set; } = string.Empty;
    public string? VendorTaxId { get; set; }
    /// <summary>"00000" = สำนักงานใหญ่ หรือรหัสสาขา 5 หลัก</summary>
    public string? VendorBranch { get; set; }
    public string? VendorAddress { get; set; }

    public ExpenseCategory Category { get; set; } = ExpenseCategory.Other;
    public string Description { get; set; } = string.Empty;

    // ── Amounts ──
    public VatCalculationMode VatMode { get; set; } = VatCalculationMode.Exclusive;
    public decimal Subtotal { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal TotalBeforeVat { get; set; }
    public decimal VatRate { get; set; } = 7.00m;
    /// <summary>ภาษีซื้อ</summary>
    public decimal VatAmount { get; set; }
    public decimal GrandTotal { get; set; }

    /// <summary>true = ภาษีซื้อขอคืนได้, false = ภาษีซื้อต้องห้าม</summary>
    public bool IsRefundableVat { get; set; } = true;

    // ── Withholding Tax ──
    public decimal WhtRate { get; set; }
    public decimal WhtAmount { get; set; }
    public PndType PndType { get; set; } = PndType.None;
    /// <summary>ประเภทเงินได้ เช่น ค่าบริการ, ค่าจ้างทำของ, ค่าเช่า</summary>
    public string? IncomeTypeDescription { get; set; }

    /// <summary>ยอดจ่ายจริง = GrandTotal - WhtAmount</summary>
    public decimal NetPaidAmount { get; set; }

    public ExpenseStatus Status { get; set; } = ExpenseStatus.Approved;
    public string? AttachmentUrl { get; set; }
    public string? Notes { get; set; }
    public string? CancellationReason { get; set; }

    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public Tenant Tenant { get; set; } = null!;
}

