using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using SenicBilling.API.Controllers;
using SenicBilling.API.Controllers.SuperAdmin;
using SenicBilling.API.Extensions;
using SenicBilling.API.Hubs;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Infrastructure.Auth;
using SenicBilling.Infrastructure.Data;
using SenicBilling.Infrastructure.Services;

namespace SenicBilling.Tests;

public class Phase15ProductionAndPaymentTests
{
    private static readonly byte[] TinyValidPngBytes = Convert.FromBase64String(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=");

    private static SenicBillingDbContext CreateDbContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<SenicBillingDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;
        return new SenicBillingDbContext(options);
    }

    private sealed class StubStorageService : IStorageService
    {
        public Dictionary<string, byte[]> Objects { get; } = new(StringComparer.Ordinal);

        public async Task<string> UploadFileAsync(
            Stream fileStream,
            string fileName,
            string contentType,
            string bucketName,
            string objectKey,
            CancellationToken ct = default)
        {
            using var ms = new MemoryStream();
            await fileStream.CopyToAsync(ms, ct);
            Objects[$"{bucketName}/{objectKey}"] = ms.ToArray();
            return objectKey;
        }

        public Task<Stream> DownloadFileAsync(string bucketName, string objectKey, CancellationToken ct = default)
        {
            if (!Objects.TryGetValue($"{bucketName}/{objectKey}", out var data))
                throw new FileNotFoundException(objectKey);

            return Task.FromResult<Stream>(new MemoryStream(data));
        }

        public Task DeleteFileAsync(string bucketName, string objectKey, CancellationToken ct = default)
        {
            Objects.Remove($"{bucketName}/{objectKey}");
            return Task.CompletedTask;
        }

        public Task<string> GetPresignedUrlAsync(string bucketName, string objectKey, int expirySeconds = 3600) =>
            Task.FromResult($"https://storage.local/{bucketName}/{objectKey}");
    }

    private sealed class StubPaymentService : IPaymentService
    {
        public Task<(string ChargeId, string QrCodeUrl)> CreatePromptPayChargeAsync(decimal amountThb, string referenceId, string returnUrl = "") =>
            Task.FromResult(("chrg_test", "https://pay.test/qr"));

        public Task<string> CreatePaymentLinkAsync(decimal amountThb, string title, string description, string referenceId) =>
            Task.FromResult("https://pay.test/link");

        public Task<string> CreateCustomerAsync(string email, string description, string cardToken) =>
            Task.FromResult("cust_test");

        public Task<string> CreateCardChargeAsync(decimal amountThb, string customerId, string referenceId) =>
            Task.FromResult("chrg_card_test");

        public Task<bool> VerifyChargeAsync(string chargeId) =>
            Task.FromResult(true);
    }

    private sealed class StubHubContext : IHubContext<SenicBillingHub>
    {
        private sealed class NoopClientProxy : IClientProxy
        {
            public Task SendCoreAsync(string method, object?[] args, CancellationToken cancellationToken = default) =>
                Task.CompletedTask;
        }

        private sealed class NoopClients : IHubClients
        {
            private readonly NoopClientProxy _proxy = new();
            public IClientProxy All => _proxy;
            public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => _proxy;
            public IClientProxy Client(string connectionId) => _proxy;
            public IClientProxy Clients(IReadOnlyList<string> connectionIds) => _proxy;
            public IClientProxy Group(string groupName) => _proxy;
            public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => _proxy;
            public IClientProxy Groups(IReadOnlyList<string> groupNames) => _proxy;
            public IClientProxy User(string userId) => _proxy;
            public IClientProxy Users(IReadOnlyList<string> userIds) => _proxy;
        }

        public IHubClients Clients { get; } = new NoopClients();
        public IGroupManager Groups => throw new NotSupportedException();
    }

    private sealed class StubLineNotifyService : ILineNotifyService
    {
        public Task<bool> SendNotificationAsync(string accessToken, string message, CancellationToken ct = default) =>
            Task.FromResult(true);

        public Task<bool> PushMessageAsync(string channelAccessToken, string to, string message, CancellationToken ct = default) =>
            Task.FromResult(true);

        public Task<bool> ReplyMessageAsync(string channelAccessToken, string replyToken, string message, CancellationToken ct = default) =>
            Task.FromResult(true);

        public Task<bool> NotifyTenantAsync(Tenant tenant, string message, CancellationToken ct = default) =>
            Task.FromResult(true);
    }

    [Fact]
    public async Task PaymentsController_CallbackStatusAndMalformedWebhook_ShouldWorkSafely()
    {
        await using var db = CreateDbContext(nameof(PaymentsController_CallbackStatusAndMalformedWebhook_ShouldWorkSafely));
        var tenantId = Guid.NewGuid();
        var paidDocId = Guid.NewGuid();
        var pendingDocId = Guid.NewGuid();

        db.DocumentHeaders.AddRange(
            new DocumentHeader
            {
                Id = paidDocId,
                TenantId = tenantId,
                DocumentType = DocumentType.TaxInvoice,
                DocumentNumber = "IV-202611-0001",
                DocumentDate = DateTime.UtcNow,
                CustomerName = "Paid Customer",
                Status = DocumentStatus.Paid,
                GrandTotal = 10700m
            },
            new DocumentHeader
            {
                Id = pendingDocId,
                TenantId = tenantId,
                DocumentType = DocumentType.Receipt,
                DocumentNumber = "RC-202611-0002",
                DocumentDate = DateTime.UtcNow,
                CustomerName = "Pending Customer",
                Status = DocumentStatus.Issued,
                GrandTotal = 5350m
            });

        db.PaymentTransactions.Add(new PaymentTransaction
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            DocumentId = pendingDocId,
            Amount = 5350m,
            PaymentMethod = "promptpay",
            GatewayReference = "chrg_test_pending_01",
            Status = "pending",
            CreatedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync();

        var controller = new PaymentsController(
            db,
            new StubPaymentService(),
            new StubHubContext(),
            new StubLineNotifyService(),
            NullLogger<PaymentsController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };

        var paidResult = Assert.IsType<OkObjectResult>(
            await controller.GetCallbackStatus(documentId: paidDocId));
        var paidJson = JsonDocument.Parse(JsonSerializer.Serialize(paidResult.Value)).RootElement;
        Assert.True(paidJson.GetProperty("isPaid").GetBoolean());
        Assert.Equal("IV-202611-0001", paidJson.GetProperty("documentNumber").GetString());

        var pendingByCharge = Assert.IsType<OkObjectResult>(
            await controller.GetCallbackStatus(chargeId: "chrg_test_pending_01"));
        var pendingJson = JsonDocument.Parse(JsonSerializer.Serialize(pendingByCharge.Value)).RootElement;
        Assert.False(pendingJson.GetProperty("isPaid").GetBoolean());
        Assert.Equal("pending", pendingJson.GetProperty("paymentStatus").GetString());

        Assert.IsType<NotFoundObjectResult>(await controller.GetCallbackStatus());

        var malformedPayload = JsonDocument.Parse("""{"key":"charge.complete","data":{"id":"x"}}""").RootElement;
        Assert.IsType<OkResult>(await controller.OmiseWebhook(malformedPayload));
    }

    [Fact]
    public void QuestPdfService_ShouldLoadTenantLogoFromObjectStorage_WhenLocalFileMissing()
    {
        var tenantId = Guid.NewGuid();
        var fileName = "logo-storage-only.png";
        var storage = new StubStorageService();
        storage.Objects[$"senic-billing-logos/tenants/{tenantId}/{fileName}"] = TinyValidPngBytes;

        var pdfService = new QuestPdfService(storage);
        var doc = new DocumentHeader
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Tenant = new Tenant
            {
                Id = tenantId,
                CompanyName = "MinIO Storage Logo Co.",
                LogoUrl = $"/api/tenants/logo/{tenantId}/{fileName}"
            },
            DocumentType = DocumentType.TaxInvoice,
            DocumentNumber = "IV-STORAGE-001",
            DocumentDate = DateTime.UtcNow,
            CustomerName = "Buyer Co.",
            GrandTotal = 1070m,
            Lines =
            [
                new DocumentLine
                {
                    Id = Guid.NewGuid(),
                    SortOrder = 1,
                    Description = "Cloud Storage Logo Item",
                    Quantity = 1,
                    UnitPrice = 1070m,
                    LineTotal = 1070m
                }
            ]
        };

        var pdfBytes = pdfService.GenerateDocumentPdf(doc);
        Assert.True(pdfBytes.Length > 500);
        Assert.Equal("%PDF-", Encoding.ASCII.GetString(pdfBytes, 0, 5));
    }

    [Fact]
    public async Task TenantsController_UploadLogo_ShouldRejectSpoofedMagicBytes()
    {
        await using var db = CreateDbContext(nameof(TenantsController_UploadLogo_ShouldRejectSpoofedMagicBytes));
        var tenantId = Guid.NewGuid();
        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            CompanyName = "Magic Byte Check Co.",
            IsActive = true
        });
        await db.SaveChangesAsync();

        var controller = new TenantsController(db, new StubLineNotifyService(), new StubStorageService(), null)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                    [
                        new Claim("tenantId", tenantId.ToString()),
                        new Claim(ClaimTypes.Role, "Admin")
                    ], "Test"))
                }
            }
        };

        var spoofedBytes = "<script>alert(1)</script>"u8.ToArray();
        var spoofedFile = new FormFile(new MemoryStream(spoofedBytes), 0, spoofedBytes.Length, "file", "evil.png");
        var badRes = await controller.UploadLogo(spoofedFile, CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(badRes.Result);

        // Even if ObjectStorage returns a 0-byte stream (e.g. MinIO silent connection error), UploadLogo + GetLogo must serve valid PNG bytes from local App_Data
        var storage = new StubStorageService();
        var validController = new TenantsController(db, new StubLineNotifyService(), storage, null)
        {
            ControllerContext = controller.ControllerContext
        };
        var validFile = new FormFile(new MemoryStream(TinyValidPngBytes), 0, TinyValidPngBytes.Length, "file", "company-logo.png");
        var uploadRes = Assert.IsType<OkObjectResult>((await validController.UploadLogo(validFile, CancellationToken.None)).Result);
        var uploadPayload = Assert.IsType<ApiResponse<TenantLogoUploadResultDto>>(uploadRes.Value);
        Assert.NotNull(uploadPayload.Data);

        // Simulate MinIO returning an empty 0-byte object
        storage.Objects[$"senic-billing-logos/tenants/{tenantId}/{uploadPayload.Data!.FileName}"] = [];

        var getLogoRes = Assert.IsType<FileContentResult>(await validController.GetLogo(tenantId, uploadPayload.Data.FileName, CancellationToken.None));
        Assert.Equal("image/png", getLogoRes.ContentType);
        Assert.Equal(TinyValidPngBytes, getLogoRes.FileContents);
    }

    [Fact]
    public async Task SaTenantsController_ImpersonateTenant_ShouldReturnConfiguredFrontendUrl()
    {
        await using var db = CreateDbContext(nameof(SaTenantsController_ImpersonateTenant_ShouldReturnConfiguredFrontendUrl));
        var tenantId = Guid.NewGuid();
        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            CompanyName = "Prod URL Tenant",
            IsActive = true
        });
        db.AppUsers.Add(new AppUser
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Username = "tenant_owner",
            DisplayName = "Tenant Owner",
            PasswordHash = PasswordHasher.HashPassword("pass"),
            Role = "Admin",
            IsActive = true
        });
        await db.SaveChangesAsync();

        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JwtSettings:SecretKey"] = "SenicBillingNext-SuperSecret-TestKey-AtLeast32Chars!",
                ["JwtSettings:Issuer"] = "SenicBillingNext",
                ["JwtSettings:Audience"] = "SenicBillingNextClient",
                ["JwtSettings:ExpiryMinutes"] = "480",
                ["App:FrontendBaseUrl"] = "https://app.senic.co.th/"
            })
            .Build();

        var jwt = new JwtTokenService(config);
        var controller = new SaTenantsController(db, jwt, config)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                    [
                        new Claim("tenantId", ClaimsPrincipalExtensions.PlatformOwnerTenantId.ToString()),
                        new Claim(ClaimTypes.Role, "SuperAdmin"),
                        new Claim("username", "superadmin")
                    ], "Test"))
                }
            }
        };

        var result = Assert.IsType<OkObjectResult>(await controller.ImpersonateTenant(tenantId, CancellationToken.None));
        var json = JsonDocument.Parse(JsonSerializer.Serialize(result.Value, new JsonSerializerOptions(JsonSerializerDefaults.Web))).RootElement;
        Assert.True(json.GetProperty("success").GetBoolean());
        Assert.Equal("https://app.senic.co.th", json.GetProperty("data").GetProperty("frontendUrl").GetString());
    }
}
