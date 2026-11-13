using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Interfaces;
using SenicBilling.Application.Services;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Domain.Interfaces;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/purchase-orders")]
[Authorize]
public class PurchaseOrdersController(
    SenicBillingDbContext dbContext,
    IDocumentNumberGeneratorService numberGenerator,
    IInventoryService inventoryService,
    IPdfService pdfService) : ControllerBase
{
    private Guid GetTenantId() => Guid.Parse(User.FindFirst("tenantId")!.Value);
    private string? GetUsername() => User.FindFirst(ClaimTypes.Name)?.Value ?? User.Identity?.Name;

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<PurchaseOrderDto>>>> GetAll(
        [FromQuery] PurchaseOrderStatus? status, [FromQuery] string? search, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var query = dbContext.PurchaseOrders
            .AsNoTracking()
            .Include(p => p.Warehouse)
            .Include(p => p.Lines.OrderBy(l => l.SortOrder))
            .Where(p => p.TenantId == tenantId);

        if (status.HasValue) query = query.Where(p => p.Status == status.Value);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(p => p.PoNumber.ToLower().Contains(term) || p.VendorName.ToLower().Contains(term));
        }

        var items = await query.OrderByDescending(p => p.OrderDate).ThenByDescending(p => p.CreatedAt).ToListAsync(ct);
        return Ok(new ApiResponse<List<PurchaseOrderDto>>(true, "สำเร็จ", items.Select(MapToDto).ToList()));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<PurchaseOrderDto>>> GetById(Guid id, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var po = await dbContext.PurchaseOrders
            .AsNoTracking()
            .Include(p => p.Warehouse)
            .Include(p => p.Lines.OrderBy(l => l.SortOrder))
            .FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tenantId, ct);

        if (po is null) return NotFound(new ApiResponse<PurchaseOrderDto>(false, "ไม่พบใบสั่งซื้อ", null));
        return Ok(new ApiResponse<PurchaseOrderDto>(true, "สำเร็จ", MapToDto(po)));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<PurchaseOrderDto>>> Create([FromBody] CreatePurchaseOrderRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        if (string.IsNullOrWhiteSpace(request.VendorName))
            return BadRequest(new ApiResponse<PurchaseOrderDto>(false, "กรุณาระบุชื่อผู้ขาย", null));
        if (request.Lines is null || request.Lines.Count == 0)
            return BadRequest(new ApiResponse<PurchaseOrderDto>(false, "กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ", null));

        var warehouse = request.WarehouseId.HasValue
            ? await dbContext.Warehouses.FirstOrDefaultAsync(w => w.Id == request.WarehouseId.Value && w.TenantId == tenantId, ct)
            : await inventoryService.EnsureDefaultWarehouseAsync(tenantId, ct);

        var po = new PurchaseOrder
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PoNumber = await numberGenerator.GenerateNextNumberAsync(tenantId, DocumentType.PurchaseOrder, ct),
            OrderDate = DateTime.SpecifyKind(request.OrderDate, DateTimeKind.Utc),
            ExpectedDeliveryDate = request.ExpectedDeliveryDate.HasValue
                ? DateTime.SpecifyKind(request.ExpectedDeliveryDate.Value, DateTimeKind.Utc)
                : null,
            VendorId = request.VendorId,
            VendorName = request.VendorName.Trim(),
            VendorTaxId = request.VendorTaxId?.Trim(),
            VendorBranch = string.IsNullOrWhiteSpace(request.VendorBranch) ? "00000" : request.VendorBranch.Trim(),
            VendorAddress = request.VendorAddress?.Trim(),
            WarehouseId = warehouse?.Id,
            VatMode = request.VatMode,
            VatRate = request.VatRate,
            Status = PurchaseOrderStatus.Sent,
            Notes = request.Notes?.Trim(),
            CreatedBy = GetUsername(),
            CreatedAt = DateTime.UtcNow
        };

        var lines = new List<PurchaseOrderLine>();
        var sort = 1;
        foreach (var item in request.Lines)
        {
            var lineTotal = Math.Round((item.Quantity * item.UnitPrice) - item.DiscountAmount, 2, MidpointRounding.AwayFromZero);
            lines.Add(new PurchaseOrderLine
            {
                Id = Guid.NewGuid(),
                PurchaseOrderId = po.Id,
                SortOrder = sort++,
                ProductId = item.ProductId,
                Description = item.Description.Trim(),
                Unit = string.IsNullOrWhiteSpace(item.Unit) ? "ชิ้น" : item.Unit.Trim(),
                Quantity = item.Quantity,
                ReceivedQuantity = 0m,
                UnitPrice = item.UnitPrice,
                DiscountAmount = item.DiscountAmount,
                LineTotal = Math.Max(0m, lineTotal)
            });
        }

        var subtotal = lines.Sum(l => l.LineTotal);
        var calc = ExpenseCalculator.Calculate(subtotal, request.DiscountAmount, request.VatMode, request.VatRate, 0m);
        po.Subtotal = calc.Subtotal;
        po.DiscountAmount = calc.DiscountAmount;
        po.TotalBeforeVat = calc.TotalBeforeVat;
        po.VatAmount = calc.VatAmount;
        po.GrandTotal = calc.GrandTotal;

        dbContext.PurchaseOrders.Add(po);
        foreach (var l in lines) dbContext.PurchaseOrderLines.Add(l);
        await dbContext.SaveChangesAsync(ct);

        po.Warehouse = warehouse;
        po.Lines = lines;
        return CreatedAtAction(nameof(GetById), new { id = po.Id },
            new ApiResponse<PurchaseOrderDto>(true, "สร้างใบสั่งซื้อสำเร็จ", MapToDto(po)));
    }

    /// <summary>รับสินค้าเข้าคลังจากใบสั่งซื้อ + เพิ่มสต็อกอัตโนมัติ + ตัวเลือกสร้างใบสำคัญจ่าย/ภาษีซื้อ</summary>
    [HttpPost("{id:guid}/receive")]
    public async Task<ActionResult<ApiResponse<PurchaseOrderDto>>> Receive(
        Guid id, [FromBody] ReceivePurchaseOrderRequest? request, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var po = await dbContext.PurchaseOrders
            .Include(p => p.Lines)
            .Include(p => p.Warehouse)
            .FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tenantId, ct);

        if (po is null) return NotFound(new ApiResponse<PurchaseOrderDto>(false, "ไม่พบใบสั่งซื้อ", null));
        if (po.Status == PurchaseOrderStatus.Cancelled)
            return BadRequest(new ApiResponse<PurchaseOrderDto>(false, "ใบสั่งซื้อถูกยกเลิกแล้ว", null));
        if (po.Status == PurchaseOrderStatus.Received)
            return BadRequest(new ApiResponse<PurchaseOrderDto>(false, "ใบสั่งซื้อนี้รับสินค้าครบแล้ว", null));

        var targetWarehouseId = request?.WarehouseId ?? po.WarehouseId;
        var username = GetUsername();
        var requestedMap = request?.Lines?.ToDictionary(l => l.LineId, l => l.ReceiveQuantity);

        var anyReceivedNow = false;
        foreach (var line in po.Lines)
        {
            var remaining = line.Quantity - line.ReceivedQuantity;
            if (remaining <= 0) continue;

            var receiveQty = requestedMap != null && requestedMap.TryGetValue(line.Id, out var rq)
                ? Math.Min(remaining, Math.Max(0m, rq))
                : remaining;

            if (receiveQty <= 0) continue;
            anyReceivedNow = true;
            line.ReceivedQuantity += receiveQty;

            if (line.ProductId.HasValue)
            {
                await inventoryService.AdjustWarehouseStockAsync(
                    tenantId,
                    line.ProductId.Value,
                    targetWarehouseId,
                    receiveQty,
                    StockMovementType.PurchaseIn,
                    po.PoNumber,
                    $"รับสินค้าตามใบสั่งซื้อ {po.PoNumber}",
                    username,
                    ct);
            }
        }

        if (!anyReceivedNow)
            return BadRequest(new ApiResponse<PurchaseOrderDto>(false, "ไม่มีจำนวนสินค้าที่ต้องรับเพิ่ม", null));

        var allReceived = po.Lines.All(l => l.ReceivedQuantity >= l.Quantity);
        po.Status = allReceived ? PurchaseOrderStatus.Received : PurchaseOrderStatus.PartiallyReceived;
        po.ReceivedAt = DateTime.UtcNow;
        po.UpdatedAt = DateTime.UtcNow;

        if ((request?.CreateExpenseRecord ?? true) && po.LinkedExpenseId is null && allReceived)
        {
            var linkedVendor = po.VendorId.HasValue
                ? await dbContext.Vendors.AsNoTracking().FirstOrDefaultAsync(v => v.Id == po.VendorId.Value && v.TenantId == tenantId, ct)
                : null;

            var whtRate = request?.WhtRate ?? linkedVendor?.DefaultWhtRate ?? 0m;
            var pndType = request?.PndType ?? linkedVendor?.DefaultPndType ?? PndType.None;
            if (whtRate > 0m && pndType == PndType.None) pndType = PndType.PND53;
            if (whtRate <= 0m) pndType = PndType.None;

            var whtAmount = whtRate > 0m
                ? Math.Round(po.TotalBeforeVat * (whtRate / 100m), 2, MidpointRounding.AwayFromZero)
                : 0m;
            var netPaid = Math.Max(0m, po.GrandTotal - whtAmount);

            var expense = new ExpenseRecord
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                VoucherNumber = await numberGenerator.GenerateNextNumberAsync(tenantId, DocumentType.ExpenseVoucher, ct),
                ExpenseDate = DateTime.UtcNow,
                TaxInvoiceNumber = request?.VendorTaxInvoiceNumber?.Trim(),
                TaxInvoiceDate = request?.VendorTaxInvoiceDate.HasValue == true
                    ? DateTime.SpecifyKind(request.VendorTaxInvoiceDate.Value, DateTimeKind.Utc)
                    : DateTime.UtcNow,
                VendorName = po.VendorName,
                VendorTaxId = po.VendorTaxId,
                VendorBranch = po.VendorBranch ?? "00000",
                VendorAddress = po.VendorAddress,
                Category = ExpenseCategory.CostOfGoods,
                Description = $"รับสินค้าตามใบสั่งซื้อ {po.PoNumber}",
                VatMode = po.VatMode,
                Subtotal = po.Subtotal,
                DiscountAmount = po.DiscountAmount,
                TotalBeforeVat = po.TotalBeforeVat,
                VatRate = po.VatRate,
                VatAmount = po.VatAmount,
                GrandTotal = po.GrandTotal,
                IsRefundableVat = po.VatAmount > 0,
                WhtRate = whtRate,
                WhtAmount = whtAmount,
                PndType = pndType,
                IncomeTypeDescription = whtRate > 0m ? (request?.IncomeTypeDescription?.Trim() ?? "ค่าซื้อสินค้า/วัสดุ") : null,
                NetPaidAmount = netPaid,
                Status = ExpenseStatus.Approved,
                CreatedBy = username,
                CreatedAt = DateTime.UtcNow
            };
            dbContext.ExpenseRecords.Add(expense);
            po.LinkedExpenseId = expense.Id;

            var accounting = HttpContext?.RequestServices?.GetService<IAccountingService>();
            if (accounting is not null)
            {
                await dbContext.SaveChangesAsync(ct);
                await accounting.PostExpenseAsync(expense, username, ct);
            }
        }

        await dbContext.SaveChangesAsync(ct);
        return Ok(new ApiResponse<PurchaseOrderDto>(true, "รับสินค้าเข้าคลังสำเร็จ", MapToDto(po)));
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<ApiResponse<PurchaseOrderDto>>> Cancel(Guid id, [FromBody] CancelExpenseRequest? request, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var po = await dbContext.PurchaseOrders
            .Include(p => p.Lines)
            .FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tenantId, ct);
        if (po is null) return NotFound(new ApiResponse<PurchaseOrderDto>(false, "ไม่พบใบสั่งซื้อ", null));
        if (po.Status == PurchaseOrderStatus.Received)
            return BadRequest(new ApiResponse<PurchaseOrderDto>(false, "ไม่สามารถยกเลิกใบสั่งซื้อที่รับสินค้าครบแล้ว", null));

        po.Status = PurchaseOrderStatus.Cancelled;
        po.CancellationReason = request?.Reason;
        po.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);
        return Ok(new ApiResponse<PurchaseOrderDto>(true, "ยกเลิกใบสั่งซื้อสำเร็จ", MapToDto(po)));
    }

    [HttpGet("{id:guid}/pdf")]
    public async Task<IActionResult> GetPdf(Guid id, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var po = await dbContext.PurchaseOrders
            .AsNoTracking()
            .Include(p => p.Lines.OrderBy(l => l.SortOrder))
            .FirstOrDefaultAsync(p => p.Id == id && p.TenantId == tenantId, ct);
        if (po is null) return NotFound();

        var tenant = await dbContext.Tenants.AsNoTracking().FirstAsync(t => t.Id == tenantId, ct);
        var pdf = pdfService.GeneratePurchaseOrderPdf(po, tenant);
        return File(pdf, "application/pdf", $"{po.PoNumber}.pdf");
    }

    private static PurchaseOrderDto MapToDto(PurchaseOrder p) => new(
        p.Id, p.PoNumber, p.OrderDate, p.ExpectedDeliveryDate,
        p.VendorId, p.VendorName, p.VendorTaxId, p.VendorBranch, p.VendorAddress,
        p.WarehouseId, p.Warehouse?.Name,
        p.VatMode, p.Subtotal, p.DiscountAmount, p.TotalBeforeVat,
        p.VatRate, p.VatAmount, p.GrandTotal, p.Status,
        p.Notes, p.ReceivedAt, p.LinkedExpenseId, p.CreatedAt,
        p.Lines.OrderBy(l => l.SortOrder).Select(l => new PurchaseOrderLineDto(
            l.Id, l.SortOrder, l.ProductId, l.Description, l.Unit,
            l.Quantity, l.ReceivedQuantity, l.UnitPrice, l.DiscountAmount, l.LineTotal)).ToList());
}
