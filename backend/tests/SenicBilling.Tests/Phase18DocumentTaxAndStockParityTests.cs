using System.Security.Claims;
using System.Text;
using System.Xml.Linq;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.API.Controllers;
using SenicBilling.API.Services;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Domain.Interfaces;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.Tests;

public class Phase18DocumentTaxAndStockParityTests
{
    private sealed class StubNumberGenerator : IDocumentNumberGeneratorService
    {
        private int _seq = 1;
        public Task<string> GenerateNextNumberAsync(Guid tenantId, DocumentType documentType, CancellationToken ct = default)
            => Task.FromResult($"{documentType.ToString().ToUpperInvariant()[..2]}-202611-{_seq++:0000}");
    }

    private sealed class StubPdfService : IPdfService
    {
        public byte[] GenerateDocumentPdf(DocumentHeader document)
            => Encoding.UTF8.GetBytes($"%PDF-1.4 {document.DocumentNumber}");

        public byte[] GenerateWhtCertificatePdf(ExpenseRecord expense, Tenant payer)
            => Encoding.UTF8.GetBytes($"%PDF-1.4 WHT50 {expense.VoucherNumber}");

        public byte[] GeneratePurchaseOrderPdf(PurchaseOrder po, Tenant buyer)
            => Encoding.UTF8.GetBytes($"%PDF-1.4 PO {po.PoNumber}");
    }

    private static SenicBillingDbContext CreateDbContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<SenicBillingDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;
        return new SenicBillingDbContext(options);
    }

    private static void SetUserTenantContext(ControllerBase controller, Guid tenantId, string role = "Admin")
    {
        var claims = new[]
        {
            new Claim("tenantId", tenantId.ToString()),
            new Claim(ClaimTypes.NameIdentifier, "tester-id"),
            new Claim(ClaimTypes.Name, "tester"),
            new Claim(ClaimTypes.Role, role),
            new Claim("role", role)
        };
        var identity = new ClaimsIdentity(claims, "TestAuth");
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(identity)
            }
        };
    }

    [Fact]
    public async Task SharedDocumentController_ConvertAndGenerateETaxXml_ShouldEnforceQuota_TrackUsage_AndSupportCreditDebitXml()
    {
        using var db = CreateDbContext(Guid.NewGuid().ToString());
        var tenantId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        var quotationId = Guid.NewGuid();
        var creditNoteId = Guid.NewGuid();

        db.SubscriptionPlans.Add(new SubscriptionPlan
        {
            Id = planId,
            Name = "Starter 2 Docs",
            MaxDocumentsPerMonth = 2,
            MaxUsers = 3,
            IsActive = true
        });

        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            CompanyName = "Senic Phase 18 Co., Ltd.",
            TaxId = "0105558888888",
            CurrentPlanId = planId,
            IsActive = true,
            SubscriptionStatus = "Active"
        });

        db.DocumentHeaders.Add(new DocumentHeader
        {
            Id = quotationId,
            TenantId = tenantId,
            DocumentType = DocumentType.Quotation,
            DocumentNumber = "QT-202611-0001",
            DocumentDate = DateTime.UtcNow,
            CustomerName = "ลูกค้าใบเสนอราคา",
            CustomerTaxId = "0105551234567",
            Status = DocumentStatus.Issued,
            VatMode = VatCalculationMode.Exclusive,
            VatRate = 7m,
            Subtotal = 1000m,
            TotalBeforeVat = 1000m,
            VatAmount = 70m,
            GrandTotal = 1070m,
            CreatedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();

        var ctrl = new SharedDocumentController(db, new StubNumberGenerator(), new StubPdfService());
        SetUserTenantContext(ctrl, tenantId);

        // 1. Convert Quotation -> TaxInvoice succeeds (2nd doc in month, reaching quota 2/2) and increments TenantUsageStat
        var firstConvert = await ctrl.Convert(
            quotationId,
            new ConvertDocumentRequest(DocumentType.TaxInvoice, null, null, "Convert 1"),
            CancellationToken.None);
        Assert.IsType<CreatedResult>(firstConvert.Result);

        var usageStat = await db.TenantUsageStats.FirstOrDefaultAsync(u => u.TenantId == tenantId);
        Assert.NotNull(usageStat);
        Assert.Equal(1, usageStat!.DocumentsCreated);

        // 2. Converting another document when monthlyDocs (2) >= MaxDocumentsPerMonth (2) -> BadRequest
        var secondConvert = await ctrl.Convert(
            quotationId,
            new ConvertDocumentRequest(DocumentType.TaxInvoice, null, null, "Convert 2 exceeds quota"),
            CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(secondConvert.Result);

        // 3. GenerateETaxXml on CreditNote returns ETDA TypeCode 381 XML, and rejects Quotation
        db.DocumentHeaders.Add(new DocumentHeader
        {
            Id = creditNoteId,
            TenantId = tenantId,
            DocumentType = DocumentType.CreditNote,
            DocumentNumber = "CN-202611-0001",
            DocumentDate = DateTime.UtcNow,
            CustomerName = "ลูกค้าลดหนี้",
            CustomerTaxId = "0105551234567",
            Status = DocumentStatus.Issued,
            TotalBeforeVat = 500m,
            VatAmount = 35m,
            GrandTotal = 535m
        });
        await db.SaveChangesAsync();

        var quotationXmlRes = await ctrl.GenerateETaxXml(quotationId, CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(quotationXmlRes);

        var cnXmlRes = await ctrl.GenerateETaxXml(creditNoteId, CancellationToken.None);
        var fileRes = Assert.IsType<FileContentResult>(cnXmlRes);
        var xmlText = XDocument.Load(new MemoryStream(fileRes.FileContents)).ToString();
        Assert.Contains("<TypeCode>381</TypeCode>", xmlText);
        Assert.Contains("CN-202611-0001", xmlText);
    }

    [Fact]
    public async Task CreditNote_ShouldRestoreStock_AndTaxInvoiceFromDeliveryNote_ShouldNotDoubleDeductStock()
    {
        using var db = CreateDbContext(Guid.NewGuid().ToString());
        var tenantId = Guid.NewGuid();
        var productId = Guid.NewGuid();
        var deliveryNoteId = Guid.NewGuid();

        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            CompanyName = "Stock Dedup Co.",
            TaxId = "0105557777777",
            IsActive = true,
            SubscriptionStatus = "Active"
        });

        db.Products.Add(new Product
        {
            Id = productId,
            TenantId = tenantId,
            Sku = "SKU-DEDUP",
            Name = "สินค้าทดสอบตัดสต็อก",
            Unit = "ชิ้น",
            UnitPrice = 1000m,
            StockQuantity = 20m,
            IsActive = true
        });

        // Simulate an already-issued DeliveryNote that deducted 5 units (leaving StockQuantity = 20)
        db.DocumentHeaders.Add(new DocumentHeader
        {
            Id = deliveryNoteId,
            TenantId = tenantId,
            DocumentType = DocumentType.DeliveryNote,
            DocumentNumber = "DN-202611-0001",
            DocumentDate = DateTime.UtcNow,
            CustomerName = "ลูกค้าส่งของ",
            Status = DocumentStatus.Issued
        });
        await db.SaveChangesAsync();

        var taxCtrl = new TaxInvoiceController(db, new StubNumberGenerator());
        SetUserTenantContext(taxCtrl, tenantId);

        // 1. Creating TaxInvoice referencing DeliveryNote should NOT deduct stock a second time
        var createFromDnReq = new CreateDocumentRequest(
            DocumentType: DocumentType.TaxInvoice,
            DocumentDate: DateTime.UtcNow,
            DueDate: null,
            CustomerId: null,
            CustomerName: "ลูกค้าส่งของ",
            CustomerAddress: null,
            CustomerBranch: null,
            CustomerTaxId: "0105551234567",
            VatMode: VatCalculationMode.Exclusive,
            VatRate: 7m,
            DiscountAmount: 0m,
            WhtRate: 0m,
            Notes: "อ้างอิงใบส่งของ",
            ReferenceDocumentId: deliveryNoteId,
            DeliveryStatus: null,
            Lines: [new DocumentLineDto(null, 1, productId, "สินค้าทดสอบตัดสต็อก", 5m, "ชิ้น", 1000m, 0m, 5000m)]);

        var createdAction = await taxCtrl.Create(createFromDnReq, CancellationToken.None);
        var createdTaxDoc = Assert.IsType<ApiResponse<DocumentResponse>>(
            Assert.IsType<CreatedAtActionResult>(createdAction.Result).Value).Data!;

        var productAfterTaxFromDn = await db.Products.FindAsync(productId);
        Assert.Equal(20m, productAfterTaxFromDn!.StockQuantity); // Unchanged (no double deduction)
        Assert.Equal(deliveryNoteId, createdTaxDoc.ConvertedFromDocumentId);

        // 2. Issuing a CreditNote against the TaxInvoice enforces monthly quota & increments TenantUsageStat
        var cnCtrl = new CreditNoteController(db, new StubNumberGenerator());
        SetUserTenantContext(cnCtrl, tenantId);

        var cnReq = new CreateCreditDebitNoteRequest(
            NoteType: DocumentType.CreditNote,
            SourceDocumentId: createdTaxDoc.Id,
            DocumentDate: DateTime.UtcNow,
            Reason: "ลดราคาสินค้า 2 ชิ้น",
            AdjustmentAmount: 2000m,
            VatMode: VatCalculationMode.Exclusive,
            VatRate: 7m,
            WhtRate: 0m,
            Lines: [new DocumentLineDto(null, 1, productId, "สินค้าทดสอบตัดสต็อก", 2m, "ชิ้น", 1000m, 0m, 2000m)]);

        var cnAction = await cnCtrl.CreateCreditDebitNote(cnReq, CancellationToken.None);
        Assert.IsType<CreatedAtActionResult>(cnAction.Result);

        var usageAfterCn = await db.TenantUsageStats.FirstOrDefaultAsync(u => u.TenantId == tenantId);
        Assert.NotNull(usageAfterCn);
        Assert.Equal(2, usageAfterCn!.DocumentsCreated);
    }

    [Fact]
    public async Task TaxSummaryQuery_ReportsController_AndAgingReport_ShouldSubtractCreditNote_AndAddDebitNote()
    {
        using var db = CreateDbContext(Guid.NewGuid().ToString());
        var tenantId = Guid.NewGuid();
        var customerId = Guid.NewGuid();
        var docDate = new DateTime(2026, 11, 10, 0, 0, 0, DateTimeKind.Utc);
        var overdueDate = DateTime.UtcNow.Date.AddDays(-15);

        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            CompanyName = "Tax Parity Co., Ltd.",
            TaxId = "0105556666666",
            IsActive = true,
            SubscriptionStatus = "Active"
        });

        // TaxInvoice: 10,000 + VAT 700 = 10,700 (WHT 300)
        db.DocumentHeaders.Add(new DocumentHeader
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CustomerId = customerId,
            CustomerName = "บจก. ทดสอบภาษี",
            CustomerTaxId = "0105551111111",
            DocumentType = DocumentType.TaxInvoice,
            DocumentNumber = "INV-202611-0001",
            DocumentDate = docDate,
            DueDate = overdueDate,
            Status = DocumentStatus.Overdue,
            TotalBeforeVat = 10000m,
            VatAmount = 700m,
            WhtAmount = 300m,
            GrandTotal = 10700m
        });

        // CreditNote: -2,000 + VAT -140 = -2,140 (WHT -60)
        db.DocumentHeaders.Add(new DocumentHeader
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CustomerId = customerId,
            CustomerName = "บจก. ทดสอบภาษี",
            CustomerTaxId = "0105551111111",
            DocumentType = DocumentType.CreditNote,
            DocumentNumber = "CN-202611-0001",
            DocumentDate = docDate,
            DueDate = overdueDate,
            Status = DocumentStatus.Issued,
            TotalBeforeVat = 2000m,
            VatAmount = 140m,
            WhtAmount = 60m,
            GrandTotal = 2140m
        });

        // DebitNote: +1,000 + VAT +70 = +1,070 (WHT +30)
        db.DocumentHeaders.Add(new DocumentHeader
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CustomerId = customerId,
            CustomerName = "บจก. ทดสอบภาษี",
            CustomerTaxId = "0105551111111",
            DocumentType = DocumentType.DebitNote,
            DocumentNumber = "DN-202611-0001",
            DocumentDate = docDate,
            DueDate = overdueDate,
            Status = DocumentStatus.Issued,
            TotalBeforeVat = 1000m,
            VatAmount = 70m,
            WhtAmount = 30m,
            GrandTotal = 1070m
        });

        await db.SaveChangesAsync();

        // 1. TaxSummaryQuery: Net Sales = 10,000 - 2,000 + 1,000 = 9,000; Output VAT = 700 - 140 + 70 = 630; WHT = 300 - 60 + 30 = 270
        var summary = await TaxSummaryQuery.ComputeAsync(db, tenantId, 2026, 11, CancellationToken.None);
        Assert.Equal(9000m, summary.TotalSales);
        Assert.Equal(630m, summary.TotalVatCollected);
        Assert.Equal(630m, summary.TotalSalesVat);
        Assert.Equal(270m, summary.WhtDeducted);

        // 2. ReportsController.ExportTaxReport: Excel sum row matches 9,000 / 630 / 9,630
        var reportsCtrl = new ReportsController(db);
        SetUserTenantContext(reportsCtrl, tenantId);
        var excelRes = await reportsCtrl.ExportTaxReport(2026, 11, CancellationToken.None);
        var excelFile = Assert.IsType<FileContentResult>(excelRes);
        using var wb = new XLWorkbook(new MemoryStream(excelFile.FileContents));
        var ws = wb.Worksheet("รายงานภาษีขาย");
        Assert.Equal(9000m, ws.Cell(10, 7).GetValue<decimal>());
        Assert.Equal(630m, ws.Cell(10, 8).GetValue<decimal>());
        Assert.Equal(9630m, ws.Cell(10, 9).GetValue<decimal>());

        // 3. DashboardController.GetAgingReport: Overdue1_30 = 10,700 - 2,140 + 1,070 = 9,630
        var dashCtrl = new DashboardController(db);
        SetUserTenantContext(dashCtrl, tenantId);
        var agingAction = await dashCtrl.GetAgingReport(CancellationToken.None);
        var agingDto = Assert.IsType<ApiResponse<AgingSummaryDto>>(
            Assert.IsType<OkObjectResult>(agingAction.Result).Value).Data!;
        Assert.Equal(9630m, agingDto.Overdue1_30);
        Assert.Equal(9630m, agingDto.TotalOverdue);
    }
}
