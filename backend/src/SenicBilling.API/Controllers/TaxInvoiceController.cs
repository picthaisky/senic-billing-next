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
/// RESTful API Controller for Tax Invoice (ใบกำกับภาษี) management.
/// Enforces strict data integrity: only Draft documents can be edited,
/// cancellation requires a reason (Credit Note reference).
/// </summary>
[ApiController]
[Route("api/tax-invoices")]
[Authorize]
public class TaxInvoiceController(
    SenicBillingDbContext dbContext,
    IDocumentNumberGeneratorService numberGenerator) : ControllerBase
{
    /// <summary>Get paginated list of tax invoices</summary>
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PaginatedResponse<DocumentResponse>>>> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] DocumentStatus? status = null,
        CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        var query = dbContext.DocumentHeaders
            .Where(d => d.TenantId == tenantId && d.DocumentType == DocumentType.TaxInvoice);

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

    /// <summary>Get a single tax invoice by ID</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<DocumentResponse>>> GetById(Guid id, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var doc = await dbContext.DocumentHeaders
            .Include(d => d.Lines.OrderBy(l => l.SortOrder))
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId && d.DocumentType == DocumentType.TaxInvoice, ct);

        if (doc is null)
            return NotFound(new ApiResponse<DocumentResponse>(false, "ไม่พบใบกำกับภาษี", null));

        return Ok(new ApiResponse<DocumentResponse>(true, "สำเร็จ", MapToResponse(doc)));
    }

    /// <summary>Create a new tax invoice</summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<DocumentResponse>>> Create(
        [FromBody] CreateDocumentRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();

        // Validate Tax ID for Tax Invoice
        if (!string.IsNullOrEmpty(request.CustomerTaxId) && request.CustomerTaxId.Length != 13)
        {
            return BadRequest(new ApiResponse<DocumentResponse>(
                false, "เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก", null));
        }

        // Generate sequential document number
        var docNumber = await numberGenerator.GenerateNextNumberAsync(tenantId, DocumentType.TaxInvoice, ct);

        var header = new DocumentHeader
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            DocumentType = DocumentType.TaxInvoice,
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
            CreatedBy = User.Identity?.Name
        };

        // Add lines and calculate totals
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

        // Calculate totals
        CalculateTotals(header);

        dbContext.DocumentHeaders.Add(header);
        await dbContext.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = header.Id },
            new ApiResponse<DocumentResponse>(true, "สร้างใบกำกับภาษีสำเร็จ", MapToResponse(header)));
    }

    /// <summary>Update a draft tax invoice</summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<DocumentResponse>>> Update(
        Guid id, [FromBody] UpdateDocumentRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var doc = await dbContext.DocumentHeaders
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId && d.DocumentType == DocumentType.TaxInvoice, ct);

        if (doc is null)
            return NotFound(new ApiResponse<DocumentResponse>(false, "ไม่พบใบกำกับภาษี", null));

        if (doc.Status != DocumentStatus.Draft)
            return BadRequest(new ApiResponse<DocumentResponse>(false, "แก้ไขได้เฉพาะเอกสารสถานะ 'ร่าง' เท่านั้น", null));

        // Update header
        doc.DocumentDate = request.DocumentDate;
        doc.DueDate = request.DueDate;
        doc.CustomerId = request.CustomerId;
        doc.CustomerName = request.CustomerName;
        doc.CustomerAddress = request.CustomerAddress;
        doc.CustomerTaxId = request.CustomerTaxId;
        doc.VatMode = request.VatMode;
        doc.VatRate = request.VatRate;
        doc.DiscountAmount = request.DiscountAmount;
        doc.Notes = request.Notes;
        doc.UpdatedAt = DateTime.UtcNow;

        // Replace lines
        dbContext.DocumentLines.RemoveRange(doc.Lines);
        doc.Lines.Clear();

        int sortOrder = 1;
        foreach (var lineDto in request.Lines)
        {
            var lineTotal = (lineDto.Quantity * lineDto.UnitPrice) - lineDto.DiscountAmount;
            doc.Lines.Add(new DocumentLine
            {
                Id = Guid.NewGuid(),
                DocumentHeaderId = doc.Id,
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

        CalculateTotals(doc);
        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<DocumentResponse>(true, "อัปเดตใบกำกับภาษีสำเร็จ", MapToResponse(doc)));
    }

    /// <summary>Cancel a tax invoice (requires reason — acts as Credit Note reference)</summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<DocumentResponse>>> Cancel(
        Guid id, [FromBody] CancelDocumentRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var doc = await dbContext.DocumentHeaders
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId && d.DocumentType == DocumentType.TaxInvoice, ct);

        if (doc is null)
            return NotFound(new ApiResponse<DocumentResponse>(false, "ไม่พบใบกำกับภาษี", null));

        if (doc.Status == DocumentStatus.Cancelled)
            return BadRequest(new ApiResponse<DocumentResponse>(false, "เอกสารนี้ถูกยกเลิกไปแล้ว", null));

        doc.Status = DocumentStatus.Cancelled;
        doc.CancellationReason = request.Reason;
        doc.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<DocumentResponse>(true, "ยกเลิกใบกำกับภาษีสำเร็จ", MapToResponse(doc)));
    }

    // ──────────────────────────────────────────────
    // Private Helpers
    // ──────────────────────────────────────────────

    private static void CalculateTotals(DocumentHeader doc)
    {
        doc.Subtotal = doc.Lines.Sum(l => l.LineTotal);
        doc.TotalBeforeVat = doc.Subtotal - doc.DiscountAmount;

        if (doc.VatMode == VatCalculationMode.Exclusive)
        {
            // ราคาแยกภาษี: VAT added on top
            doc.VatAmount = Math.Round(doc.TotalBeforeVat * doc.VatRate / 100m, 2);
            doc.GrandTotal = doc.TotalBeforeVat + doc.VatAmount;
        }
        else
        {
            // ราคารวมภาษี: VAT extracted from total
            doc.GrandTotal = doc.TotalBeforeVat;
            doc.VatAmount = Math.Round(doc.TotalBeforeVat * doc.VatRate / (100m + doc.VatRate), 2);
            doc.TotalBeforeVat = doc.GrandTotal - doc.VatAmount;
        }

        // ภาษีหัก ณ ที่จ่าย (WHT) — applied against TotalBeforeVat
        doc.WhtAmount = doc.WhtRate > 0
            ? Math.Round(doc.TotalBeforeVat * doc.WhtRate / 100m, 2)
            : 0m;
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

    private Guid GetTenantId()
    {
        var claim = User.FindFirst("tenantId")?.Value;
        return claim is not null ? Guid.Parse(claim) : throw new UnauthorizedAccessException();
    }
}
