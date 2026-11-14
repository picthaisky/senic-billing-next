using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SenicBilling.API.Hubs;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Interfaces;
using SenicBilling.Infrastructure.Data;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;

namespace SenicBilling.API.Controllers;

public record PublicDocumentPrintResponse(
    DocumentResponse Document,
    string CompanyName,
    string? Address,
    string? Phone,
    string? TaxId,
    string? BranchName,
    string? LogoUrl
);

/// <summary>
/// A shared controller for fetching, converting, exporting, and tracking ANY document by its unique ID,
/// without knowing its specific document type.
/// </summary>
[Authorize]
[Route("api/documents")]
[ApiController]
public class SharedDocumentController(
    SenicBillingDbContext dbContext,
    IDocumentNumberGeneratorService numberGenerator,
    IPdfService pdfService) : ControllerBase
{
    private static bool IsStockAffecting(DocumentType docType) =>
        docType is DocumentType.TaxInvoice
            or DocumentType.Receipt
            or DocumentType.CashBill
            or DocumentType.DeliveryNote;

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

    [HttpGet("{id:guid}/public")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<PublicDocumentPrintResponse>>> GetPublicById(Guid id, CancellationToken ct)
    {
        var doc = await dbContext.DocumentHeaders
            .Include(d => d.Lines.OrderBy(l => l.SortOrder))
            .FirstOrDefaultAsync(d => d.Id == id, ct);

        if (doc is null)
            return NotFound(new ApiResponse<PublicDocumentPrintResponse>(false, "ไม่พบเอกสาร", null));

        var tenant = await dbContext.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == doc.TenantId, ct);

        // If accessed by external viewer (unauthenticated), mark as viewed automatically
        var isAuthenticatedSameTenant = Guid.TryParse(User.FindFirst("tenantId")?.Value, out var callerTenantId)
                                        && callerTenantId == doc.TenantId;
        if (!isAuthenticatedSameTenant && doc.ViewedAt == null)
        {
            doc.ViewedAt = DateTime.UtcNow;
            if (doc.Status == DocumentStatus.Issued || doc.Status == DocumentStatus.Sent)
            {
                doc.Status = DocumentStatus.Viewed;
            }
            await dbContext.SaveChangesAsync(ct);
        }

        var payload = new PublicDocumentPrintResponse(
            MapToResponse(doc),
            tenant?.CompanyName ?? "Senic Billing",
            tenant?.Address,
            tenant?.Phone,
            tenant?.TaxId,
            tenant?.BranchName,
            tenant?.LogoUrl
        );

        return Ok(new ApiResponse<PublicDocumentPrintResponse>(true, "สำเร็จ", payload));
    }

    [HttpGet("{id:guid}/pdf")]
    [AllowAnonymous]
    public async Task<IActionResult> DownloadPdf(Guid id, CancellationToken ct)
    {
        var doc = await dbContext.DocumentHeaders
            .Include(d => d.Tenant)
            .Include(d => d.Lines.OrderBy(l => l.SortOrder))
            .FirstOrDefaultAsync(d => d.Id == id, ct);

        if (doc is null)
            return NotFound(new ApiResponse<object>(false, "ไม่พบเอกสาร", null));

        var pdfBytes = pdfService.GenerateDocumentPdf(doc);
        return File(pdfBytes, "application/pdf", $"{doc.DocumentNumber}.pdf");
    }

    [HttpPost("{id:guid}/convert")]
    public async Task<ActionResult<ApiResponse<DocumentResponse>>> Convert(
        Guid id, [FromBody] ConvertDocumentRequest request, CancellationToken ct)
    {
        var tenantIdString = User.FindFirst("tenantId")?.Value;
        if (!Guid.TryParse(tenantIdString, out var tenantId))
            return Unauthorized();

        var source = await dbContext.DocumentHeaders
            .Include(d => d.Lines.OrderBy(l => l.SortOrder))
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId, ct);

        if (source is null)
            return NotFound(new ApiResponse<DocumentResponse>(false, "ไม่พบเอกสารต้นทาง", null));

        if (source.Status == DocumentStatus.Cancelled)
            return BadRequest(new ApiResponse<DocumentResponse>(false, "ไม่สามารถแปลงเอกสารที่ยกเลิกแล้วได้", null));

        var accountingCheck = HttpContext?.RequestServices?.GetService<IAccountingService>();
        if (accountingCheck is not null && await accountingCheck.IsPeriodLockedAsync(tenantId, DateTime.UtcNow, ct))
        {
            var now = DateTime.UtcNow;
            return BadRequest(new ApiResponse<DocumentResponse>(false, $"งวดบัญชี {now.Month:D2}/{now.Year} ถูกปิดงวดแล้ว ไม่สามารถออกเอกสารใหม่ได้", null));
        }

        var newDocNumber = await numberGenerator.GenerateNextNumberAsync(
            tenantId, request.TargetType, ct);

        var target = new DocumentHeader
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            DocumentType = request.TargetType,
            DocumentNumber = newDocNumber,
            DocumentDate = DateTime.UtcNow,
            DueDate = request.DueDate ?? source.DueDate,
            CustomerId = source.CustomerId,
            CustomerName = source.CustomerName,
            CustomerAddress = source.CustomerAddress,
            CustomerBranch = source.CustomerBranch,
            CustomerTaxId = source.CustomerTaxId,
            Status = DocumentStatus.Issued,
            VatMode = source.VatMode,
            VatRate = source.VatRate,
            Subtotal = source.Subtotal,
            DiscountAmount = source.DiscountAmount,
            TotalBeforeVat = source.TotalBeforeVat,
            VatAmount = source.VatAmount,
            WhtRate = source.WhtRate,
            WhtAmount = source.WhtAmount,
            GrandTotal = source.GrandTotal,
            Notes = request.Notes ?? source.Notes,
            ConvertedFromDocumentId = source.Id,
            ReferenceDocumentId = source.Id,
            CreatedBy = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? "system"
        };

        foreach (var srcLine in source.Lines)
        {
            target.Lines.Add(new DocumentLine
            {
                Id = Guid.NewGuid(),
                DocumentHeaderId = target.Id,
                SortOrder = srcLine.SortOrder,
                ProductId = srcLine.ProductId,
                Description = srcLine.Description,
                Quantity = srcLine.Quantity,
                Unit = srcLine.Unit,
                UnitPrice = srcLine.UnitPrice,
                DiscountAmount = srcLine.DiscountAmount,
                LineTotal = srcLine.LineTotal
            });
        }

        // If converting from a non-stock-affecting document (e.g., Quotation) to a stock-affecting one (e.g., TaxInvoice)
        if (!IsStockAffecting(source.DocumentType) && IsStockAffecting(request.TargetType))
        {
            var groupedQty = target.Lines
                .Where(l => l.ProductId.HasValue)
                .GroupBy(l => l.ProductId!.Value)
                .Select(g => new { ProductId = g.Key, Quantity = g.Sum(x => x.Quantity) })
                .Where(g => g.Quantity != 0m)
                .ToList();

            if (groupedQty.Count > 0)
            {
                var productIds = groupedQty.Select(g => g.ProductId).ToList();
                var products = await dbContext.Products
                    .Where(p => p.TenantId == tenantId && productIds.Contains(p.Id))
                    .ToDictionaryAsync(p => p.Id, ct);

                var inventoryService = HttpContext?.RequestServices?.GetService<IInventoryService>();

                foreach (var item in groupedQty)
                {
                    if (products.TryGetValue(item.ProductId, out var product) && product.StockQuantity.HasValue)
                    {
                        if (inventoryService is not null)
                        {
                            await inventoryService.AdjustWarehouseStockAsync(
                                tenantId,
                                product.Id,
                                warehouseId: null,
                                quantityDelta: -item.Quantity,
                                movementType: StockMovementType.SaleOut,
                                referenceNumber: newDocNumber,
                                notes: $"ตัดสต็อกจากเอกสาร {newDocNumber}",
                                createdBy: target.CreatedBy,
                                ct: ct,
                                saveChanges: false);
                        }
                        else
                        {
                            product.StockQuantity -= item.Quantity;
                        }
                    }
                }
            }
        }

        dbContext.DocumentHeaders.Add(target);
        await dbContext.SaveChangesAsync(ct);

        var accounting = HttpContext?.RequestServices?.GetService<IAccountingService>();
        if (accounting is not null)
        {
            await accounting.PostSalesDocumentAsync(target, target.CreatedBy, ct);
        }

        return Created($"/api/documents/{target.Id}",
            new ApiResponse<DocumentResponse>(true, $"แปลงเอกสารเป็น {newDocNumber} สำเร็จ", MapToResponse(target)));
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

        var headerLogs = await dbContext.Set<AuditLog>()
            .Where(a => a.TenantId == tenantId && a.EntityId == id.ToString() && a.EntityName == "DocumentHeader")
            .OrderByDescending(a => a.Timestamp)
            .ToListAsync(ct);

        return Ok(new ApiResponse<List<AuditLog>>(true, "สำเร็จ", headerLogs));
    }

    [HttpPost("{id:guid}/public/approve")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<DocumentApprovalResultDto>>> PublicApprove(
        Guid id, [FromBody] CustomerApproveDocumentRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.SignerName))
            return BadRequest(new ApiResponse<DocumentApprovalResultDto>(false, "กรุณาระบุชื่อผู้อนุมัติ", null));

        var doc = await dbContext.DocumentHeaders.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (doc is null)
            return NotFound(new ApiResponse<DocumentApprovalResultDto>(false, "ไม่พบเอกสาร", null));

        if (doc.Status == DocumentStatus.Cancelled)
            return BadRequest(new ApiResponse<DocumentApprovalResultDto>(false, "ไม่สามารถอนุมัติเอกสารที่ยกเลิกแล้วได้", null));

        var now = DateTime.UtcNow;
        doc.CustomerApprovalStatus = CustomerApprovalStatus.Approved;
        doc.ApprovedByName = request.SignerName.Trim();
        doc.ApprovedAt = now;
        doc.CustomerSignatureText = string.IsNullOrWhiteSpace(request.SignatureText)
            ? request.SignerName.Trim()
            : request.SignatureText.Trim();
        doc.CustomerApprovalComment = string.IsNullOrWhiteSpace(request.Comment) ? null : request.Comment.Trim();
        doc.ViewedAt ??= now;
        if (doc.Status == DocumentStatus.Issued || doc.Status == DocumentStatus.Sent)
        {
            doc.Status = DocumentStatus.Viewed;
        }
        doc.UpdatedAt = now;

        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = doc.TenantId,
            Username = doc.ApprovedByName,
            Action = "CustomerApprove",
            EntityName = "DocumentHeader",
            EntityId = doc.Id.ToString(),
            NewValues = $"{{\"signerName\":\"{doc.ApprovedByName}\",\"comment\":\"{doc.CustomerApprovalComment ?? ""}\"}}",
            Timestamp = now
        });

        await dbContext.SaveChangesAsync(ct);

        await BroadcastAndNotifyCustomerDecisionAsync(doc, approved: true, ct);

        return Ok(new ApiResponse<DocumentApprovalResultDto>(
            true,
            "อนุมัติและลงนามเอกสารเรียบร้อยแล้ว",
            new DocumentApprovalResultDto(doc.Id, doc.DocumentNumber, doc.CustomerApprovalStatus, doc.ApprovedByName, doc.ApprovedAt, doc.CustomerApprovalComment)));
    }

    [HttpPost("{id:guid}/public/reject")]
    [AllowAnonymous]
    public async Task<ActionResult<ApiResponse<DocumentApprovalResultDto>>> PublicReject(
        Guid id, [FromBody] CustomerRejectDocumentRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.SignerName) || string.IsNullOrWhiteSpace(request.Reason))
            return BadRequest(new ApiResponse<DocumentApprovalResultDto>(false, "กรุณาระบุชื่อผู้ดำเนินการและเหตุผลในการขอแก้ไข", null));

        var doc = await dbContext.DocumentHeaders.FirstOrDefaultAsync(d => d.Id == id, ct);
        if (doc is null)
            return NotFound(new ApiResponse<DocumentApprovalResultDto>(false, "ไม่พบเอกสาร", null));

        if (doc.Status == DocumentStatus.Cancelled)
            return BadRequest(new ApiResponse<DocumentApprovalResultDto>(false, "เอกสารนี้ถูกยกเลิกแล้ว", null));

        var now = DateTime.UtcNow;
        doc.CustomerApprovalStatus = CustomerApprovalStatus.Rejected;
        doc.ApprovedByName = request.SignerName.Trim();
        doc.ApprovedAt = now;
        doc.CustomerApprovalComment = request.Reason.Trim();
        doc.ViewedAt ??= now;
        doc.UpdatedAt = now;

        dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            TenantId = doc.TenantId,
            Username = doc.ApprovedByName,
            Action = "CustomerReject",
            EntityName = "DocumentHeader",
            EntityId = doc.Id.ToString(),
            NewValues = $"{{\"signerName\":\"{doc.ApprovedByName}\",\"reason\":\"{doc.CustomerApprovalComment}\"}}",
            Timestamp = now
        });

        await dbContext.SaveChangesAsync(ct);

        await BroadcastAndNotifyCustomerDecisionAsync(doc, approved: false, ct);

        return Ok(new ApiResponse<DocumentApprovalResultDto>(
            true,
            "บันทึกคำขอแก้ไขเอกสารเรียบร้อยแล้ว",
            new DocumentApprovalResultDto(doc.Id, doc.DocumentNumber, doc.CustomerApprovalStatus, doc.ApprovedByName, doc.ApprovedAt, doc.CustomerApprovalComment)));
    }

    [HttpPost("{id:guid}/send-reminder")]
    public async Task<ActionResult<ApiResponse<bool>>> SendPaymentReminder(Guid id, CancellationToken ct)
    {
        var tenantIdString = User.FindFirst("tenantId")?.Value;
        if (!Guid.TryParse(tenantIdString, out var tenantId))
            return Unauthorized();

        var doc = await dbContext.DocumentHeaders
            .Include(d => d.Customer)
            .FirstOrDefaultAsync(d => d.Id == id && d.TenantId == tenantId, ct);
        if (doc is null)
            return NotFound(new ApiResponse<bool>(false, "ไม่พบเอกสาร", false));

        if (doc.Status is DocumentStatus.Cancelled or DocumentStatus.Paid)
            return BadRequest(new ApiResponse<bool>(false, "ไม่สามารถส่งแจ้งเตือนสำหรับเอกสารที่ชำระแล้วหรือยกเลิกแล้ว", false));

        var tenant = await dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        var emailService = HttpContext?.RequestServices?.GetService<IEmailService>();
        var paymentService = HttpContext?.RequestServices?.GetService<IPaymentService>();
        var lineNotify = HttpContext?.RequestServices?.GetService<ILineNotifyService>();

        var emailSent = false;
        if (emailService is not null && !string.IsNullOrWhiteSpace(doc.Customer?.Email))
        {
            var paymentLink = paymentService is not null
                ? await paymentService.CreatePaymentLinkAsync(doc.GrandTotal, $"Invoice {doc.DocumentNumber}", $"Payment Reminder for {doc.CustomerName}", doc.Id.ToString())
                : null;
            if (string.IsNullOrWhiteSpace(paymentLink))
            {
                var config = HttpContext?.RequestServices?.GetService<IConfiguration>();
                var frontendBaseUrl = (config?["App:FrontendBaseUrl"] ?? "http://localhost:5173").Trim().TrimEnd('/');
                paymentLink = $"{frontendBaseUrl}/print/{doc.Id}";
            }
            await emailService.SendPaymentReminderAsync(
                doc.Customer.Email,
                doc.CustomerName ?? doc.Customer.Name,
                doc.DocumentNumber,
                doc.GrandTotal,
                doc.DueDate ?? doc.DocumentDate,
                paymentLink,
                ct);
            emailSent = true;
        }

        var lineSent = false;
        if (lineNotify is not null && tenant != null && tenant.HasAnyLineChannel())
        {
            lineSent = await lineNotify.NotifyTenantAsync(
                tenant,
                $"\nแจ้งเตือนวางบิล/รับชำระเงิน\nเลขที่เอกสาร: {doc.DocumentNumber}\nลูกค้า: {doc.CustomerName ?? "-"}\nยอดรวม: {doc.GrandTotal:N2} บาท\nครบกำหนด: {(doc.DueDate ?? doc.DocumentDate):dd/MM/yyyy}",
                ct);
        }

        doc.LastReminderSentAt = DateTime.UtcNow;
        doc.SentAt ??= doc.LastReminderSentAt;
        if (doc.Status == DocumentStatus.Issued)
        {
            doc.Status = DocumentStatus.Sent;
        }
        await dbContext.SaveChangesAsync(ct);

        var summary = (emailSent, lineSent) switch
        {
            (true, true) => "ส่งแจ้งเตือนทาง Email และ LINE สำเร็จ",
            (true, false) => "ส่งแจ้งเตือนทาง Email สำเร็จ",
            (false, true) => "ส่งแจ้งเตือนทาง LINE สำเร็จ (ไม่พบ Email ลูกค้า)",
            _ => "บันทึกการส่งแจ้งเตือนแล้ว (กรุณาตั้งค่า Email ลูกค้าหรือ LINE ในหน้าตั้งค่าเพื่อส่งข้อความอัตโนมัติ)"
        };

        return Ok(new ApiResponse<bool>(true, summary, true));
    }

    private async Task BroadcastAndNotifyCustomerDecisionAsync(DocumentHeader doc, bool approved, CancellationToken ct)
    {
        var hub = HttpContext?.RequestServices?.GetService<IHubContext<SenicBillingHub>>();
        if (hub is not null)
        {
            var evt = approved ? "DocumentApproved" : "DocumentRejected";
            await hub.Clients.Group($"Tenant_{doc.TenantId}").SendAsync(evt, new
            {
                documentId = doc.Id,
                documentNumber = doc.DocumentNumber,
                signerName = doc.ApprovedByName,
                comment = doc.CustomerApprovalComment
            }, ct);

            await hub.Clients.Group($"Tenant_{doc.TenantId}").SendAsync("NotificationReceived", new NotificationFeedItemDto(
                Id: $"approval-{doc.Id}",
                Title: approved
                    ? $"ลูกค้าอนุมัติเอกสาร {doc.DocumentNumber}"
                    : $"ลูกค้าขอแก้ไขเอกสาร {doc.DocumentNumber}",
                Detail: string.IsNullOrWhiteSpace(doc.ApprovedByName)
                    ? (doc.CustomerName ?? doc.DocumentNumber)
                    : $"ผู้ดำเนินการ: {doc.ApprovedByName}",
                TimeLabel: "เมื่อสักครู่",
                OccurredAt: doc.ApprovedAt ?? DateTime.UtcNow,
                Tone: approved ? "success" : "warning",
                Route: $"/documents/{doc.DocumentType.ToString().ToLowerInvariant()}"
            ), ct);
        }

        var lineNotify = HttpContext?.RequestServices?.GetService<ILineNotifyService>();
        if (lineNotify is not null)
        {
            var tenant = await dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == doc.TenantId, ct);
            if (tenant != null && tenant.HasAnyLineChannel())
            {
                var heading = approved ? "ลูกค้าอนุมัติและลงนามเอกสารแล้ว" : "ลูกค้าขอแก้ไข / ไม่อนุมัติเอกสาร";
                await lineNotify.NotifyTenantAsync(
                    tenant,
                    $"\n{heading}\nเลขที่เอกสาร: {doc.DocumentNumber}\nผู้ดำเนินการ: {doc.ApprovedByName}\nหมายเหตุ: {doc.CustomerApprovalComment ?? "-"}",
                    ct);
            }
        }
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
}
