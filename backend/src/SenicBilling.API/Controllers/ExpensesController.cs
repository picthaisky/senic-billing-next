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

/// <summary>
/// ใบสำคัญจ่าย / บันทึกค่าใช้จ่าย พร้อมภาษีซื้อ (Input VAT) และภาษีหัก ณ ที่จ่าย (50 ทวิ).
/// </summary>
[ApiController]
[Route("api/expenses")]
[Authorize]
public class ExpensesController(
    SenicBillingDbContext dbContext,
    IDocumentNumberGeneratorService numberGenerator,
    IPdfService pdfService) : ControllerBase
{
    private Guid GetTenantId() => Guid.Parse(User.FindFirst("tenantId")!.Value);

    [HttpGet]
    public async Task<ActionResult<ApiResponse<ExpenseListResponse>>> GetAll(
        [FromQuery] int? year,
        [FromQuery] int? month,
        [FromQuery] ExpenseCategory? category,
        [FromQuery] PndType? pndType,
        [FromQuery] ExpenseStatus? status,
        [FromQuery] string? search,
        CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var query = dbContext.ExpenseRecords.AsNoTracking().Where(e => e.TenantId == tenantId);

        if (year is > 0)
        {
            var start = new DateTime(year.Value, month is >= 1 and <= 12 ? month.Value : 1, 1, 0, 0, 0, DateTimeKind.Utc);
            var end = month is >= 1 and <= 12 ? start.AddMonths(1) : start.AddYears(1);
            query = query.Where(e => e.ExpenseDate >= start && e.ExpenseDate < end);
        }

        if (category.HasValue) query = query.Where(e => e.Category == category.Value);
        if (pndType.HasValue) query = query.Where(e => e.PndType == pndType.Value);
        if (status.HasValue) query = query.Where(e => e.Status == status.Value);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(e =>
                e.VoucherNumber.ToLower().Contains(term) ||
                e.VendorName.ToLower().Contains(term) ||
                e.Description.ToLower().Contains(term) ||
                (e.TaxInvoiceNumber != null && e.TaxInvoiceNumber.ToLower().Contains(term)) ||
                (e.VendorTaxId != null && e.VendorTaxId.Contains(term)));
        }

        var items = await query
            .OrderByDescending(e => e.ExpenseDate)
            .ThenByDescending(e => e.CreatedAt)
            .ToListAsync(ct);

        var summary = BuildSummary(items);
        return Ok(new ApiResponse<ExpenseListResponse>(true, "สำเร็จ",
            new ExpenseListResponse(items.Select(MapToResponse), summary)));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<ExpenseResponse>>> GetById(Guid id, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var expense = await dbContext.ExpenseRecords.AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id && e.TenantId == tenantId, ct);
        if (expense is null) return NotFound(new ApiResponse<ExpenseResponse>(false, "ไม่พบใบสำคัญจ่าย", null));

        return Ok(new ApiResponse<ExpenseResponse>(true, "สำเร็จ", MapToResponse(expense)));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<ExpenseResponse>>> Create([FromBody] CreateExpenseRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var validationError = Validate(request);
        if (validationError is not null)
            return BadRequest(new ApiResponse<ExpenseResponse>(false, validationError, null));

        var expense = new ExpenseRecord
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            VoucherNumber = await numberGenerator.GenerateNextNumberAsync(tenantId, DocumentType.ExpenseVoucher, ct),
            CreatedBy = User.FindFirst(ClaimTypes.Name)?.Value ?? User.Identity?.Name,
            CreatedAt = DateTime.UtcNow
        };

        ApplyRequest(expense, request);
        dbContext.ExpenseRecords.Add(expense);
        await dbContext.SaveChangesAsync(ct);

        var accounting = HttpContext?.RequestServices?.GetService<IAccountingService>();
        if (accounting is not null)
        {
            await accounting.PostExpenseAsync(expense, expense.CreatedBy, ct);
        }

        return CreatedAtAction(nameof(GetById), new { id = expense.Id },
            new ApiResponse<ExpenseResponse>(true, "บันทึกใบสำคัญจ่ายสำเร็จ", MapToResponse(expense)));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<ExpenseResponse>>> Update(Guid id, [FromBody] CreateExpenseRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var expense = await dbContext.ExpenseRecords.FirstOrDefaultAsync(e => e.Id == id && e.TenantId == tenantId, ct);
        if (expense is null) return NotFound(new ApiResponse<ExpenseResponse>(false, "ไม่พบใบสำคัญจ่าย", null));
        if (expense.Status == ExpenseStatus.Cancelled)
            return BadRequest(new ApiResponse<ExpenseResponse>(false, "ไม่สามารถแก้ไขใบสำคัญจ่ายที่ยกเลิกแล้ว", null));

        var validationError = Validate(request);
        if (validationError is not null)
            return BadRequest(new ApiResponse<ExpenseResponse>(false, validationError, null));

        ApplyRequest(expense, request);
        expense.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);

        var accounting = HttpContext?.RequestServices?.GetService<IAccountingService>();
        if (accounting is not null && expense.Status is ExpenseStatus.Approved or ExpenseStatus.Paid)
        {
            var username = User.FindFirst(ClaimTypes.Name)?.Value ?? User.Identity?.Name;
            await accounting.ReverseSourceEntriesAsync(tenantId, JournalSourceType.Expense, expense.Id, "แก้ไขข้อมูลใบสำคัญจ่าย", username, ct);
            await accounting.PostExpenseAsync(expense, username, ct);
        }

        return Ok(new ApiResponse<ExpenseResponse>(true, "แก้ไขใบสำคัญจ่ายสำเร็จ", MapToResponse(expense)));
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<ApiResponse<ExpenseResponse>>> Cancel(Guid id, [FromBody] CancelExpenseRequest? request, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var expense = await dbContext.ExpenseRecords.FirstOrDefaultAsync(e => e.Id == id && e.TenantId == tenantId, ct);
        if (expense is null) return NotFound(new ApiResponse<ExpenseResponse>(false, "ไม่พบใบสำคัญจ่าย", null));
        if (expense.Status == ExpenseStatus.Cancelled)
            return BadRequest(new ApiResponse<ExpenseResponse>(false, "ใบสำคัญจ่ายนี้ถูกยกเลิกแล้ว", null));

        expense.Status = ExpenseStatus.Cancelled;
        expense.CancellationReason = request?.Reason;
        expense.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);

        var accounting = HttpContext?.RequestServices?.GetService<IAccountingService>();
        if (accounting is not null)
        {
            var username = User.FindFirst(ClaimTypes.Name)?.Value ?? User.Identity?.Name;
            await accounting.ReverseSourceEntriesAsync(tenantId, JournalSourceType.Expense, expense.Id, request?.Reason, username, ct);
        }

        return Ok(new ApiResponse<ExpenseResponse>(true, "ยกเลิกใบสำคัญจ่ายสำเร็จ", MapToResponse(expense)));
    }

    /// <summary>หนังสือรับรองการหักภาษี ณ ที่จ่าย (มาตรา 50 ทวิ) PDF</summary>
    [HttpGet("{id:guid}/wht-certificate-pdf")]
    public async Task<IActionResult> GetWhtCertificatePdf(Guid id, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var expense = await dbContext.ExpenseRecords.AsNoTracking()
            .FirstOrDefaultAsync(e => e.Id == id && e.TenantId == tenantId, ct);
        if (expense is null) return NotFound(new ApiResponse<object>(false, "ไม่พบใบสำคัญจ่าย", null));
        if (expense.WhtAmount <= 0 || expense.PndType == PndType.None)
            return BadRequest(new ApiResponse<object>(false, "รายการนี้ไม่มีการหักภาษี ณ ที่จ่าย", null));
        if (expense.Status == ExpenseStatus.Cancelled)
            return BadRequest(new ApiResponse<object>(false, "ใบสำคัญจ่ายนี้ถูกยกเลิกแล้ว", null));

        var tenant = await dbContext.Tenants.AsNoTracking().FirstAsync(t => t.Id == tenantId, ct);
        var pdf = pdfService.GenerateWhtCertificatePdf(expense, tenant);
        return File(pdf, "application/pdf", $"WHT50Tawi_{expense.VoucherNumber}.pdf");
    }

    // ──────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────

    private static string? Validate(CreateExpenseRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.VendorName)) return "กรุณาระบุชื่อผู้ขาย / ผู้รับเงิน";
        if (string.IsNullOrWhiteSpace(request.Description)) return "กรุณาระบุรายละเอียดค่าใช้จ่าย";
        if (request.Amount <= 0) return "ยอดเงินต้องมากกว่า 0";
        if (request.DiscountAmount < 0 || request.DiscountAmount > request.Amount) return "ส่วนลดไม่ถูกต้อง";
        if (request.VatRate is < 0 or > 100) return "อัตราภาษีมูลค่าเพิ่มไม่ถูกต้อง";
        if (!ExpenseCalculator.AllowedWhtRates.Contains(request.WhtRate)) return "อัตราภาษีหัก ณ ที่จ่ายไม่ถูกต้อง";
        if (request.WhtRate > 0 && request.PndType == PndType.None) return "กรุณาเลือกประเภทแบบ ภ.ง.ด.3 หรือ ภ.ง.ด.53";
        if (!string.IsNullOrWhiteSpace(request.VendorTaxId) &&
            (request.VendorTaxId.Trim().Length != 13 || !request.VendorTaxId.Trim().All(char.IsDigit)))
            return "เลขประจำตัวผู้เสียภาษีของผู้ขายต้องเป็นตัวเลข 13 หลัก";
        if (request.WhtRate > 0 && string.IsNullOrWhiteSpace(request.VendorTaxId))
            return "การหักภาษี ณ ที่จ่ายต้องระบุเลขประจำตัวผู้เสียภาษีของผู้ถูกหัก";
        return null;
    }

    private static void ApplyRequest(ExpenseRecord expense, CreateExpenseRequest request)
    {
        var amounts = ExpenseCalculator.Calculate(
            request.Amount, request.DiscountAmount, request.VatMode, request.VatRate, request.WhtRate);

        expense.ExpenseDate = DateTime.SpecifyKind(request.ExpenseDate, DateTimeKind.Utc);
        expense.TaxInvoiceNumber = request.TaxInvoiceNumber?.Trim();
        expense.TaxInvoiceDate = request.TaxInvoiceDate.HasValue
            ? DateTime.SpecifyKind(request.TaxInvoiceDate.Value, DateTimeKind.Utc)
            : null;
        expense.VendorName = request.VendorName.Trim();
        expense.VendorTaxId = string.IsNullOrWhiteSpace(request.VendorTaxId) ? null : request.VendorTaxId.Trim();
        expense.VendorBranch = string.IsNullOrWhiteSpace(request.VendorBranch) ? "00000" : request.VendorBranch.Trim();
        expense.VendorAddress = request.VendorAddress?.Trim();
        expense.Category = request.Category;
        expense.Description = request.Description.Trim();
        expense.VatMode = request.VatMode;
        expense.VatRate = request.VatRate;
        expense.IsRefundableVat = request.VatRate > 0 && request.IsRefundableVat;
        expense.WhtRate = request.WhtRate;
        expense.PndType = request.WhtRate > 0 ? request.PndType : PndType.None;
        expense.IncomeTypeDescription = request.WhtRate > 0 ? request.IncomeTypeDescription?.Trim() : null;
        expense.Status = request.Status == ExpenseStatus.Cancelled ? ExpenseStatus.Approved : request.Status;
        expense.AttachmentUrl = request.AttachmentUrl;
        expense.Notes = request.Notes;

        expense.Subtotal = amounts.Subtotal;
        expense.DiscountAmount = amounts.DiscountAmount;
        expense.TotalBeforeVat = amounts.TotalBeforeVat;
        expense.VatAmount = amounts.VatAmount;
        expense.GrandTotal = amounts.GrandTotal;
        expense.WhtAmount = amounts.WhtAmount;
        expense.NetPaidAmount = amounts.NetPaidAmount;
    }

    internal static ExpenseSummaryDto BuildSummary(IReadOnlyCollection<ExpenseRecord> items)
    {
        var active = items.Where(e => e.Status != ExpenseStatus.Cancelled).ToList();
        return new ExpenseSummaryDto(
            Count: active.Count,
            TotalBeforeVat: active.Sum(e => e.TotalBeforeVat),
            TotalInputVat: active.Sum(e => e.VatAmount),
            TotalRefundableInputVat: active.Where(e => e.IsRefundableVat).Sum(e => e.VatAmount),
            TotalWht: active.Sum(e => e.WhtAmount),
            TotalPnd3Wht: active.Where(e => e.PndType == PndType.PND3).Sum(e => e.WhtAmount),
            TotalPnd53Wht: active.Where(e => e.PndType == PndType.PND53).Sum(e => e.WhtAmount),
            TotalGrandTotal: active.Sum(e => e.GrandTotal),
            TotalNetPaid: active.Sum(e => e.NetPaidAmount));
    }

    internal static ExpenseResponse MapToResponse(ExpenseRecord e) => new(
        e.Id, e.VoucherNumber, e.ExpenseDate, e.TaxInvoiceNumber, e.TaxInvoiceDate,
        e.VendorName, e.VendorTaxId, e.VendorBranch, e.VendorAddress,
        e.Category, e.Description, e.VatMode,
        e.Subtotal, e.DiscountAmount, e.TotalBeforeVat, e.VatRate, e.VatAmount, e.GrandTotal,
        e.IsRefundableVat, e.WhtRate, e.WhtAmount, e.PndType, e.IncomeTypeDescription,
        e.NetPaidAmount, e.Status, e.AttachmentUrl, e.Notes, e.CancellationReason, e.CreatedAt);
}

