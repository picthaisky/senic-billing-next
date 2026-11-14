using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers.SuperAdmin;

[ApiController]
[Route("api/superadmin/plans")]
[Authorize(Policy = "PlatformAdmin")]
public class SaPlansController(SenicBillingDbContext dbContext) : ControllerBase
{
    private static readonly Guid DefaultTenantId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    [HttpGet]
    public async Task<IActionResult> GetAllPlans(CancellationToken ct)
    {
        var plans = await dbContext.SubscriptionPlans
            .OrderBy(p => p.MonthlyPrice)
            .ToListAsync(ct);

        return Ok(new { success = true, data = plans });
    }

    [HttpPost]
    public async Task<IActionResult> CreatePlan([FromBody] SubscriptionPlan plan, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(plan.Name))
        {
            return BadRequest(new { success = false, message = "กรุณาระบุชื่อแพ็กเกจ" });
        }

        if (plan.MonthlyPrice < 0 || plan.YearlyPrice < 0)
        {
            return BadRequest(new { success = false, message = "ราคาแพ็กเกจต้องไม่ติดลบ" });
        }

        plan.Id = Guid.NewGuid();
        plan.Name = plan.Name.Trim();
        plan.CreatedAt = DateTime.UtcNow;

        dbContext.SubscriptionPlans.Add(plan);

        var username = User?.FindFirst(ClaimTypes.Name)?.Value ?? User?.Identity?.Name ?? "SuperAdmin";
        var auditTenantId = await ResolveAuditTenantIdAsync(ct);
        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = auditTenantId,
            Username = username,
            Action = "CreateSubscriptionPlan",
            EntityName = "SubscriptionPlan",
            EntityId = plan.Id.ToString(),
            NewValues = JsonSerializer.Serialize(new { plan.Name, plan.MonthlyPrice, plan.YearlyPrice, plan.MaxUsers, plan.MaxDocumentsPerMonth, plan.IsActive }),
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(ct);

        return Ok(new { success = true, data = plan });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdatePlan(Guid id, [FromBody] SubscriptionPlan req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Name))
        {
            return BadRequest(new { success = false, message = "กรุณาระบุชื่อแพ็กเกจ" });
        }

        if (req.MonthlyPrice < 0 || req.YearlyPrice < 0)
        {
            return BadRequest(new { success = false, message = "ราคาแพ็กเกจต้องไม่ติดลบ" });
        }

        var plan = await dbContext.SubscriptionPlans.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (plan == null) return NotFound();

        var oldValues = JsonSerializer.Serialize(new { plan.Name, plan.MonthlyPrice, plan.YearlyPrice, plan.MaxUsers, plan.MaxDocumentsPerMonth, plan.IsActive });

        plan.Name = req.Name.Trim();
        plan.MonthlyPrice = req.MonthlyPrice;
        plan.YearlyPrice = req.YearlyPrice;
        plan.MaxUsers = req.MaxUsers;
        plan.MaxDocumentsPerMonth = req.MaxDocumentsPerMonth;
        plan.Features = req.Features;
        plan.IsActive = req.IsActive;
        plan.UpdatedAt = DateTime.UtcNow;

        var username = User?.FindFirst(ClaimTypes.Name)?.Value ?? User?.Identity?.Name ?? "SuperAdmin";
        var auditTenantId = await ResolveAuditTenantIdAsync(ct);
        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = auditTenantId,
            Username = username,
            Action = "UpdateSubscriptionPlan",
            EntityName = "SubscriptionPlan",
            EntityId = plan.Id.ToString(),
            OldValues = oldValues,
            NewValues = JsonSerializer.Serialize(new { plan.Name, plan.MonthlyPrice, plan.YearlyPrice, plan.MaxUsers, plan.MaxDocumentsPerMonth, plan.IsActive }),
            Timestamp = DateTime.UtcNow
        });

        await dbContext.SaveChangesAsync(ct);

        return Ok(new { success = true, data = plan });
    }

    private async Task<Guid> ResolveAuditTenantIdAsync(CancellationToken ct)
    {
        var claimValue = User?.FindFirst("tenantId")?.Value;
        if (Guid.TryParse(claimValue, out var claimTenantId) &&
            claimTenantId != Guid.Empty &&
            await dbContext.Tenants.AsNoTracking().AnyAsync(t => t.Id == claimTenantId, ct))
        {
            return claimTenantId;
        }

        if (await dbContext.Tenants.AsNoTracking().AnyAsync(t => t.Id == DefaultTenantId, ct))
        {
            return DefaultTenantId;
        }

        var firstTenantId = await dbContext.Tenants.AsNoTracking()
            .OrderBy(t => t.CreatedAt)
            .Select(t => t.Id)
            .FirstOrDefaultAsync(ct);

        return firstTenantId != Guid.Empty ? firstTenantId : DefaultTenantId;
    }
}
