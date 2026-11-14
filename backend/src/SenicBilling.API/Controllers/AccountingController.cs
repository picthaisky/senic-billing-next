using System.Security.Claims;
using System.Text;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Domain.Interfaces;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/accounting")]
[Authorize]
public class AccountingController(
    SenicBillingDbContext dbContext,
    IAccountingService accountingService,
    IDocumentNumberGeneratorService numberGenerator) : ControllerBase
{
    private Guid GetTenantId() => Guid.Parse(User.FindFirst("tenantId")!.Value);
    private string? GetUsername() => User.FindFirst(ClaimTypes.Name)?.Value ?? User.Identity?.Name;

    [HttpGet("accounts")]
    public async Task<ActionResult<ApiResponse<List<ChartOfAccountDto>>>> GetAccounts(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        await accountingService.EnsureDefaultChartOfAccountsAsync(tenantId, ct);

        var accounts = await dbContext.ChartOfAccounts
            .AsNoTracking()
            .Where(a => a.TenantId == tenantId && a.IsActive)
            .OrderBy(a => a.Code)
            .Select(a => new ChartOfAccountDto(a.Id, a.Code, a.Name, a.AccountType, a.IsSystem, a.IsActive))
            .ToListAsync(ct);

        return Ok(new ApiResponse<List<ChartOfAccountDto>>(true, "สำเร็จ", accounts));
    }

    [HttpGet("journals")]
    public async Task<ActionResult<ApiResponse<List<JournalEntryDto>>>> GetJournals(
        [FromQuery] DateTime? startDate, [FromQuery] DateTime? endDate, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var query = dbContext.JournalEntries
            .AsNoTracking()
            .Include(j => j.Lines)
            .ThenInclude(l => l.Account)
            .Where(j => j.TenantId == tenantId);

        if (startDate.HasValue)
        {
            var s = DateTime.SpecifyKind(startDate.Value.Date, DateTimeKind.Utc);
            query = query.Where(j => j.EntryDate >= s);
        }
        if (endDate.HasValue)
        {
            var e = DateTime.SpecifyKind(endDate.Value.Date.AddDays(1), DateTimeKind.Utc);
            query = query.Where(j => j.EntryDate < e);
        }

        var items = await query
            .OrderByDescending(j => j.EntryDate)
            .ThenByDescending(j => j.CreatedAt)
            .Take(200)
            .ToListAsync(ct);

        var dtos = items.Select(j => new JournalEntryDto(
            j.Id, j.JournalNumber, j.EntryDate, j.Description, j.SourceType, j.SourceId, j.SourceNumber,
            j.IsPosted, j.CreatedAt,
            j.Lines.Select(l => new JournalEntryLineDto(l.Id, l.AccountId, l.Account.Code, l.Account.Name, l.Debit, l.Credit, l.Memo)).ToList()
        )).ToList();

        return Ok(new ApiResponse<List<JournalEntryDto>>(true, "สำเร็จ", dtos));
    }

    [HttpPost("journals")]
    public async Task<ActionResult<ApiResponse<JournalEntryDto>>> CreateManualJournal(
        [FromBody] CreateJournalEntryRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        if (string.IsNullOrWhiteSpace(request.Description))
            return BadRequest(new ApiResponse<JournalEntryDto>(false, "กรุณาระบุคำอธิบายรายการ", null));
        if (request.Lines is null || request.Lines.Count < 2)
            return BadRequest(new ApiResponse<JournalEntryDto>(false, "สมุดรายวันต้องมีอย่างน้อย 2 บรรทัด", null));

        var totalDebit = request.Lines.Sum(l => l.Debit);
        var totalCredit = request.Lines.Sum(l => l.Credit);
        if (totalDebit <= 0 || totalDebit != totalCredit)
            return BadRequest(new ApiResponse<JournalEntryDto>(false, "ยอดเดบิตและเครดิตต้องเท่ากันและมากกว่า 0", null));

        if (await accountingService.IsPeriodLockedAsync(tenantId, request.EntryDate, ct))
            return BadRequest(new ApiResponse<JournalEntryDto>(false, $"งวดบัญชี {request.EntryDate.Month:D2}/{request.EntryDate.Year} ถูกปิดงวดแล้ว ไม่สามารถบันทึกรายการได้", null));

        var accountIds = request.Lines.Select(l => l.AccountId).Distinct().ToList();
        var validAccounts = await dbContext.ChartOfAccounts
            .Where(a => a.TenantId == tenantId && accountIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id, ct);
        if (validAccounts.Count != accountIds.Count)
            return BadRequest(new ApiResponse<JournalEntryDto>(false, "พบผังบัญชีที่ไม่ถูกต้อง", null));

        var entry = new JournalEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            JournalNumber = await numberGenerator.GenerateNextNumberAsync(tenantId, DocumentType.JournalVoucher, ct),
            EntryDate = DateTime.SpecifyKind(request.EntryDate, DateTimeKind.Utc),
            Description = request.Description.Trim(),
            SourceType = JournalSourceType.Manual,
            IsPosted = true,
            CreatedBy = GetUsername(),
            CreatedAt = DateTime.UtcNow
        };
        dbContext.JournalEntries.Add(entry);

        var lineDtos = new List<JournalEntryLineDto>();
        foreach (var l in request.Lines)
        {
            var acc = validAccounts[l.AccountId];
            var line = new JournalEntryLine
            {
                Id = Guid.NewGuid(),
                JournalEntryId = entry.Id,
                AccountId = l.AccountId,
                Debit = l.Debit,
                Credit = l.Credit,
                Memo = l.Memo?.Trim()
            };
            dbContext.JournalEntryLines.Add(line);
            lineDtos.Add(new JournalEntryLineDto(line.Id, acc.Id, acc.Code, acc.Name, line.Debit, line.Credit, line.Memo));
        }

        await dbContext.SaveChangesAsync(ct);

        var dto = new JournalEntryDto(
            entry.Id, entry.JournalNumber, entry.EntryDate, entry.Description, entry.SourceType,
            entry.SourceId, entry.SourceNumber, entry.IsPosted, entry.CreatedAt, lineDtos);
        return CreatedAtAction(nameof(GetJournals), new ApiResponse<JournalEntryDto>(true, "บันทึกรายการบัญชีสำเร็จ", dto));
    }

    [HttpGet("trial-balance")]
    public async Task<ActionResult<ApiResponse<TrialBalanceDto>>> GetTrialBalance(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        await accountingService.EnsureDefaultChartOfAccountsAsync(tenantId, ct);

        var lines = await dbContext.JournalEntryLines
            .AsNoTracking()
            .Include(l => l.Account)
            .Include(l => l.JournalEntry)
            .Where(l => l.JournalEntry.TenantId == tenantId && l.JournalEntry.IsPosted)
            .ToListAsync(ct);

        var rows = lines
            .GroupBy(l => new { l.AccountId, l.Account.Code, l.Account.Name, l.Account.AccountType })
            .OrderBy(g => g.Key.Code)
            .Select(g =>
            {
                var dr = g.Sum(x => x.Debit);
                var cr = g.Sum(x => x.Credit);
                return new TrialBalanceRowDto(g.Key.AccountId, g.Key.Code, g.Key.Name, g.Key.AccountType, dr, cr, dr - cr);
            })
            .ToList();

        var totalDr = rows.Sum(r => r.TotalDebit);
        var totalCr = rows.Sum(r => r.TotalCredit);
        return Ok(new ApiResponse<TrialBalanceDto>(true, "สำเร็จ",
            new TrialBalanceDto(totalDr, totalCr, totalDr == totalCr, rows)));
    }

    [HttpGet("profit-loss")]
    public async Task<ActionResult<ApiResponse<ProfitLossDto>>> GetProfitLoss(
        [FromQuery] int? year, [FromQuery] int? month, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var now = DateTime.UtcNow;
        var y = year is > 0 ? year.Value : now.Year;
        var start = new DateTime(y, month is >= 1 and <= 12 ? month.Value : 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = month is >= 1 and <= 12 ? start.AddMonths(1) : start.AddYears(1);

        var lines = await dbContext.JournalEntryLines
            .AsNoTracking()
            .Include(l => l.Account)
            .Include(l => l.JournalEntry)
            .Where(l => l.JournalEntry.TenantId == tenantId &&
                        l.JournalEntry.IsPosted &&
                        l.JournalEntry.EntryDate >= start &&
                        l.JournalEntry.EntryDate < end &&
                        (l.Account.AccountType == AccountType.Revenue || l.Account.AccountType == AccountType.Expense))
            .ToListAsync(ct);

        var grouped = lines
            .GroupBy(l => new { l.AccountId, l.Account.Code, l.Account.Name, l.Account.AccountType })
            .OrderBy(g => g.Key.Code)
            .Select(g =>
            {
                var dr = g.Sum(x => x.Debit);
                var cr = g.Sum(x => x.Credit);
                var net = g.Key.AccountType == AccountType.Revenue ? cr - dr : dr - cr;
                return new TrialBalanceRowDto(g.Key.AccountId, g.Key.Code, g.Key.Name, g.Key.AccountType, dr, cr, net);
            })
            .ToList();

        var revRows = grouped.Where(r => r.AccountType == AccountType.Revenue).ToList();
        var expRows = grouped.Where(r => r.AccountType == AccountType.Expense).ToList();
        var totalRev = revRows.Sum(r => r.NetBalance);
        var totalExp = expRows.Sum(r => r.NetBalance);

        return Ok(new ApiResponse<ProfitLossDto>(true, "สำเร็จ",
            new ProfitLossDto(start, end.AddDays(-1), totalRev, totalExp, totalRev - totalExp, revRows, expRows)));
    }

    [HttpGet("export/excel")]
    public async Task<IActionResult> ExportExcel(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var entries = await dbContext.JournalEntries
            .AsNoTracking()
            .Include(j => j.Lines)
            .ThenInclude(l => l.Account)
            .Where(j => j.TenantId == tenantId)
            .OrderBy(j => j.EntryDate)
            .ThenBy(j => j.JournalNumber)
            .ToListAsync(ct);

        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("สมุดรายวันทั่วไป");
        string[] headers = ["เลขที่ใบสำคัญ", "วันที่", "รหัสบัญชี", "ชื่อบัญชี", "คำอธิบาย", "เดบิต", "เครดิต", "อ้างอิง"];
        for (var i = 0; i < headers.Length; i++) ws.Cell(1, i + 1).Value = headers[i];
        ws.Range(1, 1, 1, headers.Length).Style.Font.Bold = true;

        var row = 2;
        foreach (var e in entries)
        {
            foreach (var l in e.Lines)
            {
                ws.Cell(row, 1).Value = e.JournalNumber;
                ws.Cell(row, 2).Value = e.EntryDate.ToString("dd/MM/yyyy");
                ws.Cell(row, 3).Value = l.Account.Code;
                ws.Cell(row, 4).Value = l.Account.Name;
                ws.Cell(row, 5).Value = l.Memo ?? e.Description;
                ws.Cell(row, 6).Value = l.Debit;
                ws.Cell(row, 7).Value = l.Credit;
                ws.Cell(row, 8).Value = e.SourceNumber ?? "-";
                row++;
            }
        }
        ws.Range(2, 6, Math.Max(2, row - 1), 7).Style.NumberFormat.Format = "#,##0.00";
        ws.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "JournalEntries.xlsx");
    }

    [HttpGet("export/csv")]
    public async Task<IActionResult> ExportCsv(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var entries = await dbContext.JournalEntries
            .AsNoTracking()
            .Include(j => j.Lines)
            .ThenInclude(l => l.Account)
            .Where(j => j.TenantId == tenantId)
            .OrderBy(j => j.EntryDate)
            .ThenBy(j => j.JournalNumber)
            .ToListAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("JournalNumber,EntryDate,AccountCode,AccountName,Description,Debit,Credit,SourceNumber");
        foreach (var e in entries)
        {
            foreach (var l in e.Lines)
            {
                var desc = (l.Memo ?? e.Description).Replace("\"", "\"\"");
                sb.AppendLine($"{e.JournalNumber},{e.EntryDate:yyyy-MM-dd},{l.Account.Code},\"{l.Account.Name}\",\"{desc}\",{l.Debit:F2},{l.Credit:F2},{e.SourceNumber}");
            }
        }
        var bytes = Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
        return File(bytes, "text/csv; charset=utf-8", "JournalEntries.csv");
    }

    // ──────────────────────────────────────────────
    // Phase 11: Financial Statements (Balance Sheet, Cash Flow, Margin, Period Lock)
    // ──────────────────────────────────────────────

    [HttpGet("balance-sheet")]
    public async Task<ActionResult<ApiResponse<BalanceSheetDto>>> GetBalanceSheet(
        [FromQuery] DateTime? asOfDate,
        CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        var cutoffDate = (asOfDate ?? DateTime.UtcNow).Date;
        var dto = await ComputeBalanceSheetAsync(tenantId, cutoffDate, ct);
        return Ok(new ApiResponse<BalanceSheetDto>(true, "สำเร็จ", dto));
    }

    [HttpGet("cash-flow")]
    public async Task<ActionResult<ApiResponse<CashFlowStatementDto>>> GetCashFlow(
        [FromQuery] int? year,
        [FromQuery] int? month,
        CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        var now = DateTime.UtcNow;
        var y = year is > 0 ? year.Value : now.Year;
        var start = new DateTime(y, month is >= 1 and <= 12 ? month.Value : 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = month is >= 1 and <= 12 ? start.AddMonths(1) : start.AddYears(1);
        var dto = await ComputeCashFlowAsync(tenantId, start, end, ct);
        return Ok(new ApiResponse<CashFlowStatementDto>(true, "สำเร็จ", dto));
    }

    [HttpGet("sales-margin")]
    public async Task<ActionResult<ApiResponse<SalesMarginReportDto>>> GetSalesMargin(
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        var now = DateTime.UtcNow;
        var start = DateTime.SpecifyKind((startDate ?? new DateTime(now.Year, 1, 1)).Date, DateTimeKind.Utc);
        var endInclusive = DateTime.SpecifyKind((endDate ?? now).Date, DateTimeKind.Utc);
        var endExclusive = endInclusive.AddDays(1);

        var docs = await dbContext.DocumentHeaders
            .AsNoTracking()
            .Include(d => d.Lines)
            .Where(d => d.TenantId == tenantId &&
                        d.Status != DocumentStatus.Draft &&
                        d.Status != DocumentStatus.Cancelled &&
                        d.DocumentType != DocumentType.Quotation &&
                        d.DocumentType != DocumentType.DeliveryNote &&
                        d.DocumentDate >= start &&
                        d.DocumentDate < endExclusive)
            .ToListAsync(ct);

        var products = await dbContext.Products
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId)
            .ToDictionaryAsync(p => p.Id, ct);

        // Fallback average cost from received PurchaseOrderLines when Product.CostPrice is null
        var poLines = await dbContext.PurchaseOrderLines
            .AsNoTracking()
            .Include(l => l.PurchaseOrder)
            .Where(l => l.PurchaseOrder.TenantId == tenantId &&
                        l.ProductId.HasValue &&
                        (l.ReceivedQuantity > 0 || l.PurchaseOrder.Status == PurchaseOrderStatus.Received) &&
                        l.PurchaseOrder.Status != PurchaseOrderStatus.Cancelled)
            .ToListAsync(ct);

        var avgPoCostLookup = poLines
            .GroupBy(l => l.ProductId!.Value)
            .ToDictionary(
                g => g.Key,
                g =>
                {
                    var totalWeight = g.Sum(x => x.ReceivedQuantity > 0 ? x.ReceivedQuantity : x.Quantity);
                    if (totalWeight <= 0) return 0m;
                    return g.Sum(x =>
                    {
                        var w = x.ReceivedQuantity > 0 ? x.ReceivedQuantity : x.Quantity;
                        var unitCost = x.Quantity > 0 ? x.LineTotal / x.Quantity : x.UnitPrice;
                        return unitCost * w;
                    }) / totalWeight;
                });

        var productAgg = new Dictionary<string, (Guid? ProductId, string? Sku, string Name, decimal Qty, decimal Rev, decimal Cost)>();
        foreach (var d in docs)
        {
            var sign = d.DocumentType == DocumentType.CreditNote ? -1m : 1m;
            var lineSum = d.Lines.Sum(l => l.LineTotal);
            var revenueFactor = lineSum > 0m ? (d.TotalBeforeVat / lineSum) : 1m;

            foreach (var line in d.Lines)
            {
                Product? prod = null;
                if (line.ProductId.HasValue) products.TryGetValue(line.ProductId.Value, out prod);

                var unitCost = prod?.CostPrice ?? (line.ProductId.HasValue && avgPoCostLookup.TryGetValue(line.ProductId.Value, out var poCost) ? poCost : 0m);
                var qty = line.Quantity * sign;
                var rev = Math.Round(line.LineTotal * revenueFactor * sign, 2);
                var cost = Math.Round(qty * unitCost, 2);

                var key = line.ProductId?.ToString() ?? $"ADHOC:{line.Description.Trim()}";
                var name = prod?.Name ?? line.Description;
                var sku = prod?.Sku;
                if (productAgg.TryGetValue(key, out var cur))
                {
                    productAgg[key] = (cur.ProductId, cur.Sku, cur.Name, cur.Qty + qty, cur.Rev + rev, cur.Cost + cost);
                }
                else
                {
                    productAgg[key] = (line.ProductId, sku, name, qty, rev, cost);
                }
            }
        }

        var byProduct = productAgg.Values
            .Select(p =>
            {
                var gp = p.Rev - p.Cost;
                var margin = p.Rev > 0m ? Math.Round(gp / p.Rev * 100m, 2) : 0m;
                return new ProductMarginDto(p.ProductId, p.Sku, p.Name, p.Qty, p.Rev, p.Cost, gp, margin);
            })
            .OrderByDescending(p => p.Revenue)
            .ToList();

        var byStaff = docs
            .GroupBy(d => string.IsNullOrWhiteSpace(d.CreatedBy) ? "ไม่ระบุผู้ขาย" : d.CreatedBy!.Trim())
            .Select(g =>
            {
                var beforeVat = g.Sum(d => d.DocumentType == DocumentType.CreditNote ? -d.TotalBeforeVat : d.TotalBeforeVat);
                var grandTotal = g.Sum(d => d.DocumentType == DocumentType.CreditNote ? -d.GrandTotal : d.GrandTotal);
                var paidTotal = g.Where(d => d.Status == DocumentStatus.Paid || d.DocumentType is DocumentType.CashBill or DocumentType.Receipt)
                    .Sum(d => d.DocumentType == DocumentType.CreditNote ? -d.GrandTotal : d.GrandTotal);
                return new StaffSalesSummaryDto(g.Key, g.Count(), beforeVat, grandTotal, paidTotal);
            })
            .OrderByDescending(s => s.GrandTotal)
            .ToList();

        var totalRev = byProduct.Sum(p => p.Revenue);
        var totalCost = byProduct.Sum(p => p.EstimatedCost);
        var totalGp = totalRev - totalCost;
        var overallMargin = totalRev > 0m ? Math.Round(totalGp / totalRev * 100m, 2) : 0m;

        return Ok(new ApiResponse<SalesMarginReportDto>(true, "สำเร็จ",
            new SalesMarginReportDto(start, endInclusive, totalRev, totalCost, totalGp, overallMargin, byProduct, byStaff)));
    }

    [HttpGet("export/financial-statements-excel")]
    public async Task<IActionResult> ExportFinancialStatementsExcel(
        [FromQuery] DateTime? asOfDate,
        [FromQuery] int? year,
        CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        var cutoffDate = (asOfDate ?? DateTime.UtcNow).Date;
        var y = year is > 0 ? year.Value : cutoffDate.Year;

        var bs = await ComputeBalanceSheetAsync(tenantId, cutoffDate, ct);
        var startYear = new DateTime(y, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var endYear = startYear.AddYears(1);
        var cf = await ComputeCashFlowAsync(tenantId, startYear, endYear, ct);

        using var wb = new XLWorkbook();

        var wsBs = wb.Worksheets.Add("งบดุล (Balance Sheet)");
        wsBs.Cell("A1").Value = $"งบดุล ณ วันที่ {cutoffDate:dd/MM/yyyy}";
        wsBs.Cell("A1").Style.Font.Bold = true;
        wsBs.Cell("A3").Value = "หมวด";
        wsBs.Cell("B3").Value = "รหัสบัญชี";
        wsBs.Cell("C3").Value = "ชื่อบัญชี";
        wsBs.Cell("D3").Value = "ยอดคงเหลือ";
        wsBs.Range("A3:D3").Style.Font.Bold = true;

        var r = 4;
        foreach (var a in bs.AssetAccounts)
        {
            wsBs.Cell(r, 1).Value = "สินทรัพย์"; wsBs.Cell(r, 2).Value = a.AccountCode; wsBs.Cell(r, 3).Value = a.AccountName; wsBs.Cell(r, 4).Value = a.NetBalance; r++;
        }
        wsBs.Cell(r, 3).Value = "รวมสินทรัพย์"; wsBs.Cell(r, 4).Value = bs.TotalAssets; wsBs.Range(r, 1, r, 4).Style.Font.Bold = true; r++;
        foreach (var l in bs.LiabilityAccounts)
        {
            wsBs.Cell(r, 1).Value = "หนี้สิน"; wsBs.Cell(r, 2).Value = l.AccountCode; wsBs.Cell(r, 3).Value = l.AccountName; wsBs.Cell(r, 4).Value = l.NetBalance; r++;
        }
        wsBs.Cell(r, 3).Value = "รวมหนี้สิน"; wsBs.Cell(r, 4).Value = bs.TotalLiabilities; wsBs.Range(r, 1, r, 4).Style.Font.Bold = true; r++;
        foreach (var eq in bs.EquityAccounts)
        {
            wsBs.Cell(r, 1).Value = "ส่วนของเจ้าของ"; wsBs.Cell(r, 2).Value = eq.AccountCode; wsBs.Cell(r, 3).Value = eq.AccountName; wsBs.Cell(r, 4).Value = eq.NetBalance; r++;
        }
        wsBs.Cell(r, 1).Value = "ส่วนของเจ้าของ"; wsBs.Cell(r, 3).Value = "กำไร (ขาดทุน) สะสมงวดปัจจุบัน"; wsBs.Cell(r, 4).Value = bs.CurrentPeriodNetIncome; r++;
        wsBs.Cell(r, 3).Value = "รวมหนี้สินและส่วนของเจ้าของ"; wsBs.Cell(r, 4).Value = bs.TotalLiabilitiesAndEquity; wsBs.Range(r, 1, r, 4).Style.Font.Bold = true;
        wsBs.Range(4, 4, Math.Max(4, r), 4).Style.NumberFormat.Format = "#,##0.00";
        wsBs.Columns().AdjustToContents();

        var wsCf = wb.Worksheets.Add("งบกระแสเงินสด (Cash Flow)");
        wsCf.Cell("A1").Value = $"งบกระแสเงินสด ปี {y}";
        wsCf.Cell("A1").Style.Font.Bold = true;
        wsCf.Cell("A3").Value = "รายการ";
        wsCf.Cell("B3").Value = "หมวดหมู่";
        wsCf.Cell("C3").Value = "จำนวนเงิน (บาท)";
        wsCf.Range("A3:C3").Style.Font.Bold = true;
        wsCf.Cell(4, 1).Value = "เงินสดต้นงวด"; wsCf.Cell(4, 2).Value = "Opening"; wsCf.Cell(4, 3).Value = cf.OpeningCashBalance;
        var cr = 5;
        foreach (var item in cf.Breakdown)
        {
            wsCf.Cell(cr, 1).Value = item.Label; wsCf.Cell(cr, 2).Value = item.Category; wsCf.Cell(cr, 3).Value = item.Amount; cr++;
        }
        wsCf.Cell(cr, 1).Value = "กระแสเงินสดสุทธิ"; wsCf.Cell(cr, 3).Value = cf.NetCashFlow; wsCf.Range(cr, 1, cr, 3).Style.Font.Bold = true; cr++;
        wsCf.Cell(cr, 1).Value = "เงินสดปลายงวด"; wsCf.Cell(cr, 3).Value = cf.EndingCashBalance; wsCf.Range(cr, 1, cr, 3).Style.Font.Bold = true;
        wsCf.Range(4, 3, Math.Max(4, cr), 3).Style.NumberFormat.Format = "#,##0.00";
        wsCf.Columns().AdjustToContents();

        // Worksheet 3: Profit & Loss summary for the selected year
        var pnlLines = await dbContext.JournalEntryLines
            .AsNoTracking()
            .Include(l => l.Account)
            .Include(l => l.JournalEntry)
            .Where(l => l.JournalEntry.TenantId == tenantId &&
                        l.JournalEntry.IsPosted &&
                        l.JournalEntry.EntryDate >= startYear &&
                        l.JournalEntry.EntryDate < endYear &&
                        (l.Account.AccountType == AccountType.Revenue || l.Account.AccountType == AccountType.Expense))
            .ToListAsync(ct);

        var pnlGrouped = pnlLines
            .GroupBy(l => new { l.AccountId, l.Account.Code, l.Account.Name, l.Account.AccountType })
            .OrderBy(g => g.Key.Code)
            .Select(g => new
            {
                g.Key.Code,
                g.Key.Name,
                g.Key.AccountType,
                Net = g.Key.AccountType == AccountType.Revenue ? g.Sum(x => x.Credit - x.Debit) : g.Sum(x => x.Debit - x.Credit)
            })
            .ToList();

        var totalPnlRev = pnlGrouped.Where(x => x.AccountType == AccountType.Revenue).Sum(x => x.Net);
        var totalPnlExp = pnlGrouped.Where(x => x.AccountType == AccountType.Expense).Sum(x => x.Net);

        var wsPnl = wb.Worksheets.Add("งบกำไรขาดทุน (Profit & Loss)");
        wsPnl.Cell("A1").Value = $"งบกำไรขาดทุน ประจำปี {y}";
        wsPnl.Cell("A1").Style.Font.Bold = true;
        wsPnl.Cell("A3").Value = "หมวด";
        wsPnl.Cell("B3").Value = "รหัสบัญชี";
        wsPnl.Cell("C3").Value = "ชื่อบัญชี";
        wsPnl.Cell("D3").Value = "จำนวนเงิน (บาท)";
        wsPnl.Range("A3:D3").Style.Font.Bold = true;
        var pr = 4;
        foreach (var row in pnlGrouped)
        {
            wsPnl.Cell(pr, 1).Value = row.AccountType == AccountType.Revenue ? "รายได้" : "ค่าใช้จ่าย";
            wsPnl.Cell(pr, 2).Value = row.Code;
            wsPnl.Cell(pr, 3).Value = row.Name;
            wsPnl.Cell(pr, 4).Value = row.Net;
            pr++;
        }
        wsPnl.Cell(pr, 3).Value = "รวมรายได้"; wsPnl.Cell(pr, 4).Value = totalPnlRev; wsPnl.Range(pr, 1, pr, 4).Style.Font.Bold = true; pr++;
        wsPnl.Cell(pr, 3).Value = "รวมค่าใช้จ่าย"; wsPnl.Cell(pr, 4).Value = totalPnlExp; wsPnl.Range(pr, 1, pr, 4).Style.Font.Bold = true; pr++;
        wsPnl.Cell(pr, 3).Value = "กำไร (ขาดทุน) สุทธิ"; wsPnl.Cell(pr, 4).Value = totalPnlRev - totalPnlExp; wsPnl.Range(pr, 1, pr, 4).Style.Font.Bold = true;
        wsPnl.Range(4, 4, Math.Max(4, pr), 4).Style.NumberFormat.Format = "#,##0.00";
        wsPnl.Columns().AdjustToContents();

        using var ms = new MemoryStream();
        wb.SaveAs(ms);
        return File(ms.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"FinancialStatements_{cutoffDate:yyyyMMdd}.xlsx");
    }

    [HttpGet("periods")]
    public async Task<ActionResult<ApiResponse<List<AccountingPeriodDto>>>> GetPeriods(
        [FromQuery] int? year,
        CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        var targetYear = year is > 0 ? year.Value : DateTime.UtcNow.Year;

        var locks = await dbContext.AccountingPeriodLocks
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.Year == targetYear)
            .ToDictionaryAsync(p => p.Month, ct);

        var startYear = new DateTime(targetYear, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var endYear = startYear.AddYears(1);
        var jvMonths = await dbContext.JournalEntries
            .AsNoTracking()
            .Where(j => j.TenantId == tenantId && j.EntryDate >= startYear && j.EntryDate < endYear)
            .GroupBy(j => j.EntryDate.Month)
            .Select(g => new { Month = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Month, x => x.Count, ct);

        var list = Enumerable.Range(1, 12).Select(m =>
        {
            locks.TryGetValue(m, out var l);
            jvMonths.TryGetValue(m, out var jCount);
            return new AccountingPeriodDto(
                targetYear,
                m,
                $"{targetYear:D4}-{m:D2}",
                l?.IsLocked == true,
                l?.LockedAt,
                l?.LockedBy,
                l?.Notes,
                jCount);
        }).ToList();

        return Ok(new ApiResponse<List<AccountingPeriodDto>>(true, "สำเร็จ", list));
    }

    [HttpPost("periods/lock")]
    [Authorize(Roles = "Admin,SystemAdmin,SuperAdmin")]
    public async Task<ActionResult<ApiResponse<AccountingPeriodDto>>> LockPeriod(
        [FromBody] LockAccountingPeriodRequest request,
        CancellationToken ct = default)
    {
        if (request.Year < 2000 || request.Month < 1 || request.Month > 12)
            return BadRequest(new ApiResponse<AccountingPeriodDto>(false, "ปีหรือเดือนงวดบัญชีไม่ถูกต้อง", null));

        var tenantId = GetTenantId();
        var username = GetUsername() ?? "Admin";
        var now = DateTime.UtcNow;

        var existing = await dbContext.AccountingPeriodLocks
            .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Year == request.Year && p.Month == request.Month, ct);

        if (existing is null)
        {
            existing = new AccountingPeriodLock
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Year = request.Year,
                Month = request.Month,
                IsLocked = true,
                LockedAt = now,
                LockedBy = username,
                Notes = request.Notes?.Trim()
            };
            dbContext.AccountingPeriodLocks.Add(existing);
        }
        else
        {
            existing.IsLocked = true;
            existing.LockedAt = now;
            existing.LockedBy = username;
            existing.Notes = request.Notes?.Trim();
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Username = username,
            Action = "AccountingPeriodLock",
            EntityName = "AccountingPeriodLock",
            EntityId = $"{request.Year:D4}-{request.Month:D2}",
            NewValues = $"{{\"isLocked\":true,\"notes\":\"{existing.Notes ?? ""}\"}}",
            Timestamp = now
        });

        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<AccountingPeriodDto>(
            true,
            $"ปิดงวดบัญชี {request.Month:D2}/{request.Year} สำเร็จ",
            new AccountingPeriodDto(request.Year, request.Month, $"{request.Year:D4}-{request.Month:D2}", true, existing.LockedAt, existing.LockedBy, existing.Notes, 0)));
    }

    [HttpPost("periods/unlock")]
    [Authorize(Roles = "Admin,SystemAdmin,SuperAdmin")]
    public async Task<ActionResult<ApiResponse<AccountingPeriodDto>>> UnlockPeriod(
        [FromBody] LockAccountingPeriodRequest request,
        CancellationToken ct = default)
    {
        if (request.Year < 2000 || request.Month < 1 || request.Month > 12)
            return BadRequest(new ApiResponse<AccountingPeriodDto>(false, "ปีหรือเดือนงวดบัญชีไม่ถูกต้อง", null));

        var tenantId = GetTenantId();
        var username = GetUsername() ?? "Admin";
        var now = DateTime.UtcNow;

        var existing = await dbContext.AccountingPeriodLocks
            .FirstOrDefaultAsync(p => p.TenantId == tenantId && p.Year == request.Year && p.Month == request.Month, ct);

        if (existing is not null)
        {
            existing.IsLocked = false;
            existing.UnlockedAt = now;
            existing.UnlockedBy = username;
            if (!string.IsNullOrWhiteSpace(request.Notes))
                existing.Notes = request.Notes.Trim();
        }

        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Username = username,
            Action = "AccountingPeriodUnlock",
            EntityName = "AccountingPeriodLock",
            EntityId = $"{request.Year:D4}-{request.Month:D2}",
            NewValues = $"{{\"isLocked\":false,\"reason\":\"{request.Notes ?? ""}\"}}",
            Timestamp = now
        });

        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<AccountingPeriodDto>(
            true,
            $"เปิดงวดบัญชี {request.Month:D2}/{request.Year} เรียบร้อยแล้ว",
            new AccountingPeriodDto(request.Year, request.Month, $"{request.Year:D4}-{request.Month:D2}", false, existing?.LockedAt, existing?.LockedBy, existing?.Notes, 0)));
    }

    private async Task<BalanceSheetDto> ComputeBalanceSheetAsync(Guid tenantId, DateTime cutoffDate, CancellationToken ct)
    {
        await accountingService.EnsureDefaultChartOfAccountsAsync(tenantId, ct);
        var endExclusive = DateTime.SpecifyKind(cutoffDate.Date.AddDays(1), DateTimeKind.Utc);

        var lines = await dbContext.JournalEntryLines
            .AsNoTracking()
            .Include(l => l.Account)
            .Include(l => l.JournalEntry)
            .Where(l => l.JournalEntry.TenantId == tenantId &&
                        l.JournalEntry.IsPosted &&
                        l.JournalEntry.EntryDate < endExclusive)
            .ToListAsync(ct);

        var grouped = lines
            .GroupBy(l => new { l.AccountId, l.Account.Code, l.Account.Name, l.Account.AccountType })
            .OrderBy(g => g.Key.Code)
            .Select(g =>
            {
                var dr = g.Sum(x => x.Debit);
                var cr = g.Sum(x => x.Credit);
                var net = g.Key.AccountType switch
                {
                    AccountType.Asset or AccountType.Expense => dr - cr,
                    _ => cr - dr
                };
                return new TrialBalanceRowDto(g.Key.AccountId, g.Key.Code, g.Key.Name, g.Key.AccountType, dr, cr, net);
            })
            .ToList();

        var assetRows = grouped.Where(r => r.AccountType == AccountType.Asset).ToList();
        var liabilityRows = grouped.Where(r => r.AccountType == AccountType.Liability).ToList();
        var equityRows = grouped.Where(r => r.AccountType == AccountType.Equity).ToList();

        var totalRevenue = grouped.Where(r => r.AccountType == AccountType.Revenue).Sum(r => r.NetBalance);
        var totalExpense = grouped.Where(r => r.AccountType == AccountType.Expense).Sum(r => r.NetBalance);
        var currentNetIncome = totalRevenue - totalExpense;

        var totalAssets = assetRows.Sum(r => r.NetBalance);
        var totalLiabilities = liabilityRows.Sum(r => r.NetBalance);
        var totalEquity = equityRows.Sum(r => r.NetBalance);
        var totalLAndE = totalLiabilities + totalEquity + currentNetIncome;

        return new BalanceSheetDto(
            cutoffDate,
            totalAssets,
            totalLiabilities,
            totalEquity,
            currentNetIncome,
            totalLAndE,
            Math.Abs(totalAssets - totalLAndE) < 0.01m,
            assetRows,
            liabilityRows,
            equityRows);
    }

    private async Task<CashFlowStatementDto> ComputeCashFlowAsync(Guid tenantId, DateTime start, DateTime end, CancellationToken ct)
    {
        await accountingService.EnsureDefaultChartOfAccountsAsync(tenantId, ct);

        var cashAccountIds = await dbContext.ChartOfAccounts
            .AsNoTracking()
            .Where(a => a.TenantId == tenantId && a.Code.StartsWith("111"))
            .Select(a => a.Id)
            .ToHashSetAsync(ct);

        var openingCash = await dbContext.JournalEntryLines
            .AsNoTracking()
            .Include(l => l.JournalEntry)
            .Where(l => l.JournalEntry.TenantId == tenantId &&
                        l.JournalEntry.IsPosted &&
                        cashAccountIds.Contains(l.AccountId) &&
                        l.JournalEntry.EntryDate < start)
            .SumAsync(l => l.Debit - l.Credit, ct);

        var periodCashEntries = await dbContext.JournalEntries
            .AsNoTracking()
            .Include(j => j.Lines)
            .ThenInclude(jl => jl.Account)
            .Where(j => j.TenantId == tenantId &&
                        j.IsPosted &&
                        j.EntryDate >= start &&
                        j.EntryDate < end &&
                        j.Lines.Any(l => cashAccountIds.Contains(l.AccountId)))
            .ToListAsync(ct);

        decimal operatingInflows = 0m;
        decimal operatingOutflows = 0m;
        decimal financingNet = 0m;

        foreach (var entry in periodCashEntries)
        {
            var hasEquityContra = entry.Lines.Any(ol => !cashAccountIds.Contains(ol.AccountId) && ol.Account.AccountType == AccountType.Equity);
            foreach (var line in entry.Lines.Where(l => cashAccountIds.Contains(l.AccountId)))
            {
                var delta = line.Debit - line.Credit;
                if (hasEquityContra)
                {
                    financingNet += delta;
                }
                else if (delta >= 0)
                {
                    operatingInflows += delta;
                }
                else
                {
                    operatingOutflows += Math.Abs(delta);
                }
            }
        }

        var breakdown = new List<CashFlowItemDto>
        {
            new("เงินสดรับจากการขายและรับชำระลูกหนี้", operatingInflows, "OperatingInflow"),
            new("เงินสดจ่ายค่าใช้จ่ายและจัดซื้อสินค้า", -operatingOutflows, "OperatingOutflow"),
            new("กิจกรรมจัดหาเงิน / ทุนเจ้าของสุทธิ", financingNet, "Financing")
        };

        var netCashFlow = operatingInflows - operatingOutflows + financingNet;
        var endingCash = openingCash + netCashFlow;

        return new CashFlowStatementDto(
            start,
            end.AddDays(-1),
            openingCash,
            operatingInflows,
            operatingOutflows,
            financingNet,
            netCashFlow,
            endingCash,
            breakdown);
    }
}

