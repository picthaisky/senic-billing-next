using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Enums;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Services;

/// <summary>
/// Computes the monthly VAT position (ภ.พ.30): Output VAT (ภาษีขาย) − claimable Input VAT (ภาษีซื้อ),
/// plus WHT deducted from the tenant by customers and WHT the tenant withheld from vendors.
/// Shared by Dashboard, Reports and the LINE Webhook so all channels report identical numbers.
/// </summary>
public static class TaxSummaryQuery
{
    public static (DateTime Start, DateTime End) MonthRange(int year, int month)
    {
        var start = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        return (start, start.AddMonths(1));
    }

    public static async Task<TaxEstimatorDto> ComputeAsync(
        SenicBillingDbContext dbContext, Guid tenantId, int year, int month, CancellationToken ct = default)
    {
        var (start, end) = MonthRange(year, month);

        var sales = await dbContext.DocumentHeaders.AsNoTracking()
            .Where(d =>
                d.TenantId == tenantId &&
                (d.DocumentType == DocumentType.TaxInvoice ||
                 d.DocumentType == DocumentType.CreditNote ||
                 d.DocumentType == DocumentType.DebitNote) &&
                d.Status != DocumentStatus.Cancelled &&
                d.Status != DocumentStatus.Draft &&
                d.DocumentDate >= start && d.DocumentDate < end)
            .Select(d => new
            {
                Sign = d.DocumentType == DocumentType.CreditNote ? -1m : 1m,
                d.TotalBeforeVat,
                d.VatAmount
            })
            .ToListAsync(ct);

        var whtDeductedByCustomers = await dbContext.DocumentHeaders.AsNoTracking()
            .Where(d =>
                d.TenantId == tenantId &&
                d.DocumentType != DocumentType.Quotation &&
                d.DocumentType != DocumentType.DeliveryNote &&
                d.Status != DocumentStatus.Cancelled &&
                d.Status != DocumentStatus.Draft &&
                d.DocumentDate >= start && d.DocumentDate < end)
            .Select(d => d.DocumentType == DocumentType.CreditNote ? -d.WhtAmount : d.WhtAmount)
            .ToListAsync(ct);

        var purchases = await dbContext.ExpenseRecords.AsNoTracking()
            .Where(e =>
                e.TenantId == tenantId &&
                e.Status != ExpenseStatus.Cancelled &&
                e.Status != ExpenseStatus.Draft &&
                e.ExpenseDate >= start && e.ExpenseDate < end)
            .Select(e => new { e.TotalBeforeVat, e.VatAmount, e.IsRefundableVat })
            .ToListAsync(ct);

        var totalSales = sales.Sum(s => s.Sign * s.TotalBeforeVat);
        var outputVat = sales.Sum(s => s.Sign * s.VatAmount);
        var totalPurchases = purchases.Sum(p => p.TotalBeforeVat);
        var inputVat = purchases.Where(p => p.IsRefundableVat).Sum(p => p.VatAmount);
        var netVat = outputVat - inputVat;
        var whtDeducted = whtDeductedByCustomers.Sum();

        return new TaxEstimatorDto(
            year, month,
            TotalSales: totalSales,
            TotalVatCollected: outputVat,
            TotalPurchases: totalPurchases,
            TotalVatPaid: inputVat,
            NetVatPayable: netVat,
            TotalSalesVat: outputVat,
            TotalPurchaseVat: inputVat,
            EstimatedTaxPayable: netVat,
            WhtDeducted: whtDeducted);
    }

    public static async Task<(decimal Pnd3, decimal Pnd53)> ComputeWithheldFromVendorsAsync(
        SenicBillingDbContext dbContext, Guid tenantId, int year, int month, CancellationToken ct = default)
    {
        var (start, end) = MonthRange(year, month);
        var rows = await dbContext.ExpenseRecords.AsNoTracking()
            .Where(e =>
                e.TenantId == tenantId &&
                e.Status != ExpenseStatus.Cancelled &&
                e.Status != ExpenseStatus.Draft &&
                e.WhtAmount > 0 &&
                e.ExpenseDate >= start && e.ExpenseDate < end)
            .Select(e => new { e.PndType, e.WhtAmount })
            .ToListAsync(ct);

        return (rows.Where(r => r.PndType == PndType.PND3).Sum(r => r.WhtAmount),
                rows.Where(r => r.PndType == PndType.PND53).Sum(r => r.WhtAmount));
    }
}

