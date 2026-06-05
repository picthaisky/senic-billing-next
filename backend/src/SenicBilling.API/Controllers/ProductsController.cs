using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProductsController(SenicBillingDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<PaginatedResponse<ProductDto>>>> GetAll(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null, [FromQuery] string? category = null,
        CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        var query = dbContext.Products.Where(p => p.TenantId == tenantId && p.IsActive);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(p => p.Name.Contains(search) || (p.Sku != null && p.Sku.Contains(search)));
        if (!string.IsNullOrWhiteSpace(category))
            query = query.Where(p => p.Category == category);

        var total = await query.CountAsync(ct);
        var items = await query
            .OrderBy(p => p.Name)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(p => new ProductDto(p.Id, p.Sku, p.Name, p.Description, p.Unit, p.UnitPrice, p.Category, p.StockQuantity, p.IsActive))
            .ToListAsync(ct);

        return Ok(new ApiResponse<PaginatedResponse<ProductDto>>(true, "สำเร็จ",
            new PaginatedResponse<ProductDto>(items, total, page, pageSize)));
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<ApiResponse<ProductDto>>> GetById(Guid id, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var p = await dbContext.Products.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, ct);
        if (p is null) return NotFound(new ApiResponse<ProductDto>(false, "ไม่พบสินค้า", null));
        return Ok(new ApiResponse<ProductDto>(true, "สำเร็จ",
            new ProductDto(p.Id, p.Sku, p.Name, p.Description, p.Unit, p.UnitPrice, p.Category, p.StockQuantity, p.IsActive)));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<ProductDto>>> Create([FromBody] CreateProductRequest req, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var product = new Product
        {
            Id = Guid.NewGuid(), TenantId = tenantId, Sku = req.Sku, Name = req.Name,
            Description = req.Description, Unit = req.Unit, UnitPrice = req.UnitPrice,
            Category = req.Category, StockQuantity = req.StockQuantity
        };
        dbContext.Products.Add(product);
        await dbContext.SaveChangesAsync(ct);

        var dto = new ProductDto(product.Id, product.Sku, product.Name, product.Description,
            product.Unit, product.UnitPrice, product.Category, product.StockQuantity, product.IsActive);
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, new ApiResponse<ProductDto>(true, "สร้างสินค้าสำเร็จ", dto));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<ProductDto>>> Update(Guid id, [FromBody] UpdateProductRequest req, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var p = await dbContext.Products.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, ct);
        if (p is null) return NotFound(new ApiResponse<ProductDto>(false, "ไม่พบสินค้า", null));

        p.Sku = req.Sku; p.Name = req.Name; p.Description = req.Description;
        p.Unit = req.Unit; p.UnitPrice = req.UnitPrice; p.Category = req.Category;
        p.StockQuantity = req.StockQuantity; p.IsActive = req.IsActive; p.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);

        var dto = new ProductDto(p.Id, p.Sku, p.Name, p.Description, p.Unit, p.UnitPrice, p.Category, p.StockQuantity, p.IsActive);
        return Ok(new ApiResponse<ProductDto>(true, "อัปเดตสินค้าสำเร็จ", dto));
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult<ApiResponse<bool>>> Delete(Guid id, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var p = await dbContext.Products.FirstOrDefaultAsync(x => x.Id == id && x.TenantId == tenantId, ct);
        if (p is null) return NotFound(new ApiResponse<bool>(false, "ไม่พบสินค้า", false));

        p.IsActive = false;
        p.UpdatedAt = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<bool>(true, "ลบสินค้าสำเร็จ", true));
    }

    private Guid GetTenantId() => Guid.Parse(User.FindFirst("tenantId")!.Value);
}
