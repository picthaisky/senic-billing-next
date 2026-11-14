using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using ClosedXML.Excel;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using SenicBilling.API.Controllers;
using SenicBilling.API.Controllers.SuperAdmin;
using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Auth;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.Tests;

public class Phase12EnterpriseOperationsTests
{
    private static SenicBillingDbContext CreateDbContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<SenicBillingDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;
        return new SenicBillingDbContext(options);
    }

    private static JwtTokenService CreateJwtService()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["JwtSettings:SecretKey"] = "SenicBillingNext-SuperSecret-TestKey-AtLeast32Chars!",
                ["JwtSettings:Issuer"] = "SenicBillingNext",
                ["JwtSettings:Audience"] = "SenicBillingNextClient",
                ["JwtSettings:ExpiryMinutes"] = "480"
            })
            .Build();
        return new JwtTokenService(config);
    }

    private static void SetUserContext(ControllerBase controller, Guid tenantId, string username = "tester", string role = "Admin")
    {
        var claims = new[]
        {
            new Claim("tenantId", tenantId.ToString()),
            new Claim(ClaimTypes.Name, username),
            new Claim(ClaimTypes.Role, role),
            new Claim("role", role)
        };
        controller.ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "TestAuth"))
            }
        };
    }

    [Fact]
    public async Task AuthLogin_ShouldBlockSuspendedTenantUsers_AndAllowActiveTenants()
    {
        await using var db = CreateDbContext(nameof(AuthLogin_ShouldBlockSuspendedTenantUsers_AndAllowActiveTenants));
        var activeTenantId = Guid.NewGuid();
        var suspendedTenantId = Guid.NewGuid();

        db.Tenants.AddRange(
            new Tenant { Id = activeTenantId, CompanyName = "Active Co.", IsActive = true, SubscriptionStatus = "Active" },
            new Tenant { Id = suspendedTenantId, CompanyName = "Suspended Co.", IsActive = false, SubscriptionStatus = "Suspended" }
        );

        db.AppUsers.AddRange(
            new AppUser
            {
                Id = Guid.NewGuid(),
                TenantId = activeTenantId,
                Username = "active_user",
                DisplayName = "Active User",
                PasswordHash = PasswordHasher.HashPassword("pass1234"),
                Role = "Admin",
                IsActive = true
            },
            new AppUser
            {
                Id = Guid.NewGuid(),
                TenantId = suspendedTenantId,
                Username = "suspended_user",
                DisplayName = "Suspended User",
                PasswordHash = PasswordHasher.HashPassword("pass1234"),
                Role = "Admin",
                IsActive = true
            }
        );
        await db.SaveChangesAsync();

        var controller = new AuthController(db, CreateJwtService());

        var blockedResult = await controller.Login(new LoginRequest("suspended_user", "pass1234"), CancellationToken.None);
        var forbiddenObj = Assert.IsType<ObjectResult>(blockedResult.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, forbiddenObj.StatusCode);

        var allowedResult = await controller.Login(new LoginRequest("active_user", "pass1234"), CancellationToken.None);
        var okObj = Assert.IsType<OkObjectResult>(allowedResult.Result);
        var payload = Assert.IsType<ApiResponse<LoginResponse>>(okObj.Value);
        Assert.True(payload.Success);
        Assert.False(string.IsNullOrEmpty(payload.Data?.Token));
    }

    [Fact]
    public async Task AuditLogsController_ShouldIsolateTenants_Filter_AndExportValidExcel()
    {
        await using var db = CreateDbContext(nameof(AuditLogsController_ShouldIsolateTenants_Filter_AndExportValidExcel));
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        db.AuditLogs.AddRange(
            new AuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenantA,
                Username = "alice",
                Action = "Update",
                EntityName = "DocumentHeader",
                EntityId = "DOC-A-001",
                OldValues = "{\"status\":\"Draft\"}",
                NewValues = "{\"status\":\"Issued\"}",
                Timestamp = DateTime.UtcNow
            },
            new AuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenantA,
                Username = "bob",
                Action = "LockPeriod",
                EntityName = "AccountingPeriodLock",
                EntityId = "2026-10",
                Timestamp = DateTime.UtcNow.AddDays(-2)
            },
            new AuditLog
            {
                Id = Guid.NewGuid(),
                TenantId = tenantB,
                Username = "mallory",
                Action = "Delete",
                EntityName = "Customer",
                EntityId = "CUST-B-999",
                Timestamp = DateTime.UtcNow
            }
        );
        await db.SaveChangesAsync();

        var controller = new AuditLogsController(db);
        SetUserContext(controller, tenantA, "alice", "Admin");

        var listRes = await controller.GetLogs(
            page: 1,
            pageSize: 25,
            search: "Issued",
            entityName: "DocumentHeader",
            action: "Update",
            ct: CancellationToken.None);

        var okList = Assert.IsType<OkObjectResult>(listRes.Result);
        var pageDto = Assert.IsType<ApiResponse<AuditLogPageDto>>(okList.Value).Data!;
        Assert.Equal(1, pageDto.TotalCount);
        Assert.Single(pageDto.Items);
        Assert.Equal("DOC-A-001", pageDto.Items[0].EntityId);
        Assert.Equal(2, pageDto.Stats.TotalLogs); // Never leaks Tenant B's log

        var filtersRes = await controller.GetFilters(CancellationToken.None);
        var filtersDto = Assert.IsType<ApiResponse<AuditLogFiltersDto>>(Assert.IsType<OkObjectResult>(filtersRes.Result).Value).Data!;
        Assert.DoesNotContain("Customer", filtersDto.EntityNames);
        Assert.Contains("DocumentHeader", filtersDto.EntityNames);

        var excelResult = await controller.ExportExcel(search: null, entityName: null, action: null, ct: CancellationToken.None);
        var fileResult = Assert.IsType<FileContentResult>(excelResult);
        Assert.Equal("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileResult.ContentType);
        Assert.True(fileResult.FileContents.Length > 100);
        Assert.Equal((byte)'P', fileResult.FileContents[0]);
        Assert.Equal((byte)'K', fileResult.FileContents[1]);

        using var ms = new MemoryStream(fileResult.FileContents);
        using var wb = new XLWorkbook(ms);
        var ws = wb.Worksheet("Audit Logs");
        Assert.Equal("วัน-เวลา (UTC)", ws.Cell(1, 1).GetString());
        Assert.Equal("alice", ws.Cell(2, 2).GetString());
    }

    [Fact]
    public async Task SaTenantsController_ShouldReturnUsageStats_AndImpersonateWithAuditLog()
    {
        await using var db = CreateDbContext(nameof(SaTenantsController_ShouldReturnUsageStats_AndImpersonateWithAuditLog));
        var planId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var adminUserId = Guid.NewGuid();

        db.SubscriptionPlans.Add(new SubscriptionPlan
        {
            Id = planId,
            Name = "Starter SME",
            MonthlyPrice = 390,
            YearlyPrice = 3900,
            MaxUsers = 5,
            MaxDocumentsPerMonth = 200,
            IsActive = true
        });
        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            CompanyName = "Siam Retail Co., Ltd.",
            CurrentPlanId = planId,
            IsActive = true,
            SubscriptionStatus = "Active"
        });
        db.AppUsers.AddRange(
            new AppUser
            {
                Id = adminUserId,
                TenantId = tenantId,
                Username = "owner",
                DisplayName = "Owner Siam",
                Role = "Admin",
                IsActive = true,
                PasswordHash = "x"
            },
            new AppUser
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                Username = "staff1",
                DisplayName = "Staff One",
                Role = "User",
                IsActive = true,
                PasswordHash = "x"
            }
        );
        db.TenantUsageStats.Add(new TenantUsageStat
        {
            TenantId = tenantId,
            YearMonth = DateTime.UtcNow.ToString("yyyy-MM"),
            DocumentsCreated = 27
        });
        await db.SaveChangesAsync();

        var controller = new SaTenantsController(db, CreateJwtService());
        SetUserContext(controller, tenantId, "superadmin", "SuperAdmin");

        var listRes = await controller.GetAllTenants(search: "Siam", CancellationToken.None);
        var okList = Assert.IsType<OkObjectResult>(listRes);
        var json = JsonDocument.Parse(JsonSerializer.Serialize(okList.Value));
        var tenantEl = json.RootElement.GetProperty("data")[0];
        Assert.Equal(2, tenantEl.GetProperty("UserCount").GetInt32());
        Assert.Equal(27, tenantEl.GetProperty("DocumentsCreatedThisMonth").GetInt32());
        Assert.Equal(5, tenantEl.GetProperty("MaxUsers").GetInt32());
        Assert.Equal(200, tenantEl.GetProperty("MaxDocumentsPerMonth").GetInt32());

        var impRes = await controller.ImpersonateTenant(tenantId, CancellationToken.None);
        var okImp = Assert.IsType<OkObjectResult>(impRes);
        var impJson = JsonDocument.Parse(JsonSerializer.Serialize(okImp.Value));
        var tokenStr = impJson.RootElement.GetProperty("data").GetProperty("Token").GetString()!;
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(tokenStr);

        Assert.Equal(tenantId.ToString(), jwt.Claims.First(c => c.Type == "tenantId").Value);
        Assert.Equal("superadmin", jwt.Claims.First(c => c.Type == "impersonatedBy").Value);

        var auditLog = await db.AuditLogs.FirstOrDefaultAsync(a => a.TenantId == tenantId && a.Action == "Impersonate");
        Assert.NotNull(auditLog);
        Assert.Contains("owner", auditLog.NewValues);
    }

    [Fact]
    public async Task Announcements_ShouldFilterByActiveAndScheduleWindow()
    {
        await using var db = CreateDbContext(nameof(Announcements_ShouldFilterByActiveAndScheduleWindow));
        var tenantId = Guid.NewGuid();

        var saController = new SaAnnouncementsController(db);
        SetUserContext(saController, tenantId, "superadmin", "SuperAdmin");

        await saController.Create(new UpsertAnnouncementRequest(
            Title: "แจ้งปิดปรับปรุงระบบคืนนี้",
            Message: "เวลา 02:00-02:30 น.",
            Severity: "Warning",
            IsActive: true,
            StartsAt: DateTime.UtcNow.AddHours(-1),
            EndsAt: DateTime.UtcNow.AddHours(2)), CancellationToken.None);

        await saController.Create(new UpsertAnnouncementRequest(
            Title: "ประกาศที่ปิดอยู่",
            Message: "hidden",
            Severity: "Info",
            IsActive: false), CancellationToken.None);

        await saController.Create(new UpsertAnnouncementRequest(
            Title: "ประกาศหมดอายุ",
            Message: "expired",
            Severity: "Critical",
            IsActive: true,
            StartsAt: DateTime.UtcNow.AddDays(-5),
            EndsAt: DateTime.UtcNow.AddDays(-1)), CancellationToken.None);

        var publicController = new AnnouncementsController(db);
        SetUserContext(publicController, tenantId, "user", "User");

        var activeRes = await publicController.GetActive(CancellationToken.None);
        var okActive = Assert.IsType<OkObjectResult>(activeRes.Result);
        var items = Assert.IsType<ApiResponse<List<PlatformAnnouncementDto>>>(okActive.Value).Data!;

        Assert.Single(items);
        Assert.Equal("แจ้งปิดปรับปรุงระบบคืนนี้", items[0].Title);
        Assert.Equal("Warning", items[0].Severity);
    }
}

