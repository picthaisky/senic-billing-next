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
}

