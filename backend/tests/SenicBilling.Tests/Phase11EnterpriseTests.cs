using System.IO.Compression;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SenicBilling.API.Controllers;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Domain.Interfaces;
using SenicBilling.Infrastructure.Data;
using SenicBilling.Infrastructure.Services;

namespace SenicBilling.Tests;

public class Phase11EnterpriseTests
{
    private sealed class StubNumberGenerator : IDocumentNumberGeneratorService
    {
        private int _seq = 1;
        public Task<string> GenerateNextNumberAsync(Guid tenantId, DocumentType documentType, CancellationToken ct = default)
        {
            var prefix = documentType switch
            {
                DocumentType.TaxInvoice => "INV",
                DocumentType.Receipt => "REC",
                DocumentType.Quotation => "QT",
                DocumentType.PurchaseOrder => "PO",
                DocumentType.ExpenseVoucher => "EXP",
                DocumentType.JournalVoucher => "JV",
                _ => "DOC"
            };
            return Task.FromResult($"{prefix}-202611-{_seq++:0000}");
        }
    }

    private sealed class SpyEmailService : IEmailService
    {
        public List<(string To, string DocNumber, decimal Amount)> RemindersSent { get; } = [];

        public Task SendEmailAsync(string to, string subject, string body, CancellationToken ct = default)
            => Task.CompletedTask;

        public Task SendDocumentLinkAsync(string to, string customerName, string documentNumber, string link, CancellationToken ct = default)
            => Task.CompletedTask;

        public Task SendPaymentReminderAsync(string to, string customerName, string documentNumber, decimal amount, DateTime dueDate, string paymentLink, CancellationToken ct = default)
        {
            RemindersSent.Add((to, documentNumber, amount));
            return Task.CompletedTask;
        }
    }

    private sealed class StubLineNotifyService : ILineNotifyService
    {
        public Task<bool> SendNotificationAsync(string accessToken, string message, CancellationToken ct = default) => Task.FromResult(true);
        public Task<bool> PushMessageAsync(string channelAccessToken, string to, string message, CancellationToken ct = default) => Task.FromResult(true);
        public Task<bool> ReplyMessageAsync(string channelAccessToken, string replyToken, string message, CancellationToken ct = default) => Task.FromResult(true);
        public Task<bool> NotifyTenantAsync(Tenant tenant, string message, CancellationToken ct = default) => Task.FromResult(true);
    }

    private static SenicBillingDbContext CreateDbContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<SenicBillingDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;
        return new SenicBillingDbContext(options);
    }

    private static void SetUserTenantContext(ControllerBase controller, Guid tenantId, IServiceProvider? provider = null, string role = "Admin")
    {
        var claims = new[]
        {
            new Claim("tenantId", tenantId.ToString()),
            new Claim(ClaimTypes.Name, "phase11tester"),
            new Claim(ClaimTypes.Role, role)
        };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")),
                RequestServices = provider!
            }
        };
    }

    [Fact]
    public async Task PublicDocumentApproval_AndPaymentReminder_ShouldUpdateStatusAuditLog_AndGuardCancelled()
    {
        await using var db = CreateDbContext(nameof(PublicDocumentApproval_AndPaymentReminder_ShouldUpdateStatusAuditLog_AndGuardCancelled));
        var tenantId = Guid.NewGuid();
        var customerId = Guid.NewGuid();
        var docId = Guid.NewGuid();
        var cancelledId = Guid.NewGuid();

        db.Tenants.Add(new Tenant { Id = tenantId, CompanyName = "บจก. ซีนิค แอพพรูฟ" });
        db.Customers.Add(new Customer
        {
            Id = customerId,
            TenantId = tenantId,
            Name = "บจก. คู่ค้าดีเด่น",
            Email = "ap@partner.co.th"
        });
        db.DocumentHeaders.AddRange(
            new DocumentHeader
            {
                Id = docId,
                TenantId = tenantId,
                CustomerId = customerId,
                CustomerName = "บจก. คู่ค้าดีเด่น",
                DocumentType = DocumentType.TaxInvoice,
                DocumentNumber = "INV-202611-0001",
                DocumentDate = new DateTime(2026, 11, 10, 0, 0, 0, DateTimeKind.Utc),
                DueDate = new DateTime(2026, 11, 20, 0, 0, 0, DateTimeKind.Utc),
                Status = DocumentStatus.Issued,
                GrandTotal = 10700m
            },
            new DocumentHeader
            {
                Id = cancelledId,
                TenantId = tenantId,
                CustomerId = customerId,
                CustomerName = "บจก. คู่ค้าดีเด่น",
                DocumentType = DocumentType.Quotation,
                DocumentNumber = "QT-202611-0099",
                DocumentDate = new DateTime(2026, 11, 10, 0, 0, 0, DateTimeKind.Utc),
                Status = DocumentStatus.Cancelled,
                GrandTotal = 5000m
            });
        await db.SaveChangesAsync();

        var emailSpy = new SpyEmailService();
        var services = new ServiceCollection();
        services.AddSingleton<IEmailService>(emailSpy);
        await using var provider = services.BuildServiceProvider();

        var ctrl = new SharedDocumentController(db, new StubNumberGenerator(), new QuestPdfService());
        SetUserTenantContext(ctrl, tenantId, provider);

        // 1. Public Approve
        var approveRes = await ctrl.PublicApprove(
            docId,
            new CustomerApproveDocumentRequest("สมชาย จัดซื้อ", "Somchai.P", "ยืนยันสั่งซื้อ"),
            CancellationToken.None);
        var approveOk = Assert.IsType<OkObjectResult>(approveRes.Result);
        var approvePayload = Assert.IsType<ApiResponse<DocumentApprovalResultDto>>(approveOk.Value).Data!;
        Assert.Equal(CustomerApprovalStatus.Approved, approvePayload.ApprovalStatus);
        Assert.Equal("สมชาย จัดซื้อ", approvePayload.ApprovedByName);

        var updatedDoc = await db.DocumentHeaders.FindAsync(docId);
        Assert.Equal(CustomerApprovalStatus.Approved, updatedDoc!.CustomerApprovalStatus);
        Assert.Equal("Somchai.P", updatedDoc.CustomerSignatureText);
        Assert.NotNull(updatedDoc.ApprovedAt);

        Assert.True(await db.AuditLogs.AnyAsync(a => a.TenantId == tenantId && a.Action == "CustomerApprove" && a.EntityId == docId.ToString()));

        // 2. Cancelled document cannot be approved
        var cancelledApproveRes = await ctrl.PublicApprove(
            cancelledId,
            new CustomerApproveDocumentRequest("สมชาย", null, null),
            CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(cancelledApproveRes.Result);

        // 3. Public Reject
        var rejectRes = await ctrl.PublicReject(
            docId,
            new CustomerRejectDocumentRequest("สมหญิง บัญชี", "ขอแก้ที่อยู่สาขา"),
            CancellationToken.None);
        var rejectOk = Assert.IsType<OkObjectResult>(rejectRes.Result);
        var rejectPayload = Assert.IsType<ApiResponse<DocumentApprovalResultDto>>(rejectOk.Value).Data!;
        Assert.Equal(CustomerApprovalStatus.Rejected, rejectPayload.ApprovalStatus);
        Assert.Contains("ขอแก้ที่อยู่สาขา", rejectPayload.Comment);

        // 4. 1-click Payment Reminder
        var remRes = await ctrl.SendPaymentReminder(docId, CancellationToken.None);
        Assert.IsType<OkObjectResult>(remRes.Result);
        Assert.Single(emailSpy.RemindersSent);
        Assert.Equal("INV-202611-0001", emailSpy.RemindersSent[0].DocNumber);
        Assert.NotNull((await db.DocumentHeaders.FindAsync(docId))!.LastReminderSentAt);
    }

    [Fact]
    public async Task BankReconciliation_CsvImportSuggestAutoMatch_ShouldSettleDocumentAndIsolateTenants()
    {
        await using var db = CreateDbContext(nameof(BankReconciliation_CsvImportSuggestAutoMatch_ShouldSettleDocumentAndIsolateTenants));
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var docId = Guid.NewGuid();
        var expId = Guid.NewGuid();

        db.Tenants.AddRange(
            new Tenant { Id = tenantA, CompanyName = "บจก. เอ เอ็นเตอร์ไพรส์" },
            new Tenant { Id = tenantB, CompanyName = "บจก. บี คอนฟิเดนเชียล" });

        db.DocumentHeaders.Add(new DocumentHeader
        {
            Id = docId,
            TenantId = tenantA,
            DocumentType = DocumentType.TaxInvoice,
            DocumentNumber = "INV-202611-0101",
            DocumentDate = new DateTime(2026, 11, 10, 0, 0, 0, DateTimeKind.Utc),
            CustomerName = "ลูกค้าสยาม",
            Status = DocumentStatus.Issued,
            TotalBeforeVat = 10000m,
            VatAmount = 700m,
            GrandTotal = 10700m,
            WhtAmount = 0m
        });

        db.ExpenseRecords.Add(new ExpenseRecord
        {
            Id = expId,
            TenantId = tenantA,
            VoucherNumber = "EXP-202611-0201",
            ExpenseDate = new DateTime(2026, 11, 11, 0, 0, 0, DateTimeKind.Utc),
            VendorName = "บจก. คลาวด์ไทย",
            Description = "ค่าเช่าเซิร์ฟเวอร์",
            TotalBeforeVat = 2000m,
            VatAmount = 140m,
            GrandTotal = 2140m,
            NetPaidAmount = 2140m,
            Status = ExpenseStatus.Approved
        });
        await db.SaveChangesAsync();

        var numGen = new StubNumberGenerator();
        var accounting = new AccountingService(db, numGen);
        var ctrl = new BankReconciliationController(db, accounting);
        SetUserTenantContext(ctrl, tenantA);

        var csv = "Date,Description,Reference,Deposit,Withdrawal,Balance,Counterparty\n" +
                  "2026-11-12,รับโอนค่าบริการ INV-202611-0101,TRF-101,10700.00,0,110700.00,ลูกค้าสยาม\n" +
                  "2026-11-12,จ่ายค่าบริการ EXP-202611-0201,PAY-201,0,2140.00,108560.00,บจก. คลาวด์ไทย\n";

        var importRes = await ctrl.Import(new ImportBankStatementRequest("KBANK", "012-3-45678-9", csv), CancellationToken.None);
        var importOk = Assert.IsType<OkObjectResult>(importRes.Result);
        var imported = Assert.IsType<ApiResponse<List<BankStatementTransactionDto>>>(importOk.Value).Data!;
        Assert.Equal(2, imported.Count);
        Assert.Equal(BankMatchStatus.Suggested, imported[0].MatchStatus);
        Assert.Equal(docId, imported[0].SuggestedDocumentId);
        Assert.Equal(BankMatchStatus.Suggested, imported[1].MatchStatus);
        Assert.Equal(expId, imported[1].SuggestedExpenseId);

        // Auto-reconcile
        var autoRes = await ctrl.AutoReconcile(CancellationToken.None);
        var autoOk = Assert.IsType<OkObjectResult>(autoRes.Result);
        var apiAuto = Assert.IsType<ApiResponse<object>>(autoOk.Value);
        Assert.True(apiAuto.Success);

        var updatedDoc = await db.DocumentHeaders.FindAsync(docId);
        Assert.Equal(DocumentStatus.Paid, updatedDoc!.Status);
        Assert.True(await db.PaymentTransactions.AnyAsync(p => p.DocumentId == docId && p.Amount == 10700m && p.Status == "successful"));

        var updatedExp = await db.ExpenseRecords.FindAsync(expId);
        Assert.Equal(ExpenseStatus.Paid, updatedExp!.Status);

        // AR Settlement Double Entry Journal (1110 Dr 10,700 / 1120 Cr 10,700)
        var settlementJournal = await db.JournalEntries
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.TenantId == tenantA && j.SourceType == JournalSourceType.Payment && j.SourceId == docId);
        Assert.NotNull(settlementJournal);
        Assert.Equal(10700m, settlementJournal.Lines.Sum(l => l.Debit));
        Assert.Equal(10700m, settlementJournal.Lines.Sum(l => l.Credit));

        // Strict Tenant Isolation check as Tenant B
        SetUserTenantContext(ctrl, tenantB);
        var otherListRes = await ctrl.GetTransactions(null, CancellationToken.None);
        var otherJson = JsonSerializer.Serialize(Assert.IsType<OkObjectResult>(otherListRes.Result).Value);
        Assert.DoesNotContain("INV-202611-0101", otherJson);

        var crossTenantMatch = await ctrl.ManualMatch(imported[0].Id, new MatchBankTransactionRequest(DocumentId: docId), CancellationToken.None);
        Assert.IsType<NotFoundObjectResult>(crossTenantMatch.Result);
    }

    [Fact]
    public async Task FinancialStatements_BalanceSheetCashFlowAndMargin_ShouldBeBalancedAndAccurate()
    {
        await using var db = CreateDbContext(nameof(FinancialStatements_BalanceSheetCashFlowAndMargin_ShouldBeBalancedAndAccurate));
        var tenantId = Guid.NewGuid();
        var prodCostId = Guid.NewGuid();
        var prodPoFallbackId = Guid.NewGuid();

        db.Tenants.Add(new Tenant { Id = tenantId, CompanyName = "บจก. งบการเงินแม่นยำ" });
        db.Products.AddRange(
            new Product
            {
                Id = prodCostId,
                TenantId = tenantId,
                Sku = "PRD-COST",
                Name = "เมาส์ไร้สาย Pro",
                Unit = "ชิ้น",
                UnitPrice = 1000m,
                CostPrice = 600m
            },
            new Product
            {
                Id = prodPoFallbackId,
                TenantId = tenantId,
                Sku = "PRD-PO",
                Name = "สายชาร์จ USB-C",
                Unit = "เส้น",
                UnitPrice = 500m,
                CostPrice = null
            });

        // PO fallback avg cost = 200 THB/unit
        var poId = Guid.NewGuid();
        db.PurchaseOrders.Add(new PurchaseOrder
        {
            Id = poId,
            TenantId = tenantId,
            PoNumber = "PO-202611-0001",
            VendorName = "โรงงาน",
            OrderDate = new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc),
            Status = PurchaseOrderStatus.Received,
            Lines =
            [
                new PurchaseOrderLine
                {
                    Id = Guid.NewGuid(),
                    ProductId = prodPoFallbackId,
                    Description = "สายชาร์จ USB-C",
                    Quantity = 10m,
                    ReceivedQuantity = 10m,
                    UnitPrice = 200m,
                    LineTotal = 2000m
                }
            ]
        });

        // Sales document issued & paid
        var inv = new DocumentHeader
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            DocumentType = DocumentType.TaxInvoice,
            DocumentNumber = "INV-202611-0001",
            DocumentDate = new DateTime(2026, 11, 5, 0, 0, 0, DateTimeKind.Utc),
            CustomerName = "ลูกค้าทั่วไป",
            CreatedBy = "Somchai Sale",
            Status = DocumentStatus.Issued,
            TotalBeforeVat = 6000m,
            Subtotal = 6000m,
            VatAmount = 420m,
            GrandTotal = 6420m,
            Lines =
            [
                new DocumentLine
                {
                    Id = Guid.NewGuid(),
                    ProductId = prodCostId,
                    Description = "เมาส์ไร้สาย Pro",
                    Quantity = 5m,
                    UnitPrice = 1000m,
                    LineTotal = 5000m
                },
                new DocumentLine
                {
                    Id = Guid.NewGuid(),
                    ProductId = prodPoFallbackId,
                    Description = "สายชาร์จ USB-C",
                    Quantity = 2m,
                    UnitPrice = 500m,
                    LineTotal = 1000m
                }
            ]
        };
        db.DocumentHeaders.Add(inv);
        await db.SaveChangesAsync();

        var numGen = new StubNumberGenerator();
        var accounting = new AccountingService(db, numGen);
        await accounting.EnsureDefaultChartOfAccountsAsync(tenantId);

        var accounts = await db.ChartOfAccounts.Where(a => a.TenantId == tenantId).ToListAsync();
        var cashAcc = accounts.First(a => a.Code == "1110");
        var capAcc = accounts.First(a => a.Code == "3100");

        var ctrl = new AccountingController(db, accounting, numGen);
        SetUserTenantContext(ctrl, tenantId);

        // Owner capital injection 50,000 + sales invoice + cash settlement
        await ctrl.CreateManualJournal(
            new CreateJournalEntryRequest(
                new DateTime(2026, 11, 2, 0, 0, 0, DateTimeKind.Utc),
                "ทุนจดทะเบียน",
                [new CreateJournalLineRequest(cashAcc.Id, 50000m, 0m, null), new CreateJournalLineRequest(capAcc.Id, 0m, 50000m, null)]),
            CancellationToken.None);
        await accounting.PostSalesDocumentAsync(inv, "Somchai Sale");
        inv.Status = DocumentStatus.Paid;
        await db.SaveChangesAsync();
        await accounting.PostPaymentAsync(inv, 6420m, "Somchai Sale");

        // Balance Sheet equation check
        var bsRes = await ctrl.GetBalanceSheet(new DateTime(2026, 11, 30, 0, 0, 0, DateTimeKind.Utc), CancellationToken.None);
        var bs = Assert.IsType<ApiResponse<BalanceSheetDto>>(Assert.IsType<OkObjectResult>(bsRes.Result).Value).Data!;
        Assert.True(bs.IsBalanced);
        Assert.Equal(bs.TotalAssets, bs.TotalLiabilitiesAndEquity);
        Assert.Equal(56420m, bs.TotalAssets); // 50,000 capital cash + 6,420 collected cash

        // Cash Flow Direct Method continuity check
        var cfRes = await ctrl.GetCashFlow(2026, 11, CancellationToken.None);
        var cf = Assert.IsType<ApiResponse<CashFlowStatementDto>>(Assert.IsType<OkObjectResult>(cfRes.Result).Value).Data!;
        Assert.Equal(cf.OpeningCashBalance + cf.NetCashFlow, cf.EndingCashBalance);
        Assert.Equal(56420m, cf.EndingCashBalance);

        // Sales & Margin report check (Product 1: 5*600=3000, Product 2 PO fallback: 2*200=400)
        var marginRes = await ctrl.GetSalesMargin(
            new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 11, 30, 0, 0, 0, DateTimeKind.Utc),
            CancellationToken.None);
        var margin = Assert.IsType<ApiResponse<SalesMarginReportDto>>(Assert.IsType<OkObjectResult>(marginRes.Result).Value).Data!;
        Assert.Equal(6000m, margin.TotalRevenue);
        Assert.Equal(3400m, margin.TotalEstimatedCost);
        Assert.Equal(2600m, margin.TotalGrossProfit);
        Assert.Single(margin.ByStaff);
        Assert.Equal("Somchai Sale", margin.ByStaff[0].StaffName);

        // Export Financial Statements Excel workbook validation
        var excelFile = Assert.IsType<FileContentResult>(
            await ctrl.ExportFinancialStatementsExcel(new DateTime(2026, 11, 30, 0, 0, 0, DateTimeKind.Utc), 2026, CancellationToken.None));
        using var ms = new MemoryStream(excelFile.FileContents);
        using var wb = new XLWorkbook(ms);
        Assert.True(wb.Worksheets.Contains("งบดุล (Balance Sheet)"));
        Assert.True(wb.Worksheets.Contains("งบกระแสเงินสด (Cash Flow)"));
        Assert.True(wb.Worksheets.Contains("งบกำไรขาดทุน (Profit & Loss)"));
    }

    [Fact]
    public async Task AccountingPeriodLock_ShouldPreventMutationsAcrossControllers_UntilUnlocked()
    {
        await using var db = CreateDbContext(nameof(AccountingPeriodLock_ShouldPreventMutationsAcrossControllers_UntilUnlocked));
        var tenantId = Guid.NewGuid();
        db.Tenants.Add(new Tenant { Id = tenantId, CompanyName = "บจก. ล็อกงวดบัญชี" });
        await db.SaveChangesAsync();

        var numGen = new StubNumberGenerator();
        var accounting = new AccountingService(db, numGen);
        await accounting.EnsureDefaultChartOfAccountsAsync(tenantId);

        var services = new ServiceCollection();
        services.AddSingleton<IInventoryService>(new InventoryService(db));
        services.AddSingleton<IAccountingService>(accounting);
        await using var provider = services.BuildServiceProvider();

        var accCtrl = new AccountingController(db, accounting, numGen);
        SetUserTenantContext(accCtrl, tenantId, provider);

        // Lock 11/2026
        var lockRes = await accCtrl.LockPeriod(new LockAccountingPeriodRequest(2026, 11, "ยื่น ภ.พ.30 เสร็จแล้ว"), CancellationToken.None);
        var lockedDto = Assert.IsType<ApiResponse<AccountingPeriodDto>>(Assert.IsType<OkObjectResult>(lockRes.Result).Value).Data!;
        Assert.True(lockedDto.IsLocked);
        Assert.True(await db.AuditLogs.AnyAsync(a => a.TenantId == tenantId && a.Action == "AccountingPeriodLock"));

        var cashAcc = await db.ChartOfAccounts.FirstAsync(a => a.TenantId == tenantId && a.Code == "1110");
        var revAcc = await db.ChartOfAccounts.FirstAsync(a => a.TenantId == tenantId && a.Code == "4100");

        // 1. Blocked Manual Journal
        var blockedJv = await accCtrl.CreateManualJournal(new CreateJournalEntryRequest(
            new DateTime(2026, 11, 15, 0, 0, 0, DateTimeKind.Utc),
            "พยายามลงย้อนหลัง",
            [new CreateJournalLineRequest(cashAcc.Id, 100m, 0m, null), new CreateJournalLineRequest(revAcc.Id, 0m, 100m, null)]),
            CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(blockedJv.Result);

        // 2. Blocked Tax Invoice creation in locked month
        var invCtrl = new TaxInvoiceController(db, numGen);
        SetUserTenantContext(invCtrl, tenantId, provider);
        var blockedInv = await invCtrl.Create(new CreateDocumentRequest(
            DocumentType.TaxInvoice,
            new DateTime(2026, 11, 18, 0, 0, 0, DateTimeKind.Utc),
            null,
            null,
            "ลูกค้า",
            "กทม.",
            "00000",
            "0105551234567",
            VatCalculationMode.Exclusive,
            7m,
            0m,
            0m,
            null,
            null,
            null,
            [new DocumentLineDto(null, 1, null, "บริการ", 1m, "งาน", 1000m, 0m, 1000m)]),
            CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(blockedInv.Result);

        // 3. Blocked Expense creation in locked month
        var expCtrl = new ExpensesController(db, numGen, new QuestPdfService());
        SetUserTenantContext(expCtrl, tenantId, provider);
        var blockedExp = await expCtrl.Create(new CreateExpenseRequest(
            ExpenseDate: new DateTime(2026, 11, 19, 0, 0, 0, DateTimeKind.Utc),
            VendorName: "ผู้ขาย",
            Description: "ค่าใช้จ่าย",
            Amount: 500m,
            Category: ExpenseCategory.OfficeSupplies,
            VatMode: VatCalculationMode.Exclusive,
            VatRate: 0m,
            IsRefundableVat: false,
            WhtRate: 0m,
            PndType: PndType.None),
            CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(blockedExp.Result);

        // 4. Unlock and verify posting works again
        var unlockRes = await accCtrl.UnlockPeriod(new LockAccountingPeriodRequest(2026, 11, "ปรับปรุงรายการ"), CancellationToken.None);
        var unlockedDto = Assert.IsType<ApiResponse<AccountingPeriodDto>>(Assert.IsType<OkObjectResult>(unlockRes.Result).Value).Data!;
        Assert.False(unlockedDto.IsLocked);
        Assert.True(await db.AuditLogs.AnyAsync(a => a.TenantId == tenantId && a.Action == "AccountingPeriodUnlock"));

        var allowedJv = await accCtrl.CreateManualJournal(new CreateJournalEntryRequest(
            new DateTime(2026, 11, 15, 0, 0, 0, DateTimeKind.Utc),
            "ลงบัญชีหลังปลดล็อก",
            [new CreateJournalLineRequest(cashAcc.Id, 100m, 0m, null), new CreateJournalLineRequest(revAcc.Id, 0m, 100m, null)]),
            CancellationToken.None);
        Assert.IsType<CreatedAtActionResult>(allowedJv.Result);
    }

    [Fact]
    public async Task TenantBackupExport_ShouldContainOnlyCurrentTenantDataInZip_AndLogAudit()
    {
        await using var db = CreateDbContext(nameof(TenantBackupExport_ShouldContainOnlyCurrentTenantDataInZip_AndLogAudit));
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        db.Tenants.AddRange(
            new Tenant { Id = tenantA, CompanyName = "บจก. เอ แบ็คอัพ", TaxId = "0105550001111" },
            new Tenant { Id = tenantB, CompanyName = "บจก. บี ความลับ", TaxId = "0105550002222" });

        db.Customers.AddRange(
            new Customer { Id = Guid.NewGuid(), TenantId = tenantA, Name = "ลูกค้าของเอเท่านั้น" },
            new Customer { Id = Guid.NewGuid(), TenantId = tenantB, Name = "ลูกค้าลับของบี" });

        db.BankStatementTransactions.Add(new BankStatementTransaction
        {
            Id = Guid.NewGuid(),
            TenantId = tenantA,
            TransactionDate = DateTime.UtcNow,
            Description = "รายการแบ็คอัพ A",
            DepositAmount = 999m
        });
        await db.SaveChangesAsync();

        var tenantsCtrl = new TenantsController(db, new StubLineNotifyService());
        SetUserTenantContext(tenantsCtrl, tenantA);

        var fileRes = Assert.IsType<FileContentResult>(await tenantsCtrl.ExportTenantBackup(CancellationToken.None));
        Assert.Equal("application/zip", fileRes.ContentType);

        using var ms = new MemoryStream(fileRes.FileContents);
        using var zip = new ZipArchive(ms, ZipArchiveMode.Read);

        Assert.NotNull(zip.GetEntry("tenant.json"));
        Assert.NotNull(zip.GetEntry("customers.json"));
        Assert.NotNull(zip.GetEntry("bank_transactions.json"));

        using var reader = new StreamReader(zip.GetEntry("customers.json")!.Open(), Encoding.UTF8);
        var customersJson = await reader.ReadToEndAsync();
        Assert.Contains("ลูกค้าของเอเท่านั้น", customersJson);
        Assert.DoesNotContain("ลูกค้าลับของบี", customersJson);

        Assert.True(await db.AuditLogs.AnyAsync(a => a.TenantId == tenantA && a.Action == "ExportTenantBackup"));
    }
}
