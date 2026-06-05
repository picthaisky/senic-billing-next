using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Enums;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

public record ChatRequest(string Message);
public record ChatResponse(string Reply);

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AIAssistantController(
    SenicBillingDbContext dbContext,
    IAIAssistantService aiService) : ControllerBase
{
    [HttpPost("chat")]
    public async Task<ActionResult<ApiResponse<ChatResponse>>> Chat([FromBody] ChatRequest req, CancellationToken ct)
    {
        var tenantIdString = User.FindFirst("tenantId")?.Value;
        if (!Guid.TryParse(tenantIdString, out var tenantId))
            return Unauthorized();

        // Build Context
        var now = DateTime.UtcNow;
        var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var thisMonthRevenue = await dbContext.DocumentHeaders
            .Where(d => d.TenantId == tenantId && d.Status == DocumentStatus.Issued && d.DocumentType != DocumentType.Quotation && d.DocumentDate >= startOfMonth)
            .SumAsync(d => (decimal?)d.GrandTotal, ct) ?? 0;

        var overdueDocs = await dbContext.DocumentHeaders
            .Where(d => d.TenantId == tenantId && d.Status == DocumentStatus.Overdue)
            .Select(d => new { d.DocumentNumber, d.CustomerName, d.GrandTotal })
            .ToListAsync(ct);

        var recentDocs = await dbContext.DocumentHeaders
            .Where(d => d.TenantId == tenantId)
            .OrderByDescending(d => d.CreatedAt)
            .Take(5)
            .Select(d => new { d.DocumentNumber, d.Status, d.GrandTotal })
            .ToListAsync(ct);

        var contextBuilder = new System.Text.StringBuilder();
        contextBuilder.AppendLine($"[สรุปยอดขายเดือนนี้]: {thisMonthRevenue:N2} บาท");
        contextBuilder.AppendLine($"[รายการค้างชำระ ({overdueDocs.Count} รายการ)]:");
        foreach (var doc in overdueDocs.Take(10)) // limit to 10 for context size
        {
            contextBuilder.AppendLine($"- เอกสาร {doc.DocumentNumber} (ลูกค้า: {doc.CustomerName}), ยอด: {doc.GrandTotal:N2} บาท");
        }
        contextBuilder.AppendLine($"[เอกสาร 5 รายการล่าสุด]:");
        foreach (var doc in recentDocs)
        {
            contextBuilder.AppendLine($"- เอกสาร {doc.DocumentNumber}, สถานะ: {doc.Status}, ยอด: {doc.GrandTotal:N2} บาท");
        }

        var context = contextBuilder.ToString();

        // Call AI
        var reply = await aiService.ChatAsync(req.Message, context, ct);

        return Ok(new ApiResponse<ChatResponse>(true, "สำเร็จ", new ChatResponse(reply)));
    }
}
