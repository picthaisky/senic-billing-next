using System.Reflection;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using SenicBilling.API.Controllers;
using SenicBilling.API.Controllers.SuperAdmin;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Infrastructure.BackgroundJobs;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.Tests;

public class Phase17WorkerQuotaAndSubscriptionTests
{
    private sealed class StubPaymentService : IPaymentService
    {
        public Task<(string ChargeId, string QrCodeUrl)> CreatePromptPayChargeAsync(decimal amount, string referenceId, string returnUrl = "")
            => Task.FromResult(("chrg_promptpay_stub", "https://stub/qr.png"));

        public Task<string> CreatePaymentLinkAsync(decimal amount, string title, string description, string referenceId)
            => Task.FromResult(string.Empty);

        public Task<bool> VerifyChargeAsync(string chargeId) => Task.FromResult(true);

        public Task<string> CreateCustomerAsync(string email, string description, string cardToken)
            => Task.FromResult("cust_test_17");

        public Task<string> CreateCardChargeAsync(decimal amount, string customerId, string referenceId)
            => Task.FromResult("chrg_card_test_17");
    }

    private sealed class StubEmailService : IEmailService
    {
        public List<string> SentReminders { get; } = [];

        public Task SendEmailAsync(string to, string subject, string body, CancellationToken ct = default)
            => Task.CompletedTask;

        public Task SendDocumentLinkAsync(string to, string customerName, string documentNumber, string link, CancellationToken ct = default)
            => Task.CompletedTask;

        public Task SendPaymentReminderAsync(string to, string customerName, string documentNumber, decimal amount, DateTime dueDate, string paymentLink, CancellationToken ct = default)
        {
            SentReminders.Add(documentNumber);
            return Task.CompletedTask;
        }
    }

    private sealed class StubLineNotifyService : ILineNotifyService
    {
        public List<string> SentMessages { get; } = [];

        public Task<bool> SendNotificationAsync(string accessToken, string message, CancellationToken ct = default)
        {
            SentMessages.Add(message);
            return Task.FromResult(true);
        }

        public Task<bool> PushMessageAsync(string channelAccessToken, string to, string message, CancellationToken ct = default)
        {
            SentMessages.Add(message);
            return Task.FromResult(true);
        }

        public Task<bool> ReplyMessageAsync(string channelAccessToken, string replyToken, string message, CancellationToken ct = default)
            => Task.FromResult(true);

        public Task<bool> NotifyTenantAsync(Tenant tenant, string message, CancellationToken ct = default)
        {
            SentMessages.Add(message);
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

    private static ControllerContext CreateAuthContext(Guid tenantId, Guid userId, string role, string username = "admin")
    {
        var claims = new List<Claim>
        {
            new("tenantId", tenantId.ToString()),
            new("id", userId.ToString()),
            new(ClaimTypes.Name, username),
            new(ClaimTypes.Role, role)
        };

        return new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"))
            }
        };
    }

    [Fact]
    public async Task RecurringInvoiceWorker_ShouldSkipSuspendedTenant_AndEnforceMonthlyDocumentQuota()
    {
        var dbName = Guid.NewGuid().ToString();
        var suspendedTenantId = Guid.NewGuid();
        var quotaLimitedTenantId = Guid.NewGuid();
        var planId = Guid.NewGuid();

        var services = new ServiceCollection();
        services.AddDbContext<SenicBillingDbContext>(o => o.UseInMemoryDatabase(dbName));
        using var provider = services.BuildServiceProvider();

        using (var seedScope = provider.CreateScope())
        {
            var db = seedScope.ServiceProvider.GetRequiredService<SenicBillingDbContext>();
            var plan = new SubscriptionPlan
            {
                Id = planId,
                Name = "Starter Quota 2",
                MonthlyPrice = 290m,
                YearlyPrice = 2900m,
                MaxUsers = 2,
                MaxDocumentsPerMonth = 2,
                IsActive = true
            };
            db.SubscriptionPlans.Add(plan);

            db.Tenants.AddRange(
                new Tenant
                {
                    Id = suspendedTenantId,
                    CompanyName = "Suspended Co.",
                    IsActive = false,
                    SubscriptionStatus = "Suspended",
                    CurrentPlanId = planId
                },
                new Tenant
                {
                    Id = quotaLimitedTenantId,
                    CompanyName = "Quota Limited Co.",
                    IsActive = true,
                    SubscriptionStatus = "Active",
                    CurrentPlanId = planId
                });

            var suspendedSourceDocId = Guid.NewGuid();
            var quotaSourceDocId = Guid.NewGuid();

            db.DocumentHeaders.AddRange(
                new DocumentHeader
                {
                    Id = suspendedSourceDocId,
                    TenantId = suspendedTenantId,
                    DocumentType = DocumentType.TaxInvoice,
                    DocumentNumber = "INV-SUSP-001",
                    DocumentDate = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                    Status = DocumentStatus.Issued,
                    GrandTotal = 1000m
                },
                // 1 existing document in current month for quotaLimitedTenantId (Max = 2)
                new DocumentHeader
                {
                    Id = quotaSourceDocId,
                    TenantId = quotaLimitedTenantId,
                    DocumentType = DocumentType.TaxInvoice,
                    DocumentNumber = "INV-QUOTA-001",
                    DocumentDate = DateTime.UtcNow,
                    CreatedAt = DateTime.UtcNow,
                    Status = DocumentStatus.Issued,
                    GrandTotal = 1500m
                });

            db.RecurringInvoices.AddRange(
                new RecurringInvoice
                {
                    Id = Guid.NewGuid(),
                    TenantId = suspendedTenantId,
                    SourceDocumentId = suspendedSourceDocId,
                    Frequency = "Monthly",
                    NextRunDate = DateTime.UtcNow.Date.AddDays(-1),
                    IsActive = true
                },
                new RecurringInvoice
                {
                    Id = Guid.NewGuid(),
                    TenantId = quotaLimitedTenantId,
                    SourceDocumentId = quotaSourceDocId,
                    Frequency = "Monthly",
                    NextRunDate = DateTime.UtcNow.Date.AddDays(-1),
                    IsActive = true
                },
                new RecurringInvoice
                {
                    Id = Guid.NewGuid(),
                    TenantId = quotaLimitedTenantId,
                    SourceDocumentId = quotaSourceDocId,
                    Frequency = "Monthly",
                    NextRunDate = DateTime.UtcNow.Date.AddDays(-1),
                    IsActive = true
                });

            await db.SaveChangesAsync();
        }

        var worker = new RecurringInvoiceWorker(provider, NullLogger<RecurringInvoiceWorker>.Instance);
        var generatedCount = await worker.ProcessDueRecurringInvoicesAsync(CancellationToken.None);

        // Suspended tenant should generate 0; quotaLimitedTenant starts at 1/2 docs this month so only 1 of its 2 due recurring invoices can spawn
        Assert.Equal(1, generatedCount);

        using var verifyScope = provider.CreateScope();
        var verifyDb = verifyScope.ServiceProvider.GetRequiredService<SenicBillingDbContext>();
        var suspendedDocs = await verifyDb.DocumentHeaders.CountAsync(d => d.TenantId == suspendedTenantId);
        var quotaDocs = await verifyDb.DocumentHeaders.CountAsync(d => d.TenantId == quotaLimitedTenantId);

        Assert.Equal(1, suspendedDocs); // Only original source doc
        Assert.Equal(2, quotaDocs); // Capped at MaxDocumentsPerMonth = 2
    }

    [Fact]
    public async Task OverdueMonitorWorker_ShouldSkipSuspendedAndInactiveTenants()
    {
        var dbName = Guid.NewGuid().ToString();
        var suspendedTenantId = Guid.NewGuid();
        var activeTenantId = Guid.NewGuid();

        var emailService = new StubEmailService();
        var lineService = new StubLineNotifyService();

        var services = new ServiceCollection();
        services.AddDbContext<SenicBillingDbContext>(o => o.UseInMemoryDatabase(dbName));
        services.AddSingleton<IEmailService>(emailService);
        services.AddSingleton<IPaymentService>(new StubPaymentService());
        services.AddSingleton<ILineNotifyService>(lineService);
        using var provider = services.BuildServiceProvider();

        using (var seedScope = provider.CreateScope())
        {
            var db = seedScope.ServiceProvider.GetRequiredService<SenicBillingDbContext>();
            var cust1 = new Customer { Id = Guid.NewGuid(), TenantId = suspendedTenantId, Name = "Cust Suspended", Email = "susp@test.co" };
            var cust2 = new Customer { Id = Guid.NewGuid(), TenantId = activeTenantId, Name = "Cust Active", Email = "active@test.co" };

            db.Tenants.AddRange(
                new Tenant
                {
                    Id = suspendedTenantId,
                    CompanyName = "Suspended Org",
                    IsActive = false,
                    SubscriptionStatus = "Suspended",
                    LineNotifyToken = "tok_susp"
                },
                new Tenant
                {
                    Id = activeTenantId,
                    CompanyName = "Active Org",
                    IsActive = true,
                    SubscriptionStatus = "Active",
                    LineNotifyToken = "tok_active"
                });

            db.Customers.AddRange(cust1, cust2);
            db.DocumentHeaders.AddRange(
                new DocumentHeader
                {
                    Id = Guid.NewGuid(),
                    TenantId = suspendedTenantId,
                    CustomerId = cust1.Id,
                    CustomerName = cust1.Name,
                    DocumentType = DocumentType.TaxInvoice,
                    DocumentNumber = "INV-SUSPENDED-OD",
                    DocumentDate = DateTime.UtcNow.AddDays(-10),
                    DueDate = DateTime.UtcNow.AddDays(-2),
                    Status = DocumentStatus.Issued,
                    GrandTotal = 1000m
                },
                new DocumentHeader
                {
                    Id = Guid.NewGuid(),
                    TenantId = activeTenantId,
                    CustomerId = cust2.Id,
                    CustomerName = cust2.Name,
                    DocumentType = DocumentType.TaxInvoice,
                    DocumentNumber = "INV-ACTIVE-OD",
                    DocumentDate = DateTime.UtcNow.AddDays(-10),
                    DueDate = DateTime.UtcNow.AddDays(-2),
                    Status = DocumentStatus.Issued,
                    GrandTotal = 2000m
                });

            await db.SaveChangesAsync();
        }

        var worker = new OverdueMonitorWorker(provider, NullLogger<OverdueMonitorWorker>.Instance);
        var processed = await worker.RunOverdueCheckAsync(CancellationToken.None);

        Assert.Equal(1, processed);
        var sentDocNumber = Assert.Single(emailService.SentReminders);
        Assert.Equal("INV-ACTIVE-OD", sentDocNumber);
        Assert.Single(lineService.SentMessages);
    }

    [Fact]
    public async Task TenantSubscriptionController_Checkout_ShouldEnforceActivePlanAndMaxUsers_AndAuditLog()
    {
        await using var db = CreateDbContext(nameof(TenantSubscriptionController_Checkout_ShouldEnforceActivePlanAndMaxUsers_AndAuditLog));
        var tenantId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var inactivePlanId = Guid.NewGuid();
        var smallPlanId = Guid.NewGuid();
        var proPlanId = Guid.NewGuid();

        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            CompanyName = "Growing SME Co.",
            Email = "billing@growingsme.co.th",
            IsActive = true,
            SubscriptionStatus = "Active"
        });

        db.SubscriptionPlans.AddRange(
            new SubscriptionPlan
            {
                Id = inactivePlanId,
                Name = "Legacy Plan",
                MonthlyPrice = 199m,
                MaxUsers = 10,
                MaxDocumentsPerMonth = 100,
                IsActive = false
            },
            new SubscriptionPlan
            {
                Id = smallPlanId,
                Name = "Solo Plan (1 User)",
                MonthlyPrice = 299m,
                MaxUsers = 1,
                MaxDocumentsPerMonth = 100,
                IsActive = true
            },
            new SubscriptionPlan
            {
                Id = proPlanId,
                Name = "Pro Plan (10 Users)",
                MonthlyPrice = 990m,
                MaxUsers = 10,
                MaxDocumentsPerMonth = -1,
                IsActive = true
            });

        // Seed 2 active users so Solo Plan (MaxUsers = 1) must be rejected
        db.AppUsers.AddRange(
            new AppUser { Id = adminId, TenantId = tenantId, Username = "admin1", Role = "Admin", IsActive = true },
            new AppUser { Id = Guid.NewGuid(), TenantId = tenantId, Username = "staff1", Role = "User", IsActive = true });
        await db.SaveChangesAsync();

        var controller = new TenantSubscriptionController(
            db,
            new StubPaymentService(),
            NullLogger<TenantSubscriptionController>.Instance)
        {
            ControllerContext = CreateAuthContext(tenantId, adminId, "Admin", "admin1")
        };

        // 1) Inactive plan rejected
        var inactiveRes = await controller.Checkout(new CheckoutRequest { PlanId = inactivePlanId }, CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(inactiveRes);

        // 2) Downgrading below active user count rejected
        var downgradeRes = await controller.Checkout(new CheckoutRequest { PlanId = smallPlanId }, CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(downgradeRes);

        // 3) Valid upgrade succeeds and writes AuditLog
        var upgradeRes = await controller.Checkout(new CheckoutRequest { PlanId = proPlanId, CardToken = "tokn_test_17" }, CancellationToken.None);
        Assert.IsType<OkObjectResult>(upgradeRes);

        var updatedTenant = await db.Tenants.SingleAsync(t => t.Id == tenantId);
        Assert.Equal(proPlanId, updatedTenant.CurrentPlanId);
        Assert.True(await db.AuditLogs.AnyAsync(a => a.TenantId == tenantId && a.Action == "CheckoutSubscriptionPlan"));
    }

    [Fact]
    public async Task TenantSubscriptionController_OmiseWebhook_ShouldHandlePingAndExtendSubscriptionOnChargeComplete()
    {
        await using var db = CreateDbContext(nameof(TenantSubscriptionController_OmiseWebhook_ShouldHandlePingAndExtendSubscriptionOnChargeComplete));
        var tenantId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        var initialExpiry = DateTime.UtcNow.AddDays(3);

        db.SubscriptionPlans.Add(new SubscriptionPlan
        {
            Id = planId,
            Name = "Enterprise",
            MonthlyPrice = 1990m,
            MaxUsers = -1,
            MaxDocumentsPerMonth = -1,
            IsActive = true
        });
        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            CompanyName = "Webhook Tenant Co.",
            CurrentPlanId = planId,
            IsActive = false,
            SubscriptionStatus = "Suspended",
            SubscriptionValidUntil = initialExpiry
        });
        db.TenantSubscriptions.Add(new TenantSubscription
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PlanId = planId,
            StartDate = DateTime.UtcNow.AddMonths(-1),
            EndDate = initialExpiry,
            Status = "Active"
        });
        await db.SaveChangesAsync();

        var controller = new TenantSubscriptionController(
            db,
            new StubPaymentService(),
            NullLogger<TenantSubscriptionController>.Instance);

        // 1) Incomplete/ping payload without "key" should not throw KeyNotFoundException
        using var pingDoc = JsonDocument.Parse("""{"ping": true}""");
        var pingRes = await controller.OmiseWebhook(pingDoc.RootElement, CancellationToken.None);
        Assert.IsType<OkObjectResult>(pingRes);

        // 2) Successful charge.complete payload extends SubscriptionValidUntil by 1 month and reactivates tenant
        using var chargeDoc = JsonDocument.Parse($$"""
        {
            "key": "charge.complete",
            "data": {
                "status": "successful",
                "description": "{{tenantId}}"
            }
        }
        """);
        var chargeRes = await controller.OmiseWebhook(chargeDoc.RootElement, CancellationToken.None);
        Assert.IsType<OkObjectResult>(chargeRes);

        var updatedTenant = await db.Tenants.SingleAsync(t => t.Id == tenantId);
        Assert.True(updatedTenant.IsActive);
        Assert.Equal("Active", updatedTenant.SubscriptionStatus);
        Assert.True(updatedTenant.SubscriptionValidUntil > initialExpiry.AddDays(25));
        Assert.True(await db.AuditLogs.AnyAsync(a => a.TenantId == tenantId && a.Action == "RenewSubscriptionWebhook"));
    }

    [Fact]
    public async Task SaPlansController_And_TenantsController_ShouldEnforceRbacValidationAndAuditLogs()
    {
        // Verify [Authorize(Roles = "Admin,SystemAdmin,SuperAdmin")] on TenantsController.UpdateProfile & TestLineNotify
        // and TenantSubscriptionController.Checkout
        var updateProfileAuth = typeof(TenantsController)
            .GetMethod(nameof(TenantsController.UpdateProfile))?
            .GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(updateProfileAuth);
        Assert.Contains("Admin", updateProfileAuth!.Roles);

        var testLineAuth = typeof(TenantsController)
            .GetMethod(nameof(TenantsController.TestLineNotify))?
            .GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(testLineAuth);
        Assert.Contains("Admin", testLineAuth!.Roles);

        var checkoutAuth = typeof(TenantSubscriptionController)
            .GetMethod(nameof(TenantSubscriptionController.Checkout))?
            .GetCustomAttribute<AuthorizeAttribute>();
        Assert.NotNull(checkoutAuth);
        Assert.Contains("Admin", checkoutAuth!.Roles);

        await using var db = CreateDbContext(nameof(SaPlansController_And_TenantsController_ShouldEnforceRbacValidationAndAuditLogs));
        var tenantId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            CompanyName = "Initial Name",
            TaxId = "0105551111111"
        });
        await db.SaveChangesAsync();

        var tenantsCtrl = new TenantsController(db, new StubLineNotifyService())
        {
            ControllerContext = CreateAuthContext(tenantId, adminId, "Admin", "tenant_admin")
        };

        var updateRes = await tenantsCtrl.UpdateProfile(
            new UpdateTenantProfileRequest(
                "Updated Company Name",
                "0105559999999",
                "HQ",
                "123 Sukhumvit",
                "021112222",
                "info@updated.co.th",
                null,
                null,
                null,
                null,
                null),
            CancellationToken.None);
        Assert.IsType<OkObjectResult>(updateRes.Result);
        Assert.True(await db.AuditLogs.AnyAsync(a => a.TenantId == tenantId && a.Action == "UpdateTenantProfile"));

        var saPlansCtrl = new SaPlansController(db)
        {
            ControllerContext = CreateAuthContext(Guid.Empty, adminId, "SuperAdmin", "superadmin")
        };

        var invalidNameRes = await saPlansCtrl.CreatePlan(new SubscriptionPlan { Name = "  ", MonthlyPrice = 100m }, CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(invalidNameRes);

        var negativePriceRes = await saPlansCtrl.CreatePlan(new SubscriptionPlan { Name = "Bad Price", MonthlyPrice = -50m }, CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(negativePriceRes);

        var validPlanRes = await saPlansCtrl.CreatePlan(
            new SubscriptionPlan
            {
                Name = "Unlimited Enterprise",
                MonthlyPrice = 2990m,
                YearlyPrice = 29900m,
                MaxUsers = -1,
                MaxDocumentsPerMonth = -1,
                IsActive = false
            },
            CancellationToken.None);
        Assert.IsType<OkObjectResult>(validPlanRes);
        var createdPlan = await db.SubscriptionPlans.SingleAsync(p => p.Name == "Unlimited Enterprise");
        Assert.False(createdPlan.IsActive);
        var planAuditLog = await db.AuditLogs.SingleAsync(a => a.Action == "CreateSubscriptionPlan");
        Assert.Equal(tenantId, planAuditLog.TenantId);
        Assert.NotEqual(Guid.Empty, planAuditLog.TenantId);
    }
}
