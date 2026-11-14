using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using SenicBilling.API.Controllers;
using SenicBilling.API.Controllers.SuperAdmin;
using SenicBilling.API.Extensions;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Infrastructure.Auth;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.Tests;

public class Phase13SecuritySearchAndOperationsTests
{
    private static SenicBillingDbContext CreateDbContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<SenicBillingDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;
        return new SenicBillingDbContext(options);
    }

    private static IConfiguration CreateConfiguration() =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JwtSettings:SecretKey"] = "SenicBillingNext-SuperSecret-TestKey-AtLeast32Chars!",
                ["JwtSettings:Issuer"] = "SenicBillingNext",
                ["JwtSettings:Audience"] = "SenicBillingNextClient",
                ["JwtSettings:ExpiryMinutes"] = "480",
                ["Vapid:PublicKey"] = "test-public-key"
            })
            .Build();

    private static JwtTokenService CreateJwtService() => new(CreateConfiguration());

    private static void SetUserContext(
        ControllerBase controller,
        Guid tenantId,
        Guid? userId = null,
        string username = "tester",
        string role = "Admin",
        bool useSubOnly = false)
    {
        var uid = (userId ?? Guid.NewGuid()).ToString();
        var claims = new List<Claim>
        {
            new("tenantId", tenantId.ToString()),
            new(ClaimTypes.Name, username),
            new(ClaimTypes.Role, role),
            new("role", role),
            useSubOnly
                ? new(JwtRegisteredClaimNames.Sub, uid)
                : new(ClaimTypes.NameIdentifier, uid)
        };

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"))
            }
        };
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

    private sealed class StubPushService : IPushNotificationService
    {
        public Task SendNotificationAsync(Guid userId, string title, string message, string? url = null) =>
            Task.CompletedTask;

        public Task SendNotificationToAllAsync(string title, string message, string? url = null) =>
            Task.CompletedTask;
    }

    private sealed class CapturingAIService : IAIAssistantService
    {
        public string LastContext { get; private set; } = string.Empty;

        public Task<string> ChatAsync(string prompt, string context, CancellationToken ct = default)
        {
            LastContext = context;
            return Task.FromResult("สรุปข้อมูลสำเร็จ");
        }

        public Task<ParsedExpenseDto> ParseExpenseAsync(string receiptText, CancellationToken ct = default) =>
            Task.FromResult(new ParsedExpenseDto(null, null, null, null, null, null, null, null, ExpenseCategory.Other, null, PndType.None, null, false));
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
    public void PlatformAdmin_PolicyAndClaims_ShouldRestrictOtherTenantAdmins_AndExposeSubIdClaims()
    {
        var platformOwnerId = ClaimsPrincipalExtensions.PlatformOwnerTenantId;
        var regularTenantId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var platformOwnerAdmin = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim("tenantId", platformOwnerId.ToString()),
            new Claim(ClaimTypes.Role, "Admin")
        ], "Test"));

        var superAdminOnAnyTenant = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim("tenantId", regularTenantId.ToString()),
            new Claim(ClaimTypes.Role, "SuperAdmin")
        ], "Test"));

        var regularTenantAdmin = new ClaimsPrincipal(new ClaimsIdentity(
        [
            new Claim("tenantId", regularTenantId.ToString()),
            new Claim(ClaimTypes.Role, "Admin")
        ], "Test"));

        Assert.True(platformOwnerAdmin.IsPlatformAdmin());
        Assert.True(superAdminOnAnyTenant.IsPlatformAdmin());
        Assert.False(regularTenantAdmin.IsPlatformAdmin());

        var jwtService = CreateJwtService();
        var jwt = jwtService.GenerateToken(new AppUser
        {
            Id = userId,
            TenantId = platformOwnerId,
            Username = "rootadmin",
            DisplayName = "Root Admin",
            Role = "Admin"
        }, "Senic Platform Co.");
        var decoded = new JwtSecurityTokenHandler().ReadJwtToken(jwt);

        Assert.Equal(userId.ToString(), decoded.Claims.First(c => c.Type == JwtRegisteredClaimNames.Sub).Value);
        Assert.Equal(userId.ToString(), decoded.Claims.First(c => c.Type == "id").Value);
        Assert.Equal("rootadmin", decoded.Claims.First(c => c.Type == "username").Value);
    }

    [Fact]
    public async Task Auth_ShouldBlockSuspendedDemoTenant_AndEnforcePlanMaxUsersOnRegister()
    {
        await using var db = CreateDbContext(nameof(Auth_ShouldBlockSuspendedDemoTenant_AndEnforcePlanMaxUsersOnRegister));
        var platformId = ClaimsPrincipalExtensions.PlatformOwnerTenantId;
        var tenantId = Guid.NewGuid();
        var limitedPlan = new SubscriptionPlan
        {
            Id = Guid.NewGuid(),
            Name = "Starter",
            MonthlyPrice = 490m,
            YearlyPrice = 4900m,
            MaxUsers = 1,
            MaxDocumentsPerMonth = 50
        };

        db.SubscriptionPlans.Add(limitedPlan);
        db.Tenants.AddRange(
            new Tenant
            {
                Id = platformId,
                CompanyName = "Suspended Platform Demo",
                IsActive = false,
                SubscriptionStatus = "Suspended"
            },
            new Tenant
            {
                Id = tenantId,
                CompanyName = "Starter Co.",
                IsActive = true,
                SubscriptionStatus = "Active",
                CurrentPlanId = limitedPlan.Id
            });

        db.AppUsers.AddRange(
            new AppUser
            {
                Id = Guid.NewGuid(),
                TenantId = platformId,
                Username = "admin",
                DisplayName = "Platform Admin",
                PasswordHash = PasswordHasher.HashPassword("pass"),
                Role = "Admin",
                IsActive = true
            },
            new AppUser
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Username = "owner1",
                DisplayName = "Owner 1",
                PasswordHash = PasswordHasher.HashPassword("pass"),
                Role = "Admin",
                IsActive = true
            });
        await db.SaveChangesAsync();

        var controller = new AuthController(db, CreateJwtService());

        var demoResult = await controller.DemoLogin(CancellationToken.None);
        var demoForbidden = Assert.IsType<ObjectResult>(demoResult.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, demoForbidden.StatusCode);

        SetUserContext(controller, tenantId, username: "owner1", role: "Admin");
        var regResult = await controller.Register(
            new RegisterRequest("second_staff", "secret123", "Second Staff", "s@co.th", "User"),
            CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(regResult.Result);
    }

    [Fact]
    public async Task AttachmentsController_ShouldIsolateByTenant_AndValidateExtensions()
    {
        await using var db = CreateDbContext(nameof(AttachmentsController_ShouldIsolateByTenant_AndValidateExtensions));
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var docA = new DocumentHeader { Id = Guid.NewGuid(), TenantId = tenantA, DocumentNumber = "INV-A1" };
        var docB = new DocumentHeader { Id = Guid.NewGuid(), TenantId = tenantB, DocumentNumber = "INV-B1" };
        var attachB = new Attachment
        {
            Id = Guid.NewGuid(),
            DocumentId = docB.Id,
            FileName = "secret.pdf",
            OriginalFileName = "secret.pdf",
            ContentType = "application/pdf",
            FileSize = 10,
            ObjectKey = $"{tenantB}/{docB.Id}/secret.pdf"
        };

        db.DocumentHeaders.AddRange(docA, docB);
        db.Attachments.Add(attachB);
        await db.SaveChangesAsync();

        var storage = new StubStorageService();
        storage.Objects["senic-billing/" + attachB.ObjectKey] = Encoding.UTF8.GetBytes("secret");

        var controller = new AttachmentsController(db, storage);
        SetUserContext(controller, tenantA, username: "alice", role: "User");

        var validPdf = new FormFile(new MemoryStream(Encoding.UTF8.GetBytes("%PDF-1.4")), 0, 8, "file", "invoice.pdf")
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/pdf"
        };

        // Cross-tenant upload must fail with 404
        var crossUpload = await controller.UploadFile(docB.Id, validPdf, CancellationToken.None);
        Assert.IsType<NotFoundObjectResult>(crossUpload.Result);

        // Cross-tenant download must fail with 404
        var crossDownload = await controller.DownloadFile(attachB.Id, CancellationToken.None);
        Assert.IsType<NotFoundObjectResult>(crossDownload);

        // Disallowed extension must fail with 400
        var badExe = new FormFile(new MemoryStream("MZ"u8.ToArray()), 0, 2, "file", "malware.exe");
        var badExtRes = await controller.UploadFile(docA.Id, badExe, CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(badExtRes.Result);

        // Own tenant valid upload succeeds and records uploader username
        var ownPdf = new FormFile(new MemoryStream(Encoding.UTF8.GetBytes("%PDF-1.4")), 0, 8, "file", "../slip.pdf")
        {
            Headers = new HeaderDictionary(),
            ContentType = "application/pdf"
        };
        var okUpload = await controller.UploadFile(docA.Id, ownPdf, CancellationToken.None);
        Assert.IsType<OkObjectResult>(okUpload.Result);
        var saved = await db.Attachments.FirstOrDefaultAsync(a => a.DocumentId == docA.Id);
        Assert.NotNull(saved);
        Assert.Equal("slip.pdf", saved.FileName);
        Assert.Equal("alice", saved.UploadedBy);
    }

    [Fact]
    public async Task SearchController_ShouldReturnMultiEntityMatchesStrictlyForCallerTenant()
    {
        await using var db = CreateDbContext(nameof(SearchController_ShouldReturnMultiEntityMatchesStrictlyForCallerTenant));
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        db.DocumentHeaders.AddRange(
            new DocumentHeader { Id = Guid.NewGuid(), TenantId = tenantA, DocumentNumber = "TAX-ACME-01", DocumentType = DocumentType.TaxInvoice, Status = DocumentStatus.Issued, CustomerName = "Acme Alpha", GrandTotal = 1500m },
            new DocumentHeader { Id = Guid.NewGuid(), TenantId = tenantB, DocumentNumber = "TAX-ACME-99", DocumentType = DocumentType.TaxInvoice, Status = DocumentStatus.Issued, CustomerName = "Acme Secret B", GrandTotal = 9999m });
        db.Customers.Add(new Customer { Id = Guid.NewGuid(), TenantId = tenantA, Name = "Acme Customer Ltd", TaxId = "0105559990001" });
        db.Products.Add(new Product { Id = Guid.NewGuid(), TenantId = tenantA, Name = "Acme Cloud License", Sku = "ACME-01", UnitPrice = 2400m });
        db.ExpenseRecords.Add(new ExpenseRecord { Id = Guid.NewGuid(), TenantId = tenantA, VoucherNumber = "EXP-ACME-1", VendorName = "Acme Hosting", Description = "Cloud", GrandTotal = 800m });
        db.PurchaseOrders.Add(new PurchaseOrder { Id = Guid.NewGuid(), TenantId = tenantA, PoNumber = "PO-ACME-1", VendorName = "Acme Supply", GrandTotal = 3000m });
        await db.SaveChangesAsync();

        var controller = new SearchController(db);
        SetUserContext(controller, tenantA);

        var res = await controller.Search("Acme", 20, CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var payload = Assert.IsType<ApiResponse<GlobalSearchResponseDto>>(ok.Value).Data!;

        Assert.Equal(5, payload.Items.Count);
        Assert.Contains(payload.Items, i => i.Category == "document" && i.Title == "TAX-ACME-01");
        Assert.Contains(payload.Items, i => i.Category == "customer" && i.Title == "Acme Customer Ltd");
        Assert.Contains(payload.Items, i => i.Category == "product" && i.Title == "Acme Cloud License");
        Assert.Contains(payload.Items, i => i.Category == "expense" && i.Title == "EXP-ACME-1");
        Assert.Contains(payload.Items, i => i.Category == "purchase_order" && i.Title == "PO-ACME-1");
        Assert.DoesNotContain(payload.Items, i => i.Title == "TAX-ACME-99");
    }

    [Fact]
    public async Task NotificationsController_ShouldSupportSubClaimAndReturnTenantFeed()
    {
        await using var db = CreateDbContext(nameof(NotificationsController_ShouldSupportSubClaimAndReturnTenantFeed));
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var userA = Guid.NewGuid();

        var product = new Product { Id = Guid.NewGuid(), TenantId = tenantA, Name = "กระดาษ A4", UnitPrice = 120m };
        var warehouse = new Warehouse { Id = Guid.NewGuid(), TenantId = tenantA, Code = "MAIN", Name = "คลังใหญ่" };
        db.Products.Add(product);
        db.Warehouses.Add(warehouse);
        db.ProductWarehouseStocks.Add(new ProductWarehouseStock
        {
            Id = Guid.NewGuid(),
            TenantId = tenantA,
            ProductId = product.Id,
            WarehouseId = warehouse.Id,
            Quantity = 2m,
            ReorderLevel = 5m,
            UpdatedAt = DateTime.UtcNow
        });

        db.DocumentHeaders.AddRange(
            new DocumentHeader
            {
                Id = Guid.NewGuid(),
                TenantId = tenantA,
                DocumentType = DocumentType.TaxInvoice,
                DocumentNumber = "TAX-A-OVERDUE",
                CustomerName = "บจก. เอ",
                GrandTotal = 5000m,
                Status = DocumentStatus.Overdue,
                DueDate = DateTime.UtcNow.AddDays(-2)
            },
            new DocumentHeader
            {
                Id = Guid.NewGuid(),
                TenantId = tenantA,
                DocumentType = DocumentType.Quotation,
                DocumentNumber = "QUO-A-APPROVED",
                CustomerApprovalStatus = CustomerApprovalStatus.Approved,
                ApprovedByName = "คุณสมชาย",
                ApprovedAt = DateTime.UtcNow
            },
            new DocumentHeader
            {
                Id = Guid.NewGuid(),
                TenantId = tenantB,
                DocumentType = DocumentType.TaxInvoice,
                DocumentNumber = "TAX-B-SECRET",
                Status = DocumentStatus.Overdue,
                DueDate = DateTime.UtcNow.AddDays(-1)
            });
        await db.SaveChangesAsync();

        var controller = new NotificationsController(db, CreateConfiguration(), new StubPushService());
        SetUserContext(controller, tenantA, userId: userA, username: "alice", useSubOnly: true);

        var subRes = await controller.Subscribe(new PushSubscriptionRequest
        {
            Endpoint = "https://push.example/1",
            P256dh = "p256",
            Auth = "auth"
        });
        Assert.IsType<OkObjectResult>(subRes);
        Assert.True(await db.PushSubscriptions.AnyAsync(p => p.UserId == userA));

        var feedRes = await controller.GetFeed(15, CancellationToken.None);
        var okFeed = Assert.IsType<OkObjectResult>(feedRes.Result);
        var items = Assert.IsType<ApiResponse<List<NotificationFeedItemDto>>>(okFeed.Value).Data!;

        Assert.Contains(items, i => i.Title.Contains("TAX-A-OVERDUE"));
        Assert.Contains(items, i => i.Title.Contains("QUO-A-APPROVED"));
        Assert.Contains(items, i => i.Title.Contains("กระดาษ A4"));
        Assert.DoesNotContain(items, i => i.Title.Contains("TAX-B-SECRET"));
    }

    [Fact]
    public async Task AIAssistant_ShouldCalculateRevenueConsistentWithDashboardAndTaxContext()
    {
        await using var db = CreateDbContext(nameof(AIAssistant_ShouldCalculateRevenueConsistentWithDashboardAndTaxContext));
        var tenantId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        db.DocumentHeaders.AddRange(
            new DocumentHeader
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                DocumentType = DocumentType.TaxInvoice,
                DocumentNumber = "INV-1",
                DocumentDate = now,
                Status = DocumentStatus.Paid,
                GrandTotal = 10_000m,
                VatAmount = 654.21m
            },
            new DocumentHeader
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                DocumentType = DocumentType.Receipt,
                DocumentNumber = "REC-1",
                DocumentDate = now,
                Status = DocumentStatus.Viewed,
                GrandTotal = 5_000m,
                VatAmount = 327.10m
            },
            new DocumentHeader
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                DocumentType = DocumentType.CreditNote,
                DocumentNumber = "CN-1",
                DocumentDate = now,
                Status = DocumentStatus.Issued,
                GrandTotal = 2_000m,
                VatAmount = 130.84m
            },
            new DocumentHeader
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                DocumentType = DocumentType.Quotation,
                DocumentNumber = "QUO-IGNORE",
                DocumentDate = now,
                Status = DocumentStatus.Issued,
                GrandTotal = 99_000m
            },
            new DocumentHeader
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                DocumentType = DocumentType.TaxInvoice,
                DocumentNumber = "INV-DRAFT-IGNORE",
                DocumentDate = now,
                Status = DocumentStatus.Draft,
                GrandTotal = 50_000m
            });

        db.ExpenseRecords.Add(new ExpenseRecord
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            VoucherNumber = "EXP-1",
            VendorName = "Vendor",
            Description = "Hosting",
            ExpenseDate = now,
            Status = ExpenseStatus.Approved,
            VatAmount = 700m,
            IsRefundableVat = true,
            GrandTotal = 10_700m,
            WhtAmount = 300m
        });

        await db.SaveChangesAsync();

        var aiStub = new CapturingAIService();
        var controller = new AIAssistantController(db, aiStub);
        SetUserContext(controller, tenantId);

        var res = await controller.Chat(new ChatRequest("สรุปยอดขายและภาษี"), CancellationToken.None);
        Assert.IsType<OkObjectResult>(res.Result);

        Assert.Contains("13,000.00 บาท", aiStub.LastContext);
        Assert.Contains("ภาษีซื้อขอคืนได้=700.00 บาท", aiStub.LastContext);
        Assert.Contains("หัก ณ ที่จ่ายต้องนำส่งฝั่งซื้อ=300.00 บาท", aiStub.LastContext);
    }

    [Fact]
    public async Task TenantLogoUpload_AndSaBillingMarkPaid_ShouldPersistUpdateAndAudit()
    {
        await using var db = CreateDbContext(nameof(TenantLogoUpload_AndSaBillingMarkPaid_ShouldPersistUpdateAndAudit));
        var tenantId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        var subId = Guid.NewGuid();

        db.SubscriptionPlans.Add(new SubscriptionPlan
        {
            Id = planId,
            Name = "Pro",
            MonthlyPrice = 1290m,
            YearlyPrice = 12900m,
            MaxUsers = 15,
            MaxDocumentsPerMonth = 2000
        });
        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            CompanyName = "บจก. ทดสอบโลโก้",
            IsActive = false,
            SubscriptionStatus = "PastDue",
            CurrentPlanId = planId
        });
        db.TenantSubscriptions.Add(new TenantSubscription
        {
            Id = subId,
            TenantId = tenantId,
            PlanId = planId,
            BillingCycle = "Monthly",
            Status = "Pending",
            StartDate = DateTime.UtcNow.AddDays(-35),
            EndDate = DateTime.UtcNow.AddDays(-5)
        });
        await db.SaveChangesAsync();

        var storage = new StubStorageService();
        var tenantsCtrl = new TenantsController(db, new StubLineNotifyService(), storage, null);
        SetUserContext(tenantsCtrl, tenantId, username: "tenantadmin", role: "Admin");

        var invalidFile = new FormFile(new MemoryStream("<svg></svg>"u8.ToArray()), 0, 11, "file", "bad.svg");
        var badRes = await tenantsCtrl.UploadLogo(invalidFile, CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(badRes.Result);

        var pngBytes = new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 };
        var pngFile = new FormFile(new MemoryStream(pngBytes), 0, pngBytes.Length, "file", "company.png")
        {
            Headers = new HeaderDictionary(),
            ContentType = "image/png"
        };
        var okUpload = await tenantsCtrl.UploadLogo(pngFile, CancellationToken.None);
        var okObj = Assert.IsType<OkObjectResult>(okUpload.Result);
        var uploadDto = Assert.IsType<ApiResponse<TenantLogoUploadResultDto>>(okObj.Value).Data!;
        Assert.StartsWith($"/api/tenants/logo/{tenantId}/", uploadDto.LogoUrl);

        var logoFileResult = Assert.IsType<FileStreamResult>(
            await tenantsCtrl.GetLogo(tenantId, uploadDto.FileName, CancellationToken.None));
        Assert.Equal("image/png", logoFileResult.ContentType);

        var saBillingCtrl = new SaBillingController(db);
        SetUserContext(saBillingCtrl, ClaimsPrincipalExtensions.PlatformOwnerTenantId, username: "superadmin", role: "SuperAdmin");

        var paidRes = Assert.IsType<OkObjectResult>(await saBillingCtrl.MarkInvoicePaid(subId, CancellationToken.None));
        var paidJson = JsonDocument.Parse(JsonSerializer.Serialize(paidRes.Value));
        Assert.True(paidJson.RootElement.GetProperty("success").GetBoolean());

        var updatedSub = await db.TenantSubscriptions.FirstAsync(s => s.Id == subId);
        var updatedTenant = await db.Tenants.FirstAsync(t => t.Id == tenantId);
        Assert.Equal("Paid", updatedSub.Status);
        Assert.True(updatedSub.EndDate > DateTime.UtcNow.AddDays(20));
        Assert.True(updatedTenant.IsActive);
        Assert.Equal("Active", updatedTenant.SubscriptionStatus);
        Assert.True(await db.AuditLogs.AnyAsync(a => a.TenantId == tenantId && a.Action == "UploadTenantLogo"));
        Assert.True(await db.AuditLogs.AnyAsync(a => a.TenantId == tenantId && a.Action == "MarkSaaSInvoicePaid"));
    }
}
