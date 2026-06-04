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

        var allDocs = dbContext.DocumentHeaders
            .Where(d =>
                d.TenantId == tenantId &&
                d.Status == DocumentStatus.Issued &&
                d.DocumentType != DocumentType.Quotation);

        var totalRevenue = await allDocs.SumAsync(d => (decimal?)d.GrandTotal, ct) ?? 0;
        var documentsIssued = await allDocs.CountAsync(ct);
        var pendingDocs = await dbContext.DocumentHeaders
            .CountAsync(d => d.TenantId == tenantId && d.Status == DocumentStatus.Draft, ct);

        // Monthly growth calculation
        var thisMonthRevenue = await allDocs
            .Where(d => d.DocumentDate >= startOfMonth)
            .SumAsync(d => (decimal?)d.GrandTotal, ct) ?? 0;
        var lastMonthRevenue = await allDocs
            .Where(d => d.DocumentDate >= startOfLastMonth && d.DocumentDate < startOfMonth)
            .SumAsync(d => (decimal?)d.GrandTotal, ct) ?? 0;

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
                d.Status == DocumentStatus.Issued &&
                d.DocumentType != DocumentType.Quotation &&
                d.DocumentDate >= sixMonthsAgo)
            .GroupBy(d => new { d.DocumentDate.Year, d.DocumentDate.Month })
            .Select(g => new
            {
                g.Key.Year,
                g.Key.Month,
                GoodsValue = g.Sum(d => d.TotalBeforeVat),
                VatAmount = g.Sum(d => d.VatAmount)
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
                l.DocumentHeader.Status == DocumentStatus.Issued &&
                l.DocumentHeader.DocumentType != DocumentType.Quotation)
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
                d.Status == DocumentStatus.Issued &&
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

    private Guid GetTenantId() => Guid.Parse(User.FindFirst("tenantId")!.Value);
}
