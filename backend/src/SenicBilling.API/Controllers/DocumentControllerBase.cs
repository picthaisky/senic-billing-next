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
/// Abstract generic document controller for various document types.
/// Provides CRUD operations with document-type-specific behavior.
/// </summary>
[Authorize]
public abstract class DocumentControllerBase(
    SenicBillingDbContext dbContext,
    IDocumentNumberGeneratorService numberGenerator) : ControllerBase
{
    protected abstract DocumentType TargetDocumentType { get; }

    /// <summary>Get paginated list of documents</summary>
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
            .Where(d => d.TenantId == tenantId && d.DocumentType == TargetDocumentType);

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
        return Ok(new ApiResponse<PaginatedResponse<DocumentResponse>>(true, "เธชเธณเน€เธฃเนเธ", result));
    }

    /// <summary>Get a single document by ID</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<DocumentResponse>>> GetById(Guid id, CancellationToken ct)
    {
        var tenantIdString = User.FindFirst("tenantId")?.Value;
        if (!Guid.TryParse(tenantIdString, out var tenantId))
            return Unauthorized();

        var doc = await dbContext.DocumentHeaders
            .Include(d => d.Lines.OrderBy(l => l.SortOrder))
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId && d.DocumentType == TargetDocumentType, ct);

        if (doc is null) return NotFound(new ApiResponse<DocumentResponse>(false, "เนเธกเนเธเธเน€เธญเธเธชเธฒเธฃ", null));

        return Ok(new ApiResponse<DocumentResponse>(true, "เธชเธณเน€เธฃเนเธ", MapToResponse(doc)));
    }

    /// <summary>Public endpoint for Read-Receipt tracking (Customer opens the link)</summary>
    [HttpGet("{id:guid}/view-receipt")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<bool>>> MarkAsViewed(Guid id, CancellationToken ct)
    {
        var doc = await dbContext.DocumentHeaders.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (doc is null) return NotFound(new ApiResponse<bool>(false, "เนเธกเนเธเธเน€เธญเธเธชเธฒเธฃ", false));

        if (doc.ViewedAt == null)
        {
            doc.ViewedAt = DateTime.UtcNow;
            if (doc.Status == DocumentStatus.Issued || doc.Status == DocumentStatus.Sent)
            {
                doc.Status = DocumentStatus.Viewed;
            }
            await dbContext.SaveChangesAsync(ct);
        }

        return Ok(new ApiResponse<bool>(true, "เธเธฑเธเธ—เธถเธเธเธฒเธฃเน€เธเธดเธ”เธญเนเธฒเธเธชเธณเน€เธฃเนเธ", true));
    }

    /// <summary>Create a new document</summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<DocumentResponse>>> Create(
        [FromBody] CreateDocumentRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();

        var docNumber = await numberGenerator.GenerateNextNumberAsync(tenantId, TargetDocumentType, ct);

        var header = new DocumentHeader
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            DocumentType = TargetDocumentType,
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
            WhtRate = request.WhtRate,
            Notes = request.Notes,
            ReferenceDocumentId = request.ReferenceDocumentId,
            DeliveryStatus = request.DeliveryStatus ?? (TargetDocumentType == DocumentType.DeliveryNote ? "รอส่ง" : null),
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

        if (TargetDocumentType == DocumentType.DeliveryNote || TargetDocumentType == DocumentType.TaxInvoice)
        {
            await DeductStockAsync(header.Lines, tenantId, ct);
        }

        dbContext.DocumentHeaders.Add(header);
        await dbContext.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = header.Id },
            new ApiResponse<DocumentResponse>(true, "สร้างเอกสารสำเร็จ", MapToResponse(header)));
    }

    /// <summary>Update delivery status</summary>
    [HttpPatch("{id:guid}/delivery-status")]
    public async Task<ActionResult<ApiResponse<DocumentResponse>>> UpdateDeliveryStatus(
        Guid id, [FromBody] string deliveryStatus, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var doc = await dbContext.DocumentHeaders
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId && d.DocumentType == TargetDocumentType, ct);

        if (doc is null)
            return NotFound(new ApiResponse<DocumentResponse>(false, "ไม่พบเอกสาร", null));

        doc.DeliveryStatus = deliveryStatus;
        doc.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<DocumentResponse>(true, "อัปเดตสถานะการส่งสำเร็จ", MapToResponse(doc)));
    }

    /// <summary>Update a draft document</summary>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<DocumentResponse>>> Update(
        Guid id, [FromBody] UpdateDocumentRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var doc = await dbContext.DocumentHeaders
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId && d.DocumentType == TargetDocumentType, ct);

        if (doc is null)
            return NotFound(new ApiResponse<DocumentResponse>(false, "ไม่พบเอกสาร", null));

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

        return Ok(new ApiResponse<DocumentResponse>(true, "อัปเดตเอกสารสำเร็จ", MapToResponse(doc)));
    }

    /// <summary>Cancel a document</summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<DocumentResponse>>> Cancel(
        Guid id, [FromBody] CancelDocumentRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var doc = await dbContext.DocumentHeaders
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId && d.DocumentType == TargetDocumentType, ct);

        if (doc is null)
            return NotFound(new ApiResponse<DocumentResponse>(false, "ไม่พบเอกสาร", null));

        if (doc.Status == DocumentStatus.Cancelled)
            return BadRequest(new ApiResponse<DocumentResponse>(false, "เอกสารนี้ถูกยกเลิกไปแล้ว", null));

        doc.Status = DocumentStatus.Cancelled;
        doc.CancellationReason = request.Reason;
        doc.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<DocumentResponse>(true, "ยกเลิกเอกสารสำเร็จ", MapToResponse(doc)));
    }

    /// <summary>1-Click Convert: convert a document to another type</summary>
    [HttpPost("{id:guid}/convert")]
    public async Task<ActionResult<ApiResponse<DocumentResponse>>> ConvertDocument(
        Guid id, [FromBody] ConvertDocumentRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var source = await dbContext.DocumentHeaders
            .Include(d => d.Lines.OrderBy(l => l.SortOrder))
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId && d.DocumentType == TargetDocumentType, ct);

        if (source is null)
            return NotFound(new ApiResponse<DocumentResponse>(false, "ไม่พบเอกสารต้นทาง", null));

        if (source.Status == DocumentStatus.Cancelled)
            return BadRequest(new ApiResponse<DocumentResponse>(false, "ไม่สามารถแปลงเอกสารที่ยกเลิกแล้ว", null));

        // Prevent converting to same type
        if (source.DocumentType == request.TargetType)
            return BadRequest(new ApiResponse<DocumentResponse>(false, "เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เนเธเธฅเธเน€เธเนเธเธเธฃเธฐเน€เธ เธ—เน€เธ”เธตเธขเธงเธเธฑเธ", null));

        // Tax Invoice should use its dedicated controller
        if (request.TargetType == DocumentType.TaxInvoice)
        {
            // Generate via TaxInvoice numbering
            var docNumber = await numberGenerator.GenerateNextNumberAsync(tenantId, DocumentType.TaxInvoice, ct);
            var newDoc = CloneToNewDocument(source, DocumentType.TaxInvoice, docNumber, tenantId, request);
            
            bool shouldDeductStock = source.DocumentType != DocumentType.DeliveryNote && source.DocumentType != DocumentType.TaxInvoice;
            if (shouldDeductStock)
            {
                await DeductStockAsync(newDoc.Lines, tenantId, ct);
            }

            dbContext.DocumentHeaders.Add(newDoc);
            await dbContext.SaveChangesAsync(ct);
            return CreatedAtAction(nameof(GetById), new { id = newDoc.Id },
                new ApiResponse<DocumentResponse>(true, "เนเธเธฅเธเน€เธญเธเธชเธฒเธฃเน€เธเนเธเนเธเธเธณเธเธฑเธเธ เธฒเธฉเธตเธชเธณเน€เธฃเนเธ", MapToResponse(newDoc)));
        }

        var targetDocNumber = await numberGenerator.GenerateNextNumberAsync(tenantId, request.TargetType, ct);
        var converted = CloneToNewDocument(source, request.TargetType, targetDocNumber, tenantId, request);
        
        bool deductInConverted = (request.TargetType == DocumentType.DeliveryNote || request.TargetType == DocumentType.TaxInvoice) &&
                                 (source.DocumentType != DocumentType.DeliveryNote && source.DocumentType != DocumentType.TaxInvoice);
        if (deductInConverted)
        {
            await DeductStockAsync(converted.Lines, tenantId, ct);
        }

        dbContext.DocumentHeaders.Add(converted);
        await dbContext.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = converted.Id },
            new ApiResponse<DocumentResponse>(true, "เนเธเธฅเธเน€เธญเธเธชเธฒเธฃเธชเธณเน€เธฃเนเธ", MapToResponse(converted)));
    }

    /// <summary>Create a Credit Note or Debit Note referencing a source document</summary>
    [HttpPost("credit-debit-note")]
    public async Task<ActionResult<ApiResponse<DocumentResponse>>> CreateCreditDebitNote(
        [FromBody] CreateCreditDebitNoteRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();

        if (request.NoteType != DocumentType.CreditNote && request.NoteType != DocumentType.DebitNote)
            return BadRequest(new ApiResponse<DocumentResponse>(false, "เธเธฃเธฐเน€เธ เธ—เน€เธญเธเธชเธฒเธฃเธ•เนเธญเธเน€เธเนเธเนเธเธฅเธ”เธซเธเธตเนเธซเธฃเธทเธญเนเธเน€เธเธดเนเธกเธซเธเธตเนเน€เธ—เนเธฒเธเธฑเนเธ", null));

        var sourceDoc = await dbContext.DocumentHeaders
            .FirstOrDefaultAsync(d => d.Id == request.SourceDocumentId && d.TenantId == tenantId, ct);

        if (sourceDoc is null)
            return NotFound(new ApiResponse<DocumentResponse>(false, "เนเธกเนเธเธเน€เธญเธเธชเธฒเธฃเธ•เนเธเธ—เธฒเธ", null));

        if (sourceDoc.Status == DocumentStatus.Cancelled)
            return BadRequest(new ApiResponse<DocumentResponse>(false, "เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธญเธญเธเนเธเธฅเธ”เธซเธเธตเน/เน€เธเธดเนเธกเธซเธเธตเนเธเธฒเธเน€เธญเธเธชเธฒเธฃเธ—เธตเนเธขเธเน€เธฅเธดเธเนเธฅเนเธง", null));

        var docNumber = await numberGenerator.GenerateNextNumberAsync(tenantId, request.NoteType, ct);

        var header = new DocumentHeader
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            DocumentType = request.NoteType,
            DocumentNumber = docNumber,
            DocumentDate = request.DocumentDate,
            CustomerId = sourceDoc.CustomerId,
            CustomerName = sourceDoc.CustomerName,
            CustomerAddress = sourceDoc.CustomerAddress,
            CustomerTaxId = sourceDoc.CustomerTaxId,
            Status = DocumentStatus.Issued,
            VatMode = request.VatMode,
            VatRate = request.VatRate,
            WhtRate = request.WhtRate,
            Notes = request.Reason,
            ReferenceDocumentId = request.SourceDocumentId,
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

        var noteLabel = request.NoteType == DocumentType.CreditNote ? "เนเธเธฅเธ”เธซเธเธตเน" : "เนเธเน€เธเธดเนเธกเธซเธเธตเน";
        return CreatedAtAction(nameof(GetById), new { id = header.Id },
            new ApiResponse<DocumentResponse>(true, $"เธชเธฃเนเธฒเธ{noteLabel}เธชเธณเน€เธฃเนเธ", MapToResponse(header)));
    }

    // โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€
    // Private Helpers
    // โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€โ”€

    private static DocumentHeader CloneToNewDocument(
        DocumentHeader source, DocumentType targetType, string docNumber,
        Guid tenantId, ConvertDocumentRequest request)
    {
        var newDoc = new DocumentHeader
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            DocumentType = targetType,
            DocumentNumber = docNumber,
            DocumentDate = request.DocumentDate ?? DateTime.UtcNow,
            DueDate = request.DueDate,
            CustomerId = source.CustomerId,
            CustomerName = source.CustomerName,
            CustomerAddress = source.CustomerAddress,
            CustomerTaxId = source.CustomerTaxId,
            Status = DocumentStatus.Issued,
            VatMode = source.VatMode,
            VatRate = source.VatRate,
            WhtRate = source.WhtRate,
            DiscountAmount = source.DiscountAmount,
            Notes = request.Notes ?? source.Notes,
            ReferenceDocumentId = source.ReferenceDocumentId,
            ConvertedFromDocumentId = source.Id,
            DeliveryStatus = targetType == DocumentType.DeliveryNote ? "เธฃเธญเธชเนเธ" : null
        };

        int sortOrder = 1;
        foreach (var line in source.Lines)
        {
            newDoc.Lines.Add(new DocumentLine
            {
                Id = Guid.NewGuid(),
                DocumentHeaderId = newDoc.Id,
                SortOrder = sortOrder++,
                ProductId = line.ProductId,
                Description = line.Description,
                Quantity = line.Quantity,
                Unit = line.Unit,
                UnitPrice = line.UnitPrice,
                DiscountAmount = line.DiscountAmount,
                LineTotal = line.LineTotal
            });
        }

        CalculateTotals(newDoc);
        return newDoc;
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

        // เธ เธฒเธฉเธตเธซเธฑเธ เธ“ เธ—เธตเนเธเนเธฒเธข (WHT) โ€” applied against TotalBeforeVat
        doc.WhtAmount = doc.WhtRate > 0
            ? Math.Round(doc.TotalBeforeVat * doc.WhtRate / 100m, 2)
            : 0m;
    }

    private async Task DeductStockAsync(ICollection<DocumentLine> lines, Guid tenantId, CancellationToken ct)
    {
        var productIds = lines.Where(l => l.ProductId.HasValue).Select(l => l.ProductId!.Value).Distinct().ToList();
        if (!productIds.Any()) return;

        var products = await dbContext.Products
            .Where(p => p.TenantId == tenantId && productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);

        foreach (var line in lines)
        {
            if (line.ProductId.HasValue && products.TryGetValue(line.ProductId.Value, out var product))
            {
                if (product.StockQuantity.HasValue)
                {
                    product.StockQuantity -= line.Quantity;
                }
            }
        }
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
