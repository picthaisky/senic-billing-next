using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.API.Extensions;
using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Enums;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SearchController(SenicBillingDbContext dbContext) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<ApiResponse<GlobalSearchResponseDto>>> Search(
        [FromQuery] string? q,
        [FromQuery] int limit = 20,
        CancellationToken ct = default)
    {
        var queryText = (q ?? string.Empty).Trim();
        if (string.IsNullOrWhiteSpace(queryText))
        {
            return Ok(new ApiResponse<GlobalSearchResponseDto>(
                true,
                "กรุณาระบุคำค้นหา",
                new GlobalSearchResponseDto(queryText, [])));
        }

        var tenantId = User.GetTenantId();
        var normalized = queryText.ToLower();
        var perCategoryLimit = Math.Clamp(limit / 4, 3, 10);

        var documents = await dbContext.DocumentHeaders
            .AsNoTracking()
            .Where(d => d.TenantId == tenantId && (
                d.DocumentNumber.ToLower().Contains(normalized) ||
                (d.CustomerName != null && d.CustomerName.ToLower().Contains(normalized)) ||
                (d.CustomerTaxId != null && d.CustomerTaxId.ToLower().Contains(normalized))))
            .OrderByDescending(d => d.DocumentDate)
            .Take(perCategoryLimit)
            .Select(d => new
            {
                d.Id,
                d.DocumentNumber,
                d.DocumentType,
                d.Status,
                d.CustomerName,
                d.GrandTotal
            })
            .ToListAsync(ct);

        var customers = await dbContext.Customers
            .AsNoTracking()
            .Where(c => c.TenantId == tenantId && c.IsActive && (
                c.Name.ToLower().Contains(normalized) ||
                (c.TaxId != null && c.TaxId.ToLower().Contains(normalized)) ||
                (c.Email != null && c.Email.ToLower().Contains(normalized)) ||
                (c.Phone != null && c.Phone.ToLower().Contains(normalized))))
            .OrderBy(c => c.Name)
            .Take(perCategoryLimit)
            .Select(c => new
            {
                c.Id,
                c.Name,
                c.TaxId,
                c.Phone,
                c.Email
            })
            .ToListAsync(ct);

        var products = await dbContext.Products
            .AsNoTracking()
            .Where(p => p.TenantId == tenantId && p.IsActive && (
                p.Name.ToLower().Contains(normalized) ||
                (p.Sku != null && p.Sku.ToLower().Contains(normalized)) ||
                (p.Barcode != null && p.Barcode.ToLower().Contains(normalized)) ||
                (p.Category != null && p.Category.ToLower().Contains(normalized))))
            .OrderBy(p => p.Name)
            .Take(perCategoryLimit)
            .Select(p => new
            {
                p.Id,
                p.Name,
                p.Sku,
                p.Barcode,
                p.UnitPrice
            })
            .ToListAsync(ct);

        var expenses = await dbContext.ExpenseRecords
            .AsNoTracking()
            .Where(e => e.TenantId == tenantId && (
                e.VoucherNumber.ToLower().Contains(normalized) ||
                e.VendorName.ToLower().Contains(normalized) ||
                e.Description.ToLower().Contains(normalized) ||
                (e.TaxInvoiceNumber != null && e.TaxInvoiceNumber.ToLower().Contains(normalized))))
            .OrderByDescending(e => e.ExpenseDate)
            .Take(perCategoryLimit)
            .Select(e => new
            {
                e.Id,
                e.VoucherNumber,
                e.VendorName,
                e.Description,
                e.GrandTotal,
                e.Status
            })
            .ToListAsync(ct);

        var purchaseOrders = await dbContext.PurchaseOrders
            .AsNoTracking()
            .Where(po => po.TenantId == tenantId && (
                po.PoNumber.ToLower().Contains(normalized) ||
                po.VendorName.ToLower().Contains(normalized)))
            .OrderByDescending(po => po.OrderDate)
            .Take(perCategoryLimit)
            .Select(po => new
            {
                po.Id,
                po.PoNumber,
                po.VendorName,
                po.GrandTotal,
                po.Status
            })
            .ToListAsync(ct);

        var items = new List<GlobalSearchItemDto>();

        foreach (var d in documents)
        {
            var typeSlug = d.DocumentType.ToString().ToLowerInvariant();
            var route = d.Status == DocumentStatus.Draft
                ? $"/documents/{typeSlug}/edit/{d.Id}"
                : $"/documents/{typeSlug}";

            items.Add(new GlobalSearchItemDto(
                Id: $"doc-{d.Id}",
                Category: "document",
                Title: d.DocumentNumber,
                Subtitle: $"{d.CustomerName ?? "-"} • ฿{d.GrandTotal:N2}",
                Badge: d.Status.ToString(),
                Route: route
            ));
        }

        foreach (var c in customers)
        {
            items.Add(new GlobalSearchItemDto(
                Id: $"cust-{c.Id}",
                Category: "customer",
                Title: c.Name,
                Subtitle: !string.IsNullOrWhiteSpace(c.TaxId)
                    ? $"Tax ID: {c.TaxId}"
                    : (c.Phone ?? c.Email ?? "Customer"),
                Badge: "Customer",
                Route: "/customers"
            ));
        }

        foreach (var p in products)
        {
            items.Add(new GlobalSearchItemDto(
                Id: $"prod-{p.Id}",
                Category: "product",
                Title: p.Name,
                Subtitle: $"{p.Sku ?? p.Barcode ?? "-"} • ฿{p.UnitPrice:N2}",
                Badge: "Product",
                Route: "/products"
            ));
        }

        foreach (var e in expenses)
        {
            items.Add(new GlobalSearchItemDto(
                Id: $"exp-{e.Id}",
                Category: "expense",
                Title: e.VoucherNumber,
                Subtitle: $"{e.VendorName} • ฿{e.GrandTotal:N2}",
                Badge: e.Status.ToString(),
                Route: "/expenses"
            ));
        }

        foreach (var po in purchaseOrders)
        {
            items.Add(new GlobalSearchItemDto(
                Id: $"po-{po.Id}",
                Category: "purchase_order",
                Title: po.PoNumber,
                Subtitle: $"{po.VendorName} • ฿{po.GrandTotal:N2}",
                Badge: po.Status.ToString(),
                Route: "/purchase-orders"
            ));
        }

        return Ok(new ApiResponse<GlobalSearchResponseDto>(
            true,
            $"พบ {items.Count} รายการ",
            new GlobalSearchResponseDto(queryText, items.Take(Math.Clamp(limit, 1, 50)).ToList())));
    }
}

