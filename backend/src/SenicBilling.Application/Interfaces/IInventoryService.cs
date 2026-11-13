using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;

namespace SenicBilling.Application.Interfaces;

public interface IInventoryService
{
    Task<Warehouse> EnsureDefaultWarehouseAsync(Guid tenantId, CancellationToken ct = default);

    Task<decimal> AdjustWarehouseStockAsync(
        Guid tenantId,
        Guid productId,
        Guid? warehouseId,
        decimal quantityDelta,
        StockMovementType movementType,
        string? referenceNumber,
        string? notes,
        string? createdBy,
        CancellationToken ct = default,
        bool saveChanges = true);

    Task SetWarehouseStockAsync(
        Guid tenantId,
        Guid productId,
        Guid warehouseId,
        decimal newQuantity,
        decimal? reorderLevel,
        string? notes,
        string? createdBy,
        CancellationToken ct = default);

    Task TransferStockAsync(
        Guid tenantId,
        Guid productId,
        Guid fromWarehouseId,
        Guid toWarehouseId,
        decimal quantity,
        string? notes,
        string? createdBy,
        CancellationToken ct = default);
}

