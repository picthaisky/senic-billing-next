using System.Security.Claims;
using System.Text;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using SenicBilling.API.Controllers;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Interfaces;
using SenicBilling.Application.Services;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Domain.Interfaces;
using SenicBilling.Infrastructure.Data;
using SenicBilling.Infrastructure.Services;

namespace SenicBilling.Tests;

public class Phase9ExpenseAndLineTests
{
    private sealed class StubNumberGenerator : IDocumentNumberGeneratorService
    {
        private int _seq = 1;
        public Task<string> GenerateNextNumberAsync(Guid tenantId, DocumentType documentType, CancellationToken ct = default)
        {
            var prefix = documentType == DocumentType.ExpenseVoucher ? "EXP" : "INV";
            return Task.FromResult($"{prefix}-202611-{_seq++:0000}");
        }
    }

    private sealed class RecordingLineService : ILineNotifyService
    {
        public List<(string Token, string ReplyToken, string Message)> Replies { get; } = [];

        public Task<bool> SendNotificationAsync(string accessToken, string message, CancellationToken ct = default)
            => Task.FromResult(true);

        public Task<bool> PushMessageAsync(string channelAccessToken, string to, string message, CancellationToken ct = default)
            => Task.FromResult(true);

        public Task<bool> ReplyMessageAsync(string channelAccessToken, string replyToken, string message, CancellationToken ct = default)
        {
            Replies.Add((channelAccessToken, replyToken, message));
            return Task.FromResult(true);
        }

        public Task<bool> NotifyTenantAsync(Tenant tenant, string message, CancellationToken ct = default)
            => Task.FromResult(true);
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
    public void ExpenseCalculator_ShouldComputeExclusiveAndInclusiveVatAndWhtCorrectly()
    {
        // Exclusive 10,000 + 7% VAT - 3% WHT = 10,700 - 300 = 10,400
        var excl = ExpenseCalculator.Calculate(10000m, 0m, VatCalculationMode.Exclusive, 7m, 3m);
        Assert.Equal(10000m, excl.TotalBeforeVat);
        Assert.Equal(700m, excl.VatAmount);
        Assert.Equal(10700m, excl.GrandTotal);
        Assert.Equal(300m, excl.WhtAmount);
        Assert.Equal(10400m, excl.NetPaidAmount);

        // Inclusive 10,700 -> Before VAT 10,000, VAT 700, WHT 3% = 300, NetPaid = 10,400
        var incl = ExpenseCalculator.Calculate(10700m, 0m, VatCalculationMode.Inclusive, 7m, 3m);
        Assert.Equal(10000m, incl.TotalBeforeVat);
        Assert.Equal(700m, incl.VatAmount);
        Assert.Equal(10700m, incl.GrandTotal);
        Assert.Equal(300m, incl.WhtAmount);
        Assert.Equal(10400m, incl.NetPaidAmount);
    }

    [Fact]
    public void ThaiBahtText_ShouldConvertAmountsToThaiWords()
    {
        Assert.Equal("สามร้อยบาทถ้วน", ThaiBahtText.Convert(300m));
        Assert.Equal("หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์", ThaiBahtText.Convert(1234.50m));
        Assert.Equal("ยี่สิบเอ็ดบาทถ้วน", ThaiBahtText.Convert(21m));
    }

    [Fact]
    public async Task ExpensesController_ShouldCreateAndIsolateByTenant_AndDashboardSubtractsInputVat()
    {
        await using var db = CreateDbContext(nameof(ExpensesController_ShouldCreateAndIsolateByTenant_AndDashboardSubtractsInputVat));
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        db.Tenants.AddRange(
            new Tenant { Id = tenantA, CompanyName = "บจก. ซีนิค เอ", TaxId = "0105551111111", Address = "กทม." },
            new Tenant { Id = tenantB, CompanyName = "บจก. ซีนิค บี", TaxId = "0105552222222", Address = "กทม." });

        // Output VAT for Tenant A in Nov 2026: 1,400 THB (on 20,000 THB)
        db.DocumentHeaders.Add(new DocumentHeader
        {
            Id = Guid.NewGuid(),
            TenantId = tenantA,
            DocumentType = DocumentType.TaxInvoice,
            DocumentNumber = "INV-202611-0001",
            DocumentDate = new DateTime(2026, 11, 10, 0, 0, 0, DateTimeKind.Utc),
            Status = DocumentStatus.Issued,
            Subtotal = 20000m,
            TotalBeforeVat = 20000m,
            VatRate = 7m,
            VatAmount = 1400m,
            GrandTotal = 21400m
        });
        await db.SaveChangesAsync();

        var pdfService = new QuestPdfService();
        var expenseCtrl = new ExpensesController(db, new StubNumberGenerator(), pdfService);
        SetUserTenantContext(expenseCtrl, tenantA);

        // Create claimable expense: 10,000 + 700 VAT - 300 WHT (PND53)
        var createRes = await expenseCtrl.Create(new CreateExpenseRequest(
            ExpenseDate: new DateTime(2026, 11, 12, 0, 0, 0, DateTimeKind.Utc),
            VendorName: "บจก. ผู้ให้บริการไอที",
            Description: "ค่าพัฒนาระบบบัญชี",
            Amount: 10000m,
            TaxInvoiceNumber: "TIV-9988",
            TaxInvoiceDate: new DateTime(2026, 11, 12, 0, 0, 0, DateTimeKind.Utc),
            VendorTaxId: "0105553333333",
            VendorBranch: "00000",
            Category: ExpenseCategory.ProfessionalService,
            VatMode: VatCalculationMode.Exclusive,
            VatRate: 7m,
            IsRefundableVat: true,
            WhtRate: 3m,
            PndType: PndType.PND53,
            IncomeTypeDescription: "ค่าบริการวางระบบ"), CancellationToken.None);

        var created = Assert.IsType<CreatedAtActionResult>(createRes.Result);
        var createdExpense = Assert.IsType<ApiResponse<ExpenseResponse>>(created.Value).Data!;
        Assert.Equal("EXP-202611-0001", createdExpense.VoucherNumber);
        Assert.Equal(700m, createdExpense.VatAmount);
        Assert.Equal(300m, createdExpense.WhtAmount);
        Assert.Equal(10400m, createdExpense.NetPaidAmount);

        // Non-refundable VAT expense should NOT reduce PP30
        await expenseCtrl.Create(new CreateExpenseRequest(
            ExpenseDate: new DateTime(2026, 11, 13, 0, 0, 0, DateTimeKind.Utc),
            VendorName: "ร้านอาหารรับรองลูกค้า",
            Description: "ค่ารับรอง",
            Amount: 1000m,
            VatMode: VatCalculationMode.Exclusive,
            VatRate: 7m,
            IsRefundableVat: false), CancellationToken.None);

        // Tenant B cannot see Tenant A's expense
        SetUserTenantContext(expenseCtrl, tenantB);
        var forbiddenGet = await expenseCtrl.GetById(createdExpense.Id, CancellationToken.None);
        Assert.IsType<NotFoundObjectResult>(forbiddenGet.Result);

        // Dashboard Tax Estimator (PP30): 1,400 Output VAT - 700 Claimable Input VAT = 700 Net VAT
        var dashCtrl = new DashboardController(db);
        SetUserTenantContext(dashCtrl, tenantA);
        var taxRes = await dashCtrl.GetTaxEstimator(2026, 11, CancellationToken.None);
        var okTax = Assert.IsType<OkObjectResult>(taxRes.Result);
        var taxDto = Assert.IsType<ApiResponse<TaxEstimatorDto>>(okTax.Value).Data!;
        Assert.Equal(1400m, taxDto.TotalSalesVat);
        Assert.Equal(700m, taxDto.TotalPurchaseVat);
        Assert.Equal(700m, taxDto.EstimatedTaxPayable);

        // Reports Excel export (Input Tax + PP30 + WHT)
        var reportsCtrl = new ReportsController(db);
        SetUserTenantContext(reportsCtrl, tenantA);
        var inputExcel = Assert.IsType<FileContentResult>(
            await reportsCtrl.ExportInputTaxReport(2026, 11, CancellationToken.None));
        using (var wb = new XLWorkbook(new MemoryStream(inputExcel.FileContents)))
        {
            Assert.True(wb.Worksheets.Contains("รายงานภาษีซื้อ"));
            Assert.True(wb.Worksheets.Contains("สรุปภาษี ภ.พ.30"));
            Assert.Equal(700m, wb.Worksheet("สรุปภาษี ภ.พ.30").Cell("C8").GetValue<decimal>());
        }

        var whtExcel = Assert.IsType<FileContentResult>(
            await reportsCtrl.ExportWhtReport(2026, 11, null, CancellationToken.None));
        using (var wb = new XLWorkbook(new MemoryStream(whtExcel.FileContents)))
        {
            Assert.True(wb.Worksheets.Contains("ภ.ง.ด.3"));
            Assert.True(wb.Worksheets.Contains("ภ.ง.ด.53"));
            Assert.Equal(300m, wb.Worksheet("ภ.ง.ด.53").Cell("J7").GetValue<decimal>());
        }

        // 50 Tawi PDF generation
        SetUserTenantContext(expenseCtrl, tenantA);
        var pdfResult = Assert.IsType<FileContentResult>(
            await expenseCtrl.GetWhtCertificatePdf(createdExpense.Id, CancellationToken.None));
        Assert.Equal("application/pdf", pdfResult.ContentType);
        Assert.True(pdfResult.FileContents.Length > 500);
    }

    [Fact]
    public void ReceiptTextParser_ShouldExtractThaiVendorTaxIdAmountsAndSuggestWht()
    {
        var sample = """
            บริษัท ซีนิค คลาวด์ เซอร์วิส จำกัด (สำนักงานใหญ่)
            เลขประจำตัวผู้เสียภาษี 0105561234567
            เลขที่ใบกำกับภาษี: INV-2026-889
            วันที่ 13/11/2569
            ค่าบริการดูแลระบบคลาวด์
            มูลค่าสินค้า 10,000.00
            ภาษีมูลค่าเพิ่ม 7% 700.00
            รวมทั้งสิ้น 10,700.00
            """;

        var parsed = ReceiptTextParser.Parse(sample);
        Assert.Equal("0105561234567", parsed.VendorTaxId);
        Assert.Equal("00000", parsed.VendorBranch);
        Assert.Equal("INV-2026-889", parsed.TaxInvoiceNumber);
        Assert.Equal(new DateTime(2026, 11, 13, 0, 0, 0, DateTimeKind.Utc), parsed.TaxInvoiceDate);
        Assert.Equal(10000m, parsed.TotalBeforeVat);
        Assert.Equal(700m, parsed.VatAmount);
        Assert.Equal(10700m, parsed.GrandTotal);
        Assert.Equal(ExpenseCategory.ProfessionalService, parsed.SuggestedCategory);
        Assert.Equal(3m, parsed.SuggestedWhtRate);
        Assert.Equal(PndType.PND53, parsed.SuggestedPndType);
    }

    [Fact]
    public async Task LineWebhookController_ShouldVerifySignatureAndReplyToTaxCommand()
    {
        await using var db = CreateDbContext(nameof(LineWebhookController_ShouldVerifySignatureAndReplyToTaxCommand));
        var tenantId = Guid.NewGuid();
        const string secret = "my-line-channel-secret";

        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            CompanyName = "บจก. ซีนิค เทสต์",
            LineChannelSecret = secret,
            LineChannelAccessToken = "line-access-token",
            IsActive = true
        });
        await db.SaveChangesAsync();

        var lineRecorder = new RecordingLineService();
        var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Frontend:BaseUrl"] = "https://billing.senic.local"
        }).Build();

        var controller = new LineWebhookController(db, lineRecorder, config, NullLogger<LineWebhookController>.Instance);

        var bodyJson = """{"events":[{"type":"message","replyToken":"reply-123","message":{"type":"text","text":"ภาษี"}}]}""";
        var bodyBytes = Encoding.UTF8.GetBytes(bodyJson);

        // 1. Invalid signature -> 401 Unauthorized
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        controller.HttpContext.Request.Body = new MemoryStream(bodyBytes);
        controller.HttpContext.Request.Headers["X-Line-Signature"] = "invalid-sig";
        var unauth = await controller.HandleWebhook(tenantId, CancellationToken.None);
        Assert.IsType<UnauthorizedObjectResult>(unauth);
        Assert.Empty(lineRecorder.Replies);

        // 2. Valid HMAC-SHA256 signature -> 200 OK & replies with VAT summary
        var validSig = LineSignatureVerifier.ComputeSignature(secret, bodyBytes);
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext()
        };
        controller.HttpContext.Request.Body = new MemoryStream(bodyBytes);
        controller.HttpContext.Request.Headers["X-Line-Signature"] = validSig;

        var ok = await controller.HandleWebhook(tenantId, CancellationToken.None);
        Assert.IsType<OkObjectResult>(ok);
        Assert.Single(lineRecorder.Replies);
        Assert.Equal("reply-123", lineRecorder.Replies[0].ReplyToken);
        Assert.Contains("สรุปภาษีประจำเดือน", lineRecorder.Replies[0].Message);
    }
}

