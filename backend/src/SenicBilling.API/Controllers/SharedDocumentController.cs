using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Infrastructure.Data;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;

namespace SenicBilling.API.Controllers;

/// <summary>
/// A shared controller for fetching and tracking ANY document by its unique ID,
/// without knowing its specific document type.
/// </summary>
[Authorize]
[Route("api/documents")]
[ApiController]
public class SharedDocumentController(SenicBillingDbContext dbContext) : ControllerBase
{
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<DocumentResponse>>> GetById(Guid id, CancellationToken ct)
    {
        var tenantIdString = User.FindFirst("tenantId")?.Value;
        if (!Guid.TryParse(tenantIdString, out var tenantId))
            return Unauthorized();

        var doc = await dbContext.DocumentHeaders
            .Include(d => d.Lines.OrderBy(l => l.SortOrder))
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId, ct);

        if (doc is null) return NotFound(new ApiResponse<DocumentResponse>(false, "ไม่พบเอกสาร", null));

        return Ok(new ApiResponse<DocumentResponse>(true, "สำเร็จ", MapToResponse(doc)));
    }

    [HttpGet("{id:guid}/view-receipt")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<bool>>> MarkAsViewed(Guid id, CancellationToken ct)
    {
        var doc = await dbContext.DocumentHeaders.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (doc is null) return NotFound(new ApiResponse<bool>(false, "ไม่พบเอกสาร", false));

        if (doc.ViewedAt == null)
        {
            doc.ViewedAt = DateTime.UtcNow;
            if (doc.Status == DocumentStatus.Issued || doc.Status == DocumentStatus.Sent)
            {
                doc.Status = DocumentStatus.Viewed;
            }
            await dbContext.SaveChangesAsync(ct);
        }

        return Ok(new ApiResponse<bool>(true, "บันทึกการเปิดอ่านสำเร็จ", true));
    }

    [HttpGet("{id:guid}/history")]
    public async Task<ActionResult<ApiResponse<List<AuditLog>>>> GetHistory(Guid id, CancellationToken ct)
    {
        var tenantIdString = User.FindFirst("tenantId")?.Value;
        if (!Guid.TryParse(tenantIdString, out var tenantId))
            return Unauthorized();

        // Get audit logs for the document header and its lines
        var logs = await dbContext.Set<AuditLog>()
            .Where(a => a.TenantId == tenantId && 
                        (a.EntityId == id.ToString() || 
                         (a.EntityName == "DocumentLine" && a.NewValues!.Contains(id.ToString()))))
            .OrderByDescending(a => a.Timestamp)
            .ToListAsync(ct);

        // We can just return the logs directly, but maybe we should format them?
        // Let's just return the raw logs for the UI to parse.
        // Wait, for simplicity, we'll just filter by EntityId == id.ToString() for the DocumentHeader.
        // The lines might have different IDs. Let's just fetch DocumentHeader logs for now to keep it clean.
        var headerLogs = await dbContext.Set<AuditLog>()
            .Where(a => a.TenantId == tenantId && a.EntityId == id.ToString() && a.EntityName == "DocumentHeader")
            .OrderByDescending(a => a.Timestamp)
            .ToListAsync(ct);

        return Ok(new ApiResponse<List<AuditLog>>(true, "สำเร็จ", headerLogs));
    }

    private static DocumentResponse MapToResponse(DocumentHeader d) => new(
        d.Id, d.DocumentType, d.DocumentNumber, d.DocumentDate, d.DueDate,
        d.CustomerId, d.CustomerName, d.CustomerAddress, d.CustomerTaxId,
        d.Status, d.VatMode, d.VatRate,
        d.Subtotal, d.DiscountAmount, d.TotalBeforeVat, d.VatAmount,
        d.WhtRate, d.WhtAmount, d.GrandTotal,
        d.Notes, d.ReferenceDocumentId, d.ConvertedFromDocumentId,
        d.DeliveryStatus, d.CancellationReason,
        d.SentAt, d.ViewedAt, d.CreatedAt, d.CreatedBy,
        d.Lines.OrderBy(l => l.SortOrder).Select(l => new DocumentLineDto(
            l.Id, l.SortOrder, l.ProductId, l.Description,
            l.Quantity, l.Unit, l.UnitPrice, l.DiscountAmount, l.LineTotal
        )).ToList()
    );
}
