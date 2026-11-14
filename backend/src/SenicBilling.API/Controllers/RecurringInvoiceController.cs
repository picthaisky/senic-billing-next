using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class RecurringInvoiceController(SenicBillingDbContext dbContext) : ControllerBase
{
    private static readonly string[] AllowedFrequencies = ["Daily", "Weekly", "Monthly", "Yearly"];

    private static string? NormalizeFrequency(string? frequency)
    {
        if (string.IsNullOrWhiteSpace(frequency)) return null;
        return AllowedFrequencies.FirstOrDefault(f => string.Equals(f, frequency.Trim(), StringComparison.OrdinalIgnoreCase));
    }
    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<RecurringInvoiceDto>>>> GetAll(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var items = await dbContext.RecurringInvoices
            .Include(r => r.SourceDocument)
            .Where(r => r.TenantId == tenantId)
            .OrderBy(r => r.NextRunDate)
            .Select(r => new RecurringInvoiceDto(
                r.Id, r.SourceDocumentId, r.Frequency, r.NextRunDate,
                r.IsActive, r.MaxOccurrences, r.CurrentOccurrence,
                r.SourceDocument != null ? r.SourceDocument.DocumentNumber : null,
                r.SourceDocument != null ? r.SourceDocument.CustomerName : null,
                r.SourceDocument != null ? r.SourceDocument.DocumentType.ToString() : null))
            .ToListAsync(ct);

        return Ok(new ApiResponse<List<RecurringInvoiceDto>>(true, "สำเร็จ", items));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<RecurringInvoiceDto>>> Create([FromBody] CreateRecurringInvoiceRequest req, CancellationToken ct)
    {
        var tenantId = GetTenantId();

        var normalizedFrequency = NormalizeFrequency(req.Frequency);
        if (normalizedFrequency is null)
            return BadRequest(new ApiResponse<RecurringInvoiceDto>(false, "ความถี่ต้องเป็น Daily, Weekly, Monthly หรือ Yearly เท่านั้น", null));

        if (req.MaxOccurrences is <= 0)
            return BadRequest(new ApiResponse<RecurringInvoiceDto>(false, "จำนวนครั้งสูงสุดต้องมากกว่า 0", null));

        // Validate Source Document
        var source = await dbContext.DocumentHeaders.FirstOrDefaultAsync(d => d.Id == req.SourceDocumentId && d.TenantId == tenantId, ct);
        if (source == null)
            return NotFound(new ApiResponse<RecurringInvoiceDto>(false, "ไม่พบเอกสารต้นฉบับ", null));

        if (source.Status == DocumentStatus.Cancelled)
            return BadRequest(new ApiResponse<RecurringInvoiceDto>(false, "ไม่สามารถสร้างกำหนดการจากเอกสารที่ยกเลิกแล้ว", null));

        var recurring = new RecurringInvoice
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            SourceDocumentId = req.SourceDocumentId,
            Frequency = normalizedFrequency,
            NextRunDate = req.NextRunDate,
            MaxOccurrences = req.MaxOccurrences,
            IsActive = true
        };

        dbContext.RecurringInvoices.Add(recurring);
        await dbContext.SaveChangesAsync(ct);

        var dto = new RecurringInvoiceDto(
            recurring.Id, recurring.SourceDocumentId, recurring.Frequency,
            recurring.NextRunDate, recurring.IsActive, recurring.MaxOccurrences, recurring.CurrentOccurrence,
            source.DocumentNumber, source.CustomerName, source.DocumentType.ToString());

        return Ok(new ApiResponse<RecurringInvoiceDto>(true, "สร้างกำหนดการออกเอกสารอัตโนมัติสำเร็จ", dto));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<RecurringInvoiceDto>>> Update(Guid id, [FromBody] UpdateRecurringInvoiceRequest req, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var recurring = await dbContext.RecurringInvoices
            .Include(r => r.SourceDocument)
            .FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantId, ct);

        if (recurring == null)
            return NotFound(new ApiResponse<RecurringInvoiceDto>(false, "ไม่พบกำหนดการ", null));

        var normalizedFrequency = NormalizeFrequency(req.Frequency);
        if (normalizedFrequency is null)
            return BadRequest(new ApiResponse<RecurringInvoiceDto>(false, "ความถี่ต้องเป็น Daily, Weekly, Monthly หรือ Yearly เท่านั้น", null));

        if (req.MaxOccurrences is <= 0)
            return BadRequest(new ApiResponse<RecurringInvoiceDto>(false, "จำนวนครั้งสูงสุดต้องมากกว่า 0", null));

        recurring.Frequency = normalizedFrequency;
        recurring.NextRunDate = req.NextRunDate;
        recurring.IsActive = req.IsActive;
        recurring.MaxOccurrences = req.MaxOccurrences;
        recurring.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(ct);

        var dto = new RecurringInvoiceDto(
            recurring.Id, recurring.SourceDocumentId, recurring.Frequency,
            recurring.NextRunDate, recurring.IsActive, recurring.MaxOccurrences, recurring.CurrentOccurrence,
            recurring.SourceDocument?.DocumentNumber,
            recurring.SourceDocument?.CustomerName,
            recurring.SourceDocument?.DocumentType.ToString());

        return Ok(new ApiResponse<RecurringInvoiceDto>(true, "อัปเดตกำหนดการสำเร็จ", dto));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var recurring = await dbContext.RecurringInvoices.FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantId, ct);

        if (recurring == null)
            return NotFound(new ApiResponse<bool>(false, "ไม่พบกำหนดการ", false));

        dbContext.RecurringInvoices.Remove(recurring);
        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<bool>(true, "ลบกำหนดการสำเร็จ", true));
    }

    private Guid GetTenantId() => Guid.Parse(User.FindFirst("tenantId")!.Value);
}
