using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Domain.Interfaces;
using SenicBilling.Infrastructure.Data;
using SenicBilling.Application.Services;
using SenicBilling.Application.Interfaces;

namespace SenicBilling.API.Controllers;

/// <summary>
/// RESTful API Controller for Tax Invoice (ใบกำกับภาษี) management.
/// Enforces strict data integrity: Tax ID validation, stock deduction/restoration,
/// e-Tax XML generation, and PDF export.
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

        // Validate Tax ID for Tax Invoice
        if (!string.IsNullOrEmpty(request.CustomerTaxId) && request.CustomerTaxId.Length != 13)
        {
            return BadRequest(new ApiResponse<DocumentResponse>(
                false, "เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก", null));
        }

        var accountingPrecheck = HttpContext?.RequestServices?.GetService<IAccountingService>();
        if (accountingPrecheck is not null && await accountingPrecheck.IsPeriodLockedAsync(tenantId, request.DocumentDate, ct))
        {
            return BadRequest(new ApiResponse<DocumentResponse>(
                false,
                $"งวดบัญชี {request.DocumentDate.Month:D2}/{request.DocumentDate.Year} ถูกปิดงวดแล้ว ไม่สามารถสร้างใบกำกับภาษีในงวดนี้ได้",
                null));
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
            CustomerBranch = request.CustomerBranch,
            CustomerTaxId = request.CustomerTaxId,
            Status = DocumentStatus.Issued,
            VatMode = request.VatMode,
            VatRate = request.VatRate,
            DiscountAmount = request.DiscountAmount,
            WhtRate = request.WhtRate,
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

        // Deduct stock for TaxInvoice
        await DeductStockAsync(header.Lines, tenantId, ct, header.DocumentNumber);

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
                    $"\nออกใบกำกับภาษีใหม่: {header.DocumentNumber}\nลูกค้า: {header.CustomerName}\nยอดสุทธิ: {header.GrandTotal:N2} บาท");
            }
        }

        return CreatedAtAction(nameof(GetById), new { id = header.Id },
            new ApiResponse<DocumentResponse>(true, "สร้างใบกำกับภาษีสำเร็จ", MapToResponse(header)));
    }

    /// <summary>Mark an issued tax invoice as paid manually and settle AR into Cash</summary>
    [HttpPatch("{id:guid}/mark-paid")]
    public async Task<ActionResult<ApiResponse<DocumentResponse>>> MarkAsPaid(Guid id, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var doc = await dbContext.DocumentHeaders
            .Include(d => d.Lines)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId && d.DocumentType == DocumentType.TaxInvoice, ct);

        if (doc is null)
            return NotFound(new ApiResponse<DocumentResponse>(false, "ไม่พบใบกำกับภาษี", null));

        if (doc.Status == DocumentStatus.Cancelled)
            return BadRequest(new ApiResponse<DocumentResponse>(false, "ไม่สามารถชำระเงินเอกสารที่ยกเลิกแล้ว", null));

        if (doc.Status == DocumentStatus.Draft)
            return BadRequest(new ApiResponse<DocumentResponse>(false, "กรุณาออกใบกำกับภาษีก่อนบันทึกการรับชำระเงิน", null));

        if (doc.Status == DocumentStatus.Paid)
            return Ok(new ApiResponse<DocumentResponse>(true, "ใบกำกับภาษีถูกบันทึกชำระแล้ว", MapToResponse(doc)));

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

    /// <summary>Update a tax invoice (reconciles stock)</summary>
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

        var userRole = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
        bool isAdmin = userRole == "Admin" || userRole == "SystemAdmin";

        if (!isAdmin && doc.Status != DocumentStatus.Draft)
            return BadRequest(new ApiResponse<DocumentResponse>(false, "แก้ไขได้เฉพาะเอกสารสถานะ 'ร่าง' เท่านั้น", null));

        var accountingPrecheck = HttpContext?.RequestServices?.GetService<IAccountingService>();
        if (accountingPrecheck is not null &&
            (await accountingPrecheck.IsPeriodLockedAsync(tenantId, doc.DocumentDate, ct) ||
             await accountingPrecheck.IsPeriodLockedAsync(tenantId, request.DocumentDate, ct)))
        {
            return BadRequest(new ApiResponse<DocumentResponse>(false, "ไม่สามารถแก้ไขใบกำกับภาษีในงวดบัญชีที่ปิดงวดแล้วได้", null));
        }

        if (doc.Status != DocumentStatus.Cancelled)
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

        if (doc.Status != DocumentStatus.Cancelled)
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

        return Ok(new ApiResponse<DocumentResponse>(true, "อัปเดตใบกำกับภาษีสำเร็จ", MapToResponse(doc)));
    }

    /// <summary>Cancel a tax invoice and restore stock (requires reason — acts as Credit Note reference)</summary>
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

        var accountingPrecheck = HttpContext?.RequestServices?.GetService<IAccountingService>();
        if (accountingPrecheck is not null && await accountingPrecheck.IsPeriodLockedAsync(tenantId, doc.DocumentDate, ct))
        {
            return BadRequest(new ApiResponse<DocumentResponse>(
                false,
                $"งวดบัญชี {doc.DocumentDate.Month:D2}/{doc.DocumentDate.Year} ถูกปิดงวดแล้ว ไม่สามารถยกเลิกใบกำกับภาษีในงวดนี้ได้",
                null));
        }

        await RestoreStockAsync(doc.Lines, tenantId, ct, doc.DocumentNumber);

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

        return Ok(new ApiResponse<DocumentResponse>(true, "ยกเลิกใบกำกับภาษีสำเร็จ", MapToResponse(doc)));
    }

    /// <summary>Generate e-Tax Invoice XML for this document</summary>
    [HttpGet("{id:guid}/e-tax-xml")]
    public async Task<IActionResult> GenerateETaxXml(Guid id, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var doc = await dbContext.DocumentHeaders
            .Include(d => d.Tenant)
            .Include(d => d.Lines.OrderBy(l => l.SortOrder))
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId && d.DocumentType == DocumentType.TaxInvoice, ct);

        if (doc is null)
            return NotFound(new ApiResponse<object>(false, "ไม่พบใบกำกับภาษี", null));

        if (doc.Status == DocumentStatus.Draft || doc.Status == DocumentStatus.Cancelled)
            return BadRequest(new ApiResponse<object>(false, "สามารถออก e-Tax XML ได้เฉพาะเอกสารที่อนุมัติ/ออกแล้วเท่านั้น", null));

        var xmlBytes = ETaxXmlGenerator.GenerateXml(doc, doc.Tenant);
        return File(xmlBytes, "application/xml", $"{doc.DocumentNumber}_eTax.xml");
    }

    /// <summary>Generate PDF for this document</summary>
    [HttpGet("{id:guid}/pdf")]
    public async Task<IActionResult> GeneratePdf(
        Guid id, 
        [FromServices] IPdfService pdfService, 
        CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var doc = await dbContext.DocumentHeaders
            .Include(d => d.Tenant)
            .Include(d => d.Lines.OrderBy(l => l.SortOrder))
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId && d.DocumentType == DocumentType.TaxInvoice, ct);

        if (doc is null)
            return NotFound(new ApiResponse<object>(false, "ไม่พบใบกำกับภาษี", null));

        var pdfBytes = pdfService.GenerateDocumentPdf(doc);
        return File(pdfBytes, "application/pdf", $"{doc.DocumentNumber}.pdf");
    }

    // ──────────────────────────────────────────────
    // Private Helpers
    // ──────────────────────────────────────────────

    private async Task DeductStockAsync(
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

    private async Task RestoreStockAsync(
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

    private Guid GetTenantId()
    {
        var claim = User.FindFirst("tenantId")?.Value;
        return claim is not null ? Guid.Parse(claim) : throw new UnauthorizedAccessException();
    }
}
