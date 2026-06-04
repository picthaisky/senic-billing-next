using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Domain.Interfaces;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

/// <summary>
/// Generic document controller for Receipt, CashBill, DeliveryNote, and Quotation.
/// Provides CRUD operations with document-type-specific behavior.
/// </summary>
[ApiController]
[Route("api/documents")]
[Authorize]
public class DocumentController(
    SenicBillingDbContext dbContext,
    IDocumentNumberGeneratorService numberGenerator) : ControllerBase
{
    /// <summary>Get paginated list of documents by type</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PaginatedResponse<DocumentResponse>>>> GetAll(
        [FromQuery] DocumentType type,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] DocumentStatus? status = null,
        CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        var query = dbContext.DocumentHeaders
            .Where(d => d.TenantId == tenantId && d.DocumentType == type);

        if (status.HasValue)
            query = query.Where(d => d.Status == status.Value);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(d =>
                d.DocumentNumber.Contains(search) ||
                (d.CustomerName != null && d.CustomerName.Contains(search)));

        var totalCount = await query.CountAsync(ct);

        var items = await query
            .OrderByDescending(d => d.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Include(d => d.Lines)
            .Select(d => MapToResponse(d))
            .ToListAsync(ct);

        var result = new PaginatedResponse<DocumentResponse>(items, totalCount, page, pageSize);
        return Ok(new ApiResponse<PaginatedResponse<DocumentResponse>>(true, "สำเร็จ", result));
    }

    /// <summary>Get a single document by ID</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<DocumentResponse>>> GetById(Guid id, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var doc = await dbContext.DocumentHeaders
            .Include(d => d.Lines.OrderBy(l => l.SortOrder))
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId, ct);

        if (doc is null)
            return NotFound(new ApiResponse<DocumentResponse>(false, "ไม่พบเอกสาร", null));

        return Ok(new ApiResponse<DocumentResponse>(true, "สำเร็จ", MapToResponse(doc)));
    }

    /// <summary>Create a new document (Receipt, CashBill, DeliveryNote, or Quotation)</summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<DocumentResponse>>> Create(
        [FromBody] CreateDocumentRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();

        // Tax Invoice should use its dedicated controller
        if (request.DocumentType == DocumentType.TaxInvoice)
            return BadRequest(new ApiResponse<DocumentResponse>(false, "กรุณาใช้ /api/tax-invoices สำหรับใบกำกับภาษี", null));

        var docNumber = await numberGenerator.GenerateNextNumberAsync(tenantId, request.DocumentType, ct);

        var header = new DocumentHeader
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            DocumentType = request.DocumentType,
            DocumentNumber = docNumber,
            DocumentDate = request.DocumentDate,
            DueDate = request.DueDate,
            CustomerId = request.CustomerId,
            CustomerName = request.CustomerName,
            CustomerAddress = request.CustomerAddress,
            CustomerTaxId = request.CustomerTaxId,
            Status = DocumentStatus.Issued,
            VatMode = request.VatMode,
            VatRate = request.VatRate,
            DiscountAmount = request.DiscountAmount,
            Notes = request.Notes,
            ReferenceDocumentId = request.ReferenceDocumentId,
            DeliveryStatus = request.DeliveryStatus ?? (request.DocumentType == DocumentType.DeliveryNote ? "รอส่ง" : null),
            CreatedBy = User.Identity?.Name
        };

        int sortOrder = 1;
        foreach (var lineDto in request.Lines)
        {
            var lineTotal = (lineDto.Quantity * lineDto.UnitPrice) - lineDto.DiscountAmount;
            header.Lines.Add(new DocumentLine
            {
                Id = Guid.NewGuid(),
                DocumentHeaderId = header.Id,
                SortOrder = sortOrder++,
                ProductId = lineDto.ProductId,
                Description = lineDto.Description,
                Quantity = lineDto.Quantity,
                Unit = lineDto.Unit,
                UnitPrice = lineDto.UnitPrice,
                DiscountAmount = lineDto.DiscountAmount,
                LineTotal = lineTotal
            });
        }

        CalculateTotals(header);

        dbContext.DocumentHeaders.Add(header);
        await dbContext.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = header.Id },
            new ApiResponse<DocumentResponse>(true, "สร้างเอกสารสำเร็จ", MapToResponse(header)));
    }

    /// <summary>Update delivery status (DeliveryNote only)</summary>
    [HttpPatch("{id:guid}/delivery-status")]
    public async Task<ActionResult<ApiResponse<DocumentResponse>>> UpdateDeliveryStatus(
        Guid id, [FromBody] string deliveryStatus, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var doc = await dbContext.DocumentHeaders
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId && d.DocumentType == DocumentType.DeliveryNote, ct);

        if (doc is null)
            return NotFound(new ApiResponse<DocumentResponse>(false, "ไม่พบใบส่งของ", null));

        doc.DeliveryStatus = deliveryStatus;
        doc.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<DocumentResponse>(true, "อัปเดตสถานะการส่งสำเร็จ", MapToResponse(doc)));
    }

    private static void CalculateTotals(DocumentHeader doc)
    {
        doc.Subtotal = doc.Lines.Sum(l => l.LineTotal);
        doc.TotalBeforeVat = doc.Subtotal - doc.DiscountAmount;

        if (doc.VatMode == VatCalculationMode.Exclusive)
        {
            doc.VatAmount = Math.Round(doc.TotalBeforeVat * doc.VatRate / 100m, 2);
            doc.GrandTotal = doc.TotalBeforeVat + doc.VatAmount;
        }
        else
        {
            doc.GrandTotal = doc.TotalBeforeVat;
            doc.VatAmount = Math.Round(doc.TotalBeforeVat * doc.VatRate / (100m + doc.VatRate), 2);
            doc.TotalBeforeVat = doc.GrandTotal - doc.VatAmount;
        }
    }

    private static DocumentResponse MapToResponse(DocumentHeader d) => new(
        d.Id, d.DocumentType, d.DocumentNumber, d.DocumentDate, d.DueDate,
        d.CustomerId, d.CustomerName, d.CustomerAddress, d.CustomerTaxId,
        d.Status, d.VatMode, d.VatRate,
        d.Subtotal, d.DiscountAmount, d.TotalBeforeVat, d.VatAmount, d.GrandTotal,
        d.Notes, d.ReferenceDocumentId, d.DeliveryStatus, d.CancellationReason,
        d.CreatedAt, d.CreatedBy,
        d.Lines.OrderBy(l => l.SortOrder).Select(l => new DocumentLineDto(
            l.Id, l.SortOrder, l.ProductId, l.Description,
            l.Quantity, l.Unit, l.UnitPrice, l.DiscountAmount, l.LineTotal
        )).ToList()
    );

    private Guid GetTenantId()
    {
        var claim = User.FindFirst("tenantId")?.Value;
        return claim is not null ? Guid.Parse(claim) : throw new UnauthorizedAccessException();
    }
}
