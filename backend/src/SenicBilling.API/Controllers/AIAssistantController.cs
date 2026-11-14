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

        // Build Context aligned with DashboardController revenue recognition rules
        var now = DateTime.UtcNow;
        var startOfMonth = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);

        var thisMonthDocs = await dbContext.DocumentHeaders
            .AsNoTracking()
            .Where(d => d.TenantId == tenantId
                && d.Status != DocumentStatus.Draft
                && d.Status != DocumentStatus.Cancelled
                && d.DocumentType != DocumentType.Quotation
                && d.DocumentType != DocumentType.DeliveryNote
                && d.DocumentDate >= startOfMonth)
            .Select(d => new { d.DocumentType, d.GrandTotal, d.VatAmount, d.WhtAmount })
            .ToListAsync(ct);

        var thisMonthRevenue = thisMonthDocs.Sum(d => d.DocumentType == DocumentType.CreditNote ? -d.GrandTotal : d.GrandTotal);
        var thisMonthOutputVat = thisMonthDocs.Sum(d => d.DocumentType == DocumentType.CreditNote ? -d.VatAmount : d.VatAmount);
        var thisMonthSalesWht = thisMonthDocs.Sum(d => d.DocumentType == DocumentType.CreditNote ? -d.WhtAmount : d.WhtAmount);

        var thisMonthExpenses = await dbContext.ExpenseRecords
            .AsNoTracking()
            .Where(e => e.TenantId == tenantId
                && e.Status != ExpenseStatus.Cancelled
                && e.ExpenseDate >= startOfMonth)
            .Select(e => new { e.GrandTotal, e.VatAmount, e.IsRefundableVat, e.WhtAmount })
            .ToListAsync(ct);

        var totalExpenseAmount = thisMonthExpenses.Sum(e => e.GrandTotal);
        var inputVat = thisMonthExpenses.Where(e => e.IsRefundableVat).Sum(e => e.VatAmount);
        var payableWht = thisMonthExpenses.Sum(e => e.WhtAmount);

        var overdueDocs = await dbContext.DocumentHeaders
            .AsNoTracking()
            .Where(d => d.TenantId == tenantId
                && d.DocumentType != DocumentType.Quotation
                && d.Status != DocumentStatus.Paid
                && d.Status != DocumentStatus.Cancelled
                && (d.Status == DocumentStatus.Overdue || (d.DueDate.HasValue && d.DueDate.Value < now)))
            .Select(d => new { d.DocumentNumber, d.CustomerName, d.GrandTotal })
            .ToListAsync(ct);

        var lowStockItems = await dbContext.ProductWarehouseStocks
            .AsNoTracking()
            .Include(s => s.Product)
            .Include(s => s.Warehouse)
            .Where(s => s.TenantId == tenantId && s.ReorderLevel > 0 && s.Quantity <= s.ReorderLevel)
            .OrderBy(s => s.Quantity)
            .Take(10)
            .Select(s => new { ProductName = s.Product.Name, WarehouseName = s.Warehouse.Name, s.Quantity, s.ReorderLevel })
            .ToListAsync(ct);

        var recentDocs = await dbContext.DocumentHeaders
            .AsNoTracking()
            .Where(d => d.TenantId == tenantId)
            .OrderByDescending(d => d.CreatedAt)
            .Take(5)
            .Select(d => new { d.DocumentNumber, d.Status, d.GrandTotal })
            .ToListAsync(ct);

        var contextBuilder = new System.Text.StringBuilder();
        contextBuilder.AppendLine($"[สรุปยอดขายเดือนนี้]: {thisMonthRevenue:N2} บาท");
        contextBuilder.AppendLine($"[ค่าใช้จ่ายเดือนนี้]: {totalExpenseAmount:N2} บาท");
        contextBuilder.AppendLine($"[สรุปภาษีเดือนนี้]: ภาษีขาย={thisMonthOutputVat:N2} บาท, ภาษีซื้อขอคืนได้={inputVat:N2} บาท, VAT สุทธิ={(thisMonthOutputVat - inputVat):N2} บาท, หัก ณ ที่จ่ายฝั่งขาย={thisMonthSalesWht:N2} บาท, หัก ณ ที่จ่ายต้องนำส่งฝั่งซื้อ={payableWht:N2} บาท");
        contextBuilder.AppendLine($"[รายการค้างชำระ ({overdueDocs.Count} รายการ)]:");
        foreach (var doc in overdueDocs.Take(10)) // limit to 10 for context size
        {
            contextBuilder.AppendLine($"- เอกสาร {doc.DocumentNumber} (ลูกค้า: {doc.CustomerName}), ยอด: {doc.GrandTotal:N2} บาท");
        }
        contextBuilder.AppendLine($"[สินค้าใกล้หมดสต็อก ({lowStockItems.Count} รายการ)]:");
        foreach (var stock in lowStockItems)
        {
            contextBuilder.AppendLine($"- {stock.ProductName} ({stock.WarehouseName}): คงเหลือ {stock.Quantity:N0} / ขั้นต่ำ {stock.ReorderLevel:N0}");
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

    /// <summary>AI Smart Receipt Parser — สกัดข้อมูลใบเสร็จ/ใบกำกับภาษีซื้อเพื่อกรอกฟอร์มค่าใช้จ่าย</summary>
    [HttpPost("parse-expense")]
    public async Task<ActionResult<ApiResponse<ParsedExpenseDto>>> ParseExpense([FromBody] ParseExpenseRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Text))
            return BadRequest(new ApiResponse<ParsedExpenseDto>(false, "กรุณาวางข้อความจากใบเสร็จ", null));
        if (req.Text.Length > 10_000)
            return BadRequest(new ApiResponse<ParsedExpenseDto>(false, "ข้อความยาวเกินไป (สูงสุด 10,000 ตัวอักษร)", null));

        var parsed = await aiService.ParseExpenseAsync(req.Text, ct);
        return Ok(new ApiResponse<ParsedExpenseDto>(true, parsed.UsedAi ? "วิเคราะห์ด้วย AI สำเร็จ" : "วิเคราะห์ข้อความสำเร็จ (โหมดออฟไลน์)", parsed));
    }
}
