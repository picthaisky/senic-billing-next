using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Interfaces;
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

    protected static bool IsStockAffecting(DocumentType type) =>
        type is DocumentType.DeliveryNote or DocumentType.TaxInvoice or DocumentType.CashBill;

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
        return Ok(new ApiResponse<PaginatedResponse<DocumentResponse>>(true, "สำเร็จ", result));
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

        if (doc is null) return NotFound(new ApiResponse<DocumentResponse>(false, "ไม่พบเอกสาร", null));

        return Ok(new ApiResponse<DocumentResponse>(true, "สำเร็จ", MapToResponse(doc)));
    }

    /// <summary>Public endpoint for Read-Receipt tracking (Customer opens the link)</summary>
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

    /// <summary>Create a new document</summary>
    [HttpPost]
    public async Task<ActionResult<ApiResponse<DocumentResponse>>> Create(
        [FromBody] CreateDocumentRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();

        var tenant = await dbContext.Tenants
            .Include(t => t.CurrentPlan)
            .FirstOrDefaultAsync(t => t.Id == tenantId, ct);

        if (tenant != null)
        {
            if (!tenant.IsActive || tenant.SubscriptionStatus == "Suspended")
                return BadRequest(new ApiResponse<DocumentResponse>(false, "บัญชีองค์กรถูกระงับการใช้งานชั่วคราว กรุณาติดต่อผู้ดูแลระบบ", null));

            if (tenant.CurrentPlan != null && tenant.CurrentPlan.MaxDocumentsPerMonth > 0)
            {
                var now = DateTime.UtcNow;
                var monthlyDocs = await dbContext.DocumentHeaders.CountAsync(
                    d => d.TenantId == tenantId &&
                         d.Status != DocumentStatus.Cancelled &&
                         d.CreatedAt.Year == now.Year &&
                         d.CreatedAt.Month == now.Month, ct);

                if (monthlyDocs >= tenant.CurrentPlan.MaxDocumentsPerMonth)
                {
                    return BadRequest(new ApiResponse<DocumentResponse>(
                        false,
                        $"จำนวนเอกสารเดือนนี้ครบโควต้าของแพ็กเกจ {tenant.CurrentPlan.Name} ({tenant.CurrentPlan.MaxDocumentsPerMonth} ฉบับ/เดือน) กรุณาอัปเกรดแพ็กเกจ",
                        null));
                }
            }
        }

        var accountingPrecheck = HttpContext?.RequestServices?.GetService<IAccountingService>();
        if (accountingPrecheck is not null &&
            TargetDocumentType is not (DocumentType.Quotation or DocumentType.DeliveryNote) &&
            await accountingPrecheck.IsPeriodLockedAsync(tenantId, request.DocumentDate, ct))
        {
            return BadRequest(new ApiResponse<DocumentResponse>(
                false,
                $"งวดบัญชี {request.DocumentDate.Month:D2}/{request.DocumentDate.Year} ถูกปิดงวดแล้ว ไม่สามารถสร้างเอกสารในงวดนี้ได้",
                null));
        }

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
            CustomerBranch = request.CustomerBranch,
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

        if (IsStockAffecting(TargetDocumentType))
        {
            await DeductStockAsync(header.Lines, tenantId, ct, header.DocumentNumber);
        }

        dbContext.DocumentHeaders.Add(header);

        var yearMonth = DateTime.UtcNow.ToString("yyyy-MM");
        var usageStat = await dbContext.TenantUsageStats
            .FirstOrDefaultAsync(u => u.TenantId == tenantId && u.YearMonth == yearMonth, ct);
        if (usageStat == null)
        {
            dbContext.TenantUsageStats.Add(new TenantUsageStat
            {
                TenantId = tenantId,
                YearMonth = yearMonth,
                DocumentsCreated = 1
            });
        }
        else
        {
            usageStat.DocumentsCreated += 1;
        }

        await dbContext.SaveChangesAsync(ct);

        var accounting = HttpContext?.RequestServices?.GetService<IAccountingService>();
        if (accounting is not null)
        {
            await accounting.PostSalesDocumentAsync(header, header.CreatedBy, ct);
        }

        if (tenant != null && tenant.HasAnyLineChannel())
        {
            var lineService = HttpContext?.RequestServices.GetService<ILineNotifyService>();
            if (lineService != null)
            {
                _ = lineService.NotifyTenantAsync(
                    tenant,
                    $"\nออกเอกสารใหม่: {header.DocumentNumber}\nลูกค้า: {header.CustomerName}\nยอดสุทธิ: {header.GrandTotal:N2} บาท");
            }
        }

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

    /// <summary>Mark a non-draft/non-cancelled sales document as paid manually and post AR settlement journal entry</summary>
    [HttpPatch("{id:guid}/mark-paid")]
    public async Task<ActionResult<ApiResponse<DocumentResponse>>> MarkAsPaid(Guid id, CancellationToken ct)
    {
        if (TargetDocumentType is DocumentType.Quotation or DocumentType.DeliveryNote or DocumentType.CreditNote)
            return BadRequest(new ApiResponse<DocumentResponse>(false, "เอกสารประเภทนี้ไม่รองรับการบันทึกชำระเงิน", null));

        var tenantId = GetTenantId();
        var doc = await dbContext.DocumentHeaders
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId && d.DocumentType == TargetDocumentType, ct);

        if (doc is null)
            return NotFound(new ApiResponse<DocumentResponse>(false, "ไม่พบเอกสาร", null));

        if (doc.Status == DocumentStatus.Cancelled)
            return BadRequest(new ApiResponse<DocumentResponse>(false, "ไม่สามารถชำระเงินเอกสารที่ยกเลิกแล้ว", null));

        if (doc.Status == DocumentStatus.Draft)
            return BadRequest(new ApiResponse<DocumentResponse>(false, "กรุณาออกเอกสารก่อนบันทึกการรับชำระเงิน", null));

        if (doc.Status == DocumentStatus.Paid)
            return Ok(new ApiResponse<DocumentResponse>(true, "เอกสารถูกบันทึกชำระแล้ว", MapToResponse(doc)));

        doc.Status = DocumentStatus.Paid;
        doc.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);

        var accounting = HttpContext?.RequestServices?.GetService<IAccountingService>();
        if (accounting is not null)
        {
            await accounting.PostPaymentAsync(doc, doc.GrandTotal, User?.Identity?.Name, ct);
        }

        return Ok(new ApiResponse<DocumentResponse>(true, "บันทึกการชำระเงินสำเร็จ", MapToResponse(doc)));
    }

    /// <summary>Update a document (reconciles stock when stock-affecting)</summary>
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

        var userRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        bool isAdmin = userRole == "Admin" || userRole == "SystemAdmin";

        if (!isAdmin && doc.Status != DocumentStatus.Draft)
            return BadRequest(new ApiResponse<DocumentResponse>(false, "แก้ไขได้เฉพาะเอกสารสถานะ 'ร่าง' เท่านั้น", null));

        var accountingPrecheck = HttpContext?.RequestServices?.GetService<IAccountingService>();
        if (accountingPrecheck is not null &&
            TargetDocumentType is not (DocumentType.Quotation or DocumentType.DeliveryNote) &&
            (await accountingPrecheck.IsPeriodLockedAsync(tenantId, doc.DocumentDate, ct) ||
             await accountingPrecheck.IsPeriodLockedAsync(tenantId, request.DocumentDate, ct)))
        {
            return BadRequest(new ApiResponse<DocumentResponse>(false, "ไม่สามารถแก้ไขเอกสารในงวดบัญชีที่ปิดงวดแล้วได้", null));
        }

        // Restore previous stock before replacing lines
        if (IsStockAffecting(TargetDocumentType) && doc.Status != DocumentStatus.Cancelled)
        {
            await RestoreStockAsync(doc.Lines, tenantId, ct, doc.DocumentNumber);
        }

        // Update header
        doc.DocumentDate = request.DocumentDate;
        doc.DueDate = request.DueDate;
        doc.CustomerId = request.CustomerId;
        doc.CustomerName = request.CustomerName;
        doc.CustomerAddress = request.CustomerAddress;
        doc.CustomerBranch = request.CustomerBranch;
        doc.CustomerTaxId = request.CustomerTaxId;
        doc.VatMode = request.VatMode;
        doc.VatRate = request.VatRate;
        doc.DiscountAmount = request.DiscountAmount;
        doc.WhtRate = request.WhtRate;
        doc.Notes = request.Notes;
        doc.UpdatedAt = DateTime.UtcNow;

        // Replace lines
        dbContext.DocumentLines.RemoveRange(doc.Lines);
        doc.Lines.Clear();

        int sortOrder = 1;
        foreach (var lineDto in request.Lines)
        {
            var lineTotal = (lineDto.Quantity * lineDto.UnitPrice) - lineDto.DiscountAmount;
            var newLine = new DocumentLine
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
            };
            dbContext.DocumentLines.Add(newLine);
        }

        // Deduct new stock quantities
        if (IsStockAffecting(TargetDocumentType) && doc.Status != DocumentStatus.Cancelled)
        {
            await DeductStockAsync(doc.Lines, tenantId, ct, doc.DocumentNumber);
        }

        CalculateTotals(doc);
        await dbContext.SaveChangesAsync(ct);

        var accounting = HttpContext?.RequestServices?.GetService<IAccountingService>();
        if (accounting is not null && doc.Status != DocumentStatus.Draft && doc.Status != DocumentStatus.Cancelled)
        {
            var username = User?.Identity?.Name;
            await accounting.ReverseSourceEntriesAsync(tenantId, JournalSourceType.SalesDocument, doc.Id, $"ปรับปรุงเอกสาร {doc.DocumentNumber}", username, ct);
            await accounting.PostSalesDocumentAsync(doc, username, ct);
        }

        return Ok(new ApiResponse<DocumentResponse>(true, "อัปเดตเอกสารสำเร็จ", MapToResponse(doc)));
    }

    /// <summary>Cancel a document and restore stock if applicable</summary>
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

        var accountingPrecheck = HttpContext?.RequestServices?.GetService<IAccountingService>();
        if (accountingPrecheck is not null &&
            TargetDocumentType is not (DocumentType.Quotation or DocumentType.DeliveryNote) &&
            await accountingPrecheck.IsPeriodLockedAsync(tenantId, doc.DocumentDate, ct))
        {
            return BadRequest(new ApiResponse<DocumentResponse>(
                false,
                $"งวดบัญชี {doc.DocumentDate.Month:D2}/{doc.DocumentDate.Year} ถูกปิดงวดแล้ว ไม่สามารถยกเลิกเอกสารในงวดนี้ได้",
                null));
        }

        if (IsStockAffecting(TargetDocumentType))
        {
            await RestoreStockAsync(doc.Lines, tenantId, ct, doc.DocumentNumber);
        }

        doc.Status = DocumentStatus.Cancelled;
        doc.CancellationReason = request.Reason;
        doc.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(ct);

        var accounting = HttpContext?.RequestServices?.GetService<IAccountingService>();
        if (accounting is not null)
        {
            var username = User.Identity?.Name;
            await accounting.ReverseSourceEntriesAsync(tenantId, JournalSourceType.SalesDocument, doc.Id, request.Reason, username, ct);
            await accounting.ReverseSourceEntriesAsync(tenantId, JournalSourceType.Payment, doc.Id, request.Reason, username, ct);
        }

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
            return BadRequest(new ApiResponse<DocumentResponse>(false, "ไม่สามารถแปลงเป็นประเภทเดียวกัน", null));

        var targetDocNumber = await numberGenerator.GenerateNextNumberAsync(tenantId, request.TargetType, ct);
        var converted = CloneToNewDocument(source, request.TargetType, targetDocNumber, tenantId, request);

        bool deductInConverted = IsStockAffecting(request.TargetType) && !IsStockAffecting(source.DocumentType);
        if (deductInConverted)
        {
            await DeductStockAsync(converted.Lines, tenantId, ct, converted.DocumentNumber);
        }

        dbContext.DocumentHeaders.Add(converted);
        await dbContext.SaveChangesAsync(ct);

        var accounting = HttpContext?.RequestServices?.GetService<IAccountingService>();
        if (accounting is not null)
        {
            await accounting.PostSalesDocumentAsync(converted, converted.CreatedBy ?? User?.Identity?.Name, ct);
        }

        var msg = request.TargetType == DocumentType.TaxInvoice
            ? "แปลงเอกสารเป็นใบกำกับภาษีสำเร็จ"
            : "แปลงเอกสารสำเร็จ";

        return CreatedAtAction(nameof(GetById), new { id = converted.Id },
            new ApiResponse<DocumentResponse>(true, msg, MapToResponse(converted)));
    }

    /// <summary>Create a Credit Note or Debit Note referencing a source document</summary>
    [HttpPost("credit-debit-note")]
    public async Task<ActionResult<ApiResponse<DocumentResponse>>> CreateCreditDebitNote(
        [FromBody] CreateCreditDebitNoteRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();

        if (request.NoteType != DocumentType.CreditNote && request.NoteType != DocumentType.DebitNote)
            return BadRequest(new ApiResponse<DocumentResponse>(false, "ประเภทเอกสารต้องเป็นใบลดหนี้หรือใบเพิ่มหนี้เท่านั้น", null));

        var sourceDoc = await dbContext.DocumentHeaders
            .FirstOrDefaultAsync(d => d.Id == request.SourceDocumentId && d.TenantId == tenantId, ct);

        if (sourceDoc is null)
            return NotFound(new ApiResponse<DocumentResponse>(false, "ไม่พบเอกสารต้นทาง", null));

        if (sourceDoc.Status == DocumentStatus.Cancelled)
            return BadRequest(new ApiResponse<DocumentResponse>(false, "ไม่สามารถออกใบลดหนี้/เพิ่มหนี้จากเอกสารที่ยกเลิกแล้ว", null));

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
            CustomerBranch = sourceDoc.CustomerBranch,
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

        var accounting = HttpContext?.RequestServices?.GetService<IAccountingService>();
        if (accounting is not null)
        {
            await accounting.PostSalesDocumentAsync(header, header.CreatedBy, ct);
        }

        var noteLabel = request.NoteType == DocumentType.CreditNote ? "ใบลดหนี้" : "ใบเพิ่มหนี้";
        return CreatedAtAction(nameof(GetById), new { id = header.Id },
            new ApiResponse<DocumentResponse>(true, $"สร้าง{noteLabel}สำเร็จ", MapToResponse(header)));
    }

    // ──────────────────────────────────────────────
    // Protected & Private Helpers
    // ──────────────────────────────────────────────

    protected static DocumentHeader CloneToNewDocument(
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
            CustomerBranch = source.CustomerBranch,
            CustomerTaxId = source.CustomerTaxId,
            Status = DocumentStatus.Issued,
            VatMode = source.VatMode,
            VatRate = source.VatRate,
            WhtRate = source.WhtRate,
            DiscountAmount = source.DiscountAmount,
            Notes = request.Notes ?? source.Notes,
            ReferenceDocumentId = source.ReferenceDocumentId,
            ConvertedFromDocumentId = source.Id,
            DeliveryStatus = targetType == DocumentType.DeliveryNote ? "รอส่ง" : null
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

    protected static void CalculateTotals(DocumentHeader doc)
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

        // ภาษีหัก ณ ที่จ่าย (WHT) — applied against TotalBeforeVat
        doc.WhtAmount = doc.WhtRate > 0
            ? Math.Round(doc.TotalBeforeVat * doc.WhtRate / 100m, 2)
            : 0m;
    }

    protected async Task DeductStockAsync(
        ICollection<DocumentLine> lines,
        Guid tenantId,
        CancellationToken ct,
        string? documentNumber = null)
    {
        await AdjustDocumentStockAsync(
            lines,
            tenantId,
            StockMovementType.SaleOut,
            multiplier: -1m,
            documentNumber: documentNumber,
            notesPrefix: "ตัดสต็อกจากเอกสาร",
            ct: ct);
    }

    protected async Task RestoreStockAsync(
        ICollection<DocumentLine> lines,
        Guid tenantId,
        CancellationToken ct,
        string? documentNumber = null)
    {
        await AdjustDocumentStockAsync(
            lines,
            tenantId,
            StockMovementType.SaleRestock,
            multiplier: 1m,
            documentNumber: documentNumber,
            notesPrefix: "คืนสต็อกจากเอกสาร",
            ct: ct);
    }

    private async Task AdjustDocumentStockAsync(
        ICollection<DocumentLine> lines,
        Guid tenantId,
        StockMovementType movementType,
        decimal multiplier,
        string? documentNumber,
        string notesPrefix,
        CancellationToken ct)
    {
        var groupedQty = lines
            .Where(l => l.ProductId.HasValue)
            .GroupBy(l => l.ProductId!.Value)
            .Select(g => new { ProductId = g.Key, Quantity = g.Sum(x => x.Quantity) })
            .Where(g => g.Quantity != 0m)
            .ToList();
        if (groupedQty.Count == 0) return;

        var productIds = groupedQty.Select(g => g.ProductId).ToList();
        var products = await dbContext.Products
            .Where(p => p.TenantId == tenantId && productIds.Contains(p.Id))
            .ToDictionaryAsync(p => p.Id, ct);

        var inventoryService = HttpContext?.RequestServices?.GetService<IInventoryService>();
        var createdBy = User?.Identity?.Name;
        var notes = string.IsNullOrWhiteSpace(documentNumber) ? notesPrefix : $"{notesPrefix} {documentNumber}";

        foreach (var item in groupedQty)
        {
            if (products.TryGetValue(item.ProductId, out var product) && product.StockQuantity.HasValue)
            {
                var delta = item.Quantity * multiplier;
                if (inventoryService is not null)
                {
                    await inventoryService.AdjustWarehouseStockAsync(
                        tenantId,
                        product.Id,
                        warehouseId: null,
                        quantityDelta: delta,
                        movementType: movementType,
                        referenceNumber: documentNumber,
                        notes: notes,
                        createdBy: createdBy,
                        ct: ct,
                        saveChanges: false);
                }
                else
                {
                    product.StockQuantity += delta;
                }
            }
        }
    }

    protected static DocumentResponse MapToResponse(DocumentHeader d) => new(
        d.Id, d.DocumentType, d.DocumentNumber, d.DocumentDate, d.DueDate,
        d.CustomerId, d.CustomerName, d.CustomerAddress, d.CustomerBranch, d.CustomerTaxId,
        d.Status, d.VatMode, d.VatRate,
        d.Subtotal, d.DiscountAmount, d.TotalBeforeVat, d.VatAmount,
        d.WhtRate, d.WhtAmount, d.GrandTotal,
        d.Notes, d.ReferenceDocumentId, d.ConvertedFromDocumentId,
        d.DeliveryStatus, d.CancellationReason,
        d.SentAt, d.ViewedAt, d.CreatedAt, d.CreatedBy,
        d.Lines.OrderBy(l => l.SortOrder).Select(l => new DocumentLineDto(
            l.Id, l.SortOrder, l.ProductId, l.Description,
            l.Quantity, l.Unit, l.UnitPrice, l.DiscountAmount, l.LineTotal
        )).ToList(),
        d.CustomerApprovalStatus,
        d.ApprovedByName,
        d.ApprovedAt,
        d.CustomerSignatureText,
        d.CustomerApprovalComment,
        d.LastReminderSentAt
    );

    protected Guid GetTenantId()
    {
        var claim = User.FindFirst("tenantId")?.Value;
        return claim is not null ? Guid.Parse(claim) : throw new UnauthorizedAccessException();
    }
}
