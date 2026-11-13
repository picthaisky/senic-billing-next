using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Xml.Linq;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.API.Controllers;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Interfaces;
using SenicBilling.Application.Services;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Domain.Interfaces;
using SenicBilling.Infrastructure.Auth;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.Tests;

public class BillingDomainAndSecurityTests
{
    private sealed class StubNumberGenerator : IDocumentNumberGeneratorService
    {
        private int _seq = 1;
        public Task<string> GenerateNextNumberAsync(Guid tenantId, DocumentType documentType, CancellationToken ct = default)
            => Task.FromResult($"INV-202611-{_seq++:0000}");
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
    public void PasswordHasher_ShouldHashWithSaltedPbkdf2_AndVerifyCorrectly()
    {
        var hash1 = PasswordHasher.HashPassword("StrongP@ss123");
        var hash2 = PasswordHasher.HashPassword("StrongP@ss123");

        Assert.StartsWith("PBKDF2$100000$", hash1);
        Assert.NotEqual(hash1, hash2); // Random salt ensures distinct hashes

        Assert.True(PasswordHasher.VerifyPassword("StrongP@ss123", hash1, out var needsUpgrade));
        Assert.False(needsUpgrade);
        Assert.False(PasswordHasher.VerifyPassword("WrongPassword", hash1, out _));
    }

    [Fact]
    public void PasswordHasher_ShouldSupportLegacySha256_AndFlagNeedsUpgrade()
    {
        var legacySha256 = Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes("admin123")));

        var verified = PasswordHasher.VerifyPassword("admin123", legacySha256, out var needsUpgrade);

        Assert.True(verified);
        Assert.True(needsUpgrade);
    }

    [Fact]
    public void ETaxXmlGenerator_ShouldGenerateValidEtdaXml_WithCorrectTaxIdsAndTotals()
    {
        var tenantId = Guid.NewGuid();
        var tenant = new Tenant
        {
            Id = tenantId,
            CompanyName = "บริษัท ซีนิค บิลลิ่ง จำกัด",
            TaxId = "0105559999999",
            BranchName = "00000",
            Address = "99 ถนนสาทร กรุงเทพฯ"
        };

        var doc = new DocumentHeader
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            DocumentType = DocumentType.TaxInvoice,
            DocumentNumber = "INV-202611-0001",
            DocumentDate = new DateTime(2026, 11, 13, 0, 0, 0, DateTimeKind.Utc),
            CustomerName = "บจก. ลูกค้าตัวอย่าง",
            CustomerTaxId = "0105551111111",
            CustomerBranch = "00000",
            Subtotal = 10000m,
            DiscountAmount = 0m,
            TotalBeforeVat = 10000m,
            VatRate = 7m,
            VatAmount = 700m,
            GrandTotal = 10700m,
            Lines =
            [
                new DocumentLine
                {
                    Id = Guid.NewGuid(),
                    SortOrder = 1,
                    Description = "บริการพัฒนาซอฟต์แวร์",
                    Quantity = 1m,
                    Unit = "งาน",
                    UnitPrice = 10000m,
                    LineTotal = 10000m
                }
            ]
        };

        var xmlBytes = ETaxXmlGenerator.GenerateXml(doc, tenant);
        using var ms = new MemoryStream(xmlBytes);
        var xdoc = XDocument.Load(ms);
        var xmlText = xdoc.ToString();

        Assert.Contains("INV-202611-0001", xmlText);
        Assert.Contains("0105559999999", xmlText);
        Assert.Contains("0105551111111", xmlText);
        Assert.Contains("10700.00", xmlText);
        Assert.NotNull(xdoc.Root);
    }

    [Fact]
    public async Task TaxInvoiceController_ShouldCalculateExclusiveAndInclusiveVat_AndDeductAndRestoreStock()
    {
        using var db = CreateDbContext(Guid.NewGuid().ToString());
        var tenantId = Guid.NewGuid();
        var productId = Guid.NewGuid();

        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            CompanyName = "Test SME",
            TaxId = "0105550000001",
            IsActive = true,
            SubscriptionStatus = "Active"
        });

        db.Products.Add(new Product
        {
            Id = productId,
            TenantId = tenantId,
            Sku = "SKU-001",
            Barcode = "8850000000001",
            Name = "สินค้าทดสอบ",
            Unit = "ชิ้น",
            UnitPrice = 1000m,
            StockQuantity = 50m,
            IsActive = true
        });
        await db.SaveChangesAsync();

        var controller = new TaxInvoiceController(db, new StubNumberGenerator());
        SetUserTenantContext(controller, tenantId);

        // 1. Create TaxInvoice with 5 units -> Stock should drop from 50 to 45
        var createReq = new CreateDocumentRequest(
            DocumentType: DocumentType.TaxInvoice,
            DocumentDate: DateTime.UtcNow,
            DueDate: DateTime.UtcNow.AddDays(30),
            CustomerId: null,
            CustomerName: "ลูกค้า A",
            CustomerAddress: "กรุงเทพฯ",
            CustomerBranch: "สำนักงานใหญ่",
            CustomerTaxId: "0105551234567",
            VatMode: VatCalculationMode.Exclusive,
            VatRate: 7m,
            DiscountAmount: 0m,
            WhtRate: 3m,
            Notes: null,
            ReferenceDocumentId: null,
            DeliveryStatus: null,
            Lines:
            [
                new DocumentLineDto(null, 1, productId, "สินค้าทดสอบ", 5m, "ชิ้น", 1000m, 0m, 5000m)
            ]);

        var createAction = await controller.Create(createReq, CancellationToken.None);
        var createdResult = Assert.IsType<CreatedAtActionResult>(createAction.Result);
        var apiResp = Assert.IsType<ApiResponse<DocumentResponse>>(createdResult.Value);
        var createdDoc = apiResp.Data!;

        Assert.Equal(5000m, createdDoc.Subtotal);
        Assert.Equal(350m, createdDoc.VatAmount);
        Assert.Equal(150m, createdDoc.WhtAmount); // 3% of 5000
        Assert.Equal(5350m, createdDoc.GrandTotal);

        var productAfterCreate = await db.Products.FindAsync(productId);
        Assert.Equal(45m, productAfterCreate!.StockQuantity);

        // 2. Update TaxInvoice from 5 units to 8 units -> Stock should reconcile to 50 - 8 = 42
        var updateReq = new UpdateDocumentRequest(
            DocumentDate: DateTime.UtcNow,
            DueDate: DateTime.UtcNow.AddDays(30),
            CustomerId: null,
            CustomerName: "ลูกค้า A",
            CustomerAddress: "กรุงเทพฯ",
            CustomerBranch: "สำนักงานใหญ่",
            CustomerTaxId: "0105551234567",
            VatMode: VatCalculationMode.Inclusive,
            VatRate: 7m,
            DiscountAmount: 0m,
            WhtRate: 0m,
            Notes: "Updated",
            DeliveryStatus: null,
            Lines:
            [
                new DocumentLineDto(null, 1, productId, "สินค้าทดสอบ", 8m, "ชิ้น", 1070m, 0m, 8560m)
            ]);

        var updateAction = await controller.Update(createdDoc.Id, updateReq, CancellationToken.None);
        var okUpdate = Assert.IsType<OkObjectResult>(updateAction.Result);
        var updatedDoc = Assert.IsType<ApiResponse<DocumentResponse>>(okUpdate.Value).Data!;

        Assert.Equal(8560m, updatedDoc.GrandTotal);
        Assert.Equal(8000m, updatedDoc.TotalBeforeVat);
        Assert.Equal(560m, updatedDoc.VatAmount);

        var productAfterUpdate = await db.Products.FindAsync(productId);
        Assert.Equal(42m, productAfterUpdate!.StockQuantity);

        // 3. Cancel TaxInvoice -> Stock should be restored back to 50
        var cancelAction = await controller.Cancel(createdDoc.Id, new CancelDocumentRequest("ยกเลิกบิล"), CancellationToken.None);
        Assert.IsType<OkObjectResult>(cancelAction.Result);

        var productAfterCancel = await db.Products.FindAsync(productId);
        Assert.Equal(50m, productAfterCancel!.StockQuantity);
    }

    [Fact]
    public async Task QuotaEnforcement_ShouldRejectDocumentCreation_WhenMonthlyQuotaExceeded()
    {
        using var db = CreateDbContext(Guid.NewGuid().ToString());
        var tenantId = Guid.NewGuid();
        var planId = Guid.NewGuid();

        var plan = new SubscriptionPlan
        {
            Id = planId,
            Name = "Starter Quota Test",
            MaxDocumentsPerMonth = 1,
            MaxUsers = 2,
            IsActive = true
        };
        db.SubscriptionPlans.Add(plan);

        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            CompanyName = "Quota Tenant",
            CurrentPlanId = planId,
            IsActive = true,
            SubscriptionStatus = "Active"
        });
        await db.SaveChangesAsync();

        var controller = new TaxInvoiceController(db, new StubNumberGenerator());
        SetUserTenantContext(controller, tenantId);

        var req = new CreateDocumentRequest(
            DocumentType: DocumentType.TaxInvoice,
            DocumentDate: DateTime.UtcNow,
            DueDate: null,
            CustomerId: null,
            CustomerName: "ลูกค้า 1",
            CustomerAddress: null,
            CustomerBranch: null,
            CustomerTaxId: "0105551234567",
            VatMode: VatCalculationMode.Exclusive,
            VatRate: 7m,
            DiscountAmount: 0m,
            WhtRate: 0m,
            Notes: null,
            ReferenceDocumentId: null,
            DeliveryStatus: null,
            Lines: [new DocumentLineDto(null, 1, null, "บริการ", 1m, "งาน", 500m, 0m, 500m)]);

        // First document succeeds (1/1)
        var first = await controller.Create(req, CancellationToken.None);
        Assert.IsType<CreatedAtActionResult>(first.Result);

        // Second document in the same month exceeds MaxDocumentsPerMonth (1) -> BadRequest
        var second = await controller.Create(req, CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(second.Result);
    }

    [Fact]
    public async Task SharedDocumentConvert_FromQuotationToTaxInvoice_ShouldDeductStock_AndEnforceTenantIsolation()
    {
        using var db = CreateDbContext(Guid.NewGuid().ToString());
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var productId = Guid.NewGuid();
        var quotationId = Guid.NewGuid();

        db.Products.Add(new Product
        {
            Id = productId,
            TenantId = tenantA,
            Sku = "P-100",
            Name = "โน้ตบุ๊กสำนักงาน",
            Unit = "เครื่อง",
            UnitPrice = 20000m,
            StockQuantity = 10m,
            IsActive = true
        });

        var quotation = new DocumentHeader
        {
            Id = quotationId,
            TenantId = tenantA,
            DocumentType = DocumentType.Quotation,
            DocumentNumber = "QT-202611-0001",
            DocumentDate = DateTime.UtcNow,
            CustomerName = "ลูกค้าองค์กร",
            CustomerTaxId = "0105559876543",
            Status = DocumentStatus.Issued,
            VatMode = VatCalculationMode.Exclusive,
            VatRate = 7m,
            Subtotal = 40000m,
            TotalBeforeVat = 40000m,
            VatAmount = 2800m,
            GrandTotal = 42800m,
            Lines =
            [
                new DocumentLine
                {
                    Id = Guid.NewGuid(),
                    DocumentHeaderId = quotationId,
                    SortOrder = 1,
                    ProductId = productId,
                    Description = "โน้ตบุ๊กสำนักงาน",
                    Quantity = 2m,
                    Unit = "เครื่อง",
                    UnitPrice = 20000m,
                    LineTotal = 40000m
                }
            ]
        };
        db.DocumentHeaders.Add(quotation);
        await db.SaveChangesAsync();

        var sharedCtrl = new SharedDocumentController(db, new StubNumberGenerator(), new StubPdfService());

        // 1. Tenant B attempts to access or convert Tenant A's document -> NotFound (Strict Tenant Isolation)
        SetUserTenantContext(sharedCtrl, tenantB);
        var forbiddenGet = await sharedCtrl.GetById(quotationId, CancellationToken.None);
        Assert.IsType<NotFoundObjectResult>(forbiddenGet.Result);

        // 2. Tenant A converts Quotation -> TaxInvoice -> Stock should deduct 2 units (10 -> 8)
        SetUserTenantContext(sharedCtrl, tenantA);
        var convertRes = await sharedCtrl.Convert(
            quotationId,
            new ConvertDocumentRequest(DocumentType.TaxInvoice, null, null, "Converted to TaxInvoice"),
            CancellationToken.None);

        var created = Assert.IsType<CreatedResult>(convertRes.Result);
        var convertedDoc = Assert.IsType<ApiResponse<DocumentResponse>>(created.Value).Data!;

        Assert.Equal(DocumentType.TaxInvoice, convertedDoc.DocumentType);
        Assert.Equal(quotationId, convertedDoc.ConvertedFromDocumentId);

        var updatedProduct = await db.Products.FindAsync(productId);
        Assert.Equal(8m, updatedProduct!.StockQuantity);
    }
}
