using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using SenicBilling.API.Controllers;
using SenicBilling.API.Hubs;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.Tests;

public class Phase19WebhookPaymentAndMasterDataTests
{
    private sealed class StubLineNotifyService : ILineNotifyService
    {
        public Task<bool> SendNotificationAsync(string accessToken, string message, CancellationToken ct = default) => Task.FromResult(true);
        public Task<bool> PushMessageAsync(string channelAccessToken, string to, string message, CancellationToken ct = default) => Task.FromResult(true);
        public Task<bool> ReplyMessageAsync(string channelAccessToken, string replyToken, string message, CancellationToken ct = default) => Task.FromResult(true);
        public Task<bool> NotifyTenantAsync(Tenant tenant, string message, CancellationToken ct = default) => Task.FromResult(true);
    }

    private sealed class StubPaymentService : IPaymentService
    {
        public Task<(string ChargeId, string QrCodeUrl)> CreatePromptPayChargeAsync(decimal amount, string referenceId, string returnUrl = "")
            => Task.FromResult(("chrg_test_19", "https://example.com/qr.png"));

        public Task<string> CreatePaymentLinkAsync(decimal amount, string title, string description, string referenceId)
            => Task.FromResult("https://example.com/pay/link");

        public Task<bool> VerifyChargeAsync(string chargeId) => Task.FromResult(true);

        public Task<string> CreateCustomerAsync(string email, string description, string cardToken)
            => Task.FromResult("cust_test_19");

        public Task<string> CreateCardChargeAsync(decimal amount, string customerId, string referenceId)
            => Task.FromResult("chrg_card_19");
    }

    private sealed class StubHubContext : IHubContext<SenicBillingHub>
    {
        private sealed class NoopClientProxy : IClientProxy
        {
            public Task SendCoreAsync(string method, object?[] args, CancellationToken cancellationToken = default)
                => Task.CompletedTask;
        }

        private sealed class NoopHubClients : IHubClients
        {
            private static readonly IClientProxy Proxy = new NoopClientProxy();
            public IClientProxy All => Proxy;
            public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => Proxy;
            public IClientProxy Client(string connectionId) => Proxy;
            public IClientProxy Clients(IReadOnlyList<string> connectionIds) => Proxy;
            public IClientProxy Group(string groupName) => Proxy;
            public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => Proxy;
            public IClientProxy Groups(IReadOnlyList<string> groupNames) => Proxy;
            public IClientProxy User(string userId) => Proxy;
            public IClientProxy Users(IReadOnlyList<string> userIds) => Proxy;
        }

        public IHubClients Clients { get; } = new NoopHubClients();
        public IGroupManager Groups => throw new NotImplementedException();
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
    public async Task LineWebhookController_ShouldNetCreditNotesInSummary_UseAppFrontendBaseUrl_AndRejectSuspendedTenant()
    {
        using var db = CreateDbContext(Guid.NewGuid().ToString());
        var tenantId = Guid.NewGuid();
        var suspendedTenantId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        var activeTenant = new Tenant
        {
            Id = tenantId,
            CompanyName = "Senic LINE Co.",
            IsActive = true,
            SubscriptionStatus = "Active",
            LineChannelSecret = "secret-123"
        };
        var suspendedTenant = new Tenant
        {
            Id = suspendedTenantId,
            CompanyName = "Suspended LINE Co.",
            IsActive = true,
            SubscriptionStatus = "Suspended",
            LineChannelSecret = "secret-456"
        };
        db.Tenants.AddRange(activeTenant, suspendedTenant);

        var invId = Guid.NewGuid();
        db.DocumentHeaders.AddRange(
            new DocumentHeader
            {
                Id = invId,
                TenantId = tenantId,
                DocumentType = DocumentType.TaxInvoice,
                DocumentNumber = "INV-202611-0001",
                DocumentDate = now,
                CustomerName = "ลูกค้า A",
                Status = DocumentStatus.Issued,
                GrandTotal = 10000m
            },
            new DocumentHeader
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                DocumentType = DocumentType.CreditNote,
                DocumentNumber = "CN-202611-0001",
                DocumentDate = now,
                CustomerName = "ลูกค้า A",
                Status = DocumentStatus.Issued,
                GrandTotal = 2000m
            });
        await db.SaveChangesAsync();

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["App:FrontendBaseUrl"] = "https://billing.senic.co.th"
            })
            .Build();

        var ctrl = new LineWebhookController(
            db,
            new StubLineNotifyService(),
            config,
            NullLogger<LineWebhookController>.Instance);

        // 1. Summary nets CreditNote: 10,000 - 2,000 = 8,000 and unpaid count = 1 (not 2)
        var summaryReply = await ctrl.BuildReplyTextAsync(activeTenant, "สรุปยอด", CancellationToken.None);
        Assert.NotNull(summaryReply);
        Assert.Contains("8,000.00", summaryReply!);
        Assert.Contains("ค้างชำระ: 8,000.00 บาท (1 ใบ)", summaryReply!);

        // 2. Document lookup uses App:FrontendBaseUrl
        var docReply = await ctrl.BuildReplyTextAsync(activeTenant, "INV-202611-0001", CancellationToken.None);
        Assert.NotNull(docReply);
        Assert.Contains($"https://billing.senic.co.th/print/{invId}", docReply!);

        // 3. Suspended tenant is rejected by HandleWebhook
        ctrl.ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() };
        var webhookRes = await ctrl.HandleWebhook(suspendedTenantId, CancellationToken.None);
        Assert.IsType<UnauthorizedObjectResult>(webhookRes);
    }

    [Fact]
    public async Task PaymentsController_AndRecurringInvoiceController_ShouldEnforceStatusTypeAndFrequencyGuards()
    {
        using var db = CreateDbContext(Guid.NewGuid().ToString());
        var tenantId = Guid.NewGuid();
        var cancelledDocId = Guid.NewGuid();
        var quotationDocId = Guid.NewGuid();
        var activeDocId = Guid.NewGuid();

        db.DocumentHeaders.AddRange(
            new DocumentHeader
            {
                Id = cancelledDocId,
                TenantId = tenantId,
                DocumentType = DocumentType.TaxInvoice,
                DocumentNumber = "INV-CANCELLED",
                Status = DocumentStatus.Cancelled,
                GrandTotal = 1070m
            },
            new DocumentHeader
            {
                Id = quotationDocId,
                TenantId = tenantId,
                DocumentType = DocumentType.Quotation,
                DocumentNumber = "QT-0001",
                Status = DocumentStatus.Issued,
                GrandTotal = 1070m
            },
            new DocumentHeader
            {
                Id = activeDocId,
                TenantId = tenantId,
                DocumentType = DocumentType.TaxInvoice,
                DocumentNumber = "INV-ACTIVE",
                Status = DocumentStatus.Issued,
                GrandTotal = 1070m
            });
        await db.SaveChangesAsync();

        var payCtrl = new PaymentsController(
            db,
            new StubPaymentService(),
            new StubHubContext(),
            new StubLineNotifyService(),
            NullLogger<PaymentsController>.Instance);
        SetUserTenantContext(payCtrl, tenantId);

        // 1. Cancelled document and Quotation cannot create PromptPay charge or Payment Link
        Assert.IsType<BadRequestObjectResult>(await payCtrl.CreatePromptPayCharge(cancelledDocId));
        Assert.IsType<BadRequestObjectResult>(await payCtrl.CreatePromptPayCharge(quotationDocId));
        Assert.IsType<BadRequestObjectResult>(await payCtrl.CreatePaymentLink(cancelledDocId));
        Assert.IsType<BadRequestObjectResult>(await payCtrl.CreatePaymentLink(quotationDocId));

        // 2. OmiseWebhook does not mark Cancelled document as Paid
        using var webhookPayload = JsonDocument.Parse($$"""
        {
          "key": "charge.complete",
          "data": {
            "id": "chrg_cancelled",
            "status": "successful",
            "metadata": { "DocumentId": "{{cancelledDocId}}" }
          }
        }
        """);
        await payCtrl.OmiseWebhook(webhookPayload.RootElement);
        var cancelledAfterWebhook = await db.DocumentHeaders.FindAsync(cancelledDocId);
        Assert.Equal(DocumentStatus.Cancelled, cancelledAfterWebhook!.Status);

        // 3. RecurringInvoiceController validates Frequency, MaxOccurrences, and non-cancelled SourceDocument
        var recCtrl = new RecurringInvoiceController(db);
        SetUserTenantContext(recCtrl, tenantId);

        var badFreq = await recCtrl.Create(
            new CreateRecurringInvoiceRequest(activeDocId, "Hourly", DateTime.UtcNow.AddDays(1), 5),
            CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(badFreq.Result);

        var badMaxOcc = await recCtrl.Create(
            new CreateRecurringInvoiceRequest(activeDocId, "Monthly", DateTime.UtcNow.AddDays(1), 0),
            CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(badMaxOcc.Result);

        var cancelledSource = await recCtrl.Create(
            new CreateRecurringInvoiceRequest(cancelledDocId, "Monthly", DateTime.UtcNow.AddDays(1), 5),
            CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(cancelledSource.Result);

        var validRec = await recCtrl.Create(
            new CreateRecurringInvoiceRequest(activeDocId, "monthly", DateTime.UtcNow.AddDays(1), 6),
            CancellationToken.None);
        var createdDto = Assert.IsType<ApiResponse<RecurringInvoiceDto>>(
            Assert.IsType<OkObjectResult>(validRec.Result).Value).Data!;
        Assert.Equal("Monthly", createdDto.Frequency);
    }

    [Fact]
    public async Task MasterDataControllers_ShouldValidateNameTaxIdAndNonNegativePrices()
    {
        using var db = CreateDbContext(Guid.NewGuid().ToString());
        var tenantId = Guid.NewGuid();

        var custCtrl = new CustomersController(db);
        SetUserTenantContext(custCtrl, tenantId);

        var badCustTax = await custCtrl.Create(
            new CreateCustomerRequest("ลูกค้าทดสอบ", "12345", "00000", null, null, null, null, null),
            CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(badCustTax.Result);

        var prodCtrl = new ProductsController(db);
        SetUserTenantContext(prodCtrl, tenantId);

        var badProdPrice = await prodCtrl.Create(
            new CreateProductRequest("SKU-1", null, "สินค้าติดลบ", null, "ชิ้น", -100m, "ทั่วไป", 10m, 0m),
            CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(badProdPrice.Result);

        var vendorCtrl = new VendorsController(db);
        SetUserTenantContext(vendorCtrl, tenantId);

        var badVendorTax = await vendorCtrl.Create(
            new UpsertVendorRequest("ผู้ขายทดสอบ", "ABC1234567890", "00000", null, null, null, null, 30, 3m, PndType.PND53, null, true),
            CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(badVendorTax.Result);
    }
}
