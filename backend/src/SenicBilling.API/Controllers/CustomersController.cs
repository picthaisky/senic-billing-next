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
public class CustomersController(SenicBillingDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PaginatedResponse<CustomerDto>>>> GetAll(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null, CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        var query = dbContext.Customers.Where(c => c.TenantId == tenantId && c.IsActive);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(c => c.Name.Contains(search) || (c.TaxId != null && c.TaxId.Contains(search)));

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(c => c.Name)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(c => new CustomerDto(c.Id, c.Name, c.TaxId, c.Branch, c.Address, c.Phone, c.Email, c.ContactPerson, c.Notes, c.IsActive))
            .ToListAsync(ct);

        return Ok(new ApiResponse<PaginatedResponse<CustomerDto>>(true, "สำเร็จ",
            new PaginatedResponse<CustomerDto>(items, total, page, pageSize)));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<CustomerDto>>> GetById(Guid id, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var c = await dbContext.Customers.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, ct);
        if (c is null) return NotFound(new ApiResponse<CustomerDto>(false, "ไม่พบข้อมูลลูกค้า", null));
        return Ok(new ApiResponse<CustomerDto>(true, "สำเร็จ",
            new CustomerDto(c.Id, c.Name, c.TaxId, c.Branch, c.Address, c.Phone, c.Email, c.ContactPerson, c.Notes, c.IsActive)));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<CustomerDto>>> Create([FromBody] CreateCustomerRequest req, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var customer = new Customer
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Name = req.Name, TaxId = req.TaxId,
            Branch = req.Branch, Address = req.Address, Phone = req.Phone, Email = req.Email,
            ContactPerson = req.ContactPerson, Notes = req.Notes
        };
        dbContext.Customers.Add(customer);
        await dbContext.SaveChangesAsync(ct);

        var dto = new CustomerDto(customer.Id, customer.Name, customer.TaxId, customer.Branch, customer.Address,
            customer.Phone, customer.Email, customer.ContactPerson, customer.Notes, customer.IsActive);
        return CreatedAtAction(nameof(GetById), new { id = customer.Id }, new ApiResponse<CustomerDto>(true, "สร้างข้อมูลลูกค้าสำเร็จ", dto));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<CustomerDto>>> Update(Guid id, [FromBody] UpdateCustomerRequest req, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var c = await dbContext.Customers.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, ct);
        if (c is null) return NotFound(new ApiResponse<CustomerDto>(false, "ไม่พบข้อมูลลูกค้า", null));

        c.Name = req.Name; c.TaxId = req.TaxId; c.Branch = req.Branch; c.Address = req.Address;
        c.Phone = req.Phone; c.Email = req.Email; c.ContactPerson = req.ContactPerson;
        c.Notes = req.Notes; c.IsActive = req.IsActive; c.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);

        var dto = new CustomerDto(c.Id, c.Name, c.TaxId, c.Branch, c.Address, c.Phone, c.Email, c.ContactPerson, c.Notes, c.IsActive);
        return Ok(new ApiResponse<CustomerDto>(true, "อัปเดตข้อมูลลูกค้าสำเร็จ", dto));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var c = await dbContext.Customers.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, ct);
        if (c is null) return NotFound(new ApiResponse<bool>(false, "ไม่พบข้อมูลลูกค้า", false));

        c.IsActive = false;
        c.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<bool>(true, "ลบข้อมูลลูกค้าสำเร็จ", true));
    }

    [HttpGet("{id:guid}/purchase-history")]
    public async Task<ActionResult<ApiResponse<CustomerPurchaseHistoryDto>>> GetPurchaseHistory(
        Guid id, [FromQuery] int recentDocsCount = 5, CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        
        var customer = await dbContext.Customers.FirstOrDefaultAsync(c => c.Id == id && c.TenantId == tenantId, ct);
        if (customer is null) return NotFound(new ApiResponse<CustomerPurchaseHistoryDto>(false, "ไม่พบข้อมูลลูกค้า", null));

        var docs = await dbContext.DocumentHeaders
            .Where(d =>
                d.TenantId == tenantId &&
                d.CustomerId == id &&
                d.Status != DocumentStatus.Cancelled &&
                d.Status != DocumentStatus.Draft &&
                d.DocumentType != DocumentType.Quotation)
            .OrderByDescending(d => d.DocumentDate)
            .ToListAsync(ct);

        var totalOrders = docs.Count;
        var totalSpent = docs.Sum(d => d.GrandTotal);
        var lastPurchaseDate = docs.FirstOrDefault()?.DocumentDate;

        var recentDocs = docs.Take(recentDocsCount).Select(d => new DocumentResponse(
            d.Id, d.DocumentType, d.DocumentNumber, d.DocumentDate, d.DueDate,
            d.CustomerId, d.CustomerName, d.CustomerAddress, d.CustomerBranch, d.CustomerTaxId,
            d.Status, d.VatMode, d.VatRate,
            d.Subtotal, d.DiscountAmount, d.TotalBeforeVat, d.VatAmount,
            d.WhtRate, d.WhtAmount, d.GrandTotal,
            d.Notes, d.ReferenceDocumentId, d.ConvertedFromDocumentId,
            d.DeliveryStatus, d.CancellationReason,
            d.SentAt, d.ViewedAt, d.CreatedAt, d.CreatedBy,
            new List<DocumentLineDto>() // omit lines for summary
        )).ToList();

        var dto = new CustomerPurchaseHistoryDto(id, customer.Name, totalOrders, totalSpent, lastPurchaseDate, recentDocs);
        return Ok(new ApiResponse<CustomerPurchaseHistoryDto>(true, "สำเร็จ", dto));
    }

    private Guid GetTenantId() => Guid.Parse(User.FindFirst("tenantId")!.Value);
}
