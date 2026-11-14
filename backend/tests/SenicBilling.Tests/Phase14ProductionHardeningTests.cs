using System.Security.Claims;
using System.Text;
using System.Xml.Linq;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using SenicBilling.API.Controllers;
using SenicBilling.Application.Interfaces;
using SenicBilling.Application.Services;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Domain.Interfaces;
using SenicBilling.Infrastructure.BackgroundJobs;
using SenicBilling.Infrastructure.Data;
using SenicBilling.Infrastructure.Services;

namespace SenicBilling.Tests;

public class Phase14ProductionHardeningTests
{
    private sealed class StubNumberGenerator : IDocumentNumberGeneratorService
    {
        private int _seq = 1;
        public Task<string> GenerateNextNumberAsync(Guid tenantId, DocumentType documentType, CancellationToken ct = default)
            => Task.FromResult($"INV-202611-{_seq++:0000}");
    }

    private sealed class RecordingEmailService : IEmailService
    {
        public List<(string To, string DocumentNumber, decimal Amount, string PaymentLink)> Reminders { get; } = [];

        public Task SendEmailAsync(string to, string subject, string body, CancellationToken ct = default)
            => Task.CompletedTask;

        public Task SendDocumentLinkAsync(string to, string customerName, string documentNumber, string link, CancellationToken ct = default)
            => Task.CompletedTask;

        public Task SendPaymentReminderAsync(string to, string customerName, string documentNumber, decimal amount, DateTime dueDate, string paymentLink, CancellationToken ct = default)
        {
            Reminders.Add((to, documentNumber, amount, paymentLink));
            return Task.CompletedTask;
        }
    }

    private sealed class EmptyLinkPaymentService : IPaymentService
    {
        public Task<(string ChargeId, string QrCodeUrl)> CreatePromptPayChargeAsync(decimal amount, string referenceId, string returnUrl = "")
            => Task.FromResult(("chrg_test", "https://example.test/qr.png"));

        public Task<string> CreatePaymentLinkAsync(decimal amount, string title, string description, string referenceId)
            => Task.FromResult(string.Empty);

        public Task<bool> VerifyChargeAsync(string chargeId) => Task.FromResult(true);
        public Task<string> CreateCustomerAsync(string email, string description, string cardToken) => Task.FromResult("cust_test");
        public Task<string> CreateCardChargeAsync(decimal amount, string customerId, string referenceId) => Task.FromResult("chrg_card");
    }

    private sealed class RecordingLineNotifyService : ILineNotifyService
    {
        public List<(Guid TenantId, string Message)> SentMessages { get; } = [];

        public Task<bool> SendNotificationAsync(string accessToken, string message, CancellationToken ct = default)
            => Task.FromResult(true);

        public Task<bool> PushMessageAsync(string channelAccessToken, string to, string message, CancellationToken ct = default)
            => Task.FromResult(true);

        public Task<bool> ReplyMessageAsync(string channelAccessToken, string replyToken, string message, CancellationToken ct = default)
            => Task.FromResult(true);

        public Task<bool> NotifyTenantAsync(Tenant tenant, string message, CancellationToken ct = default)
        {
            SentMessages.Add((tenant.Id, message));
            return Task.FromResult(true);
        }
    }

    private static SenicBillingDbContext CreateDbContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<SenicBillingDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;
        return new SenicBillingDbContext(options);
    }

    [Fact]
    public async Task SharedDocumentController_DownloadPdf_ShouldIncludeTenant_AndReturnValidPdf_WithoutAuth()
    {
        using var db = CreateDbContext(Guid.NewGuid().ToString());
        var tenantId = Guid.NewGuid();
        var docId = Guid.NewGuid();

        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            CompanyName = "บริษัท ซีนิค แชร์ จำกัด",
            TaxId = "0105557778889",
            Address = "100 ถนนวิทยุ กรุงเทพฯ",
            Phone = "02-111-2222",
            BranchName = "สำนักงานใหญ่",
            IsActive = true
        });

        db.DocumentHeaders.Add(new DocumentHeader
        {
            Id = docId,
            TenantId = tenantId,
            DocumentType = DocumentType.TaxInvoice,
            DocumentNumber = "INV-202611-0141",
            DocumentDate = DateTime.UtcNow,
            CustomerName = "ลูกค้าองค์กร",
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
                    DocumentHeaderId = docId,
                    SortOrder = 1,
                    Description = "ค่าบริการระบบคลาวด์",
                    Quantity = 1m,
                    Unit = "เดือน",
                    UnitPrice = 1000m,
                    LineTotal = 1000m
                }
            ]
        });
        await db.SaveChangesAsync();

        var controller = new SharedDocumentController(db, new StubNumberGenerator(), new QuestPdfService());
        var result = await controller.DownloadPdf(docId, CancellationToken.None);

        var fileResult = Assert.IsType<FileContentResult>(result);
        Assert.Equal("application/pdf", fileResult.ContentType);
        Assert.Equal("INV-202611-0141.pdf", fileResult.FileDownloadName);
        Assert.True(fileResult.FileContents.Length > 100);
        Assert.Equal("%PDF-", Encoding.ASCII.GetString(fileResult.FileContents[..5]));
    }

    [Fact]
    public void QuestPdfService_ShouldRenderCreditNote_DebitNote_NullTenant_AndEmbedLocalPngLogo()
    {
        var pdfService = new QuestPdfService();
        var tenantId = Guid.NewGuid();
        const string fileName = "logo-phase14.png";
        var logoDir = Path.Combine(Directory.GetCurrentDirectory(), "App_Data", "logos", tenantId.ToString());
        var logoPath = Path.Combine(logoDir, fileName);

        try
        {
            Directory.CreateDirectory(logoDir);
            // Valid 1x1 RGBA PNG
            var pngBytes = Convert.FromBase64String(
                "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==");
            File.WriteAllBytes(logoPath, pngBytes);

            var creditNote = new DocumentHeader
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Tenant = null!, // Explicitly test null-safety
                DocumentType = DocumentType.CreditNote,
                DocumentNumber = "CN-202611-0001",
                DocumentDate = DateTime.UtcNow,
                CustomerName = "บริษัท ทดสอบ จำกัด",
                GrandTotal = 535m,
                Lines =
                [
                    new DocumentLine { Id = Guid.NewGuid(), SortOrder = 1, Description = "ลดหนี้ค่าสินค้า", Quantity = 1, UnitPrice = 500m, LineTotal = 500m }
                ]
            };

            var cnBytes = pdfService.GenerateDocumentPdf(creditNote);
            Assert.Equal("%PDF-", Encoding.ASCII.GetString(cnBytes[..5]));

            var debitWithoutLogo = new DocumentHeader
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Tenant = new Tenant
                {
                    Id = tenantId,
                    CompanyName = "บริษัท โลโก้ จำกัด",
                    TaxId = "0105559990001",
                    BranchName = "00000",
                    Address = "88 สีลม",
                    Phone = "02-000-0000",
                    LogoUrl = null
                },
                DocumentType = DocumentType.DebitNote,
                DocumentNumber = "DN-202611-0001",
                DocumentDate = DateTime.UtcNow,
                CustomerName = "ลูกค้า A",
                GrandTotal = 1070m,
                Lines =
                [
                    new DocumentLine { Id = Guid.NewGuid(), SortOrder = 1, Description = "เพิ่มหนี้", Quantity = 1, UnitPrice = 1000m, LineTotal = 1000m }
                ]
            };

            var pdfWithoutLogo = pdfService.GenerateDocumentPdf(debitWithoutLogo);
            debitWithoutLogo.Tenant.LogoUrl = $"/api/tenants/logo/{tenantId}/{fileName}";
            var pdfWithLogo = pdfService.GenerateDocumentPdf(debitWithoutLogo);

            Assert.Equal("%PDF-", Encoding.ASCII.GetString(pdfWithLogo[..5]));
            Assert.True(pdfWithLogo.Length > pdfWithoutLogo.Length);
        }
        finally
        {
            if (Directory.Exists(logoDir))
            {
                Directory.Delete(logoDir, recursive: true);
            }
        }
    }

    [Theory]
    [InlineData(DocumentType.TaxInvoice, "388")]
    [InlineData(DocumentType.CreditNote, "381")]
    [InlineData(DocumentType.DebitNote, "383")]
    [InlineData(DocumentType.Receipt, "380")]
    public void ETaxXmlGenerator_ShouldMapEtdaTypeCodes_AndHandleNullTenant(DocumentType docType, string expectedCode)
    {
        var doc = new DocumentHeader
        {
            Id = Guid.NewGuid(),
            DocumentType = docType,
            DocumentNumber = "DOC-ETAX-01",
            DocumentDate = new DateTime(2026, 11, 14, 0, 0, 0, DateTimeKind.Utc),
            CustomerName = "ผู้ซื้อทดสอบ",
            CustomerTaxId = "0105550000999",
            TotalBeforeVat = 100m,
            VatAmount = 7m,
            GrandTotal = 107m
        };

        var xmlBytes = ETaxXmlGenerator.GenerateXml(doc, null);
        using var ms = new MemoryStream(xmlBytes);
        var xdoc = XDocument.Load(ms);
        var ns = XNamespace.Get("urn:etda:uncefact:data:standard:TaxInvoice_CrossIndustryInvoice:2");
        var actualTypeCode = xdoc.Descendants(ns + "TypeCode").FirstOrDefault()?.Value;

        Assert.Equal(expectedCode, actualTypeCode);
    }

    [Fact]
    public async Task SharedDocumentController_SendPaymentReminder_And_OverdueMonitorWorker_ShouldUseConfiguredFrontendBaseUrl()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantId = Guid.NewGuid();
        var customerId = Guid.NewGuid();
        var docId = Guid.NewGuid();

        var emailService = new RecordingEmailService();
        var lineService = new RecordingLineNotifyService();
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["App:FrontendBaseUrl"] = "https://billing.senic.co.th/"
            })
            .Build();

        var services = new ServiceCollection();
        services.AddDbContext<SenicBillingDbContext>(o => o.UseInMemoryDatabase(dbName));
        services.AddSingleton<IEmailService>(emailService);
        services.AddSingleton<IPaymentService>(new EmptyLinkPaymentService());
        services.AddSingleton<ILineNotifyService>(lineService);
        services.AddSingleton<IConfiguration>(config);
        using var provider = services.BuildServiceProvider();

        using (var seedScope = provider.CreateScope())
        {
            var seedDb = seedScope.ServiceProvider.GetRequiredService<SenicBillingDbContext>();
            seedDb.Tenants.Add(new Tenant
            {
                Id = tenantId,
                CompanyName = "Senic Tenant",
                LineNotifyToken = "line-token-test"
            });
            seedDb.Customers.Add(new Customer
            {
                Id = customerId,
                TenantId = tenantId,
                Name = "คุณวิชัย",
                Email = "wichai@customer.test"
            });
            seedDb.DocumentHeaders.Add(new DocumentHeader
            {
                Id = docId,
                TenantId = tenantId,
                CustomerId = customerId,
                CustomerName = "คุณวิชัย",
                DocumentType = DocumentType.TaxInvoice,
                DocumentNumber = "INV-OVERDUE-01",
                DocumentDate = DateTime.UtcNow.AddDays(-10),
                DueDate = DateTime.UtcNow.AddDays(-2),
                Status = DocumentStatus.Issued,
                GrandTotal = 5350m
            });
            await seedDb.SaveChangesAsync();
        }

        // 1) Controller manual reminder uses App:FrontendBaseUrl
        using (var ctrlScope = provider.CreateScope())
        {
            var ctrlDb = ctrlScope.ServiceProvider.GetRequiredService<SenicBillingDbContext>();
            var controller = new SharedDocumentController(ctrlDb, new StubNumberGenerator(), new QuestPdfService());
            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    RequestServices = ctrlScope.ServiceProvider,
                    User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("tenantId", tenantId.ToString())], "TestAuth"))
                }
            };

            var reminderResult = await controller.SendPaymentReminder(docId, CancellationToken.None);
            Assert.IsType<OkObjectResult>(reminderResult.Result);
            Assert.Single(emailService.Reminders);
            Assert.Equal($"https://billing.senic.co.th/print/{docId}", emailService.Reminders[0].PaymentLink);
        }

        // Clear cooldown so worker processes it next
        using (var resetScope = provider.CreateScope())
        {
            var resetDb = resetScope.ServiceProvider.GetRequiredService<SenicBillingDbContext>();
            var d = await resetDb.DocumentHeaders.FirstAsync(x => x.Id == docId);
            d.LastReminderSentAt = null;
            await resetDb.SaveChangesAsync();
        }

        emailService.Reminders.Clear();
        lineService.SentMessages.Clear();

        // 2) Worker processes overdue status, dispatches notifications, enforces 24h cooldown
        var worker = new OverdueMonitorWorker(provider, NullLogger<OverdueMonitorWorker>.Instance);
        var firstProcessed = await worker.RunOverdueCheckAsync(CancellationToken.None);
        var secondProcessed = await worker.RunOverdueCheckAsync(CancellationToken.None);

        Assert.Equal(1, firstProcessed);
        Assert.Equal(0, secondProcessed);
        Assert.Single(emailService.Reminders);
        Assert.Equal($"https://billing.senic.co.th/print/{docId}", emailService.Reminders[0].PaymentLink);
        Assert.Single(lineService.SentMessages);

        using var verifyScope = provider.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<SenicBillingDbContext>();
        var updatedDoc = await verifyDb.DocumentHeaders.FirstAsync(x => x.Id == docId);
        Assert.Equal(DocumentStatus.Overdue, updatedDoc.Status);
        Assert.NotNull(updatedDoc.LastReminderSentAt);
    }

    [Fact]
    public async Task RecurringInvoiceWorker_ProcessDueRecurringInvoicesAsync_ShouldGenerateDraftAndAdvanceSchedule()
    {
        var dbName = Guid.NewGuid().ToString();
        var tenantId = Guid.NewGuid();
        var sourceDocId = Guid.NewGuid();
        var initialRunDate = DateTime.UtcNow.Date.AddDays(-1);

        var services = new ServiceCollection();
        services.AddDbContext<SenicBillingDbContext>(o => o.UseInMemoryDatabase(dbName));
        using var provider = services.BuildServiceProvider();

        using (var seedScope = provider.CreateScope())
        {
            var db = seedScope.ServiceProvider.GetRequiredService<SenicBillingDbContext>();
            db.DocumentHeaders.Add(new DocumentHeader
            {
                Id = sourceDocId,
                TenantId = tenantId,
                DocumentType = DocumentType.TaxInvoice,
                DocumentNumber = "INV-TMPL-001",
                DocumentDate = DateTime.UtcNow.AddMonths(-1),
                CustomerName = "ลูกค้ารายเดือน",
                Subtotal = 2000m,
                TotalBeforeVat = 2000m,
                VatRate = 7m,
                VatAmount = 140m,
                GrandTotal = 2140m,
                Status = DocumentStatus.Issued,
                Lines =
                [
                    new DocumentLine
                    {
                        Id = Guid.NewGuid(),
                        DocumentHeaderId = sourceDocId,
                        SortOrder = 1,
                        Description = "ค่าบำรุงรักษารายเดือน",
                        Quantity = 1m,
                        Unit = "เดือน",
                        UnitPrice = 2000m,
                        LineTotal = 2000m
                    }
                ]
            });

            db.RecurringInvoices.Add(new RecurringInvoice
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                SourceDocumentId = sourceDocId,
                Frequency = "Monthly",
                NextRunDate = initialRunDate,
                IsActive = true,
                MaxOccurrences = 1,
                CurrentOccurrence = 0
            });
            await db.SaveChangesAsync();
        }

        var worker = new RecurringInvoiceWorker(provider, NullLogger<RecurringInvoiceWorker>.Instance);
        var generated = await worker.ProcessDueRecurringInvoicesAsync(CancellationToken.None);

        Assert.Equal(1, generated);

        using var verifyScope = provider.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<SenicBillingDbContext>();
        var docs = await verifyDb.DocumentHeaders.Include(d => d.Lines).ToListAsync();
        var rec = await verifyDb.RecurringInvoices.SingleAsync();

        Assert.Equal(2, docs.Count);
        var spawned = Assert.Single(docs, d => d.Id != sourceDocId);
        Assert.Equal(DocumentStatus.Draft, spawned.Status);
        Assert.Equal("REC-INV-TMPL-001-1", spawned.DocumentNumber);
        Assert.Single(spawned.Lines);
        Assert.Equal(1, rec.CurrentOccurrence);
        Assert.Equal(initialRunDate.AddMonths(1), rec.NextRunDate);
        Assert.False(rec.IsActive); // Deactivated at MaxOccurrences = 1
    }

    [Fact]
    public void OmisePaymentService_ShouldResolveConfigurableDefaultReturnUri()
    {
        var configured = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["App:FrontendBaseUrl"] = "https://pay.senic.app/"
            })
            .Build();
        var fallback = new ConfigurationBuilder().Build();

        var customService = new OmisePaymentService(configured, NullLogger<OmisePaymentService>.Instance);
        var defaultService = new OmisePaymentService(fallback, NullLogger<OmisePaymentService>.Instance);

        Assert.Equal("https://pay.senic.app/payments/callback", customService.DefaultReturnUri);
        Assert.Equal("http://localhost:5173/payments/callback", defaultService.DefaultReturnUri);
    }
}
