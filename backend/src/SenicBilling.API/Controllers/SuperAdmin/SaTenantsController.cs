using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.API.Extensions;
using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Auth;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers.SuperAdmin;

public record AssignTenantPlanRequest(Guid PlanId);

[ApiController]
[Route("api/superadmin/tenants")]
[Authorize(Policy = "PlatformAdmin")]
public class SaTenantsController : ControllerBase
{
    private readonly SenicBillingDbContext dbContext;
    private readonly JwtTokenService jwtTokenService;
    private readonly IConfiguration? _configuration;

    public SaTenantsController(SenicBillingDbContext dbContext, JwtTokenService jwtTokenService)
        : this(dbContext, jwtTokenService, null)
    {
    }

    [Microsoft.Extensions.DependencyInjection.ActivatorUtilitiesConstructor]
    public SaTenantsController(
        SenicBillingDbContext dbContext,
        JwtTokenService jwtTokenService,
        IConfiguration? configuration)
    {
        this.dbContext = dbContext;
        this.jwtTokenService = jwtTokenService;
        _configuration = configuration;
    }
    [HttpGet]
    public async Task<IActionResult> GetAllTenants([FromQuery] string? search, CancellationToken ct)
    {
        var query = dbContext.Tenants
            .Include(t => t.CurrentPlan)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            query = query.Where(t =>
                t.CompanyName.Contains(s) ||
                (t.Email != null && t.Email.Contains(s)) ||
                (t.TaxId != null && t.TaxId.Contains(s)));
        }

        var tenants = await query
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync(ct);

        var currentYearMonth = DateTime.UtcNow.ToString("yyyy-MM");

        var userCounts = await dbContext.AppUsers
            .IgnoreQueryFilters()
            .Where(u => u.IsActive)
            .GroupBy(u => u.TenantId)
            .Select(g => new { TenantId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.TenantId, x => x.Count, ct);

        var docCounts = await dbContext.TenantUsageStats
            .AsNoTracking()
            .Where(u => u.YearMonth == currentYearMonth)
            .GroupBy(u => u.TenantId)
            .Select(g => new { TenantId = g.Key, DocumentsCreated = g.Sum(x => x.DocumentsCreated) })
            .ToDictionaryAsync(x => x.TenantId, x => x.DocumentsCreated, ct);

        var payload = tenants.Select(t => new
        {
            t.Id,
            t.CompanyName,
            t.Email,
            t.Phone,
            t.CreatedAt,
            t.IsActive,
            t.CurrentPlanId,
            CurrentPlan = t.CurrentPlan != null ? t.CurrentPlan.Name : "N/A",
            MaxUsers = t.CurrentPlan?.MaxUsers ?? -1,
            MaxDocumentsPerMonth = t.CurrentPlan?.MaxDocumentsPerMonth ?? -1,
            UserCount = userCounts.GetValueOrDefault(t.Id, 0),
            DocumentsCreatedThisMonth = docCounts.GetValueOrDefault(t.Id, 0),
            t.SubscriptionStatus,
            t.SubscriptionValidUntil
        }).ToList();

        return Ok(new { success = true, data = payload });
    }

    [HttpPut("{id}/plan")]
    public async Task<IActionResult> AssignPlan(Guid id, [FromBody] AssignTenantPlanRequest request, CancellationToken ct)
    {
        var tenant = await dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (tenant == null) return NotFound();

        var plan = await dbContext.SubscriptionPlans.FirstOrDefaultAsync(p => p.Id == request.PlanId, ct);
        if (plan == null) return BadRequest(new { success = false, message = "Plan not found" });

        tenant.CurrentPlanId = plan.Id;
        tenant.SubscriptionStatus = "Active";
        tenant.SubscriptionValidUntil = DateTime.UtcNow.AddMonths(1);
        tenant.IsActive = true;
        tenant.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(ct);
        return Ok(new { success = true, message = $"Assigned plan {plan.Name} successfully" });
    }

    [HttpPost("{id}/suspend")]
    public async Task<IActionResult> SuspendTenant(Guid id, CancellationToken ct)
    {
        var tenant = await dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (tenant == null) return NotFound();

        tenant.SubscriptionStatus = "Suspended";
        tenant.IsActive = false;
        tenant.UpdatedAt = DateTime.UtcNow;

        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Username = User.Identity?.Name ?? "SuperAdmin",
            Action = "SuspendTenant",
            EntityName = "Tenant",
            EntityId = tenant.Id.ToString(),
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(ct);

        return Ok(new { success = true, message = "Tenant suspended successfully" });
    }

    [HttpPost("{id}/activate")]
    public async Task<IActionResult> ActivateTenant(Guid id, CancellationToken ct)
    {
        var tenant = await dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (tenant == null) return NotFound();

        tenant.SubscriptionStatus = "Active";
        tenant.IsActive = true;
        tenant.UpdatedAt = DateTime.UtcNow;

        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Username = User.Identity?.Name ?? "SuperAdmin",
            Action = "ActivateTenant",
            EntityName = "Tenant",
            EntityId = tenant.Id.ToString(),
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(ct);

        return Ok(new { success = true, message = "Tenant activated successfully" });
    }

    [HttpPost("{id}/impersonate")]
    public async Task<IActionResult> ImpersonateTenant(Guid id, CancellationToken ct)
    {
        var tenant = await dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == id, ct);
        if (tenant == null)
            return NotFound(new { success = false, message = "ไม่พบองค์กร" });

        var targetUser = await dbContext.AppUsers
            .IgnoreQueryFilters()
            .Where(u => u.TenantId == id && u.IsActive)
            .OrderByDescending(u => u.Role == "Admin" ? 3 : u.Role == "Manager" ? 2 : 1)
            .ThenBy(u => u.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (targetUser == null)
            return NotFound(new { success = false, message = "ไม่พบบัญชีผู้ใช้งานที่เปิดใช้งานอยู่ในองค์กรนี้" });

        var operatorName = User.GetUsername();
        var token = jwtTokenService.GenerateToken(targetUser, tenant.CompanyName, operatorName);

        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = tenant.Id,
            Username = operatorName,
            Action = "Impersonate",
            EntityName = "Tenant",
            EntityId = tenant.Id.ToString(),
            NewValues = JsonSerializer.Serialize(new
            {
                targetUserId = targetUser.Id,
                targetUsername = targetUser.Username,
                impersonatedBy = operatorName
            }),
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(ct);

        var frontendUrl = (_configuration?["App:FrontendBaseUrl"] ?? "http://localhost:5173").Trim().TrimEnd('/');

        var result = new TenantImpersonationResultDto(
            Token: token,
            TenantId: tenant.Id,
            CompanyName: tenant.CompanyName,
            Username: targetUser.Username,
            DisplayName: targetUser.DisplayName,
            Role: targetUser.Role,
            ImpersonatedBy: operatorName,
            ExpiresAt: DateTime.UtcNow.AddHours(8),
            FrontendUrl: frontendUrl);

        return Ok(new { success = true, data = result });
    }
}
