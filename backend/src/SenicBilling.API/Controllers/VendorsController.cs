using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/vendors")]
[Authorize]
public class VendorsController(SenicBillingDbContext dbContext) : ControllerBase
{
    private Guid GetTenantId() => Guid.Parse(User.FindFirst("tenantId")!.Value);

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<VendorDto>>>> GetAll([FromQuery] string? search, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var query = dbContext.Vendors.AsNoTracking().Where(v => v.TenantId == tenantId && v.IsActive);

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(v =>
                v.Name.ToLower().Contains(term) ||
                (v.TaxId != null && v.TaxId.Contains(term)) ||
                (v.Phone != null && v.Phone.Contains(term)));
        }

        var items = await query.OrderBy(v => v.Name).Select(v => MapToDto(v)).ToListAsync(ct);
        return Ok(new ApiResponse<List<VendorDto>>(true, "สำเร็จ", items));
    }

    private static bool IsValidOptionalTaxId(string? taxId)
        => string.IsNullOrWhiteSpace(taxId) || (taxId.Trim().Length == 13 && taxId.Trim().All(char.IsDigit));

    [HttpPost]
    public async Task<ActionResult<ApiResponse<VendorDto>>> Create([FromBody] UpsertVendorRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new ApiResponse<VendorDto>(false, "กรุณาระบุชื่อผู้ขาย", null));
        if (!IsValidOptionalTaxId(request.TaxId))
            return BadRequest(new ApiResponse<VendorDto>(false, "เลขประจำตัวผู้เสียภาษีของผู้ขายต้องเป็นตัวเลข 13 หลัก", null));

        var vendor = new Vendor
        {
            Id = Guid.NewGuid(),
            TenantId = GetTenantId(),
            Name = request.Name.Trim(),
            TaxId = request.TaxId?.Trim(),
            Branch = string.IsNullOrWhiteSpace(request.Branch) ? "00000" : request.Branch.Trim(),
            Address = request.Address?.Trim(),
            Phone = request.Phone?.Trim(),
            Email = request.Email?.Trim(),
            ContactPerson = request.ContactPerson?.Trim(),
            PaymentTermsDays = request.PaymentTermsDays,
            DefaultWhtRate = request.DefaultWhtRate,
            DefaultPndType = request.DefaultPndType,
            Notes = request.Notes?.Trim(),
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.Vendors.Add(vendor);
        await dbContext.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetAll), new ApiResponse<VendorDto>(true, "เพิ่มผู้ขายสำเร็จ", MapToDto(vendor)));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<VendorDto>>> Update(Guid id, [FromBody] UpsertVendorRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new ApiResponse<VendorDto>(false, "กรุณาระบุชื่อผู้ขาย", null));
        if (!IsValidOptionalTaxId(request.TaxId))
            return BadRequest(new ApiResponse<VendorDto>(false, "เลขประจำตัวผู้เสียภาษีของผู้ขายต้องเป็นตัวเลข 13 หลัก", null));

        var tenantId = GetTenantId();
        var vendor = await dbContext.Vendors.FirstOrDefaultAsync(v => v.Id == id && v.TenantId == tenantId, ct);
        if (vendor is null) return NotFound(new ApiResponse<VendorDto>(false, "ไม่พบผู้ขาย", null));

        vendor.Name = request.Name.Trim();
        vendor.TaxId = request.TaxId?.Trim();
        vendor.Branch = string.IsNullOrWhiteSpace(request.Branch) ? "00000" : request.Branch.Trim();
        vendor.Address = request.Address?.Trim();
        vendor.Phone = request.Phone?.Trim();
        vendor.Email = request.Email?.Trim();
        vendor.ContactPerson = request.ContactPerson?.Trim();
        vendor.PaymentTermsDays = request.PaymentTermsDays;
        vendor.DefaultWhtRate = request.DefaultWhtRate;
        vendor.DefaultPndType = request.DefaultPndType;
        vendor.Notes = request.Notes?.Trim();
        vendor.IsActive = request.IsActive;
        vendor.UpdatedAt = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(ct);
        return Ok(new ApiResponse<VendorDto>(true, "อัปเดตผู้ขายสำเร็จ", MapToDto(vendor)));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var vendor = await dbContext.Vendors.FirstOrDefaultAsync(v => v.Id == id && v.TenantId == tenantId, ct);
        if (vendor is null) return NotFound(new ApiResponse<bool>(false, "ไม่พบผู้ขาย", false));

        vendor.IsActive = false;
        vendor.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);
        return Ok(new ApiResponse<bool>(true, "ลบผู้ขายสำเร็จ", true));
    }

    private static VendorDto MapToDto(Vendor v) => new(
        v.Id, v.Name, v.TaxId, v.Branch, v.Address, v.Phone, v.Email, v.ContactPerson,
        v.PaymentTermsDays, v.DefaultWhtRate, v.DefaultPndType, v.Notes, v.IsActive, v.CreatedAt);
}

