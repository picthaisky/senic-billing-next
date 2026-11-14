using System.Globalization;
using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using SenicBilling.API.Hubs;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/bank-reconciliation")]
[Authorize]
public class BankReconciliationController(
    SenicBillingDbContext dbContext,
    IAccountingService accountingService,
    ILineNotifyService? lineNotifyService = null,
    IHubContext<SenicBillingHub>? hubContext = null) : ControllerBase
{
    private Guid GetTenantId() => Guid.Parse(User.FindFirst("tenantId")!.Value);
    private string? GetUsername() => User.FindFirst(ClaimTypes.Name)?.Value ?? User.Identity?.Name;

    [HttpGet("transactions")]
    public async Task<ActionResult<ApiResponse<object>>> GetTransactions(
        [FromQuery] BankMatchStatus? status,
        CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        var query = dbContext.BankStatementTransactions
            .AsNoTracking()
            .Where(t => t.TenantId == tenantId);

        if (status.HasValue)
        {
            query = query.Where(t => t.MatchStatus == status.Value);
        }

        var transactions = await query
            .OrderByDescending(t => t.TransactionDate)
            .ThenByDescending(t => t.CreatedAt)
            .Take(200)
            .ToListAsync(ct);

        var (docCandidates, expCandidates) = await LoadCandidatesAsync(tenantId, ct);

        var dtos = transactions
            .Select(t => MapTransactionWithSuggestion(t, docCandidates, expCandidates))
            .ToList();

        var allTx = status.HasValue
            ? await dbContext.BankStatementTransactions.AsNoTracking().Where(t => t.TenantId == tenantId).ToListAsync(ct)
            : transactions;

        var summary = new BankReconciliationSummaryDto(
            allTx.Count,
            allTx.Count(t => t.MatchStatus == BankMatchStatus.Matched),
            dtos.Count(t => t.MatchStatus != BankMatchStatus.Matched && (t.SuggestedDocumentId.HasValue || t.SuggestedExpenseId.HasValue)),
            allTx.Count(t => t.MatchStatus is BankMatchStatus.Unmatched or BankMatchStatus.Suggested),
            allTx.Where(t => t.MatchStatus == BankMatchStatus.Matched).Sum(t => t.DepositAmount),
            allTx.Where(t => t.MatchStatus != BankMatchStatus.Matched && t.MatchStatus != BankMatchStatus.Ignored).Sum(t => t.DepositAmount));

        return Ok(new ApiResponse<object>(true, "สำเร็จ", new { summary, transactions = dtos }));
    }

    [HttpGet("candidates")]
    public async Task<ActionResult<ApiResponse<BankReconciliationCandidatesDto>>> GetCandidates(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var (docs, exps) = await LoadCandidatesAsync(tenantId, ct);

        var docDtos = docs.Select(d => new ReconciliationDocumentCandidateDto(
            d.Id, d.DocumentNumber, d.DocumentType, d.DocumentDate, d.DueDate,
            d.CustomerName, d.GrandTotal, Math.Max(0m, d.GrandTotal - d.WhtAmount), d.Status)).ToList();

        var expDtos = exps.Select(e => new ReconciliationExpenseCandidateDto(
            e.Id, e.VoucherNumber, e.ExpenseDate, e.VendorName, e.Description, e.NetPaidAmount, e.Status)).ToList();

        return Ok(new ApiResponse<BankReconciliationCandidatesDto>(
            true, "สำเร็จ", new BankReconciliationCandidatesDto(docDtos, expDtos)));
    }

    [HttpPost("import")]
    public async Task<ActionResult<ApiResponse<List<BankStatementTransactionDto>>>> Import(
        [FromBody] ImportBankStatementRequest request,
        CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var entries = new List<BankStatementTransaction>();

        if (!string.IsNullOrWhiteSpace(request.CsvContent))
        {
            entries.AddRange(ParseCsvRows(request.CsvContent, tenantId, request.BankName, request.AccountNumber));
        }

        if (request.Transactions is { Count: > 0 })
        {
            foreach (var item in request.Transactions)
            {
                if (string.IsNullOrWhiteSpace(item.Description) && item.DepositAmount <= 0 && item.WithdrawalAmount <= 0)
                    continue;

                entries.Add(new BankStatementTransaction
                {
                    Id = Guid.NewGuid(),
                    TenantId = tenantId,
                    TransactionDate = DateTime.SpecifyKind(item.TransactionDate, DateTimeKind.Utc),
                    BankName = item.BankName ?? request.BankName,
                    AccountNumber = item.AccountNumber ?? request.AccountNumber,
                    ReferenceNo = item.ReferenceNo?.Trim(),
                    Description = string.IsNullOrWhiteSpace(item.Description) ? "โอนเงินผ่านธนาคาร" : item.Description.Trim(),
                    CounterpartyName = item.CounterpartyName?.Trim(),
                    DepositAmount = Math.Max(0m, item.DepositAmount),
                    WithdrawalAmount = Math.Max(0m, item.WithdrawalAmount),
                    Balance = item.Balance,
                    MatchStatus = BankMatchStatus.Unmatched,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        if (entries.Count == 0)
            return BadRequest(new ApiResponse<List<BankStatementTransactionDto>>(false, "ไม่พบรายการเดินบัญชีที่ถูกต้องสำหรับนำเข้า", null));

        var (docs, exps) = await LoadCandidatesAsync(tenantId, ct);
        foreach (var entry in entries)
        {
            var suggestedDoc = FindBestDocumentSuggestion(entry, docs);
            var suggestedExp = suggestedDoc is null ? FindBestExpenseSuggestion(entry, exps) : null;
            if (suggestedDoc is not null || suggestedExp is not null)
            {
                entry.MatchStatus = BankMatchStatus.Suggested;
            }
        }

        dbContext.BankStatementTransactions.AddRange(entries);
        await dbContext.SaveChangesAsync(ct);

        var resultDtos = entries.Select(e => MapTransactionWithSuggestion(e, docs, exps)).ToList();
        return Ok(new ApiResponse<List<BankStatementTransactionDto>>(true, $"นำเข้า {entries.Count} รายการสำเร็จ", resultDtos));
    }

    [HttpPost("auto-reconcile")]
    public async Task<ActionResult<ApiResponse<object>>> AutoReconcile(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var pending = await dbContext.BankStatementTransactions
            .Where(t => t.TenantId == tenantId && (t.MatchStatus == BankMatchStatus.Unmatched || t.MatchStatus == BankMatchStatus.Suggested))
            .OrderBy(t => t.TransactionDate)
            .ToListAsync(ct);

        var (docs, exps) = await LoadCandidatesAsync(tenantId, ct);
        var docLookup = docs.ToDictionary(d => d.Id);
        var expLookup = exps.ToDictionary(e => e.Id);
        var matchedDocIds = new HashSet<Guid>();
        var matchedExpIds = new HashSet<Guid>();
        var username = GetUsername();
        var matchedCount = 0;

        foreach (var tx in pending)
        {
            if (tx.DepositAmount > 0)
            {
                var exactCandidates = docs
                    .Where(d => !matchedDocIds.Contains(d.Id) && IsExactDocumentMatch(tx, d))
                    .ToList();

                // Auto-reconcile only when unambiguously matched (doc number in description/ref OR unique exact amount)
                DocumentHeader? chosen = null;
                if (exactCandidates.Count == 1)
                {
                    chosen = exactCandidates[0];
                }
                else if (exactCandidates.Count > 1)
                {
                    chosen = exactCandidates.FirstOrDefault(d => ContainsReference(tx, d.DocumentNumber));
                }

                if (chosen is not null && !await accountingService.IsPeriodLockedAsync(tenantId, tx.TransactionDate, ct))
                {
                    await ApplyDocumentMatchAsync(tx, docLookup[chosen.Id], username, ct);
                    matchedDocIds.Add(chosen.Id);
                    matchedCount++;
                    continue;
                }
            }

            if (tx.WithdrawalAmount > 0)
            {
                var expCandidates = exps
                    .Where(e => !matchedExpIds.Contains(e.Id) && IsExactExpenseMatch(tx, e))
                    .ToList();

                ExpenseRecord? chosenExp = expCandidates.Count == 1
                    ? expCandidates[0]
                    : expCandidates.FirstOrDefault(e => ContainsReference(tx, e.VoucherNumber) || (!string.IsNullOrEmpty(e.TaxInvoiceNumber) && ContainsReference(tx, e.TaxInvoiceNumber)));

                if (chosenExp is not null && !await accountingService.IsPeriodLockedAsync(tenantId, tx.TransactionDate, ct))
                {
                    await ApplyExpenseMatchAsync(tx, expLookup[chosenExp.Id], username, ct);
                    matchedExpIds.Add(chosenExp.Id);
                    matchedCount++;
                }
            }
        }

        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<object>(
            true,
            $"กระทบยอดอัตโนมัติสำเร็จ {matchedCount} รายการ",
            new { matchedCount, totalChecked = pending.Count }));
    }

    [HttpPost("transactions/{id:guid}/match")]
    public async Task<ActionResult<ApiResponse<BankStatementTransactionDto>>> ManualMatch(
        Guid id, [FromBody] MatchBankTransactionRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        if (!request.DocumentId.HasValue && !request.ExpenseId.HasValue)
            return BadRequest(new ApiResponse<BankStatementTransactionDto>(false, "กรุณาเลือกเอกสารหรือใบสำคัญจ่ายที่ต้องการจับคู่", null));

        var tx = await dbContext.BankStatementTransactions
            .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId, ct);
        if (tx is null)
            return NotFound(new ApiResponse<BankStatementTransactionDto>(false, "ไม่พบรายการเดินบัญชี", null));
        if (tx.MatchStatus == BankMatchStatus.Matched)
            return BadRequest(new ApiResponse<BankStatementTransactionDto>(false, "รายการนี้ถูกจับคู่แล้ว", null));

        if (await accountingService.IsPeriodLockedAsync(tenantId, tx.TransactionDate, ct))
            return BadRequest(new ApiResponse<BankStatementTransactionDto>(false, $"งวดบัญชี {tx.TransactionDate.Month:D2}/{tx.TransactionDate.Year} ถูกปิดงวดแล้ว", null));

        var username = GetUsername();
        if (request.DocumentId.HasValue)
        {
            if (tx.DepositAmount <= 0)
                return BadRequest(new ApiResponse<BankStatementTransactionDto>(false, "รายการเงินเข้าเท่านั้นที่สามารถจับคู่กับใบแจ้งหนี้/ใบกำกับภาษีได้", null));

            var doc = await dbContext.DocumentHeaders
                .FirstOrDefaultAsync(d => d.Id == request.DocumentId.Value && d.TenantId == tenantId, ct);
            if (doc is null)
                return NotFound(new ApiResponse<BankStatementTransactionDto>(false, "ไม่พบเอกสารที่เลือก", null));
            if (doc.Status == DocumentStatus.Cancelled || doc.Status == DocumentStatus.Paid)
                return BadRequest(new ApiResponse<BankStatementTransactionDto>(false, "เอกสารนี้ไม่สามารถบันทึกการรับชำระได้", null));

            await ApplyDocumentMatchAsync(tx, doc, username, ct);
        }
        else if (request.ExpenseId.HasValue)
        {
            if (tx.WithdrawalAmount <= 0)
                return BadRequest(new ApiResponse<BankStatementTransactionDto>(false, "รายการเงินออกเท่านั้นที่สามารถจับคู่กับใบสำคัญจ่ายได้", null));

            var expense = await dbContext.ExpenseRecords
                .FirstOrDefaultAsync(e => e.Id == request.ExpenseId.Value && e.TenantId == tenantId, ct);
            if (expense is null)
                return NotFound(new ApiResponse<BankStatementTransactionDto>(false, "ไม่พบใบสำคัญจ่ายที่เลือก", null));
            if (expense.Status == ExpenseStatus.Cancelled)
                return BadRequest(new ApiResponse<BankStatementTransactionDto>(false, "ไม่สามารถจับคู่ใบสำคัญจ่ายที่ยกเลิกแล้ว", null));

            await ApplyExpenseMatchAsync(tx, expense, username, ct);
        }

        await dbContext.SaveChangesAsync(ct);

        var (docs, exps) = await LoadCandidatesAsync(tenantId, ct);
        return Ok(new ApiResponse<BankStatementTransactionDto>(true, "จับคู่และกระทบยอดรายการสำเร็จ", MapTransactionWithSuggestion(tx, docs, exps)));
    }

    [HttpPost("transactions/{id:guid}/ignore")]
    public async Task<ActionResult<ApiResponse<bool>>> IgnoreTransaction(Guid id, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var tx = await dbContext.BankStatementTransactions
            .FirstOrDefaultAsync(t => t.Id == id && t.TenantId == tenantId, ct);
        if (tx is null)
            return NotFound(new ApiResponse<bool>(false, "ไม่พบรายการเดินบัญชี", false));

        if (tx.MatchStatus == BankMatchStatus.Matched)
            return BadRequest(new ApiResponse<bool>(false, "ไม่สามารถข้ามรายการที่จับคู่แล้วได้", false));

        tx.MatchStatus = BankMatchStatus.Ignored;
        tx.MatchedAt = DateTime.UtcNow;
        tx.MatchedBy = GetUsername();
        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<bool>(true, "ทำเครื่องหมายไม่เกี่ยวข้องสำเร็จ", true));
    }

    // ── Private Helpers ──

    private async Task<(List<DocumentHeader> docs, List<ExpenseRecord> exps)> LoadCandidatesAsync(Guid tenantId, CancellationToken ct)
    {
        var docs = await dbContext.DocumentHeaders
            .Where(d => d.TenantId == tenantId &&
                        d.Status != DocumentStatus.Draft &&
                        d.Status != DocumentStatus.Paid &&
                        d.Status != DocumentStatus.Cancelled &&
                        d.DocumentType != DocumentType.Quotation &&
                        d.DocumentType != DocumentType.DeliveryNote &&
                        d.DocumentType != DocumentType.CreditNote)
            .OrderByDescending(d => d.DocumentDate)
            .Take(200)
            .ToListAsync(ct);

        var exps = await dbContext.ExpenseRecords
            .Where(e => e.TenantId == tenantId &&
                        e.Status == ExpenseStatus.Approved)
            .OrderByDescending(e => e.ExpenseDate)
            .Take(200)
            .ToListAsync(ct);

        return (docs, exps);
    }

    private async Task ApplyDocumentMatchAsync(BankStatementTransaction tx, DocumentHeader doc, string? username, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        doc.Status = DocumentStatus.Paid;
        doc.UpdatedAt = now;

        tx.MatchStatus = BankMatchStatus.Matched;
        tx.MatchedDocumentId = doc.Id;
        tx.MatchedDocumentNumber = doc.DocumentNumber;
        tx.MatchedAt = now;
        tx.MatchedBy = username;

        dbContext.PaymentTransactions.Add(new PaymentTransaction
        {
            Id = Guid.NewGuid(),
            TenantId = doc.TenantId,
            DocumentId = doc.Id,
            Amount = tx.DepositAmount > 0 ? tx.DepositAmount : doc.GrandTotal,
            PaymentMethod = "bank_transfer",
            GatewayReference = string.IsNullOrWhiteSpace(tx.ReferenceNo) ? $"BANK_{tx.Id.ToString("N")[..8]}" : tx.ReferenceNo,
            Status = "successful",
            PaidAt = tx.TransactionDate,
            CreatedAt = now
        });

        await dbContext.SaveChangesAsync(ct);
        await accountingService.PostPaymentAsync(doc, doc.GrandTotal, username, ct);

        if (hubContext is not null)
        {
            await hubContext.Clients.Group($"Tenant_{doc.TenantId}")
                .SendAsync("PaymentReceived", new { documentId = doc.Id, amount = doc.GrandTotal }, ct);
        }

        if (lineNotifyService is not null)
        {
            var tenant = await dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == doc.TenantId, ct);
            if (tenant != null && tenant.HasAnyLineChannel())
            {
                await lineNotifyService.NotifyTenantAsync(
                    tenant,
                    $"\nกระทบยอดเงินโอนเข้าบัญชีสำเร็จ!\nเลขที่เอกสาร: {doc.DocumentNumber}\nลูกค้า: {doc.CustomerName ?? "-"}\nยอดรับโอน: {tx.DepositAmount:N2} บาท",
                    ct);
            }
        }
    }

    private static Task ApplyExpenseMatchAsync(BankStatementTransaction tx, ExpenseRecord expense, string? username, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        expense.Status = ExpenseStatus.Paid;
        expense.UpdatedAt = now;

        tx.MatchStatus = BankMatchStatus.Matched;
        tx.MatchedExpenseId = expense.Id;
        tx.MatchedExpenseNumber = expense.VoucherNumber;
        tx.MatchedAt = now;
        tx.MatchedBy = username;
        return Task.CompletedTask;
    }

    private static bool IsExactDocumentMatch(BankStatementTransaction tx, DocumentHeader d)
    {
        var netReceivable = Math.Max(0m, d.GrandTotal - d.WhtAmount);
        return Math.Abs(tx.DepositAmount - d.GrandTotal) <= 0.01m ||
               Math.Abs(tx.DepositAmount - netReceivable) <= 0.01m;
    }

    private static bool IsExactExpenseMatch(BankStatementTransaction tx, ExpenseRecord e)
    {
        return Math.Abs(tx.WithdrawalAmount - e.NetPaidAmount) <= 0.01m ||
               Math.Abs(tx.WithdrawalAmount - e.GrandTotal) <= 0.01m;
    }

    private static bool ContainsReference(BankStatementTransaction tx, string reference)
    {
        if (string.IsNullOrWhiteSpace(reference)) return false;
        var haystack = $"{tx.ReferenceNo} {tx.Description} {tx.CounterpartyName}";
        return haystack.Contains(reference, StringComparison.OrdinalIgnoreCase);
    }

    private static DocumentHeader? FindBestDocumentSuggestion(BankStatementTransaction tx, List<DocumentHeader> docs)
    {
        if (tx.DepositAmount <= 0 || tx.MatchStatus == BankMatchStatus.Matched) return null;
        return docs.FirstOrDefault(d => ContainsReference(tx, d.DocumentNumber) && IsExactDocumentMatch(tx, d))
               ?? docs.FirstOrDefault(d => IsExactDocumentMatch(tx, d));
    }

    private static ExpenseRecord? FindBestExpenseSuggestion(BankStatementTransaction tx, List<ExpenseRecord> exps)
    {
        if (tx.WithdrawalAmount <= 0 || tx.MatchStatus == BankMatchStatus.Matched) return null;
        return exps.FirstOrDefault(e => ContainsReference(tx, e.VoucherNumber) && IsExactExpenseMatch(tx, e))
               ?? exps.FirstOrDefault(e => IsExactExpenseMatch(tx, e));
    }

    private static BankStatementTransactionDto MapTransactionWithSuggestion(
        BankStatementTransaction t, List<DocumentHeader> docs, List<ExpenseRecord> exps)
    {
        var sugDoc = t.MatchStatus is BankMatchStatus.Unmatched or BankMatchStatus.Suggested
            ? FindBestDocumentSuggestion(t, docs)
            : null;
        var sugExp = sugDoc is null && t.MatchStatus is BankMatchStatus.Unmatched or BankMatchStatus.Suggested
            ? FindBestExpenseSuggestion(t, exps)
            : null;

        return new BankStatementTransactionDto(
            t.Id, t.TransactionDate, t.BankName, t.AccountNumber, t.ReferenceNo,
            t.Description, t.CounterpartyName, t.DepositAmount, t.WithdrawalAmount, t.Balance,
            t.MatchStatus, t.MatchedDocumentId, t.MatchedDocumentNumber,
            t.MatchedExpenseId, t.MatchedExpenseNumber, t.MatchedAt, t.MatchedBy,
            sugDoc?.Id, sugDoc?.DocumentNumber, sugDoc?.CustomerName, sugDoc?.GrandTotal,
            sugExp?.Id, sugExp?.VoucherNumber, sugExp?.VendorName);
    }

    private static List<BankStatementTransaction> ParseCsvRows(
        string csvContent, Guid tenantId, string? defaultBank, string? defaultAccount)
    {
        var results = new List<BankStatementTransaction>();
        var lines = csvContent.Replace("\r\n", "\n").Split('\n', StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length == 0) return results;

        var startIndex = 0;
        var firstCells = SplitCsvLine(lines[0]).Select(c => c.Trim().ToLowerInvariant()).ToList();
        var hasHeader = firstCells.Any(c =>
            c.Contains("date") || c.Contains("วันที่") || c.Contains("deposit") || c.Contains("ฝาก") || c.Contains("description") || c.Contains("รายการ"));

        int dateCol = 0, descCol = 1, withdrawalCol = 2, depositCol = 3, balanceCol = 4, refCol = 5;
        if (hasHeader)
        {
            startIndex = 1;
            for (var i = 0; i < firstCells.Count; i++)
            {
                var h = firstCells[i];
                if (h.Contains("date") || h.Contains("วันที่")) dateCol = i;
                else if (h.Contains("desc") || h.Contains("detail") || h.Contains("รายการ")) descCol = i;
                else if (h.Contains("withdraw") || h.Contains("debit") || h.Contains("ถอน") || h.Contains("จ่าย")) withdrawalCol = i;
                else if (h.Contains("deposit") || h.Contains("credit") || h.Contains("ฝาก") || h.Contains("รับ")) depositCol = i;
                else if (h.Contains("bal") || h.Contains("คงเหลือ")) balanceCol = i;
                else if (h.Contains("ref") || h.Contains("อ้างอิง")) refCol = i;
            }
        }

        string[] dateFormats = ["yyyy-MM-dd", "dd/MM/yyyy", "dd-MM-yyyy", "yyyy/MM/dd", "d/M/yyyy", "MM/dd/yyyy"];
        for (var i = startIndex; i < lines.Length; i++)
        {
            var cols = SplitCsvLine(lines[i]);
            if (cols.Count < 3) continue;

            var rawDate = dateCol < cols.Count ? cols[dateCol].Trim() : string.Empty;
            if (!DateTime.TryParseExact(rawDate, dateFormats, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsedDate) &&
                !DateTime.TryParse(rawDate, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out parsedDate))
            {
                continue;
            }

            var desc = descCol < cols.Count ? cols[descCol].Trim() : string.Empty;
            var withdrawal = ParseAmount(withdrawalCol < cols.Count ? cols[withdrawalCol] : string.Empty);
            var deposit = ParseAmount(depositCol < cols.Count ? cols[depositCol] : string.Empty);
            decimal? balance = balanceCol < cols.Count && decimal.TryParse(cols[balanceCol].Replace(",", ""), NumberStyles.Any, CultureInfo.InvariantCulture, out var bal)
                ? bal
                : null;
            var reference = refCol < cols.Count ? cols[refCol].Trim() : null;

            if (deposit <= 0 && withdrawal <= 0) continue;

            results.Add(new BankStatementTransaction
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                TransactionDate = DateTime.SpecifyKind(parsedDate, DateTimeKind.Utc),
                BankName = defaultBank,
                AccountNumber = defaultAccount,
                ReferenceNo = string.IsNullOrWhiteSpace(reference) ? null : reference,
                Description = string.IsNullOrWhiteSpace(desc) ? "รายการเดินบัญชีธนาคาร" : desc,
                DepositAmount = Math.Max(0m, deposit),
                WithdrawalAmount = Math.Max(0m, withdrawal),
                Balance = balance,
                MatchStatus = BankMatchStatus.Unmatched,
                CreatedAt = DateTime.UtcNow
            });
        }

        return results;
    }

    private static List<string> SplitCsvLine(string line)
    {
        var matches = Regex.Matches(line, "(?:^|,)(\"(?:[^\"]|\"\")*\"|[^,]*)");
        var list = new List<string>(matches.Count);
        foreach (Match m in matches)
        {
            var val = m.Groups[1].Value;
            if (val.StartsWith('"') && val.EndsWith('"') && val.Length >= 2)
                val = val[1..^1].Replace("\"\"", "\"");
            list.Add(val);
        }
        return list;
    }

    private static decimal ParseAmount(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return 0m;
        var clean = raw.Replace(",", "").Replace("฿", "").Trim();
        return decimal.TryParse(clean, NumberStyles.Any, CultureInfo.InvariantCulture, out var v) ? Math.Max(0m, v) : 0m;
    }
}

