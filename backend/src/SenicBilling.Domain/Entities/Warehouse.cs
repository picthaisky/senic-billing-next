using SenicBilling.Domain.Enums;

namespace SenicBilling.Domain.Entities;

/// <summary>คลังสินค้า / สาขา</summary>
public class Warehouse
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Address { get; set; }
    public bool IsDefault { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Tenant Tenant { get; set; } = null!;
    public ICollection<ProductWarehouseStock> Stocks { get; set; } = [];
}

/// <summary>ยอดสต็อกสินค้าแยกตามคลัง</summary>
public class ProductWarehouseStock
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ProductId { get; set; }
    public Guid WarehouseId { get; set; }
    public decimal Quantity { get; set; }
    public decimal ReorderLevel { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Product Product { get; set; } = null!;
    public Warehouse Warehouse { get; set; } = null!;
}

/// <summary>Stock Card / ประวัติความเคลื่อนไหวสต็อก</summary>
public class StockMovement
{
    public Guid Id { get; set; }
    public Guid TenantId { get; set; }
    public Guid ProductId { get; set; }
    public Guid WarehouseId { get; set; }
    public StockMovementType MovementType { get; set; }
    public decimal QuantityDelta { get; set; }
    public decimal BalanceAfter { get; set; }
    public string? ReferenceNumber { get; set; }
    public string? Notes { get; set; }
    public string? CreatedBy { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Product Product { get; set; } = null!;
    public Warehouse Warehouse { get; set; } = null!;
}

