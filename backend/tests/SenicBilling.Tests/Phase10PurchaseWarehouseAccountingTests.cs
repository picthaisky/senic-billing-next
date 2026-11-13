using System.Security.Claims;
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

public class Phase10PurchaseWarehouseAccountingTests
{
    private sealed class StubNumberGenerator : IDocumentNumberGeneratorService
    {
        private int _seq = 1;
        public Task<string> GenerateNextNumberAsync(Guid tenantId, DocumentType documentType, CancellationToken ct = default)
        {
            var prefix = documentType switch
            {
                DocumentType.PurchaseOrder => "PO",
                DocumentType.ExpenseVoucher => "EXP",
                DocumentType.JournalVoucher => "JV",
                _ => "DOC"
            };
            return Task.FromResult($"{prefix}-202611-{_seq++:0000}");
        }
    }

    private static SenicBillingDbContext CreateDbContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<SenicBillingDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;
        return new SenicBillingDbContext(options);
    }

    private static void SetUserTenantContext(ControllerBase controller, Guid tenantId)
    {
        var claims = new[]
        {
            new Claim("tenantId", tenantId.ToString()),
            new Claim(ClaimTypes.Name, "tester"),
            new Claim(ClaimTypes.Role, "Admin")
        };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")) }
        };
    }

    [Fact]
    public async Task PurchaseOrder_ShouldCreateReceiveIncreaseStock_AndCreateExpense()
    {
        await using var db = CreateDbContext(nameof(PurchaseOrder_ShouldCreateReceiveIncreaseStock_AndCreateExpense));
        var tenantId = Guid.NewGuid();
        var productId = Guid.NewGuid();
        db.Tenants.Add(new Tenant { Id = tenantId, CompanyName = "บจก. ซีนิค" });
        db.Products.Add(new Product
        {
            Id = productId,
            TenantId = tenantId,
            Name = "กระดาษ A4",
            Sku = "P-A4",
            Unit = "รีม",
            UnitPrice = 120m,
            StockQuantity = 10m
        });
        await db.SaveChangesAsync();

        var numGen = new StubNumberGenerator();
        var inventoryService = new InventoryService(db);
        var poCtrl = new PurchaseOrdersController(db, numGen, inventoryService, new QuestPdfService());
        SetUserTenantContext(poCtrl, tenantId);

        var createRes = await poCtrl.Create(new CreatePurchaseOrderRequest(
            OrderDate: new DateTime(2026, 11, 13, 0, 0, 0, DateTimeKind.Utc),
            ExpectedDeliveryDate: null,
            VendorId: null,
            VendorName: "บจก. ซัพพลายเออร์ไทย",
            VendorTaxId: "0105559998888",
            VendorBranch: "00000",
            VendorAddress: "กทม.",
            WarehouseId: null,
            VatMode: VatCalculationMode.Exclusive,
            DiscountAmount: 0m,
            VatRate: 7m,
            Notes: null,
            Lines: [new CreatePurchaseOrderLineRequest(productId, "กระดาษ A4", "รีม", 5m, 100m)]), CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(createRes.Result);
        var po = Assert.IsType<ApiResponse<PurchaseOrderDto>>(created.Value).Data!;
        Assert.Equal(535m, po.GrandTotal);

        var receiveRes = await poCtrl.Receive(po.Id, new ReceivePurchaseOrderRequest(CreateExpenseRecord: true), CancellationToken.None);
        var okReceive = Assert.IsType<OkObjectResult>(receiveRes.Result);
        var receivedPo = Assert.IsType<ApiResponse<PurchaseOrderDto>>(okReceive.Value).Data!;
        Assert.Equal(PurchaseOrderStatus.Received, receivedPo.Status);
        Assert.NotNull(receivedPo.LinkedExpenseId);

        // Stock increased 10 -> 15
        var updatedProduct = await db.Products.FindAsync(productId);
        Assert.Equal(15m, updatedProduct!.StockQuantity);

        // Expense record created automatically with Input VAT = 35
        var expense = await db.ExpenseRecords.FindAsync(receivedPo.LinkedExpenseId);
        Assert.NotNull(expense);
        Assert.Equal(35m, expense!.VatAmount);

        // PO PDF generates successfully
        var pdf = Assert.IsType<FileContentResult>(await poCtrl.GetPdf(po.Id, CancellationToken.None));
        Assert.Equal("application/pdf", pdf.ContentType);
    }

    [Fact]
    public async Task MultiWarehouse_TransferShouldPreserveTotalStockAndRecordMovements()
    {
        await using var db = CreateDbContext(nameof(MultiWarehouse_TransferShouldPreserveTotalStockAndRecordMovements));
        var tenantId = Guid.NewGuid();
        var productId = Guid.NewGuid();
        db.Tenants.Add(new Tenant { Id = tenantId, CompanyName = "บจก. ซีนิค" });
        db.Products.Add(new Product
        {
            Id = productId,
            TenantId = tenantId,
            Name = "เครื่องพิมพ์บาร์โค้ด",
            Sku = "PRN-01",
            Unit = "เครื่อง",
            UnitPrice = 3500m,
            StockQuantity = 20m
        });
        await db.SaveChangesAsync();

        var inventoryService = new InventoryService(db);
        var whCtrl = new WarehousesController(db, inventoryService);
        SetUserTenantContext(whCtrl, tenantId);

        var mainWh = await inventoryService.EnsureDefaultWarehouseAsync(tenantId);
        var branchRes = await whCtrl.Create(new UpsertWarehouseRequest("WH-BKK2", "สาขาพระราม 9"), CancellationToken.None);
        var branchWh = Assert.IsType<ApiResponse<WarehouseDto>>(Assert.IsType<CreatedAtActionResult>(branchRes.Result).Value).Data!;

        // Transfer 6 units from main -> branch
        var trfRes = await whCtrl.Transfer(new TransferStockRequest(productId, mainWh.Id, branchWh.Id, 6m, "เติมสต็อกสาขา"), CancellationToken.None);
        Assert.IsType<OkObjectResult>(trfRes.Result);

        var stocks = await db.ProductWarehouseStocks.Where(s => s.ProductId == productId).ToListAsync();
        Assert.Equal(14m, stocks.First(s => s.WarehouseId == mainWh.Id).Quantity);
        Assert.Equal(6m, stocks.First(s => s.WarehouseId == branchWh.Id).Quantity);

        var product = await db.Products.FindAsync(productId);
        Assert.Equal(20m, product!.StockQuantity); // Total preserved

        var movements = await db.StockMovements.Where(m => m.ProductId == productId).ToListAsync();
        Assert.Equal(2, movements.Count);
    }

    [Fact]
    public async Task AutoAccounting_ShouldPostBalancedDoubleEntries_AndComputeTrialBalanceAndPnL()
    {
        await using var db = CreateDbContext(nameof(AutoAccounting_ShouldPostBalancedDoubleEntries_AndComputeTrialBalanceAndPnL));
        var tenantId = Guid.NewGuid();
        var otherTenantId = Guid.NewGuid();
        db.Tenants.AddRange(
            new Tenant { Id = tenantId, CompanyName = "บจก. ซีนิค" },
            new Tenant { Id = otherTenantId, CompanyName = "บจก. อื่น" });
        await db.SaveChangesAsync();

        var numGen = new StubNumberGenerator();
        var accounting = new AccountingService(db, numGen);

        // 1. Sales invoice: 10,000 + 700 VAT = 10,700
        var inv = new DocumentHeader
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            DocumentType = DocumentType.TaxInvoice,
            DocumentNumber = "INV-202611-0001",
            DocumentDate = new DateTime(2026, 11, 10, 0, 0, 0, DateTimeKind.Utc),
            CustomerName = "ลูกค้า ก",
            Status = DocumentStatus.Issued,
            TotalBeforeVat = 10000m,
            VatAmount = 700m,
            GrandTotal = 10700m
        };
        var jvSales = await accounting.PostSalesDocumentAsync(inv, "admin");
        Assert.NotNull(jvSales);

        // 2. Expense: 4,000 + 280 VAT - 120 WHT = 4,160 payable
        var exp = new ExpenseRecord
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            VoucherNumber = "EXP-202611-0001",
            ExpenseDate = new DateTime(2026, 11, 12, 0, 0, 0, DateTimeKind.Utc),
            VendorName = "ผู้ขาย ข",
            Description = "ค่าบริการ",
            TotalBeforeVat = 4000m,
            VatAmount = 280m,
            GrandTotal = 4280m,
            IsRefundableVat = true,
            WhtRate = 3m,
            WhtAmount = 120m,
            PndType = PndType.PND53,
            NetPaidAmount = 4160m,
            Status = ExpenseStatus.Approved
        };
        var jvExp = await accounting.PostExpenseAsync(exp, "admin");
        Assert.NotNull(jvExp);

        var accCtrl = new AccountingController(db, accounting, numGen);
        SetUserTenantContext(accCtrl, tenantId);

        var tbRes = await accCtrl.GetTrialBalance(CancellationToken.None);
        var tb = Assert.IsType<ApiResponse<TrialBalanceDto>>(Assert.IsType<OkObjectResult>(tbRes.Result).Value).Data!;
        Assert.True(tb.IsBalanced);
        Assert.Equal(tb.TotalDebit, tb.TotalCredit);
        Assert.Equal(10700m + 4280m, tb.TotalDebit);

        var pnlRes = await accCtrl.GetProfitLoss(2026, 11, CancellationToken.None);
        var pnl = Assert.IsType<ApiResponse<ProfitLossDto>>(Assert.IsType<OkObjectResult>(pnlRes.Result).Value).Data!;
        Assert.Equal(10000m, pnl.TotalRevenue);
        Assert.Equal(4000m, pnl.TotalExpense);
        Assert.Equal(6000m, pnl.NetProfit);

        // Tenant isolation: other tenant's trial balance must be empty (0)
        SetUserTenantContext(accCtrl, otherTenantId);
        var otherTbRes = await accCtrl.GetTrialBalance(CancellationToken.None);
        var otherTb = Assert.IsType<ApiResponse<TrialBalanceDto>>(Assert.IsType<OkObjectResult>(otherTbRes.Result).Value).Data!;
        Assert.Equal(0m, otherTb.TotalDebit);
    }

    [Fact]
    public async Task TaxInvoice_CreateAndCancel_ShouldSyncWarehouseStockMovements_AndPostBalancedJournal()
    {
        await using var db = CreateDbContext(nameof(TaxInvoice_CreateAndCancel_ShouldSyncWarehouseStockMovements_AndPostBalancedJournal));
        var tenantId = Guid.NewGuid();
        var productId = Guid.NewGuid();
        var serviceItemId = Guid.NewGuid();

        db.Tenants.Add(new Tenant { Id = tenantId, CompanyName = "บจก. ซีนิค" });
        db.Products.AddRange(
            new Product
            {
                Id = productId,
                TenantId = tenantId,
                Name = "คีย์บอร์ด",
                Sku = "KB-01",
                Unit = "ชิ้น",
                UnitPrice = 1000m,
                StockQuantity = 20m
            },
            new Product
            {
                Id = serviceItemId,
                TenantId = tenantId,
                Name = "ค่าบริการติดตั้ง",
                Sku = "SRV-01",
                Unit = "งาน",
                UnitPrice = 500m,
                StockQuantity = null
            });
        await db.SaveChangesAsync();

        var numGen = new StubNumberGenerator();
        var services = new ServiceCollection();
        services.AddSingleton<IInventoryService>(new InventoryService(db));
        services.AddSingleton<IAccountingService>(new AccountingService(db, numGen));
        await using var provider = services.BuildServiceProvider();

        var invCtrl = new TaxInvoiceController(db, numGen);
        SetUserTenantContext(invCtrl, tenantId);
        invCtrl.ControllerContext.HttpContext.RequestServices = provider;

        var createRes = await invCtrl.Create(new CreateDocumentRequest(
            DocumentType: DocumentType.TaxInvoice,
            DocumentDate: new DateTime(2026, 11, 13, 0, 0, 0, DateTimeKind.Utc),
            DueDate: null,
            CustomerId: null,
            CustomerName: "บจก. ลูกค้าทดสอบ",
            CustomerAddress: "กทม.",
            CustomerBranch: "00000",
            CustomerTaxId: "0105551234567",
            VatMode: VatCalculationMode.Exclusive,
            VatRate: 7m,
            DiscountAmount: 0m,
            WhtRate: 0m,
            Notes: null,
            ReferenceDocumentId: null,
            DeliveryStatus: null,
            Lines:
            [
                new DocumentLineDto(null, 1, productId, "คีย์บอร์ด", 3m, "ชิ้น", 1000m, 0m, 3000m),
                new DocumentLineDto(null, 2, serviceItemId, "ค่าบริการติดตั้ง", 1m, "งาน", 500m, 0m, 500m)
            ]), CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(createRes.Result);
        var doc = Assert.IsType<ApiResponse<DocumentResponse>>(created.Value).Data!;

        var product = await db.Products.FindAsync(productId);
        Assert.Equal(17m, product!.StockQuantity);

        var whStock = await db.ProductWarehouseStocks.FirstOrDefaultAsync(s => s.TenantId == tenantId && s.ProductId == productId);
        Assert.NotNull(whStock);
        Assert.Equal(17m, whStock.Quantity);

        // Service item (StockQuantity == null) must NOT have warehouse stock rows
        Assert.False(await db.ProductWarehouseStocks.AnyAsync(s => s.ProductId == serviceItemId));

        var saleMovement = await db.StockMovements.FirstOrDefaultAsync(m =>
            m.TenantId == tenantId && m.ProductId == productId && m.MovementType == StockMovementType.SaleOut);
        Assert.NotNull(saleMovement);
        Assert.Equal(-3m, saleMovement.QuantityDelta);
        Assert.Equal(17m, saleMovement.BalanceAfter);
        Assert.Equal(doc.DocumentNumber, saleMovement.ReferenceNumber);

        var journal = await db.JournalEntries
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.TenantId == tenantId && j.SourceType == JournalSourceType.SalesDocument && j.SourceId == doc.Id);
        Assert.NotNull(journal);
        Assert.Equal(doc.GrandTotal, journal.Lines.Sum(l => l.Debit));
        Assert.Equal(journal.Lines.Sum(l => l.Debit), journal.Lines.Sum(l => l.Credit));

        // Cancel tax invoice -> restores stock and creates SaleRestock movement
        var cancelRes = await invCtrl.Cancel(doc.Id, new CancelDocumentRequest("ทดสอบยกเลิก"), CancellationToken.None);
        Assert.IsType<OkObjectResult>(cancelRes.Result);

        await db.Entry(product).ReloadAsync();
        await db.Entry(whStock).ReloadAsync();
        Assert.Equal(20m, product.StockQuantity);
        Assert.Equal(20m, whStock.Quantity);

        var restockMovement = await db.StockMovements.FirstOrDefaultAsync(m =>
            m.TenantId == tenantId && m.ProductId == productId && m.MovementType == StockMovementType.SaleRestock);
        Assert.NotNull(restockMovement);
        Assert.Equal(3m, restockMovement.QuantityDelta);
        Assert.Equal(20m, restockMovement.BalanceAfter);

        // Cancellation also creates a balanced Reversal JournalEntry
        var reversalJournal = await db.JournalEntries
            .Include(j => j.Lines)
            .FirstOrDefaultAsync(j => j.TenantId == tenantId && j.SourceType == JournalSourceType.Reversal && j.SourceId == journal.Id);
        Assert.NotNull(reversalJournal);
        Assert.Equal(journal.Lines.Sum(l => l.Debit), reversalJournal.Lines.Sum(l => l.Credit));
    }

    [Fact]
    public async Task Accounting_CreditNoteShouldReduceRevenue_AndExpenseCancelShouldReverseJournal()
    {
        await using var db = CreateDbContext(nameof(Accounting_CreditNoteShouldReduceRevenue_AndExpenseCancelShouldReverseJournal));
        var tenantId = Guid.NewGuid();
        db.Tenants.Add(new Tenant { Id = tenantId, CompanyName = "บจก. ซีนิค" });
        await db.SaveChangesAsync();

        var numGen = new StubNumberGenerator();
        var accounting = new AccountingService(db, numGen);

        var services = new ServiceCollection();
        services.AddSingleton<IAccountingService>(accounting);
        await using var provider = services.BuildServiceProvider();

        // Issue Credit Note 1,000 + 70 VAT -> must debit 4100 (1,000) + debit 2130 (70) / credit 1130 (1,070)
        var creditNote = new DocumentHeader
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            DocumentType = DocumentType.CreditNote,
            DocumentNumber = "CN-202611-0001",
            DocumentDate = new DateTime(2026, 11, 13, 0, 0, 0, DateTimeKind.Utc),
            CustomerName = "บจก. ลูกค้า",
            Status = DocumentStatus.Issued,
            TotalBeforeVat = 1000m,
            VatAmount = 70m,
            GrandTotal = 1070m
        };
        var cnEntry = await accounting.PostSalesDocumentAsync(creditNote, "tester");
        Assert.NotNull(cnEntry);

        var cnLines = await db.JournalEntryLines
            .Include(l => l.Account)
            .Where(l => l.JournalEntryId == cnEntry.Id)
            .ToListAsync();
        Assert.Equal(1000m, cnLines.Single(l => l.Account.Code == "4100").Debit);
        Assert.Equal(70m, cnLines.Single(l => l.Account.Code == "2130").Debit);
        Assert.Equal(1070m, cnLines.Single(l => l.Account.Code == "1130").Credit);

        // Create approved Expense via controller -> posts JV -> cancel reverses it cleanly
        var expCtrl = new ExpensesController(db, numGen, new QuestPdfService());
        SetUserTenantContext(expCtrl, tenantId);
        expCtrl.ControllerContext.HttpContext.RequestServices = provider;

        var expCreateRes = await expCtrl.Create(new CreateExpenseRequest(
            ExpenseDate: new DateTime(2026, 11, 13, 0, 0, 0, DateTimeKind.Utc),
            TaxInvoiceNumber: "TAX-01",
            TaxInvoiceDate: new DateTime(2026, 11, 13, 0, 0, 0, DateTimeKind.Utc),
            VendorName: "ร้านอุปกรณ์",
            VendorTaxId: "0105559998888",
            VendorBranch: "00000",
            VendorAddress: "กทม.",
            Category: ExpenseCategory.OfficeSupplies,
            Description: "ซื้อเครื่องพิมพ์",
            VatMode: VatCalculationMode.Exclusive,
            Amount: 2000m,
            DiscountAmount: 0m,
            VatRate: 7m,
            IsRefundableVat: true,
            WhtRate: 0m,
            PndType: PndType.None,
            IncomeTypeDescription: null,
            Status: ExpenseStatus.Approved,
            AttachmentUrl: null,
            Notes: null), CancellationToken.None);

        var createdExp = Assert.IsType<ApiResponse<ExpenseResponse>>(Assert.IsType<CreatedAtActionResult>(expCreateRes.Result).Value).Data!;
        var cancelExpRes = await expCtrl.Cancel(createdExp.Id, new CancelExpenseRequest("คีย์ซ้ำ"), CancellationToken.None);
        Assert.IsType<OkObjectResult>(cancelExpRes.Result);

        var accCtrl = new AccountingController(db, accounting, numGen);
        SetUserTenantContext(accCtrl, tenantId);
        var pnlRes = await accCtrl.GetProfitLoss(2026, 11, CancellationToken.None);
        var pnl = Assert.IsType<ApiResponse<ProfitLossDto>>(Assert.IsType<OkObjectResult>(pnlRes.Result).Value).Data!;
        Assert.Equal(0m, pnl.TotalExpense);
        Assert.Equal(-1000m, pnl.TotalRevenue);
    }

    [Fact]
    public async Task PurchaseOrder_WithVendorDefaultWht_PartialAndFinalReceive_ShouldApplyWhtOnAutoExpense()
    {
        await using var db = CreateDbContext(nameof(PurchaseOrder_WithVendorDefaultWht_PartialAndFinalReceive_ShouldApplyWhtOnAutoExpense));
        var tenantId = Guid.NewGuid();
        var vendorId = Guid.NewGuid();
        var productId = Guid.NewGuid();

        db.Tenants.Add(new Tenant { Id = tenantId, CompanyName = "บจก. ซีนิค" });
        db.Vendors.Add(new Vendor
        {
            Id = vendorId,
            TenantId = tenantId,
            Name = "บจก. บริการซัพพลาย",
            TaxId = "0105551112223",
            DefaultWhtRate = 3m,
            DefaultPndType = PndType.PND53
        });
        db.Products.Add(new Product
        {
            Id = productId,
            TenantId = tenantId,
            Name = "หมึกพิมพ์",
            Unit = "ตลับ",
            UnitPrice = 1000m,
            StockQuantity = 0m
        });
        await db.SaveChangesAsync();

        var numGen = new StubNumberGenerator();
        var poCtrl = new PurchaseOrdersController(db, numGen, new InventoryService(db), new QuestPdfService());
        SetUserTenantContext(poCtrl, tenantId);

        var createRes = await poCtrl.Create(new CreatePurchaseOrderRequest(
            OrderDate: new DateTime(2026, 11, 13, 0, 0, 0, DateTimeKind.Utc),
            ExpectedDeliveryDate: null,
            VendorId: vendorId,
            VendorName: "บจก. บริการซัพพลาย",
            VendorTaxId: "0105551112223",
            VendorBranch: "00000",
            VendorAddress: "กทม.",
            WarehouseId: null,
            VatMode: VatCalculationMode.Exclusive,
            DiscountAmount: 0m,
            VatRate: 7m,
            Notes: null,
            Lines: [new CreatePurchaseOrderLineRequest(productId, "หมึกพิมพ์", "ตลับ", 10m, 1000m)]), CancellationToken.None);

        var po = Assert.IsType<ApiResponse<PurchaseOrderDto>>(Assert.IsType<CreatedAtActionResult>(createRes.Result).Value).Data!;

        // Partial receive 4 units
        var partialRes = await poCtrl.Receive(po.Id, new ReceivePurchaseOrderRequest(
            CreateExpenseRecord: true,
            Lines: [new ReceivePurchaseOrderLineRequest(po.Lines[0].Id, 4m)]), CancellationToken.None);
        var partialPo = Assert.IsType<ApiResponse<PurchaseOrderDto>>(Assert.IsType<OkObjectResult>(partialRes.Result).Value).Data!;
        Assert.Equal(PurchaseOrderStatus.PartiallyReceived, partialPo.Status);
        Assert.Null(partialPo.LinkedExpenseId);

        // Receive remaining 6 units -> status Received + auto Expense with 3% WHT (300)
        var finalRes = await poCtrl.Receive(po.Id, new ReceivePurchaseOrderRequest(
            CreateExpenseRecord: true,
            VendorTaxInvoiceNumber: "VTX-999"), CancellationToken.None);
        var finalPo = Assert.IsType<ApiResponse<PurchaseOrderDto>>(Assert.IsType<OkObjectResult>(finalRes.Result).Value).Data!;
        Assert.Equal(PurchaseOrderStatus.Received, finalPo.Status);
        Assert.NotNull(finalPo.LinkedExpenseId);

        var expense = await db.ExpenseRecords.FindAsync(finalPo.LinkedExpenseId);
        Assert.NotNull(expense);
        Assert.Equal(3m, expense.WhtRate);
        Assert.Equal(300m, expense.WhtAmount);
        Assert.Equal(PndType.PND53, expense.PndType);
        Assert.Equal(10400m, expense.NetPaidAmount);
    }

    [Fact]
    public async Task Warehouse_UpdateAndUsersStatus_ShouldReflectRealState()
    {
        await using var db = CreateDbContext(nameof(Warehouse_UpdateAndUsersStatus_ShouldReflectRealState));
        var tenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        db.Tenants.Add(new Tenant { Id = tenantId, CompanyName = "บจก. ซีนิค" });
        db.AppUsers.Add(new AppUser
        {
            Id = userId,
            TenantId = tenantId,
            Username = "staff1",
            DisplayName = "พนักงาน 1",
            Role = "User",
            PasswordHash = "hash",
            IsActive = true
        });
        await db.SaveChangesAsync();

        var whCtrl = new WarehousesController(db, new InventoryService(db));
        SetUserTenantContext(whCtrl, tenantId);
        var createdWh = Assert.IsType<ApiResponse<WarehouseDto>>(Assert.IsType<CreatedAtActionResult>(
            (await whCtrl.Create(new UpsertWarehouseRequest("WH-B2", "สาขา 2", "นนทบุรี", false), CancellationToken.None)).Result).Value).Data!;

        var updRes = await whCtrl.Update(createdWh.Id, new UpsertWarehouseRequest("WH-B2", "สาขารัตนาธิเบศร์", "นนทบุรี", true), CancellationToken.None);
        var updatedWh = Assert.IsType<ApiResponse<WarehouseDto>>(Assert.IsType<OkObjectResult>(updRes.Result).Value).Data!;
        Assert.Equal("สาขารัตนาธิเบศร์", updatedWh.Name);
        Assert.True(updatedWh.IsDefault);

        // Toggle user status & check AdminUsersController.GetUsers includes IsActive = false
        var usersCtrl = new AdminUsersController(db);
        SetUserTenantContext(usersCtrl, tenantId);
        await usersCtrl.ToggleUserStatus(userId, new ToggleStatusRequest(false), CancellationToken.None);
        var listRes = await usersCtrl.GetUsers(CancellationToken.None);
        var list = Assert.IsType<ApiResponse<List<UserProfileDto>>>(Assert.IsType<OkObjectResult>(listRes.Result).Value).Data!;
        var target = Assert.Single(list, u => u.Id == userId);
        Assert.False(target.IsActive);
    }

    [Fact]
    public async Task Dashboard_ShouldIncludePaidAndViewedDocuments_AndMarkAsPaidShouldSettleAr()
    {
        await using var db = CreateDbContext(nameof(Dashboard_ShouldIncludePaidAndViewedDocuments_AndMarkAsPaidShouldSettleAr));
        var tenantId = Guid.NewGuid();
        db.Tenants.Add(new Tenant { Id = tenantId, CompanyName = "บจก. ซีนิค" });
        await db.SaveChangesAsync();

        var numGen = new StubNumberGenerator();
        var accounting = new AccountingService(db, numGen);
        await accounting.EnsureDefaultChartOfAccountsAsync(tenantId);

        var services = new ServiceCollection()
            .AddSingleton<IAccountingService>(accounting)
            .BuildServiceProvider();

        var taxCtrl = new TaxInvoiceController(db, numGen);
        SetUserTenantContext(taxCtrl, tenantId);
        taxCtrl.ControllerContext.HttpContext.RequestServices = services;

        // 1. Create Tax Invoice: 10,000 + 700 VAT = 10,700
        var createInv = await taxCtrl.Create(new CreateDocumentRequest(
            DocumentType: DocumentType.TaxInvoice,
            DocumentDate: DateTime.UtcNow,
            DueDate: DateTime.UtcNow.AddDays(30),
            CustomerId: null,
            CustomerName: "บจก. ลูกค้า",
            CustomerAddress: null,
            CustomerBranch: "00000",
            CustomerTaxId: null,
            VatMode: VatCalculationMode.Exclusive,
            VatRate: 7m,
            DiscountAmount: 0m,
            WhtRate: 0m,
            Notes: null,
            ReferenceDocumentId: null,
            DeliveryStatus: null,
            Lines: [new DocumentLineDto(null, 1, null, "ค่าบริการรายเดือน", 1m, "เดือน", 10000m, 0m, 10000m)]), CancellationToken.None);

        var inv = Assert.IsType<ApiResponse<DocumentResponse>>(Assert.IsType<CreatedAtActionResult>(createInv.Result).Value).Data!;

        // 2. Manual MarkAsPaid -> status Paid + posts Dr. 1110 / Cr. 1130
        var paidRes = await taxCtrl.MarkAsPaid(inv.Id, CancellationToken.None);
        var paidInv = Assert.IsType<ApiResponse<DocumentResponse>>(Assert.IsType<OkObjectResult>(paidRes.Result).Value).Data!;
        Assert.Equal(DocumentStatus.Paid, paidInv.Status);

        // 3. Add a Viewed Receipt (5,350), a Draft (excluded), and a Cancelled doc (excluded)
        db.DocumentHeaders.AddRange(
            new DocumentHeader
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                DocumentType = DocumentType.Receipt,
                DocumentNumber = "RE-001",
                DocumentDate = DateTime.UtcNow,
                Status = DocumentStatus.Viewed,
                TotalBeforeVat = 5000m,
                VatAmount = 350m,
                GrandTotal = 5350m,
                Lines = [new DocumentLine { Id = Guid.NewGuid(), SortOrder = 1, Description = "สินค้า A", Quantity = 2m, Unit = "ชิ้น", UnitPrice = 2500m, LineTotal = 5000m }]
            },
            new DocumentHeader
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                DocumentType = DocumentType.TaxInvoice,
                DocumentNumber = "IV-DRAFT",
                DocumentDate = DateTime.UtcNow,
                Status = DocumentStatus.Draft,
                TotalBeforeVat = 99999m,
                GrandTotal = 99999m
            },
            new DocumentHeader
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                DocumentType = DocumentType.TaxInvoice,
                DocumentNumber = "IV-CANCEL",
                DocumentDate = DateTime.UtcNow,
                Status = DocumentStatus.Cancelled,
                TotalBeforeVat = 88888m,
                GrandTotal = 88888m
            });
        await db.SaveChangesAsync();

        var dashCtrl = new DashboardController(db);
        SetUserTenantContext(dashCtrl, tenantId);

        var summaryRes = Assert.IsType<OkObjectResult>((await dashCtrl.GetSummary(CancellationToken.None)).Result);
        var summary = Assert.IsType<ApiResponse<DashboardSummary>>(summaryRes.Value).Data!;
        Assert.Equal(16050m, summary.TotalRevenue); // 10,700 (Paid) + 5,350 (Viewed), excluding Draft & Cancelled
        Assert.Equal(2, summary.DocumentsIssued);
        Assert.Equal(1, summary.PendingDocuments);

        var chartRes = Assert.IsType<OkObjectResult>((await dashCtrl.GetRevenueChart(CancellationToken.None)).Result);
        var chart = Assert.IsType<ApiResponse<List<MonthlyRevenueData>>>(chartRes.Value).Data!;
        Assert.Single(chart);
        Assert.Equal(15000m, chart[0].GoodsValue);
        Assert.Equal(1050m, chart[0].VatAmount);

        var topRes = Assert.IsType<OkObjectResult>((await dashCtrl.GetTopProducts(5, CancellationToken.None)).Result);
        var topProducts = Assert.IsType<ApiResponse<List<TopProductData>>>(topRes.Value).Data!;
        Assert.Equal(2, topProducts.Count);

        var actRes = Assert.IsType<OkObjectResult>((await dashCtrl.GetRecentActivity(10, CancellationToken.None)).Result);
        var recent = Assert.IsType<ApiResponse<List<RecentDocumentActivity>>>(actRes.Value).Data!;
        Assert.Equal(2, recent.Count);

        // Verify Trial Balance after Sales + Manual MarkAsPaid: 1110 Cash = 10,700; 1130 AR = 0; 4100 Revenue = 10,000; 2130 VAT = 700
        var accCtrl = new AccountingController(db, accounting, numGen);
        SetUserTenantContext(accCtrl, tenantId);
        var tbRes = Assert.IsType<OkObjectResult>((await accCtrl.GetTrialBalance(CancellationToken.None)).Result);
        var tb = Assert.IsType<ApiResponse<TrialBalanceDto>>(tbRes.Value).Data!;
        Assert.Equal(tb.TotalDebit, tb.TotalCredit);
        Assert.Equal(10700m, tb.Rows.Single(r => r.AccountCode == "1110").NetBalance);
        Assert.Equal(0m, tb.Rows.Single(r => r.AccountCode == "1130").NetBalance);
    }

    [Fact]
    public async Task TaxInvoice_Update_ShouldReverseAndRepostSalesJournal_KeepingTrialBalanceAccurate()
    {
        await using var db = CreateDbContext(nameof(TaxInvoice_Update_ShouldReverseAndRepostSalesJournal_KeepingTrialBalanceAccurate));
        var tenantId = Guid.NewGuid();
        db.Tenants.Add(new Tenant { Id = tenantId, CompanyName = "บจก. ซีนิค" });
        await db.SaveChangesAsync();

        var numGen = new StubNumberGenerator();
        var accounting = new AccountingService(db, numGen);
        await accounting.EnsureDefaultChartOfAccountsAsync(tenantId);

        var services = new ServiceCollection()
            .AddSingleton<IAccountingService>(accounting)
            .BuildServiceProvider();

        var taxCtrl = new TaxInvoiceController(db, numGen);
        SetUserTenantContext(taxCtrl, tenantId);
        taxCtrl.ControllerContext.HttpContext.RequestServices = services;

        // 1. Create Tax Invoice for 10,000 + 700 VAT = 10,700
        var createRes = await taxCtrl.Create(new CreateDocumentRequest(
            DocumentType: DocumentType.TaxInvoice,
            DocumentDate: DateTime.UtcNow,
            DueDate: null,
            CustomerId: null,
            CustomerName: "บจก. ลูกค้า",
            CustomerAddress: null,
            CustomerBranch: "00000",
            CustomerTaxId: null,
            VatMode: VatCalculationMode.Exclusive,
            VatRate: 7m,
            DiscountAmount: 0m,
            WhtRate: 0m,
            Notes: null,
            ReferenceDocumentId: null,
            DeliveryStatus: null,
            Lines: [new DocumentLineDto(null, 1, null, "บริการ A", 1m, "งาน", 10000m, 0m, 10000m)]), CancellationToken.None);
        var inv = Assert.IsType<ApiResponse<DocumentResponse>>(Assert.IsType<CreatedAtActionResult>(createRes.Result).Value).Data!;

        // 2. Admin updates Tax Invoice to 20,000 + 1,400 VAT = 21,400 -> must reverse old JV and repost new JV
        var updateRes = await taxCtrl.Update(inv.Id, new UpdateDocumentRequest(
            DocumentDate: DateTime.UtcNow,
            DueDate: null,
            CustomerId: null,
            CustomerName: "บจก. ลูกค้า",
            CustomerAddress: null,
            CustomerBranch: "00000",
            CustomerTaxId: null,
            VatMode: VatCalculationMode.Exclusive,
            VatRate: 7m,
            DiscountAmount: 0m,
            WhtRate: 0m,
            Notes: "แก้ไขยอด",
            DeliveryStatus: null,
            Lines: [new DocumentLineDto(null, 1, null, "บริการ A", 2m, "งาน", 10000m, 0m, 20000m)]), CancellationToken.None);
        var updated = Assert.IsType<ApiResponse<DocumentResponse>>(Assert.IsType<OkObjectResult>(updateRes.Result).Value).Data!;
        Assert.Equal(21400m, updated.GrandTotal);

        var accCtrl = new AccountingController(db, accounting, numGen);
        SetUserTenantContext(accCtrl, tenantId);
        var tb = Assert.IsType<ApiResponse<TrialBalanceDto>>(Assert.IsType<OkObjectResult>((await accCtrl.GetTrialBalance(CancellationToken.None)).Result).Value).Data!;
        Assert.Equal(tb.TotalDebit, tb.TotalCredit);
        Assert.Equal(21400m, tb.Rows.Single(r => r.AccountCode == "1130").NetBalance);
        Assert.Equal(-20000m, tb.Rows.Single(r => r.AccountCode == "4100").NetBalance);
        Assert.Equal(-1400m, tb.Rows.Single(r => r.AccountCode == "2130").NetBalance);
    }

    [Fact]
    public async Task CreditAndDebitNoteControllers_ShouldCreateListAndBalanceAccounting_AndCustomerHistoryShouldNetCreditNotes()
    {
        await using var db = CreateDbContext(nameof(CreditAndDebitNoteControllers_ShouldCreateListAndBalanceAccounting_AndCustomerHistoryShouldNetCreditNotes));
        var tenantId = Guid.NewGuid();
        var customerId = Guid.NewGuid();
        var productId = Guid.NewGuid();

        db.Tenants.Add(new Tenant { Id = tenantId, CompanyName = "Senic Co", SubscriptionStatus = "Active", IsActive = true });
        db.Customers.Add(new Customer { Id = customerId, TenantId = tenantId, Name = "บจก. สยามเทค", Branch = "00000", TaxId = "0105561234567" });
        db.Products.Add(new Product { Id = productId, TenantId = tenantId, Sku = "P01", Name = "สินค้า A", Unit = "ชิ้น", UnitPrice = 10000m, StockQuantity = 10m });
        await db.SaveChangesAsync();

        var numGen = new StubNumberGenerator();
        var accounting = new AccountingService(db, numGen);
        await accounting.EnsureDefaultChartOfAccountsAsync(tenantId);
        var services = new ServiceCollection()
            .AddSingleton<IAccountingService>(accounting)
            .BuildServiceProvider();

        // 1. Issue TaxInvoice (10,000 + 700 VAT = 10,700; stock 10 -> 9)
        var taxCtrl = new TaxInvoiceController(db, numGen);
        SetUserTenantContext(taxCtrl, tenantId);
        taxCtrl.ControllerContext.HttpContext.RequestServices = services;

        var invRes = await taxCtrl.Create(new CreateDocumentRequest(
            DocumentType: DocumentType.TaxInvoice,
            DocumentDate: DateTime.UtcNow, DueDate: null,
            CustomerId: customerId, CustomerName: "บจก. สยามเทค",
            CustomerAddress: null, CustomerBranch: "00000", CustomerTaxId: "0105561234567",
            VatMode: VatCalculationMode.Exclusive, VatRate: 7m, DiscountAmount: 0m, WhtRate: 0m,
            Notes: null, ReferenceDocumentId: null, DeliveryStatus: null,
            Lines: [new DocumentLineDto(null, 1, productId, "สินค้า A", 1m, "ชิ้น", 10000m, 0m, 10000m)]), CancellationToken.None);
        var inv = Assert.IsType<ApiResponse<DocumentResponse>>(Assert.IsType<CreatedAtActionResult>(invRes.Result).Value).Data!;
        Assert.Equal(9m, (await db.Products.FindAsync(productId))!.StockQuantity);

        // 2. Also add a DeliveryNote (should be excluded from Customer purchase history)
        var dlvCtrl = new DeliveryNoteController(db, numGen);
        SetUserTenantContext(dlvCtrl, tenantId);
        await dlvCtrl.Create(new CreateDocumentRequest(
            DocumentType: DocumentType.DeliveryNote,
            DocumentDate: DateTime.UtcNow, DueDate: null,
            CustomerId: customerId, CustomerName: "บจก. สยามเทค",
            CustomerAddress: null, CustomerBranch: "00000", CustomerTaxId: "0105561234567",
            VatMode: VatCalculationMode.Exclusive, VatRate: 7m, DiscountAmount: 0m, WhtRate: 0m,
            Notes: null, ReferenceDocumentId: null, DeliveryStatus: "รอส่ง",
            Lines: [new DocumentLineDto(null, 1, null, "ค่าจัดส่ง", 1m, "ครั้ง", 500m, 0m, 500m)]), CancellationToken.None);

        // 3. Issue CreditNote referencing TaxInvoice (-2,000 - 140 VAT = -2,140)
        var cnCtrl = new CreditNoteController(db, numGen);
        SetUserTenantContext(cnCtrl, tenantId);
        cnCtrl.ControllerContext.HttpContext.RequestServices = services;

        var cnRes = await cnCtrl.CreateCreditDebitNote(new CreateCreditDebitNoteRequest(
            NoteType: DocumentType.CreditNote,
            SourceDocumentId: inv.Id,
            DocumentDate: DateTime.UtcNow,
            Reason: "ลดราคาบางส่วน",
            AdjustmentAmount: 2000m,
            VatMode: VatCalculationMode.Exclusive,
            VatRate: 7m,
            WhtRate: 0m,
            Lines: [new DocumentLineDto(null, 1, productId, "ลดราคาสินค้า A", 1m, "ชิ้น", 2000m, 0m, 2000m)]), CancellationToken.None);
        var cn = Assert.IsType<ApiResponse<DocumentResponse>>(Assert.IsType<CreatedAtActionResult>(cnRes.Result).Value).Data!;
        Assert.Equal(DocumentType.CreditNote, cn.DocumentType);
        Assert.Equal(2140m, cn.GrandTotal);
        Assert.Equal(9m, (await db.Products.FindAsync(productId))!.StockQuantity);

        var cnList = Assert.IsType<ApiResponse<PaginatedResponse<DocumentResponse>>>(
            Assert.IsType<OkObjectResult>((await cnCtrl.GetAll(ct: CancellationToken.None)).Result).Value).Data!;
        Assert.Single(cnList.Items);

        // 4. Issue DebitNote referencing TaxInvoice (+1,000 + 70 VAT = +1,070) and list
        var dnCtrl = new DebitNoteController(db, numGen);
        SetUserTenantContext(dnCtrl, tenantId);
        dnCtrl.ControllerContext.HttpContext.RequestServices = services;

        var dnRes = await dnCtrl.CreateCreditDebitNote(new CreateCreditDebitNoteRequest(
            NoteType: DocumentType.DebitNote,
            SourceDocumentId: inv.Id,
            DocumentDate: DateTime.UtcNow,
            Reason: "เพิ่มค่าบริการติดตั้ง",
            AdjustmentAmount: 1000m,
            VatMode: VatCalculationMode.Exclusive,
            VatRate: 7m,
            WhtRate: 0m,
            Lines: [new DocumentLineDto(null, 1, null, "ค่าติดตั้งเพิ่มเติม", 1m, "งาน", 1000m, 0m, 1000m)]), CancellationToken.None);
        var dn = Assert.IsType<ApiResponse<DocumentResponse>>(Assert.IsType<CreatedAtActionResult>(dnRes.Result).Value).Data!;
        Assert.Equal(DocumentType.DebitNote, dn.DocumentType);

        var dnList = Assert.IsType<ApiResponse<PaginatedResponse<DocumentResponse>>>(
            Assert.IsType<OkObjectResult>((await dnCtrl.GetAll(ct: CancellationToken.None)).Result).Value).Data!;
        Assert.Single(dnList.Items);

        // 5. Verify Trial Balance (Net Sales = 10,000 - 2,000 + 1,000 = 9,000; Output VAT = 630; AR = 9,630)
        var accCtrl = new AccountingController(db, accounting, numGen);
        SetUserTenantContext(accCtrl, tenantId);
        var tb = Assert.IsType<ApiResponse<TrialBalanceDto>>(Assert.IsType<OkObjectResult>((await accCtrl.GetTrialBalance(CancellationToken.None)).Result).Value).Data!;
        Assert.Equal(tb.TotalDebit, tb.TotalCredit);
        Assert.Equal(9630m, tb.Rows.Single(r => r.AccountCode == "1130").NetBalance);
        Assert.Equal(-9000m, tb.Rows.Single(r => r.AccountCode == "4100").NetBalance);
        Assert.Equal(-630m, tb.Rows.Single(r => r.AccountCode == "2130").NetBalance);

        // 6. Verify Customer purchase history nets CN and excludes DeliveryNote (3 docs: INV +10,700, CN -2,140, DN +1,070 = 9,630)
        var custCtrl = new CustomersController(db);
        SetUserTenantContext(custCtrl, tenantId);
        var history = Assert.IsType<ApiResponse<CustomerPurchaseHistoryDto>>(
            Assert.IsType<OkObjectResult>((await custCtrl.GetPurchaseHistory(customerId, ct: CancellationToken.None)).Result).Value).Data!;
        Assert.Equal(3, history.TotalOrders);
        Assert.Equal(9630m, history.TotalSpent);

        // 7. Verify RecurringInvoiceController returns SourceDocumentNumber & CustomerName
        var recCtrl = new RecurringInvoiceController(db);
        SetUserTenantContext(recCtrl, tenantId);
        var createdRec = Assert.IsType<ApiResponse<RecurringInvoiceDto>>(
            Assert.IsType<OkObjectResult>((await recCtrl.Create(
                new CreateRecurringInvoiceRequest(inv.Id, "Monthly", DateTime.UtcNow.AddMonths(1), 12),
                CancellationToken.None)).Result).Value).Data!;
        Assert.Equal(inv.DocumentNumber, createdRec.SourceDocumentNumber);
        Assert.Equal("บจก. สยามเทค", createdRec.CustomerName);

        var recList = Assert.IsType<ApiResponse<List<RecurringInvoiceDto>>>(
            Assert.IsType<OkObjectResult>((await recCtrl.GetAll(CancellationToken.None)).Result).Value).Data!;
        Assert.Single(recList);
        Assert.Equal(inv.DocumentNumber, recList[0].SourceDocumentNumber);

        // 8. Verify ProductsController.GetByBarcode matches by SKU or Barcode
        var prodCtrl = new ProductsController(db);
        SetUserTenantContext(prodCtrl, tenantId);
        var bySku = Assert.IsType<ApiResponse<ProductDto>>(
            Assert.IsType<OkObjectResult>((await prodCtrl.GetByBarcode("P01", CancellationToken.None)).Result).Value).Data!;
        Assert.Equal(productId, bySku.Id);
        Assert.IsType<NotFoundObjectResult>((await prodCtrl.GetByBarcode("MISSING-BARCODE", CancellationToken.None)).Result);
    }
}

