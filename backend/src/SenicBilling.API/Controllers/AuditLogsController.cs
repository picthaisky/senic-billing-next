using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

/// <summary>
/// Provides tenant-scoped Audit Log exploration, filtering, and Excel export for administrators.
/// </summary>
[ApiController]
[Route("api/audit-logs")]
[Authorize(Roles = "Admin,SystemAdmin,SuperAdmin")]
public class AuditLogsController(SenicBillingDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<AuditLogPageDto>>> GetLogs(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        [FromQuery] string? search = null,
        [FromQuery] string? entityName = null,
        [FromQuery] string? action = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = BuildFilteredQuery(tenantId, search, entityName, action, fromDate, toDate);

        var totalCount = await query.CountAsync(ct);

        var todayUtcStart = DateTime.UtcNow.Date;
        var tenantScope = dbContext.AuditLogs.AsNoTracking().Where(a => a.TenantId == tenantId);
        var totalTenantLogs = await tenantScope.CountAsync(ct);
        var todayLogs = await tenantScope.CountAsync(a => a.Timestamp >= todayUtcStart, ct);
        var distinctUsers = await tenantScope.Select(a => a.Username).Distinct().CountAsync(ct);
        var latestTimestamp = await tenantScope
            .OrderByDescending(a => a.Timestamp)
            .Select(a => (DateTime?)a.Timestamp)
            .FirstOrDefaultAsync(ct);

        var items = await query
            .OrderByDescending(a => a.Timestamp)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(a => new AuditLogItemDto(
                a.Id,
                a.Username,
                a.Action,
                a.EntityName,
                a.EntityId,
                a.OldValues,
                a.NewValues,
                a.Timestamp))
            .ToListAsync(ct);

        var dto = new AuditLogPageDto(
            items,
            totalCount,
            page,
            pageSize,
            new AuditLogStatsDto(totalTenantLogs, todayLogs, distinctUsers, latestTimestamp));

        return Ok(new ApiResponse<AuditLogPageDto>(true, "สำเร็จ", dto));
    }

    [HttpGet("filters")]
    public async Task<ActionResult<ApiResponse<AuditLogFiltersDto>>> GetFilters(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var tenantScope = dbContext.AuditLogs.AsNoTracking().Where(a => a.TenantId == tenantId);

        var entityNames = await tenantScope
            .Where(a => !string.IsNullOrEmpty(a.EntityName))
            .Select(a => a.EntityName)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync(ct);

        var actions = await tenantScope
            .Where(a => !string.IsNullOrEmpty(a.Action))
            .Select(a => a.Action)
            .Distinct()
            .OrderBy(x => x)
            .ToListAsync(ct);

        return Ok(new ApiResponse<AuditLogFiltersDto>(true, "สำเร็จ", new AuditLogFiltersDto(entityNames, actions)));
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportExcel(
        [FromQuery] string? search = null,
        [FromQuery] string? entityName = null,
        [FromQuery] string? action = null,
        [FromQuery] DateTime? fromDate = null,
        [FromQuery] DateTime? toDate = null,
        CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        var rows = await BuildFilteredQuery(tenantId, search, entityName, action, fromDate, toDate)
            .OrderByDescending(a => a.Timestamp)
            .Take(5000)
            .ToListAsync(ct);

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("Audit Logs");

        var headers = new[]
        {
            "วัน-เวลา (UTC)",
            "ผู้ใช้งาน",
            "การกระทำ",
            "โมดูล/เอนทิตี",
            "รหัสอ้างอิง",
            "ข้อมูลเดิม (OldValues)",
            "ข้อมูลใหม่ (NewValues)"
        };

        for (var i = 0; i < headers.Length; i++)
        {
            var cell = ws.Cell(1, i + 1);
            cell.Value = headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromHtml("#EA580C");
            cell.Style.Font.FontColor = XLColor.White;
        }

        for (var r = 0; r < rows.Count; r++)
        {
            var log = rows[r];
            var rowIdx = r + 2;
            ws.Cell(rowIdx, 1).Value = log.Timestamp.ToString("yyyy-MM-dd HH:mm:ss");
            ws.Cell(rowIdx, 2).Value = log.Username;
            ws.Cell(rowIdx, 3).Value = log.Action;
            ws.Cell(rowIdx, 4).Value = log.EntityName;
            ws.Cell(rowIdx, 5).Value = log.EntityId;
            ws.Cell(rowIdx, 6).Value = log.OldValues ?? "";
            ws.Cell(rowIdx, 7).Value = log.NewValues ?? "";
        }

        ws.Columns().AdjustToContents(1, 50);

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        var fileName = $"audit-logs-{DateTime.UtcNow:yyyyMMdd-HHmm}.xlsx";
        return File(
            stream.ToArray(),
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            fileName);
    }

    private IQueryable<AuditLog> BuildFilteredQuery(
        Guid tenantId,
        string? search,
        string? entityName,
        string? action,
        DateTime? fromDate,
        DateTime? toDate)
    {
        var query = dbContext.AuditLogs.AsNoTracking().Where(a => a.TenantId == tenantId);

        if (!string.IsNullOrWhiteSpace(entityName))
        {
            var entityFilter = entityName.Trim();
            query = query.Where(a => a.EntityName == entityFilter);
        }

        if (!string.IsNullOrWhiteSpace(action))
        {
            var actionFilter = action.Trim();
            query = query.Where(a => a.Action == actionFilter);
        }

        if (fromDate.HasValue)
        {
            var startUtc = DateTime.SpecifyKind(fromDate.Value.Date, DateTimeKind.Utc);
            query = query.Where(a => a.Timestamp >= startUtc);
        }

        if (toDate.HasValue)
        {
            var endExclusiveUtc = DateTime.SpecifyKind(toDate.Value.Date.AddDays(1), DateTimeKind.Utc);
            query = query.Where(a => a.Timestamp < endExclusiveUtc);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(a =>
                a.Username.Contains(term) ||
                a.EntityName.Contains(term) ||
                a.EntityId.Contains(term) ||
                a.Action.Contains(term) ||
                (a.OldValues != null && a.OldValues.Contains(term)) ||
                (a.NewValues != null && a.NewValues.Contains(term)));
        }

        return query;
    }

    private Guid GetTenantId()
    {
        var claim = User.FindFirst("tenantId")?.Value;
        return claim is not null ? Guid.Parse(claim) : throw new UnauthorizedAccessException("Tenant ID claim not found");
    }
}

