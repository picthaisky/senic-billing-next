using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers.SuperAdmin;

[ApiController]
[Route("api/superadmin/plans")]
// [Authorize(Roles = "SuperAdmin")] // Uncomment when SuperAdmin role is implemented securely
public class SaPlansController(SenicBillingDbContext dbContext) : ControllerBase
{
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
        plan.Id = Guid.NewGuid();
        plan.CreatedAt = DateTime.UtcNow;
        plan.IsActive = true;

        dbContext.SubscriptionPlans.Add(plan);
        await dbContext.SaveChangesAsync(ct);

        return Ok(new { success = true, data = plan });
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdatePlan(Guid id, [FromBody] SubscriptionPlan req, CancellationToken ct)
    {
        var plan = await dbContext.SubscriptionPlans.FirstOrDefaultAsync(p => p.Id == id, ct);
        if (plan == null) return NotFound();

        plan.Name = req.Name;
        plan.MonthlyPrice = req.MonthlyPrice;
        plan.YearlyPrice = req.YearlyPrice;
        plan.MaxUsers = req.MaxUsers;
        plan.MaxDocumentsPerMonth = req.MaxDocumentsPerMonth;
        plan.Features = req.Features;
        plan.IsActive = req.IsActive;
        plan.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(ct);

        return Ok(new { success = true, data = plan });
    }
}
