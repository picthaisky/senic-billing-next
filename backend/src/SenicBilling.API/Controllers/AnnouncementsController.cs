using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

/// <summary>
/// Exposes active platform-wide announcements to authenticated SME tenant users.
/// </summary>
[ApiController]
[Route("api/announcements")]
[Authorize]
public class AnnouncementsController(SenicBillingDbContext dbContext) : ControllerBase
{
    [HttpGet("active")]
    public async Task<ActionResult<ApiResponse<List<PlatformAnnouncementDto>>>> GetActive(CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var items = await dbContext.PlatformAnnouncements
            .AsNoTracking()
            .Where(a =>
                a.IsActive &&
                (a.StartsAt == null || a.StartsAt <= now) &&
                (a.EndsAt == null || a.EndsAt >= now))
            .OrderByDescending(a => a.CreatedAt)
            .Select(a => new PlatformAnnouncementDto(
                a.Id,
                a.Title,
                a.Message,
                a.Severity,
                a.IsActive,
                a.StartsAt,
                a.EndsAt,
                a.CreatedBy,
                a.CreatedAt,
                a.UpdatedAt))
            .ToListAsync(ct);

        return Ok(new ApiResponse<List<PlatformAnnouncementDto>>(true, "สำเร็จ", items));
    }
}

