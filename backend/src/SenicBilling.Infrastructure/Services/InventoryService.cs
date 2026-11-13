using Microsoft.EntityFrameworkCore;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.Infrastructure.Services;

public class InventoryService(SenicBillingDbContext dbContext) : IInventoryService
{
    public async Task<Warehouse> EnsureDefaultWarehouseAsync(Guid tenantId, CancellationToken ct = default)
    {
        var existing = await dbContext.Warehouses
            .Where(w => w.TenantId == tenantId && w.IsActive)
            .OrderByDescending(w => w.IsDefault)
            .ThenBy(w => w.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (existing is not null) return existing;

        var main = new Warehouse
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = "WH-MAIN",
            Name = "คลังสินค้าหลัก",
            IsDefault = true,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        dbContext.Warehouses.Add(main);
        await dbContext.SaveChangesAsync(ct);
        return main;
    }

    public async Task<decimal> AdjustWarehouseStockAsync(
        Guid tenantId,
        Guid productId,
        Guid? warehouseId,
        decimal quantityDelta,
        StockMovementType movementType,
        string? referenceNumber,
        string? notes,
        string? createdBy,
        CancellationToken ct = default,
        bool saveChanges = true)
    {
        var product = await dbContext.Products.FirstOrDefaultAsync(p => p.Id == productId && p.TenantId == tenantId, ct)
            ?? throw new InvalidOperationException("ไม่พบสินค้าในระบบ");

        var targetWarehouse = warehouseId.HasValue
            ? await dbContext.Warehouses.FirstOrDefaultAsync(w => w.Id == warehouseId.Value && w.TenantId == tenantId, ct)
                ?? throw new InvalidOperationException("ไม่พบคลังสินค้าที่ระบุ")
            : await EnsureDefaultWarehouseAsync(tenantId, ct);

        var stock = await GetOrInitializeStockAsync(tenantId, product, targetWarehouse, ct);
        stock.Quantity += quantityDelta;
        stock.UpdatedAt = DateTime.UtcNow;

        dbContext.StockMovements.Add(new StockMovement
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ProductId = productId,
            WarehouseId = targetWarehouse.Id,
            MovementType = movementType,
            QuantityDelta = quantityDelta,
            BalanceAfter = stock.Quantity,
            ReferenceNumber = referenceNumber,
            Notes = notes,
            CreatedBy = createdBy,
            CreatedAt = DateTime.UtcNow
        });

        await SyncProductTotalStockAsync(tenantId, product, ct);
        if (saveChanges)
        {
            await dbContext.SaveChangesAsync(ct);
        }
        return stock.Quantity;
    }

    public async Task SetWarehouseStockAsync(
        Guid tenantId,
        Guid productId,
        Guid warehouseId,
        decimal newQuantity,
        decimal? reorderLevel,
        string? notes,
        string? createdBy,
        CancellationToken ct = default)
    {
        if (newQuantity < 0) throw new InvalidOperationException("จำนวนสต็อกต้องไม่ติดลบ");

        var product = await dbContext.Products.FirstOrDefaultAsync(p => p.Id == productId && p.TenantId == tenantId, ct)
            ?? throw new InvalidOperationException("ไม่พบสินค้าในระบบ");
        var warehouse = await dbContext.Warehouses.FirstOrDefaultAsync(w => w.Id == warehouseId && w.TenantId == tenantId, ct)
            ?? throw new InvalidOperationException("ไม่พบคลังสินค้า");

        var stock = await GetOrInitializeStockAsync(tenantId, product, warehouse, ct);
        var delta = newQuantity - stock.Quantity;
        stock.Quantity = newQuantity;
        if (reorderLevel.HasValue && reorderLevel.Value >= 0) stock.ReorderLevel = reorderLevel.Value;
        stock.UpdatedAt = DateTime.UtcNow;

        if (delta != 0)
        {
            dbContext.StockMovements.Add(new StockMovement
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                ProductId = productId,
                WarehouseId = warehouseId,
                MovementType = StockMovementType.Adjustment,
                QuantityDelta = delta,
                BalanceAfter = stock.Quantity,
                ReferenceNumber = "ADJ",
                Notes = notes ?? "ปรับยอดตรวจนับสต็อก",
                CreatedBy = createdBy,
                CreatedAt = DateTime.UtcNow
            });
        }

        await SyncProductTotalStockAsync(tenantId, product, ct);
        await dbContext.SaveChangesAsync(ct);
    }

    public async Task TransferStockAsync(
        Guid tenantId,
        Guid productId,
        Guid fromWarehouseId,
        Guid toWarehouseId,
        decimal quantity,
        string? notes,
        string? createdBy,
        CancellationToken ct = default)
    {
        if (fromWarehouseId == toWarehouseId) throw new InvalidOperationException("คลังต้นทางและปลายทางต้องไม่ซ้ำกัน");
        if (quantity <= 0) throw new InvalidOperationException("จำนวนที่โอนย้ายต้องมากกว่า 0");

        var product = await dbContext.Products.FirstOrDefaultAsync(p => p.Id == productId && p.TenantId == tenantId, ct)
            ?? throw new InvalidOperationException("ไม่พบสินค้า");
        var fromWh = await dbContext.Warehouses.FirstOrDefaultAsync(w => w.Id == fromWarehouseId && w.TenantId == tenantId, ct)
            ?? throw new InvalidOperationException("ไม่พบคลังต้นทาง");
        var toWh = await dbContext.Warehouses.FirstOrDefaultAsync(w => w.Id == toWarehouseId && w.TenantId == tenantId, ct)
            ?? throw new InvalidOperationException("ไม่พบคลังปลายทาง");

        var fromStock = await GetOrInitializeStockAsync(tenantId, product, fromWh, ct);
        if (fromStock.Quantity < quantity)
        {
            throw new InvalidOperationException($"สต็อกในคลัง {fromWh.Name} ไม่เพียงพอ (คงเหลือ {fromStock.Quantity:N2})");
        }

        var toStock = await GetOrInitializeStockAsync(tenantId, product, toWh, ct);

        fromStock.Quantity -= quantity;
        fromStock.UpdatedAt = DateTime.UtcNow;
        toStock.Quantity += quantity;
        toStock.UpdatedAt = DateTime.UtcNow;

        var refNo = $"TRF-{DateTime.UtcNow:yyyyMMddHHmmss}";
        var now = DateTime.UtcNow;

        dbContext.StockMovements.AddRange(
            new StockMovement
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                ProductId = productId,
                WarehouseId = fromWarehouseId,
                MovementType = StockMovementType.TransferOut,
                QuantityDelta = -quantity,
                BalanceAfter = fromStock.Quantity,
                ReferenceNumber = refNo,
                Notes = notes ?? $"โอนย้ายไปยัง {toWh.Name}",
                CreatedBy = createdBy,
                CreatedAt = now
            },
            new StockMovement
            {
                Id = Guid.NewGuid(),
                TenantId = tenantId,
                ProductId = productId,
                WarehouseId = toWarehouseId,
                MovementType = StockMovementType.TransferIn,
                QuantityDelta = quantity,
                BalanceAfter = toStock.Quantity,
                ReferenceNumber = refNo,
                Notes = notes ?? $"รับโอนจาก {fromWh.Name}",
                CreatedBy = createdBy,
                CreatedAt = now
            });

        await SyncProductTotalStockAsync(tenantId, product, ct);
        await dbContext.SaveChangesAsync(ct);
    }

    private async Task<ProductWarehouseStock> GetOrInitializeStockAsync(
        Guid tenantId, Product product, Warehouse warehouse, CancellationToken ct)
    {
        var stock = await dbContext.ProductWarehouseStocks
            .FirstOrDefaultAsync(s => s.TenantId == tenantId && s.ProductId == product.Id && s.WarehouseId == warehouse.Id, ct);
        if (stock is not null) return stock;

        var hasAnyStockRows = await dbContext.ProductWarehouseStocks
            .AnyAsync(s => s.TenantId == tenantId && s.ProductId == product.Id, ct);

        var initialQty = !hasAnyStockRows && warehouse.IsDefault ? (product.StockQuantity ?? 0m) : 0m;

        stock = new ProductWarehouseStock
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ProductId = product.Id,
            WarehouseId = warehouse.Id,
            Quantity = initialQty,
            ReorderLevel = 5m,
            UpdatedAt = DateTime.UtcNow
        };
        dbContext.ProductWarehouseStocks.Add(stock);
        return stock;
    }

    private async Task SyncProductTotalStockAsync(Guid tenantId, Product product, CancellationToken ct)
    {
        // Sum existing persisted rows + tracked Added/Modified rows in ChangeTracker
        var persistedIds = await dbContext.ProductWarehouseStocks
            .Where(s => s.TenantId == tenantId && s.ProductId == product.Id)
            .Select(s => s.Id)
            .ToListAsync(ct);

        var trackedForProduct = dbContext.ChangeTracker.Entries<ProductWarehouseStock>()
            .Where(e => e.Entity.TenantId == tenantId && e.Entity.ProductId == product.Id && e.State != EntityState.Deleted)
            .Select(e => e.Entity)
            .ToList();

        var trackedIds = trackedForProduct.Select(s => s.Id).ToHashSet();
        var unTrackedSum = await dbContext.ProductWarehouseStocks
            .Where(s => s.TenantId == tenantId && s.ProductId == product.Id && !trackedIds.Contains(s.Id))
            .SumAsync(s => (decimal?)s.Quantity, ct) ?? 0m;

        product.StockQuantity = unTrackedSum + trackedForProduct.Sum(s => s.Quantity);
        product.UpdatedAt = DateTime.UtcNow;
    }
}

