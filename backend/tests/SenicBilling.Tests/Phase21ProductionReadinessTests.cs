using System.Security.Claims;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Security.Cryptography.Xml;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml;
using System.Xml.Linq;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using SenicBilling.API.Controllers;
using SenicBilling.API.Controllers.SuperAdmin;
using SenicBilling.API.Hubs;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Interfaces;
using SenicBilling.Application.Services;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Domain.Interfaces;
using SenicBilling.Infrastructure.Auth;
using SenicBilling.Infrastructure.BackgroundJobs;
using SenicBilling.Infrastructure.Data;
using SenicBilling.Infrastructure.Services;

namespace SenicBilling.Tests;

public class Phase21ProductionReadinessTests
{
    private sealed class ConfigurablePaymentService(bool verifyResult) : IPaymentService
    {
        public Task<(string ChargeId, string QrCodeUrl)> CreatePromptPayChargeAsync(decimal amount, string referenceId, string returnUrl = "") =>
            Task.FromResult(("chrg_promptpay_p21", "https://promptpay.example/qr/p21.png"));

        public Task<string> CreatePaymentLinkAsync(decimal amount, string title, string description, string referenceId) =>
            Task.FromResult("https://pay.example/p21");

        public Task<bool> VerifyChargeAsync(string chargeId) =>
            Task.FromResult(verifyResult);

        public Task<string> CreateCustomerAsync(string email, string description, string cardToken) =>
            Task.FromResult("cust_p21");

        public Task<string> CreateCardChargeAsync(decimal amount, string customerId, string referenceId) =>
            Task.FromResult("chrg_card_p21");
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

    private sealed class StubLineNotifyService : ILineNotifyService
    {
        public Task<bool> SendNotificationAsync(string accessToken, string message, CancellationToken ct = default) => Task.FromResult(true);
        public Task<bool> PushMessageAsync(string channelAccessToken, string to, string message, CancellationToken ct = default) => Task.FromResult(true);
        public Task<bool> ReplyMessageAsync(string channelAccessToken, string replyToken, string message, CancellationToken ct = default) => Task.FromResult(true);
        public Task<bool> NotifyTenantAsync(Tenant tenant, string message, CancellationToken ct = default) => Task.FromResult(true);
    }

    private sealed class CapturingEmailService : IEmailService
    {
        public List<(string To, string Subject, string Body)> SentEmails { get; } = [];

        public Task SendEmailAsync(string to, string subject, string body, CancellationToken ct = default)
        {
            SentEmails.Add((to, subject, body));
            return Task.CompletedTask;
        }

        public Task SendDocumentLinkAsync(string to, string customerName, string documentNumber, string link, CancellationToken ct = default) =>
            Task.CompletedTask;

        public Task SendPaymentReminderAsync(string to, string customerName, string documentNumber, decimal amount, DateTime dueDate, string paymentLink, CancellationToken ct = default) =>
            Task.CompletedTask;
    }

    private static SenicBillingDbContext CreateDbContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<SenicBillingDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;
        return new SenicBillingDbContext(options);
    }

    private static IConfiguration CreateConfig(Dictionary<string, string?>? extra = null)
    {
        var dict = new Dictionary<string, string?>
        {
            ["JwtSettings:SecretKey"] = "SenicBillingNext-SuperSecret-TestKey-AtLeast32Chars!",
            ["JwtSettings:Issuer"] = "SenicBillingNext",
            ["JwtSettings:Audience"] = "SenicBillingNextClient",
            ["JwtSettings:ExpiryMinutes"] = "480",
            ["App:FrontendBaseUrl"] = "https://billing-next.senicsolution.com"
        };
        if (extra is not null)
        {
            foreach (var kv in extra) dict[kv.Key] = kv.Value;
        }
        return new ConfigurationBuilder().AddInMemoryCollection(dict).Build();
    }

    private static void SetUserContext(ControllerBase controller, Guid tenantId, string role = "Admin", string username = "tester")
    {
        var claims = new[]
        {
            new Claim("tenantId", tenantId.ToString()),
            new Claim("id", Guid.NewGuid().ToString()),
            new Claim(ClaimTypes.Name, username),
            new Claim(ClaimTypes.Role, role),
            new Claim("role", role)
        };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth")) }
        };
    }

    [Fact]
    public void QuestPdfService_ShouldBundleKanitFonts_AndRenderThaiDocumentPdf()
    {
        var infraAsm = typeof(QuestPdfService).Assembly;
        var ttfResources = infraAsm.GetManifestResourceNames()
            .Where(n => n.EndsWith(".ttf", StringComparison.OrdinalIgnoreCase))
            .ToList();

        Assert.Contains(ttfResources, r => r.Contains("Kanit-Regular.ttf", StringComparison.OrdinalIgnoreCase));
        Assert.Contains(ttfResources, r => r.Contains("Kanit-Bold.ttf", StringComparison.OrdinalIgnoreCase));

        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            CompanyName = "บริษัท ซีนิค โซลูชั่น จำกัด",
            TaxId = "0105559999999",
            Address = "99 ถนนสาทร แขวงทุ่งมหาเมฆ เขตสาทร กรุงเทพมหานคร",
            BranchName = "สำนักงานใหญ่"
        };

        var doc = new DocumentHeader
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Tenant = tenant,
            DocumentType = DocumentType.TaxInvoice,
            DocumentNumber = "INV-202611-0001",
            DocumentDate = DateTime.UtcNow,
            DueDate = DateTime.UtcNow.AddDays(30),
            CustomerName = "หจก. ทดสอบภาษาไทย",
            CustomerTaxId = "0105551111111",
            CustomerAddress = "123 เชียงใหม่",
            Subtotal = 1000m,
            TotalBeforeVat = 1000m,
            VatRate = 7m,
            VatAmount = 70m,
            GrandTotal = 1070m,
            Lines =
            [
                new DocumentLine
                {
                    Id = Guid.NewGuid(),
                    SortOrder = 1,
                    Description = "ค่าบริการระบบบัญชีคลาวด์รายเดือน (ภาษาไทยชัดเจน)",
                    Quantity = 1m,
                    Unit = "เดือน",
                    UnitPrice = 1000m,
                    LineTotal = 1000m
                }
            ]
        };

        var pdfService = new QuestPdfService();
        var pdfBytes = pdfService.GenerateDocumentPdf(doc);

        Assert.NotNull(pdfBytes);
        Assert.True(pdfBytes.Length > 1000);
        Assert.Equal("%PDF-", System.Text.Encoding.ASCII.GetString(pdfBytes.Take(5).ToArray()));
    }

    [Fact]
    public async Task RecurringInvoiceWorker_ShouldUseDocumentNumberGenerator_AndUpdateTenantUsageStats()
    {
        var dbName = nameof(RecurringInvoiceWorker_ShouldUseDocumentNumberGenerator_AndUpdateTenantUsageStats);
        var tenantId = Guid.NewGuid();
        var srcDocId = Guid.NewGuid();

        var services = new ServiceCollection();
        services.AddDbContext<SenicBillingDbContext>(o => o.UseInMemoryDatabase(dbName));
        services.AddScoped<IDocumentNumberGeneratorService, DocumentNumberGeneratorService>();
        await using var sp = services.BuildServiceProvider();

        using (var scope = sp.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<SenicBillingDbContext>();
            db.Tenants.Add(new Tenant
            {
                Id = tenantId,
                CompanyName = "Recurring Seq Co.",
                IsActive = true,
                SubscriptionStatus = "Active"
            });
            db.DocumentHeaders.Add(new DocumentHeader
            {
                Id = srcDocId,
                TenantId = tenantId,
                DocumentType = DocumentType.TaxInvoice,
                DocumentNumber = "INV-202611-0001",
                Status = DocumentStatus.Issued,
                DocumentDate = DateTime.UtcNow.AddMonths(-1),
                GrandTotal = 1070m
            });
            db.RecurringInvoices.Add(new RecurringInvoice
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                SourceDocumentId = srcDocId,
                Frequency = "Monthly",
                NextRunDate = DateTime.UtcNow.AddMinutes(-5),
                IsActive = true
            });
            await db.SaveChangesAsync();
        }

        var worker = new RecurringInvoiceWorker(sp, NullLogger<RecurringInvoiceWorker>.Instance);
        var count = await worker.ProcessDueRecurringInvoicesAsync(CancellationToken.None);

        Assert.Equal(1, count);
        using (var verifyScope = sp.CreateScope())
        {
            var db = verifyScope.ServiceProvider.GetRequiredService<SenicBillingDbContext>();
            var generated = await db.DocumentHeaders.SingleAsync(d => d.TenantId == tenantId && d.Id != srcDocId);
            Assert.StartsWith("INV-", generated.DocumentNumber);
            Assert.DoesNotContain("REC-", generated.DocumentNumber);

            var yearMonth = DateTime.UtcNow.ToString("yyyy-MM");
            var stat = await db.TenantUsageStats.SingleOrDefaultAsync(u => u.TenantId == tenantId && u.YearMonth == yearMonth);
            Assert.NotNull(stat);
            Assert.Equal(1, stat!.DocumentsCreated);
        }
    }

    [Fact]
    public void ETaxXmlGenerator_ShouldEmitCompleteLineItemsReferenceDoc_AndSignValidXmlDsigWithPkcs12()
    {
        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            CompanyName = "บริษัท ซีนิค แอดวานซ์ จำกัด",
            TaxId = "0105559999999",
            BranchName = "สำนักงานใหญ่",
            Address = "99 สีลม กรุงเทพฯ",
            Email = "tax@senic.co.th"
        };
        var refDoc = new DocumentHeader
        {
            Id = Guid.NewGuid(),
            DocumentType = DocumentType.TaxInvoice,
            DocumentNumber = "INV-202611-0008",
            DocumentDate = new DateTime(2026, 11, 1, 0, 0, 0, DateTimeKind.Utc)
        };
        var creditNote = new DocumentHeader
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            DocumentType = DocumentType.CreditNote,
            DocumentNumber = "CN-202611-0001",
            DocumentDate = new DateTime(2026, 11, 14, 0, 0, 0, DateTimeKind.Utc),
            CreatedAt = new DateTime(2026, 11, 14, 1, 0, 0, DateTimeKind.Utc),
            CustomerName = "บจก. คู่ค้าทดสอบ",
            CustomerTaxId = "0105551111111",
            CustomerBranch = "00001",
            CustomerAddress = "456 นนทบุรี",
            ReferenceDocumentId = refDoc.Id,
            ReferenceDocument = refDoc,
            Subtotal = 2000m,
            DiscountAmount = 100m,
            TotalBeforeVat = 1900m,
            VatRate = 7m,
            VatAmount = 133m,
            GrandTotal = 2033m,
            Notes = "คืนสินค้าชำรุดบางส่วน",
            Lines =
            [
                new DocumentLine { SortOrder = 1, Description = "บริการที่ปรึกษา", Quantity = 1m, Unit = "งาน", UnitPrice = 1200m, LineTotal = 1200m },
                new DocumentLine { SortOrder = 2, Description = "อุปกรณ์เสริม", Quantity = 2m, Unit = "ชิ้น", UnitPrice = 400m, LineTotal = 800m }
            ]
        };

        using var rsa = RSA.Create(2048);
        var certReq = new CertificateRequest("CN=SenicTestETaxSigner", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        using var cert = certReq.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddDays(30));

        var pfxPath = Path.Combine(Path.GetTempPath(), $"senic-etax-{Guid.NewGuid():N}.p12");
        try
        {
            File.WriteAllBytes(pfxPath, cert.Export(X509ContentType.Pkcs12, "secret123"));
            var signedBytes = ETaxXmlGenerator.GenerateXml(creditNote, tenant, pfxPath, "secret123");

            var xdoc = XDocument.Load(new MemoryStream(signedBytes));
            Assert.Equal("381", xdoc.Descendants(ETaxXmlGenerator.Rsm + "TypeCode").FirstOrDefault()?.Value);
            Assert.Equal("THB", xdoc.Descendants(ETaxXmlGenerator.Ram + "InvoiceCurrencyCode").FirstOrDefault()?.Value);
            Assert.Equal(2, xdoc.Descendants(ETaxXmlGenerator.Ram + "IncludedSupplyChainTradeLineItem").Count());
            Assert.Contains("INV-202611-0008", xdoc.Descendants(ETaxXmlGenerator.Ram + "IssuerAssignedID").Select(x => x.Value));
            Assert.Contains("010555999999900000", xdoc.Descendants(ETaxXmlGenerator.Ram + "ID").Select(x => x.Value));
            Assert.Contains("010555111111100001", xdoc.Descendants(ETaxXmlGenerator.Ram + "ID").Select(x => x.Value));

            var xmlDoc = new XmlDocument { PreserveWhitespace = true };
            xmlDoc.Load(new MemoryStream(signedBytes));
            var sigEl = xmlDoc.GetElementsByTagName("Signature", SignedXml.XmlDsigNamespaceUrl).Item(0) as XmlElement;
            Assert.NotNull(sigEl);
            var signedXml = new SignedXml(xmlDoc);
            signedXml.LoadXml(sigEl!);
            Assert.True(signedXml.CheckSignature(cert, true));
        }
        finally
        {
            if (File.Exists(pfxPath)) File.Delete(pfxPath);
        }
    }

    [Fact]
    public async Task OmiseWebhooks_ShouldRejectSpoofedUnverifiedChargeIds()
    {
        await using var db = CreateDbContext(nameof(OmiseWebhooks_ShouldRejectSpoofedUnverifiedChargeIds));
        var tenantId = Guid.NewGuid();
        var docId = Guid.NewGuid();
        var initialExpiry = DateTime.UtcNow.AddDays(5);

        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            CompanyName = "Webhook Guard Co.",
            IsActive = true,
            SubscriptionStatus = "Active",
            SubscriptionValidUntil = initialExpiry
        });
        db.DocumentHeaders.Add(new DocumentHeader
        {
            Id = docId,
            TenantId = tenantId,
            DocumentType = DocumentType.TaxInvoice,
            DocumentNumber = "INV-SPOOF-001",
            Status = DocumentStatus.Issued,
            GrandTotal = 500m
        });
        await db.SaveChangesAsync();

        var unverifiedService = new ConfigurablePaymentService(verifyResult: false);
        var payCtrl = new PaymentsController(db, unverifiedService, new StubHubContext(), new StubLineNotifyService(), NullLogger<PaymentsController>.Instance);
        var subCtrl = new TenantSubscriptionController(db, unverifiedService, NullLogger<TenantSubscriptionController>.Instance);

        using var docWebhook = JsonDocument.Parse(JsonSerializer.Serialize(new
        {
            key = "charge.complete",
            data = new { id = "chrg_fake_doc", status = "successful", metadata = new { documentId = docId.ToString() } }
        }));
        using var subWebhook = JsonDocument.Parse(JsonSerializer.Serialize(new
        {
            key = "charge.complete",
            data = new { id = "chrg_fake_sub", status = "successful", description = tenantId.ToString() }
        }));

        Assert.IsType<BadRequestObjectResult>(await payCtrl.OmiseWebhook(docWebhook.RootElement));
        Assert.IsType<BadRequestObjectResult>(await subCtrl.OmiseWebhook(subWebhook.RootElement, CancellationToken.None));

        var docAfter = await db.DocumentHeaders.SingleAsync(d => d.Id == docId);
        Assert.Equal(DocumentStatus.Issued, docAfter.Status);
        var tenantAfter = await db.Tenants.SingleAsync(t => t.Id == tenantId);
        Assert.Equal(initialExpiry, tenantAfter.SubscriptionValidUntil);
    }

    [Fact]
    public async Task TenantSubscriptionCheckout_And_SaBillingMarkPaid_ShouldEnforcePaidFlows_AndSwitchUpgradedPlan()
    {
        await using var db = CreateDbContext(nameof(TenantSubscriptionCheckout_And_SaBillingMarkPaid_ShouldEnforcePaidFlows_AndSwitchUpgradedPlan));
        var tenantId = Guid.NewGuid();
        var freePlanId = Guid.NewGuid();
        var proPlanId = Guid.NewGuid();

        db.SubscriptionPlans.AddRange(
            new SubscriptionPlan { Id = freePlanId, Name = "Free", MonthlyPrice = 0m, YearlyPrice = 0m, MaxUsers = 2, MaxDocumentsPerMonth = 20, IsActive = true },
            new SubscriptionPlan { Id = proPlanId, Name = "Pro", MonthlyPrice = 990m, YearlyPrice = 9900m, MaxUsers = 10, MaxDocumentsPerMonth = 500, IsActive = true });

        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            CompanyName = "Upgrade Tenant Co.",
            IsActive = true,
            CurrentPlanId = freePlanId,
            SubscriptionStatus = "Active"
        });
        await db.SaveChangesAsync();

        var subCtrl = new TenantSubscriptionController(db, new ConfigurablePaymentService(verifyResult: true), NullLogger<TenantSubscriptionController>.Instance);
        SetUserContext(subCtrl, tenantId);

        // 1) Paid plan via "card" with empty CardToken must fail 400
        var emptyCardRes = await subCtrl.Checkout(new CheckoutRequest
        {
            PlanId = proPlanId,
            PaymentMethod = "card",
            CardToken = ""
        }, CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(emptyCardRes);
        Assert.Equal(freePlanId, (await db.Tenants.SingleAsync(t => t.Id == tenantId)).CurrentPlanId);

        // 2) Paid plan via "promptpay" stays Pending until webhook confirms
        var ppRes = Assert.IsType<OkObjectResult>(await subCtrl.Checkout(new CheckoutRequest
        {
            PlanId = proPlanId,
            PaymentMethod = "promptpay",
            BillingCycle = "Monthly"
        }, CancellationToken.None));
        var ppJson = JsonSerializer.SerializeToElement(ppRes.Value);
        Assert.True(ppJson.GetProperty("requiresPayment").GetBoolean());
        Assert.Equal("Pending", ppJson.GetProperty("status").GetString());
        Assert.Equal(freePlanId, (await db.Tenants.SingleAsync(t => t.Id == tenantId)).CurrentPlanId);

        var subId = ppJson.GetProperty("subscriptionId").GetGuid();
        using var webhookPayload = JsonDocument.Parse(JsonSerializer.Serialize(new
        {
            key = "charge.complete",
            data = new { id = "chrg_promptpay_p21", status = "successful", description = $"SUB:{tenantId}:{subId}" }
        }));
        Assert.IsType<OkObjectResult>(await subCtrl.OmiseWebhook(webhookPayload.RootElement, CancellationToken.None));
        Assert.Equal(proPlanId, (await db.Tenants.SingleAsync(t => t.Id == tenantId)).CurrentPlanId);

        // 3) Bank Transfer Yearly request -> SaBilling.GetInvoices shows YearlyPrice 9900 -> MarkInvoicePaid switches plan!
        var tenantForBankId = Guid.NewGuid();
        db.Tenants.Add(new Tenant
        {
            Id = tenantForBankId,
            CompanyName = "Bank Transfer Co.",
            IsActive = true,
            CurrentPlanId = freePlanId,
            SubscriptionStatus = "Active"
        });
        await db.SaveChangesAsync();

        SetUserContext(subCtrl, tenantForBankId);
        var bankRes = Assert.IsType<OkObjectResult>(await subCtrl.Checkout(new CheckoutRequest
        {
            PlanId = proPlanId,
            PaymentMethod = "bank_transfer",
            BillingCycle = "Yearly"
        }, CancellationToken.None));
        var bankSubId = JsonSerializer.SerializeToElement(bankRes.Value).GetProperty("subscriptionId").GetGuid();

        var saBillingCtrl = new SaBillingController(db);
        SetUserContext(saBillingCtrl, tenantId, role: "SuperAdmin", username: "superadmin");

        var invRes = Assert.IsType<OkObjectResult>(await saBillingCtrl.GetSaaSInvoices(CancellationToken.None));
        var invArray = JsonSerializer.SerializeToElement(invRes.Value).GetProperty("data").EnumerateArray().ToList();
        var matchingInv = invArray.First(i => i.GetProperty("Id").GetGuid() == bankSubId);
        Assert.Equal(9900m, matchingInv.GetProperty("Amount").GetDecimal());
        Assert.Equal("Yearly", matchingInv.GetProperty("BillingCycle").GetString());

        Assert.IsType<OkObjectResult>(await saBillingCtrl.MarkInvoicePaid(bankSubId, CancellationToken.None));
        var upgradedBankTenant = await db.Tenants.SingleAsync(t => t.Id == tenantForBankId);
        Assert.Equal(proPlanId, upgradedBankTenant.CurrentPlanId);
        Assert.True(upgradedBankTenant.SubscriptionValidUntil > DateTime.UtcNow.AddMonths(11));
    }

    [Fact]
    public async Task AuthController_SignupForgotReset_And_SaTenantsCreate_ShouldProvisionDefaultsAndResetPassword()
    {
        await using var db = CreateDbContext(nameof(AuthController_SignupForgotReset_And_SaTenantsCreate_ShouldProvisionDefaultsAndResetPassword));
        var freePlan = new SubscriptionPlan { Id = Guid.NewGuid(), Name = "Free", MonthlyPrice = 0m, YearlyPrice = 0m, MaxUsers = 2, MaxDocumentsPerMonth = 20, IsActive = true };
        db.SubscriptionPlans.Add(freePlan);
        await db.SaveChangesAsync();

        var config = CreateConfig();
        var jwt = new JwtTokenService(config);
        var emailSvc = new CapturingEmailService();
        var accountingSvc = new AccountingService(db, new DocumentNumberGeneratorService(db));
        var authCtrl = new AuthController(db, jwt, emailSvc, config, accountingSvc);

        // 1) Self-service signup
        var signupRes = await authCtrl.SignupTenant(new SignupTenantRequest(
            CompanyName: "บจก. เปิดตัวใหม่",
            Username: "newfounder",
            Password: "Password123!",
            DisplayName: "Founder Admin",
            TaxId: "0105557778889",
            Email: "founder@newco.th"), CancellationToken.None);

        var okSignup = Assert.IsType<OkObjectResult>(signupRes.Result);
        var loginPayload = Assert.IsType<ApiResponse<LoginResponse>>(okSignup.Value).Data!;
        Assert.Equal("newfounder", loginPayload.User.Username);
        var newTenantId = loginPayload.User.TenantId;
        Assert.True(await db.Warehouses.AnyAsync(w => w.TenantId == newTenantId && w.Code == "WH-MAIN"));
        Assert.True(await db.ChartOfAccounts.CountAsync(a => a.TenantId == newTenantId) >= 12);

        // Duplicate username rejected
        var dupSignup = await authCtrl.SignupTenant(new SignupTenantRequest("Another Co.", "newfounder", "Password123!"), CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(dupSignup.Result);

        // 2) Forgot Password -> email resetToken -> Reset Password
        Assert.IsType<OkObjectResult>((await authCtrl.ForgotPassword(new ForgotPasswordRequest(EmailOrUsername: "founder@newco.th"), CancellationToken.None)).Result);
        var sentEmail = Assert.Single(emailSvc.SentEmails);
        var tokenMatch = Regex.Match(sentEmail.Body, @"resetToken=([^""<\s&]+)");
        Assert.True(tokenMatch.Success);
        var rawToken = Uri.UnescapeDataString(tokenMatch.Groups[1].Value);

        var resetOk = await authCtrl.ResetPassword(new ResetPasswordRequest(rawToken, "NewSecurePass99!"), CancellationToken.None);
        Assert.IsType<OkObjectResult>(resetOk.Result);

        // Single-use token cannot be replayed
        var replayRes = await authCtrl.ResetPassword(new ResetPasswordRequest(rawToken, "AnotherPass123!"), CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(replayRes.Result);

        // Login succeeds ONLY with new password
        var oldLogin = await authCtrl.Login(new LoginRequest("newfounder", "Password123!"), CancellationToken.None);
        Assert.IsType<UnauthorizedObjectResult>(oldLogin.Result);
        var newLogin = await authCtrl.Login(new LoginRequest("newfounder", "NewSecurePass99!"), CancellationToken.None);
        Assert.IsType<OkObjectResult>(newLogin.Result);

        // 3) Super Admin CreateTenant
        var saTenantsCtrl = new SaTenantsController(db, jwt, config);
        SetUserContext(saTenantsCtrl, newTenantId, role: "SuperAdmin", username: "superadmin");
        var saCreateRes = await saTenantsCtrl.CreateTenant(new CreateTenantRequest(
            CompanyName: "บจก. แอดมินสร้างให้",
            AdminUsername: "sa_provisioned",
            AdminPassword: "InitPass123!",
            AdminDisplayName: "SA Provisioned Admin",
            Email: "admin@saprovisioned.th",
            PlanId: freePlan.Id), CancellationToken.None);

        Assert.IsType<OkObjectResult>(saCreateRes);
        var provisionedTenant = await db.Tenants.SingleAsync(t => t.CompanyName == "บจก. แอดมินสร้างให้");
        Assert.True(await db.Warehouses.AnyAsync(w => w.TenantId == provisionedTenant.Id && w.Code == "WH-MAIN"));
        Assert.True(await db.ChartOfAccounts.CountAsync(a => a.TenantId == provisionedTenant.Id) >= 12);
        Assert.True(await db.AuditLogs.AnyAsync(a => a.Action == "SuperAdminCreateTenant"));
    }

    [Fact]
    public void GeminiAIAssistantService_ShouldReadConfiguredModel_WithGemini25FlashDefault()
    {
        var defaultSvc = new GeminiAIAssistantService(CreateConfig(), NullLogger<GeminiAIAssistantService>.Instance);
        Assert.Equal("gemini-2.5-flash", defaultSvc.ConfiguredModel);
        Assert.Contains("models/gemini-2.5-flash:generateContent", defaultSvc.BuildGenerateContentUrl());

        var customSvc = new GeminiAIAssistantService(
            CreateConfig(new Dictionary<string, string?> { ["Gemini:Model"] = "gemini-2.5-pro" }),
            NullLogger<GeminiAIAssistantService>.Instance);
        Assert.Equal("gemini-2.5-pro", customSvc.ConfiguredModel);
        Assert.Contains("models/gemini-2.5-pro:generateContent", customSvc.BuildGenerateContentUrl());
    }
}
