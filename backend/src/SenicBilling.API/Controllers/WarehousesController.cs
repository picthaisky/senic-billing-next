using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/warehouses")]
[Authorize]
public class WarehousesController(
    SenicBillingDbContext dbContext,
    IInventoryService inventoryService) : ControllerBase
{
    private Guid GetTenantId() => Guid.Parse(User.FindFirst("tenantId")!.Value);
    private string? GetUsername() => User.FindFirst(ClaimTypes.Name)?.Value ?? User.Identity?.Name;

    [HttpGet]
    public async Task<ActionResult<ApiResponse<List<WarehouseDto>>>> GetAll(CancellationToken ct)
    {
        var tenantId = GetTenantId();
        await inventoryService.EnsureDefaultWarehouseAsync(tenantId, ct);

        var warehouses = await dbContext.Warehouses
            .AsNoTracking()
            .Include(w => w.Stocks)
            .Where(w => w.TenantId == tenantId && w.IsActive)
            .OrderByDescending(w => w.IsDefault)
            .ThenBy(w => w.Name)
            .ToListAsync(ct);

        var result = warehouses.Select(w => new WarehouseDto(
            w.Id, w.Code, w.Name, w.Address, w.IsDefault, w.IsActive,
            w.Stocks.Count(s => s.Quantity > 0),
            w.Stocks.Sum(s => s.Quantity))).ToList();

        return Ok(new ApiResponse<List<WarehouseDto>>(true, "สำเร็จ", result));
    }

    [HttpPost]
    public async Task<ActionResult<ApiResponse<WarehouseDto>>> Create([FromBody] UpsertWarehouseRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new ApiResponse<WarehouseDto>(false, "กรุณาระบุรหัสและชื่อคลังสินค้า", null));

        var code = request.Code.Trim().ToUpperInvariant();
        if (await dbContext.Warehouses.AnyAsync(w => w.TenantId == tenantId && w.Code == code, ct))
            return BadRequest(new ApiResponse<WarehouseDto>(false, $"รหัสคลัง {code} มีอยู่ในระบบแล้ว", null));

        if (request.IsDefault)
        {
            var others = await dbContext.Warehouses.Where(w => w.TenantId == tenantId && w.IsDefault).ToListAsync(ct);
            foreach (var o in others) o.IsDefault = false;
        }

        var wh = new Warehouse
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = code,
            Name = request.Name.Trim(),
            Address = request.Address?.Trim(),
            IsDefault = request.IsDefault,
            IsActive = request.IsActive,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.Warehouses.Add(wh);
        await dbContext.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetAll), new ApiResponse<WarehouseDto>(true, "เพิ่มคลังสินค้าสำเร็จ",
            new WarehouseDto(wh.Id, wh.Code, wh.Name, wh.Address, wh.IsDefault, wh.IsActive, 0, 0m)));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<ApiResponse<WarehouseDto>>> Update(
        Guid id, [FromBody] UpsertWarehouseRequest request, CancellationToken ct)
    {
        var tenantId = GetTenantId();
        var wh = await dbContext.Warehouses
            .Include(w => w.Stocks)
            .FirstOrDefaultAsync(w => w.Id == id && w.TenantId == tenantId, ct);
        if (wh is null)
            return NotFound(new ApiResponse<WarehouseDto>(false, "ไม่พบคลังสินค้า", null));

        if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new ApiResponse<WarehouseDto>(false, "กรุณาระบุรหัสและชื่อคลังสินค้า", null));

        var code = request.Code.Trim().ToUpperInvariant();
        if (await dbContext.Warehouses.AnyAsync(w => w.TenantId == tenantId && w.Id != id && w.Code == code, ct))
            return BadRequest(new ApiResponse<WarehouseDto>(false, $"รหัสคลัง {code} มีอยู่ในระบบแล้ว", null));

        if (request.IsDefault)
        {
            var others = await dbContext.Warehouses.Where(w => w.TenantId == tenantId && w.Id != id && w.IsDefault).ToListAsync(ct);
            foreach (var o in others) o.IsDefault = false;
        }

        wh.Code = code;
        wh.Name = request.Name.Trim();
        wh.Address = request.Address?.Trim();
        wh.IsDefault = request.IsDefault;
        wh.IsActive = request.IsActive;
        await dbContext.SaveChangesAsync(ct);

        return Ok(new ApiResponse<WarehouseDto>(true, "อัปเดตคลังสินค้าสำเร็จ",
            new WarehouseDto(wh.Id, wh.Code, wh.Name, wh.Address, wh.IsDefault, wh.IsActive,
                wh.Stocks.Count(s => s.Quantity > 0), wh.Stocks.Sum(s => s.Quantity))));
    }

    [HttpGet("stocks")]
    public async Task<ActionResult<ApiResponse<List<WarehouseStockItemDto>>>> GetStocks(
        [FromQuery] Guid? warehouseId, [FromQuery] bool lowStockOnly = false, CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        var query = dbContext.ProductWarehouseStocks
            .AsNoTracking()
            .Include(s => s.Product)
            .Include(s => s.Warehouse)
            .Where(s => s.TenantId == tenantId && s.Product.IsActive && s.Warehouse.IsActive);

        if (warehouseId.HasValue) query = query.Where(s => s.WarehouseId == warehouseId.Value);
        if (lowStockOnly) query = query.Where(s => s.Quantity <= s.ReorderLevel);

        var items = await query
            .OrderBy(s => s.Warehouse.Name)
            .ThenBy(s => s.Product.Name)
            .Select(s => new WarehouseStockItemDto(
                s.ProductId, s.Product.Sku, s.Product.Name, s.Product.Unit,
                s.WarehouseId, s.Warehouse.Code, s.Warehouse.Name,
                s.Quantity, s.ReorderLevel, s.Quantity <= s.ReorderLevel))
            .ToListAsync(ct);

        return Ok(new ApiResponse<List<WarehouseStockItemDto>>(true, "สำเร็จ", items));
    }

    [HttpPost("transfer")]
    public async Task<ActionResult<ApiResponse<bool>>> Transfer([FromBody] TransferStockRequest request, CancellationToken ct)
    {
        try
        {
            await inventoryService.TransferStockAsync(
                GetTenantId(), request.ProductId, request.FromWarehouseId, request.ToWarehouseId,
                request.Quantity, request.Notes, GetUsername(), ct);
            return Ok(new ApiResponse<bool>(true, "โอนย้ายสินค้าระหว่างคลังสำเร็จ", true));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<bool>(false, ex.Message, false));
        }
    }

    [HttpPost("adjust")]
    public async Task<ActionResult<ApiResponse<bool>>> Adjust([FromBody] AdjustStockRequest request, CancellationToken ct)
    {
        try
        {
            await inventoryService.SetWarehouseStockAsync(
                GetTenantId(), request.ProductId, request.WarehouseId,
                request.NewQuantity, request.ReorderLevel, request.Notes, GetUsername(), ct);
            return Ok(new ApiResponse<bool>(true, "ปรับปรุงยอดสต็อกสำเร็จ", true));
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new ApiResponse<bool>(false, ex.Message, false));
        }
    }

    [HttpGet("movements")]
    public async Task<ActionResult<ApiResponse<List<StockMovementDto>>>> GetMovements(
        [FromQuery] Guid? warehouseId, [FromQuery] Guid? productId, [FromQuery] int take = 100, CancellationToken ct = default)
    {
        var tenantId = GetTenantId();
        var query = dbContext.StockMovements
            .AsNoTracking()
            .Include(m => m.Product)
            .Include(m => m.Warehouse)
            .Where(m => m.TenantId == tenantId);

        if (warehouseId.HasValue) query = query.Where(m => m.WarehouseId == warehouseId.Value);
        if (productId.HasValue) query = query.Where(m => m.ProductId == productId.Value);

        var rows = await query
            .OrderByDescending(m => m.CreatedAt)
            .Take(Math.Clamp(take, 1, 500))
            .Select(m => new StockMovementDto(
                m.Id, m.ProductId, m.Product.Name, m.WarehouseId, m.Warehouse.Name,
                m.MovementType, m.QuantityDelta, m.BalanceAfter,
                m.ReferenceNumber, m.Notes, m.CreatedBy, m.CreatedAt))
            .ToListAsync(ct);

        return Ok(new ApiResponse<List<StockMovementDto>>(true, "สำเร็จ", rows));
    }
}

