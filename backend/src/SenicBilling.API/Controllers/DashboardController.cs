using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Enums;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController(SenicBillingDbContext dbContext) : ControllerBase
{
    /// <summary>Get dashboard summary KPIs</summary>
    [HttpGet("summary")]
    public async Task<ActionResult<ApiResponse<DashboardSummary>>> GetSummary(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var now = DateTime.UtcNow;
        var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
        var startOfLastMonth = startOfMonth.AddMonths(-1);

        var activeDocs = dbContext.DocumentHeaders
            .Where(d =>
                d.TenantId == tenantId &&
                d.Status != DocumentStatus.Draft &&
                d.Status != DocumentStatus.Cancelled &&
                d.DocumentType != DocumentType.Quotation);

        var revenueDocs = activeDocs
            .Where(d => d.DocumentType != DocumentType.DeliveryNote);

        var totalRevenue = await revenueDocs
            .SumAsync(d => (decimal?)(d.DocumentType == DocumentType.CreditNote ? -d.GrandTotal : d.GrandTotal), ct) ?? 0;
        var documentsIssued = await activeDocs.CountAsync(ct);
        var pendingDocs = await dbContext.DocumentHeaders
            .CountAsync(d => d.TenantId == tenantId && d.Status == DocumentStatus.Draft, ct);

        // Monthly growth calculation
        var thisMonthRevenue = await revenueDocs
            .Where(d => d.DocumentDate >= startOfMonth)
            .SumAsync(d => (decimal?)(d.DocumentType == DocumentType.CreditNote ? -d.GrandTotal : d.GrandTotal), ct) ?? 0;
        var lastMonthRevenue = await revenueDocs
            .Where(d => d.DocumentDate >= startOfLastMonth && d.DocumentDate < startOfMonth)
            .SumAsync(d => (decimal?)(d.DocumentType == DocumentType.CreditNote ? -d.GrandTotal : d.GrandTotal), ct) ?? 0;

        var growthPercent = lastMonthRevenue > 0
            ? Math.Round((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100, 1)
            : 0;

        var summary = new DashboardSummary(totalRevenue, documentsIssued, pendingDocs, growthPercent);
        return Ok(new ApiResponse<DashboardSummary>(true, "สำเร็จ", summary));
    }

    /// <summary>Get monthly revenue data for the last 6 months</summary>
    [HttpGet("revenue-chart")]
    public async Task<ActionResult<ApiResponse<List<MonthlyRevenueData>>>> GetRevenueChart(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var sixMonthsAgo = DateTime.UtcNow.AddMonths(-6);

        var monthlyRows = await dbContext.DocumentHeaders
            .Where(d =>
                d.TenantId == tenantId &&
                d.Status != DocumentStatus.Draft &&
                d.Status != DocumentStatus.Cancelled &&
                d.DocumentType != DocumentType.Quotation &&
                d.DocumentType != DocumentType.DeliveryNote &&
                d.DocumentDate >= sixMonthsAgo)
            .GroupBy(d => new { d.DocumentDate.Year, d.DocumentDate.Month })
            .Select(g => new
            {
                g.Key.Year,
                g.Key.Month,
                GoodsValue = g.Sum(d => d.DocumentType == DocumentType.CreditNote ? -d.TotalBeforeVat : d.TotalBeforeVat),
                VatAmount = g.Sum(d => d.DocumentType == DocumentType.CreditNote ? -d.VatAmount : d.VatAmount)
            })
            .OrderBy(d => d.Year)
            .ThenBy(d => d.Month)
            .ToListAsync(ct);

        var data = monthlyRows
            .Select(row => new MonthlyRevenueData(
                $"{row.Year}-{row.Month:D2}",
                row.GoodsValue,
                row.VatAmount
            ))
            .ToList();

        return Ok(new ApiResponse<List<MonthlyRevenueData>>(true, "สำเร็จ", data));
    }

    /// <summary>Get top selling products</summary>
    [HttpGet("top-products")]
    public async Task<ActionResult<ApiResponse<List<TopProductData>>>> GetTopProducts(
        [FromQuery] int top = 5, CancellationToken ct = default)
    {
        var tenantId = GetTenantId();

        var topProductRows = await dbContext.DocumentLines
            .Where(l =>
                l.DocumentHeader.TenantId == tenantId &&
                l.DocumentHeader.Status != DocumentStatus.Draft &&
                l.DocumentHeader.Status != DocumentStatus.Cancelled &&
                l.DocumentHeader.DocumentType != DocumentType.Quotation &&
                l.DocumentHeader.DocumentType != DocumentType.DeliveryNote &&
                l.DocumentHeader.DocumentType != DocumentType.CreditNote)
            .GroupBy(l => l.Description)
            .Select(g => new
            {
                ProductName = g.Key,
                TotalRevenue = g.Sum(l => l.LineTotal),
                TotalQuantity = g.Sum(l => l.Quantity)
            })
            .OrderByDescending(p => p.TotalRevenue)
            .Take(top)
            .ToListAsync(ct);

        var data = topProductRows
            .Select(row => new TopProductData(
                row.ProductName,
                row.TotalRevenue,
                row.TotalQuantity
            ))
            .ToList();

        return Ok(new ApiResponse<List<TopProductData>>(true, "สำเร็จ", data));
    }

    /// <summary>Get recent document activity</summary>
    [HttpGet("recent-activity")]
    public async Task<ActionResult<ApiResponse<List<RecentDocumentActivity>>>> GetRecentActivity(
        [FromQuery] int count = 10, CancellationToken ct = default)
    {
        var tenantId = GetTenantId();

        var data = await dbContext.DocumentHeaders
            .Where(d =>
                d.TenantId == tenantId &&
                d.Status != DocumentStatus.Draft &&
                d.Status != DocumentStatus.Cancelled &&
                d.DocumentType != DocumentType.Quotation)
            .OrderByDescending(d => d.CreatedAt)
            .Take(count)
            .Select(d => new RecentDocumentActivity(
                d.Id, d.DocumentNumber, d.DocumentType,
                d.CustomerName, d.GrandTotal, d.CreatedAt
            ))
            .ToListAsync(ct);

        return Ok(new ApiResponse<List<RecentDocumentActivity>>(true, "สำเร็จ", data));
    }

    /// <summary>Tax Estimator API — monthly VAT output & WHT summary</summary>
    [HttpGet("tax-estimator")]
    public async Task<ActionResult<ApiResponse<TaxEstimatorDto>>> GetTaxEstimator(
        [FromQuery] int? year = null, [FromQuery] int? month = null, CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        var now = DateTime.UtcNow;
        var targetYear = year is > 0 ? year.Value : now.Year;
        var targetMonth = month is >= 1 and <= 12 ? month.Value : now.Month;

        var dto = await SenicBilling.API.Services.TaxSummaryQuery.ComputeAsync(dbContext, tenantId, targetYear, targetMonth, ct);
        return Ok(new ApiResponse<TaxEstimatorDto>(true, "สำเร็จ", dto));
    }

    /// <summary>A/R Aging Report API — overdue bucketing</summary>
    [HttpGet("aging-report")]
    public async Task<ActionResult<ApiResponse<AgingSummaryDto>>> GetAgingReport(CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        var now = DateTime.UtcNow.Date;

        var overdueDocs = await dbContext.DocumentHeaders
            .Where(d =>
                d.TenantId == tenantId &&
                (d.Status == DocumentStatus.Issued || d.Status == DocumentStatus.Sent || d.Status == DocumentStatus.Viewed || d.Status == DocumentStatus.Overdue) &&
                d.DocumentType != DocumentType.Quotation &&
                d.DocumentType != DocumentType.DeliveryNote &&
                d.DocumentType != DocumentType.Receipt &&
                d.DocumentType != DocumentType.CashBill &&
                d.DocumentType != DocumentType.CreditNote)
            .Select(d => new
            {
                d.CustomerId,
                d.CustomerName,
                d.DueDate,
                d.GrandTotal
            })
            .ToListAsync(ct);

        var report = overdueDocs
            .GroupBy(d => new { d.CustomerId, CustomerName = d.CustomerName ?? "ทั่วไป" })
            .Select(g =>
            {
                var current = g.Where(d => d.DueDate == null || d.DueDate >= now).Sum(d => d.GrandTotal);
                var over1to30 = g.Where(d => d.DueDate != null && d.DueDate < now && (now - d.DueDate.Value).TotalDays <= 30).Sum(d => d.GrandTotal);
                var over31to60 = g.Where(d => d.DueDate != null && d.DueDate < now && (now - d.DueDate.Value).TotalDays > 30 && (now - d.DueDate.Value).TotalDays <= 60).Sum(d => d.GrandTotal);
                var over61to90 = g.Where(d => d.DueDate != null && d.DueDate < now && (now - d.DueDate.Value).TotalDays > 60 && (now - d.DueDate.Value).TotalDays <= 90).Sum(d => d.GrandTotal);
                var over90 = g.Where(d => d.DueDate != null && d.DueDate < now && (now - d.DueDate.Value).TotalDays > 90).Sum(d => d.GrandTotal);
                
                return new AgingReportDto(
                    g.Key.CustomerId ?? Guid.Empty,
                    g.Key.CustomerName,
                    current,
                    over1to30,
                    over31to60,
                    over61to90,
                    over90,
                    over1to30 + over31to60 + over61to90 + over90
                );
            })
            .Where(r => r.Current > 0 || r.TotalOverdue > 0)
            .OrderByDescending(r => r.TotalOverdue)
            .ToList();

        var summary = new AgingSummaryDto(
            Current: report.Sum(r => r.Current),
            Overdue1_30: report.Sum(r => r.Overdue1To30Days),
            Overdue31_60: report.Sum(r => r.Overdue31To60Days),
            Overdue61_90: report.Sum(r => r.Overdue61To90Days),
            Overdue90Plus: report.Sum(r => r.OverdueOver90Days),
            TotalOverdue: report.Sum(r => r.TotalOverdue),
            Customers: report
        );

        return Ok(new ApiResponse<AgingSummaryDto>(true, "สำเร็จ", summary));
    }

    /// <summary>Top Spenders API — customer ranking by revenue</summary>
    [HttpGet("top-spenders")]
    public async Task<ActionResult<ApiResponse<List<CustomerPurchaseHistoryDto>>>> GetTopSpenders(
        [FromQuery] int top = 5, CancellationToken ct = default)
    {
        var tenantId = GetTenantId();

        var spenders = await dbContext.DocumentHeaders
            .Where(d =>
                d.TenantId == tenantId &&
                d.Status != DocumentStatus.Cancelled &&
                d.Status != DocumentStatus.Draft &&
                d.DocumentType != DocumentType.Quotation &&
                d.DocumentType != DocumentType.DeliveryNote &&
                d.CustomerId != null)
            .GroupBy(d => new { d.CustomerId, d.CustomerName })
            .Select(g => new
            {
                CustomerId = g.Key.CustomerId,
                CustomerName = g.Key.CustomerName,
                TotalOrders = g.Count(),
                TotalSpent = g.Sum(d => d.DocumentType == DocumentType.CreditNote ? -d.GrandTotal : d.GrandTotal),
                LastPurchaseDate = g.Max(d => d.DocumentDate)
            })
            .OrderByDescending(x => x.TotalSpent)
            .Take(top)
            .ToListAsync(ct);

        var data = spenders.Select(s => new CustomerPurchaseHistoryDto(
            s.CustomerId ?? Guid.Empty,
            s.CustomerName ?? "Unknown",
            s.TotalOrders,
            s.TotalSpent,
            s.LastPurchaseDate,
            new List<DocumentResponse>() // Skip detailed docs for top spenders list
        )).ToList();

        return Ok(new ApiResponse<List<CustomerPurchaseHistoryDto>>(true, "สำเร็จ", data));
    }

    private Guid GetTenantId() => Guid.Parse(User.FindFirst("tenantId")!.Value);
}
