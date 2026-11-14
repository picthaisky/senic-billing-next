using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.API.Controllers;
using SenicBilling.API.Extensions;
using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Auth;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.Tests;

public class Phase16SecurityRbacAndQuotaTests
{
    private static SenicBillingDbContext CreateDbContext(string dbName)
    {
        var options = new DbContextOptionsBuilder<SenicBillingDbContext>()
            .UseInMemoryDatabase(databaseName: dbName)
            .Options;
        return new SenicBillingDbContext(options);
    }

    private static ControllerContext CreateAuthContext(Guid tenantId, Guid userId, string role, string claimKey = "id")
    {
        var claims = new List<Claim>
        {
            new("tenantId", tenantId.ToString()),
            new(claimKey, userId.ToString()),
            new(ClaimTypes.Role, role)
        };

        return new ControllerContext
        {
            HttpContext = new DefaultHttpContext
            {
                User = new ClaimsPrincipal(new ClaimsIdentity(claims, "Test"))
            }
        };
    }

    [Fact]
    public async Task AdminUsersAndTenantUsers_ShouldBlockPrivilegeEscalation_ToSuperAdminOrSystemAdmin()
    {
        await using var db = CreateDbContext(nameof(AdminUsersAndTenantUsers_ShouldBlockPrivilegeEscalation_ToSuperAdminOrSystemAdmin));
        var tenantId = Guid.NewGuid();
        var callerId = Guid.NewGuid();
        var targetUserId = Guid.NewGuid();

        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            CompanyName = "Regular Customer Tenant",
            IsActive = true
        });
        db.AppUsers.AddRange(
            new AppUser
            {
                Id = callerId,
                TenantId = tenantId,
                Username = "tenant_admin",
                DisplayName = "Tenant Admin",
                PasswordHash = PasswordHasher.HashPassword("pass"),
                Role = "Admin",
                IsActive = true
            },
            new AppUser
            {
                Id = targetUserId,
                TenantId = tenantId,
                Username = "staff1",
                DisplayName = "Staff 1",
                PasswordHash = PasswordHasher.HashPassword("pass"),
                Role = "User",
                IsActive = true
            });
        await db.SaveChangesAsync();

        var adminUsersCtrl = new AdminUsersController(db)
        {
            ControllerContext = CreateAuthContext(tenantId, callerId, "Admin")
        };

        var createSuperAdminRes = await adminUsersCtrl.CreateUser(
            new CreateUserRequest("hacker", "Hacker", "h@test.co", "pass1234", "SuperAdmin"),
            CancellationToken.None);
        Assert.IsType<ForbidResult>(createSuperAdminRes.Result);

        var promoteSystemAdminRes = await adminUsersCtrl.UpdateUser(
            targetUserId,
            new UpdateUserRequest("Staff 1", "s@test.co", null, "SystemAdmin"),
            CancellationToken.None);
        Assert.IsType<ForbidResult>(promoteSystemAdminRes.Result);

        var tenantUsersCtrl = new TenantUsersController(db)
        {
            ControllerContext = CreateAuthContext(tenantId, callerId, "Admin")
        };

        var inviteSuperAdminRes = await tenantUsersCtrl.InviteUser(
            new RegisterRequest("hacker2", "pass1234", "Hacker 2", "h2@test.co", "SuperAdmin"),
            CancellationToken.None);
        Assert.IsType<ForbidResult>(inviteSuperAdminRes);

        var updateRoleSuperAdminRes = await tenantUsersCtrl.UpdateRole(
            targetUserId,
            new UpdateRoleRequest { Role = "SuperAdmin" },
            CancellationToken.None);
        Assert.IsType<ForbidResult>(updateRoleSuperAdminRes);
    }

    [Fact]
    public async Task AdminUsersController_ToggleUserStatus_ShouldEnforceMaxUsersQuota_OnReactivation()
    {
        await using var db = CreateDbContext(nameof(AdminUsersController_ToggleUserStatus_ShouldEnforceMaxUsersQuota_OnReactivation));
        var planId = Guid.NewGuid();
        var tenantId = Guid.NewGuid();
        var adminId = Guid.NewGuid();
        var activeStaffId = Guid.NewGuid();
        var disabledStaffId = Guid.NewGuid();

        db.SubscriptionPlans.Add(new SubscriptionPlan
        {
            Id = planId,
            Name = "Starter 2 Users",
            MaxUsers = 2,
            MaxDocumentsPerMonth = 100,
            IsActive = true
        });
        db.Tenants.Add(new Tenant
        {
            Id = tenantId,
            CompanyName = "Quota Check Co.",
            CurrentPlanId = planId,
            IsActive = true
        });
        db.AppUsers.AddRange(
            new AppUser
            {
                Id = adminId,
                TenantId = tenantId,
                Username = "admin_q",
                DisplayName = "Admin Q",
                PasswordHash = PasswordHasher.HashPassword("pass"),
                Role = "Admin",
                IsActive = true
            },
            new AppUser
            {
                Id = activeStaffId,
                TenantId = tenantId,
                Username = "staff_active",
                DisplayName = "Active Staff",
                PasswordHash = PasswordHasher.HashPassword("pass"),
                Role = "User",
                IsActive = true
            },
            new AppUser
            {
                Id = disabledStaffId,
                TenantId = tenantId,
                Username = "staff_disabled",
                DisplayName = "Disabled Staff",
                PasswordHash = PasswordHasher.HashPassword("pass"),
                Role = "User",
                IsActive = false
            });
        await db.SaveChangesAsync();

        var controller = new AdminUsersController(db)
        {
            ControllerContext = CreateAuthContext(tenantId, adminId, "Admin")
        };

        // Re-enabling disabledStaffId when 2 active users already exist must fail with BadRequest
        var overQuotaRes = await controller.ToggleUserStatus(
            disabledStaffId,
            new ToggleStatusRequest(true),
            CancellationToken.None);
        Assert.IsType<BadRequestObjectResult>(overQuotaRes.Result);

        // Disabling activeStaffId first frees 1 slot, allowing disabledStaffId to be re-enabled
        var disableActiveRes = await controller.ToggleUserStatus(
            activeStaffId,
            new ToggleStatusRequest(false),
            CancellationToken.None);
        Assert.IsType<OkObjectResult>(disableActiveRes.Result);

        var enableDisabledRes = await controller.ToggleUserStatus(
            disabledStaffId,
            new ToggleStatusRequest(true),
            CancellationToken.None);
        Assert.IsType<OkObjectResult>(enableDisabledRes.Result);
    }

    [Fact]
    public async Task UserController_ShouldResolveSubClaim_AndEnforceTenantIsolation()
    {
        await using var db = CreateDbContext(nameof(UserController_ShouldResolveSubClaim_AndEnforceTenantIsolation));
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var userA = Guid.NewGuid();

        db.AppUsers.Add(new AppUser
        {
            Id = userA,
            TenantId = tenantA,
            Username = "alice",
            DisplayName = "Alice A",
            Email = "alice@a.co",
            PasswordHash = PasswordHasher.HashPassword("OldPass123!"),
            Role = "Admin",
            IsActive = true
        });
        await db.SaveChangesAsync();

        // 1. Valid tenant + "sub" claim works
        var validCtrl = new UserController(db)
        {
            ControllerContext = CreateAuthContext(tenantA, userA, "Admin", claimKey: JwtRegisteredClaimNames.Sub)
        };
        var profileRes = Assert.IsType<OkObjectResult>((await validCtrl.GetProfile(CancellationToken.None)).Result);
        var profileEnv = Assert.IsType<ApiResponse<UserProfileDto>>(profileRes.Value);
        Assert.Equal("Alice A", profileEnv.Data?.DisplayName);

        // 2. Mismatched tenant claim is rejected (NotFound) even if userId exists in DB
        var crossTenantCtrl = new UserController(db)
        {
            ControllerContext = CreateAuthContext(tenantB, userA, "Admin", claimKey: JwtRegisteredClaimNames.Sub)
        };
        Assert.IsType<NotFoundObjectResult>((await crossTenantCtrl.GetProfile(CancellationToken.None)).Result);
        Assert.IsType<NotFoundObjectResult>((await crossTenantCtrl.UpdateProfile(
            new UpdateProfileRequest("Hacked", "hacked@b.co"),
            CancellationToken.None)).Result);
    }

    [Fact]
    public async Task AdminRolesController_ShouldForbidSavingReservedPlatformRoles_ForCustomerTenantAdmin()
    {
        await using var db = CreateDbContext(nameof(AdminRolesController_ShouldForbidSavingReservedPlatformRoles_ForCustomerTenantAdmin));
        var tenantId = Guid.NewGuid();
        var callerId = Guid.NewGuid();

        var ctrl = new AdminRolesController(db)
        {
            ControllerContext = CreateAuthContext(tenantId, callerId, "Admin")
        };

        var forbidRes = await ctrl.SaveRolePermissions(
            new SaveRolePermissionsRequest("SuperAdmin", [Guid.NewGuid()]),
            CancellationToken.None);
        Assert.IsType<ForbidResult>(forbidRes.Result);

        var okRes = await ctrl.SaveRolePermissions(
            new SaveRolePermissionsRequest("Manager", []),
            CancellationToken.None);
        Assert.IsType<OkObjectResult>(okRes.Result);
    }
}

