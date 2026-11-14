using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers.SuperAdmin;

[ApiController]
[Route("api/superadmin/announcements")]
[Authorize(Policy = "PlatformAdmin")]
public class SaAnnouncementsController(SenicBillingDbContext dbContext) : ControllerBase
{
    private static readonly HashSet<string> AllowedSeverities = ["Info", "Warning", "Critical"];

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var list = await dbContext.PlatformAnnouncements
            .AsNoTracking()
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

        return Ok(new { success = true, data = list });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertAnnouncementRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { success = false, message = "กรุณาระบุหัวข้อและข้อความประกาศ" });

        var severity = AllowedSeverities.Contains(request.Severity) ? request.Severity : "Info";
        var entity = new PlatformAnnouncement
        {
            Id = Guid.NewGuid(),
            Title = request.Title.Trim(),
            Message = request.Message.Trim(),
            Severity = severity,
            IsActive = request.IsActive,
            StartsAt = NormalizeUtc(request.StartsAt),
            EndsAt = NormalizeUtc(request.EndsAt),
            CreatedBy = User.Identity?.Name ?? "SuperAdmin",
            CreatedAt = DateTime.UtcNow
        };

        dbContext.PlatformAnnouncements.Add(entity);
        await dbContext.SaveChangesAsync(ct);

        return Ok(new { success = true, data = ToDto(entity) });
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertAnnouncementRequest request, CancellationToken ct)
    {
        var entity = await dbContext.PlatformAnnouncements.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (entity is null)
            return NotFound(new { success = false, message = "ไม่พบประกาศ" });

        if (string.IsNullOrWhiteSpace(request.Title) || string.IsNullOrWhiteSpace(request.Message))
            return BadRequest(new { success = false, message = "กรุณาระบุหัวข้อและข้อความประกาศ" });

        entity.Title = request.Title.Trim();
        entity.Message = request.Message.Trim();
        entity.Severity = AllowedSeverities.Contains(request.Severity) ? request.Severity : "Info";
        entity.IsActive = request.IsActive;
        entity.StartsAt = NormalizeUtc(request.StartsAt);
        entity.EndsAt = NormalizeUtc(request.EndsAt);
        entity.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(ct);
        return Ok(new { success = true, data = ToDto(entity) });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var entity = await dbContext.PlatformAnnouncements.FirstOrDefaultAsync(a => a.Id == id, ct);
        if (entity is null)
            return NotFound(new { success = false, message = "ไม่พบประกาศ" });

        dbContext.PlatformAnnouncements.Remove(entity);
        await dbContext.SaveChangesAsync(ct);
        return Ok(new { success = true, message = "ลบประกาศสำเร็จ" });
    }

    private static DateTime? NormalizeUtc(DateTime? dt)
    {
        if (!dt.HasValue) return null;
        return dt.Value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(dt.Value, DateTimeKind.Utc)
            : dt.Value.ToUniversalTime();
    }

    private static PlatformAnnouncementDto ToDto(PlatformAnnouncement a) =>
        new(a.Id, a.Title, a.Message, a.Severity, a.IsActive, a.StartsAt, a.EndsAt, a.CreatedBy, a.CreatedAt, a.UpdatedAt);
}

