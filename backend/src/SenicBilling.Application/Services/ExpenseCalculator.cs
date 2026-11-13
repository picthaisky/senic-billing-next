using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Enums;

namespace SenicBilling.Application.Services;

/// <summary>
/// Pure calculator for Expense Voucher amounts (Input VAT &amp; Withholding Tax).
/// Rounds to 2 decimals using MidpointRounding.AwayFromZero (Thai Revenue Department practice).
/// WHT is always computed on the amount before VAT.
/// </summary>
public static class ExpenseCalculator
{
    public static readonly decimal[] AllowedWhtRates = [0m, 1m, 1.5m, 2m, 3m, 5m, 10m, 15m];

    public static ExpenseAmounts Calculate(
        decimal amount,
        decimal discountAmount,
        VatCalculationMode vatMode,
        decimal vatRate,
        decimal whtRate)
    {
        if (amount < 0) throw new ArgumentOutOfRangeException(nameof(amount), "ยอดเงินต้องไม่ติดลบ");
        if (discountAmount < 0 || discountAmount > amount)
            throw new ArgumentOutOfRangeException(nameof(discountAmount), "ส่วนลดไม่ถูกต้อง");
        if (vatRate < 0 || vatRate > 100) throw new ArgumentOutOfRangeException(nameof(vatRate));
        if (whtRate < 0 || whtRate > 100) throw new ArgumentOutOfRangeException(nameof(whtRate));

        var subtotal = Round(amount);
        var discount = Round(discountAmount);
        var afterDiscount = subtotal - discount;

        decimal totalBeforeVat;
        decimal vatAmount;
        decimal grandTotal;

        if (vatRate == 0)
        {
            totalBeforeVat = afterDiscount;
            vatAmount = 0m;
            grandTotal = afterDiscount;
        }
        else if (vatMode == VatCalculationMode.Inclusive)
        {
            grandTotal = afterDiscount;
            totalBeforeVat = Round(afterDiscount * 100m / (100m + vatRate));
            vatAmount = grandTotal - totalBeforeVat;
        }
        else
        {
            totalBeforeVat = afterDiscount;
            vatAmount = Round(totalBeforeVat * vatRate / 100m);
            grandTotal = totalBeforeVat + vatAmount;
        }

        var whtAmount = Round(totalBeforeVat * whtRate / 100m);
        var netPaid = grandTotal - whtAmount;

        return new ExpenseAmounts(subtotal, discount, totalBeforeVat, vatAmount, grandTotal, whtAmount, netPaid);
    }

    private static decimal Round(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
}

