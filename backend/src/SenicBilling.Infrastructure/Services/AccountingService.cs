using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Domain.Interfaces;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.Infrastructure.Services;

/// <summary>
/// Auto-Accounting Engine: seeds Thai SME Chart of Accounts per tenant and creates
/// balanced double-entry Journal Vouchers (Sum(Debit) == Sum(Credit)) for sales, payments, and expenses.
/// </summary>
public class AccountingService(
    SenicBillingDbContext dbContext,
    IDocumentNumberGeneratorService numberGenerator) : IAccountingService
{
    private static readonly (string Code, string Name, AccountType Type)[] DefaultAccounts =
    [
        ("1110", "เงินสดและเงินฝากธนาคาร", AccountType.Asset),
        ("1130", "ลูกหนี้การค้า", AccountType.Asset),
        ("1140", "ภาษีเงินได้ถูกหัก ณ ที่จ่าย", AccountType.Asset),
        ("1150", "สินค้าคงเหลือ", AccountType.Asset),
        ("1170", "ภาษีซื้อ", AccountType.Asset),
        ("2110", "เจ้าหนี้การค้า", AccountType.Liability),
        ("2130", "ภาษีขาย", AccountType.Liability),
        ("2140", "ภาษีหัก ณ ที่จ่ายค้างจ่าย (ภ.ง.ด.3/53)", AccountType.Liability),
        ("3100", "ทุนเรือนหุ้น / กำไรสะสม", AccountType.Equity),
        ("4100", "รายได้จากการขายและบริการ", AccountType.Revenue),
        ("5100", "ต้นทุนขาย / ซื้อสินค้า", AccountType.Expense),
        ("5200", "ค่าใช้จ่ายดำเนินงาน", AccountType.Expense)
    ];

    public async Task EnsureDefaultChartOfAccountsAsync(Guid tenantId, CancellationToken ct = default)
    {
        var existingCodes = await dbContext.ChartOfAccounts
            .Where(a => a.TenantId == tenantId)
            .Select(a => a.Code)
            .ToListAsync(ct);

        var missing = DefaultAccounts
            .Where(d => !existingCodes.Contains(d.Code))
            .Select(d => new ChartOfAccount
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Code = d.Code,
                Name = d.Name,
                AccountType = d.Type,
                IsSystem = true,
                IsActive = true
            })
            .ToList();

        if (missing.Count > 0)
        {
            dbContext.ChartOfAccounts.AddRange(missing);
            await dbContext.SaveChangesAsync(ct);
        }
    }

    public async Task<JournalEntry?> PostSalesDocumentAsync(DocumentHeader document, string? createdBy = null, CancellationToken ct = default)
    {
        if (document.DocumentType is DocumentType.Quotation or DocumentType.DeliveryNote ||
            document.Status is DocumentStatus.Draft or DocumentStatus.Cancelled)
        {
            return null;
        }

        // Idempotent guard: avoid duplicate auto-posting unless prior entries were already reversed
        var hasActivePosting = await dbContext.JournalEntries.AnyAsync(j =>
            j.TenantId == document.TenantId &&
            j.SourceType == JournalSourceType.SalesDocument &&
            j.SourceId == document.Id &&
            !dbContext.JournalEntries.Any(r =>
                r.TenantId == document.TenantId &&
                r.SourceType == JournalSourceType.Reversal &&
                r.SourceId == j.Id), ct);
        if (hasActivePosting)
        {
            return null;
        }

        var accounts = await GetAccountsByCodeAsync(document.TenantId, ct);
        var isCashImmediate = document.DocumentType is DocumentType.CashBill or DocumentType.Receipt ||
                              document.Status == DocumentStatus.Paid;
        var arOrCashAccount = isCashImmediate ? accounts["1110"] : accounts["1130"];
        var isCreditNote = document.DocumentType == DocumentType.CreditNote;

        var lines = new List<JournalEntryLine>();
        if (isCreditNote)
        {
            // Credit Note reduces revenue and output VAT: Dr. Revenue + Dr. Output VAT / Cr. AR (or Cash)
            if (document.TotalBeforeVat > 0)
            {
                lines.Add(new JournalEntryLine
                {
                    Id = Guid.NewGuid(),
                    AccountId = accounts["4100"].Id,
                    Debit = document.TotalBeforeVat,
                    Credit = 0m,
                    Memo = $"ลดหนี้รายได้ {document.DocumentNumber}"
                });
            }

            if (document.VatAmount > 0)
            {
                lines.Add(new JournalEntryLine
                {
                    Id = Guid.NewGuid(),
                    AccountId = accounts["2130"].Id,
                    Debit = document.VatAmount,
                    Credit = 0m,
                    Memo = $"ลดหนี้ภาษีขาย {document.DocumentNumber}"
                });
            }

            lines.Add(new JournalEntryLine
            {
                Id = Guid.NewGuid(),
                AccountId = arOrCashAccount.Id,
                Debit = 0m,
                Credit = document.GrandTotal,
                Memo = document.CustomerName
            });
        }
        else
        {
            lines.Add(new JournalEntryLine
            {
                Id = Guid.NewGuid(),
                AccountId = arOrCashAccount.Id,
                Debit = document.GrandTotal,
                Credit = 0m,
                Memo = document.CustomerName
            });

            if (document.TotalBeforeVat > 0)
            {
                lines.Add(new JournalEntryLine
                {
                    Id = Guid.NewGuid(),
                    AccountId = accounts["4100"].Id,
                    Debit = 0m,
                    Credit = document.TotalBeforeVat,
                    Memo = $"รายได้ {document.DocumentNumber}"
                });
            }

            if (document.VatAmount > 0)
            {
                lines.Add(new JournalEntryLine
                {
                    Id = Guid.NewGuid(),
                    AccountId = accounts["2130"].Id,
                    Debit = 0m,
                    Credit = document.VatAmount,
                    Memo = $"ภาษีขาย {document.DocumentNumber}"
                });
            }
        }

        var description = isCreditNote
            ? $"บันทึกใบลดหนี้อัตโนมัติจาก {document.DocumentNumber}"
            : $"บันทึกรายได้อัตโนมัติจาก {document.DocumentNumber}";

        return await SaveEntryAsync(
            document.TenantId,
            document.DocumentDate,
            description,
            JournalSourceType.SalesDocument,
            document.Id,
            document.DocumentNumber,
            lines,
            createdBy,
            ct);
    }

    public async Task<JournalEntry?> PostPaymentAsync(DocumentHeader document, decimal amountPaid, string? createdBy = null, CancellationToken ct = default)
    {
        if (amountPaid <= 0 ||
            document.DocumentType is DocumentType.CashBill or DocumentType.Receipt or DocumentType.Quotation or DocumentType.DeliveryNote or DocumentType.CreditNote)
        {
            return null;
        }

        var hasActivePayment = await dbContext.JournalEntries.AnyAsync(j =>
            j.TenantId == document.TenantId &&
            j.SourceType == JournalSourceType.Payment &&
            j.SourceId == document.Id &&
            !dbContext.JournalEntries.Any(r =>
                r.TenantId == document.TenantId &&
                r.SourceType == JournalSourceType.Reversal &&
                r.SourceId == j.Id), ct);
        if (hasActivePayment)
        {
            return null;
        }

        var accounts = await GetAccountsByCodeAsync(document.TenantId, ct);
        var wht = document.WhtAmount;
        var netCash = Math.Max(0m, document.GrandTotal - wht);

        var lines = new List<JournalEntryLine>
        {
            new() { Id = Guid.NewGuid(), AccountId = accounts["1110"].Id, Debit = netCash, Credit = 0m, Memo = $"รับชำระ {document.DocumentNumber}" }
        };

        if (wht > 0)
        {
            lines.Add(new JournalEntryLine
            {
                Id = Guid.NewGuid(),
                AccountId = accounts["1140"].Id,
                Debit = wht,
                Credit = 0m,
                Memo = $"ถูกหัก ณ ที่จ่าย {document.DocumentNumber}"
            });
        }

        lines.Add(new JournalEntryLine
        {
            Id = Guid.NewGuid(),
            AccountId = accounts["1130"].Id,
            Debit = 0m,
            Credit = netCash + wht,
            Memo = $"ล้างลูกหนี้ {document.CustomerName}"
        });

        return await SaveEntryAsync(
            document.TenantId,
            DateTime.UtcNow,
            $"รับชำระเงินอัตโนมัติ {document.DocumentNumber}",
            JournalSourceType.Payment,
            document.Id,
            document.DocumentNumber,
            lines,
            createdBy,
            ct);
    }

    public async Task<JournalEntry?> PostExpenseAsync(ExpenseRecord expense, string? createdBy = null, CancellationToken ct = default)
    {
        if (expense.Status is ExpenseStatus.Draft or ExpenseStatus.Cancelled) return null;

        var hasActivePosting = await dbContext.JournalEntries.AnyAsync(j =>
            j.TenantId == expense.TenantId &&
            j.SourceType == JournalSourceType.Expense &&
            j.SourceId == expense.Id &&
            !dbContext.JournalEntries.Any(r =>
                r.TenantId == expense.TenantId &&
                r.SourceType == JournalSourceType.Reversal &&
                r.SourceId == j.Id), ct);
        if (hasActivePosting)
        {
            return null;
        }

        var accounts = await GetAccountsByCodeAsync(expense.TenantId, ct);
        var expenseAcc = expense.Category == ExpenseCategory.CostOfGoods ? accounts["5100"] : accounts["5200"];
        var creditCashOrPayable = expense.Status == ExpenseStatus.Paid ? accounts["1110"] : accounts["2110"];

        // Non-refundable input VAT is capitalized into expense cost
        var baseCost = expense.IsRefundableVat ? expense.TotalBeforeVat : expense.GrandTotal;
        var claimableVat = expense.IsRefundableVat ? expense.VatAmount : 0m;

        var lines = new List<JournalEntryLine>
        {
            new() { Id = Guid.NewGuid(), AccountId = expenseAcc.Id, Debit = baseCost, Credit = 0m, Memo = expense.Description }
        };

        if (claimableVat > 0)
        {
            lines.Add(new JournalEntryLine
            {
                Id = Guid.NewGuid(),
                AccountId = accounts["1170"].Id,
                Debit = claimableVat,
                Credit = 0m,
                Memo = $"ภาษีซื้อ {expense.TaxInvoiceNumber ?? expense.VoucherNumber}"
            });
        }

        if (expense.WhtAmount > 0)
        {
            lines.Add(new JournalEntryLine
            {
                Id = Guid.NewGuid(),
                AccountId = accounts["2140"].Id,
                Debit = 0m,
                Credit = expense.WhtAmount,
                Memo = $"หัก ณ ที่จ่าย {expense.PndType} {expense.VendorName}"
            });
        }

        lines.Add(new JournalEntryLine
        {
            Id = Guid.NewGuid(),
            AccountId = creditCashOrPayable.Id,
            Debit = 0m,
            Credit = expense.NetPaidAmount,
            Memo = expense.VendorName
        });

        return await SaveEntryAsync(
            expense.TenantId,
            expense.ExpenseDate,
            $"บันทึกค่าใช้จ่ายอัตโนมัติ {expense.VoucherNumber} ({expense.VendorName})",
            JournalSourceType.Expense,
            expense.Id,
            expense.VoucherNumber,
            lines,
            createdBy,
            ct);
    }

    public async Task<JournalEntry?> ReverseSourceEntriesAsync(
        Guid tenantId,
        JournalSourceType sourceType,
        Guid sourceId,
        string? reason = null,
        string? createdBy = null,
        CancellationToken ct = default)
    {
        var originals = await dbContext.JournalEntries
            .Include(j => j.Lines)
            .Where(j => j.TenantId == tenantId && j.SourceType == sourceType && j.SourceId == sourceId)
            .OrderBy(j => j.CreatedAt)
            .ToListAsync(ct);

        if (originals.Count == 0) return null;

        var originalIds = originals.Select(o => o.Id).ToList();
        var alreadyReversedIds = await dbContext.JournalEntries
            .Where(r => r.TenantId == tenantId && r.SourceType == JournalSourceType.Reversal && r.SourceId.HasValue && originalIds.Contains(r.SourceId.Value))
            .Select(r => r.SourceId!.Value)
            .ToHashSetAsync(ct);

        JournalEntry? lastReversal = null;
        foreach (var orig in originals)
        {
            if (alreadyReversedIds.Contains(orig.Id) || orig.Lines.Count == 0) continue;

            var reversedLines = orig.Lines
                .Select(l => new JournalEntryLine
                {
                    Id = Guid.NewGuid(),
                    AccountId = l.AccountId,
                    Debit = l.Credit,
                    Credit = l.Debit,
                    Memo = string.IsNullOrWhiteSpace(l.Memo) ? $"กลับรายการ {orig.JournalNumber}" : $"กลับรายการ: {l.Memo}"
                })
                .ToList();

            var desc = string.IsNullOrWhiteSpace(reason)
                ? $"กลับรายการบัญชี {orig.JournalNumber} ({orig.SourceNumber ?? orig.Description})"
                : $"กลับรายการบัญชี {orig.JournalNumber}: {reason.Trim()}";

            lastReversal = await SaveEntryAsync(
                tenantId,
                DateTime.UtcNow,
                desc,
                JournalSourceType.Reversal,
                orig.Id,
                orig.JournalNumber,
                reversedLines,
                createdBy,
                ct);
        }

        return lastReversal;
    }

    private async Task<Dictionary<string, ChartOfAccount>> GetAccountsByCodeAsync(Guid tenantId, CancellationToken ct)
    {
        await EnsureDefaultChartOfAccountsAsync(tenantId, ct);
        return await dbContext.ChartOfAccounts
            .Where(a => a.TenantId == tenantId)
            .ToDictionaryAsync(a => a.Code, ct);
    }

    private async Task<JournalEntry> SaveEntryAsync(
        Guid tenantId,
        DateTime entryDate,
        string description,
        JournalSourceType sourceType,
        Guid sourceId,
        string sourceNumber,
        List<JournalEntryLine> lines,
        string? createdBy,
        CancellationToken ct)
    {
        var debitTotal = lines.Sum(l => l.Debit);
        var creditTotal = lines.Sum(l => l.Credit);
        if (debitTotal != creditTotal)
        {
            throw new InvalidOperationException($"Journal entry out of balance: Dr={debitTotal} Cr={creditTotal}");
        }

        var jvNumber = await numberGenerator.GenerateNextNumberAsync(tenantId, DocumentType.JournalVoucher, ct);
        var entry = new JournalEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            JournalNumber = jvNumber,
            EntryDate = DateTime.SpecifyKind(entryDate, DateTimeKind.Utc),
            Description = description,
            SourceType = sourceType,
            SourceId = sourceId,
            SourceNumber = sourceNumber,
            IsPosted = true,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.JournalEntries.Add(entry);
        foreach (var line in lines)
        {
            line.JournalEntryId = entry.Id;
            dbContext.JournalEntryLines.Add(line);
        }

        await dbContext.SaveChangesAsync(ct);
        return entry;
    }
}

