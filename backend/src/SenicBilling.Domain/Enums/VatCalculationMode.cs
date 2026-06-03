namespace SenicBilling.Domain.Enums;

/// <summary>
/// Determines how VAT is calculated on a document.
/// Thai business standard supports both modes.
/// </summary>
public enum VatCalculationMode
{
    /// <summary>ราคาแยกภาษี - prices are before VAT, VAT is added on top</summary>
    Exclusive = 1,

    /// <summary>ราคารวมภาษี - prices already include VAT, VAT is extracted</summary>
    Inclusive = 2
}
