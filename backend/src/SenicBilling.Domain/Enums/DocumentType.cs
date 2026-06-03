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
    TaxInvoice = 4
}
