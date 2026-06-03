namespace SenicBilling.Domain.Enums;

/// <summary>
/// Represents the lifecycle status of a billing document.
/// Documents transition: Draft → Issued → (optionally) Cancelled.
/// Cancelled documents require a Credit Note reference for audit compliance.
/// </summary>
public enum DocumentStatus
{
    /// <summary>ร่าง - editable, not yet finalized</summary>
    Draft = 1,

    /// <summary>ออกแล้ว - finalized, read-only, assigned running number</summary>
    Issued = 2,

    /// <summary>ยกเลิก - voided with Credit Note reference</summary>
    Cancelled = 3,

    /// <summary>ชำระเงินแล้ว - fully paid online or offline</summary>
    Paid = 4
}
