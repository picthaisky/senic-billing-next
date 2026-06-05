namespace SenicBilling.Domain.Enums;

/// <summary>
/// Represents the type of billing document in the system.
/// Each type has a unique prefix used for running number generation.
/// </summary>
public enum DocumentType
{
    /// <summary>ใบเสร็จรับเงิน</summary>
    Receipt = 1,

    /// <summary>บิลเงินสด</summary>
    CashBill = 2,

    /// <summary>ใบส่งของ</summary>
    DeliveryNote = 3,

    /// <summary>ใบกำกับภาษี</summary>
    TaxInvoice = 4,

    /// <summary>ใบเสนอราคา</summary>
    Quotation = 5,

    /// <summary>ใบลดหนี้ (Credit Note) — ลดยอดจากเอกสารต้นทาง</summary>
    CreditNote = 6,

    /// <summary>ใบเพิ่มหนี้ (Debit Note) — เพิ่มยอดจากเอกสารต้นทาง</summary>
    DebitNote = 7
}
