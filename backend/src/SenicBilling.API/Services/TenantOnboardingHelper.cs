using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Auth;
using SenicBilling.Infrastructure.Data;
using SenicBilling.Infrastructure.Services;

namespace SenicBilling.API.Services;

public static class TenantOnboardingHelper
{
    public record ProvisionResult(bool Success, string Message, Tenant? Tenant = null, AppUser? AdminUser = null);

    public static async Task<ProvisionResult> ProvisionTenantAsync(
        SenicBillingDbContext dbContext,
        IAccountingService? accountingService,
        string companyName,
        string? taxId,
        string? email,
        string? phone,
        string? address,
        string? branchName,
        string adminUsername,
        string adminPassword,
        string? adminDisplayName,
        Guid? planId,
        string auditActor,
        string auditAction,
        Guid? auditTenantId,
        CancellationToken ct = default)
    {
        var trimmedCompany = companyName.Trim();
        var trimmedUsername = adminUsername.Trim();

        if (string.IsNullOrWhiteSpace(trimmedCompany))
            return new ProvisionResult(false, "กรุณาระบุชื่อบริษัท / องค์กร");

        if (string.IsNullOrWhiteSpace(trimmedUsername) || trimmedUsername.Length < 3)
            return new ProvisionResult(false, "ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร");

        if (string.IsNullOrWhiteSpace(adminPassword) || adminPassword.Length < 6)
            return new ProvisionResult(false, "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");

        var normalizedLower = trimmedUsername.ToLowerInvariant();
        var usernameExists = await dbContext.AppUsers
            .IgnoreQueryFilters()
            .AnyAsync(u => u.Username.ToLower() == normalizedLower, ct);

        if (usernameExists)
            return new ProvisionResult(false, $"ชื่อผู้ใช้ \"{trimmedUsername}\" ถูกใช้งานแล้ว กรุณาใช้ชื่ออื่น");

        SubscriptionPlan? plan = null;
        if (planId.HasValue && planId.Value != Guid.Empty)
        {
            plan = await dbContext.SubscriptionPlans.FirstOrDefaultAsync(p => p.Id == planId.Value, ct);
        }

        plan ??= await dbContext.SubscriptionPlans
            .Where(p => p.IsActive)
            .OrderBy(p => p.MonthlyPrice)
            .FirstOrDefaultAsync(ct);

        var now = DateTime.UtcNow;
        var tenant = new Tenant
        {
            Id = Guid.NewGuid(),
            CompanyName = trimmedCompany,
            TaxId = string.IsNullOrWhiteSpace(taxId) ? null : taxId.Trim(),
            Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim(),
            Phone = string.IsNullOrWhiteSpace(phone) ? null : phone.Trim(),
            Address = string.IsNullOrWhiteSpace(address) ? null : address.Trim(),
            BranchName = string.IsNullOrWhiteSpace(branchName) ? "สำนักงานใหญ่" : branchName.Trim(),
            CurrentPlanId = plan?.Id,
            SubscriptionStatus = "Active",
            SubscriptionValidUntil = now.AddDays(30),
            IsActive = true,
            CreatedAt = now
        };

        dbContext.Tenants.Add(tenant);

        var warehouse = new Warehouse
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Code = "WH-MAIN",
            Name = "คลังสินค้าหลัก",
            Address = tenant.Address,
            IsDefault = true,
            IsActive = true,
            CreatedAt = now
        };
        dbContext.Warehouses.Add(warehouse);

        var adminUser = new AppUser
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Username = trimmedUsername,
            DisplayName = string.IsNullOrWhiteSpace(adminDisplayName) ? trimmedCompany : adminDisplayName.Trim(),
            Email = tenant.Email,
            PasswordHash = PasswordHasher.HashPassword(adminPassword),
            Role = "Admin",
            IsActive = true,
            CreatedAt = now
        };
        dbContext.AppUsers.Add(adminUser);

        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = auditTenantId ?? tenant.Id,
            Username = auditActor,
            Action = auditAction,
            EntityName = "Tenant",
            EntityId = tenant.Id.ToString(),
            NewValues = System.Text.Json.JsonSerializer.Serialize(new
            {
                tenant.CompanyName,
                AdminUsername = adminUser.Username,
                PlanId = tenant.CurrentPlanId
            }),
            Timestamp = now
        });

        await dbContext.SaveChangesAsync(ct);

        var effectiveAccounting = accountingService
            ?? new AccountingService(dbContext, new DocumentNumberGeneratorService(dbContext));
        await effectiveAccounting.EnsureDefaultChartOfAccountsAsync(tenant.Id, ct);

        return new ProvisionResult(true, "สร้างองค์กรสำเร็จ", tenant, adminUser);
    }
}
