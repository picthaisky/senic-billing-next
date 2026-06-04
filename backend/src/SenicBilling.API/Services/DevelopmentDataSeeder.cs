using Microsoft.EntityFrameworkCore;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Services;

/// <summary>
/// Seeds realistic demo data in Development environment.
/// Designed to be idempotent and safe to run on every startup.
/// </summary>
public sealed class DevelopmentDataSeeder(
    SenicBillingDbContext dbContext,
    ILogger<DevelopmentDataSeeder> logger)
{
    private static readonly Guid DefaultTenantId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    private sealed record SeedLine(Guid ProductId, string Description, decimal Quantity, string Unit, decimal UnitPrice, decimal Discount = 0m);

    public async Task SeedAsync(CancellationToken ct = default)
    {
        if (!await dbContext.Tenants.AnyAsync(t => t.Id == DefaultTenantId, ct))
        {
            logger.LogWarning("Skip development seed: default tenant does not exist.");
            return;
        }

        var customers = await EnsureCustomersAsync(ct);
        var products = await EnsureProductsAsync(ct);

        var hasDocuments = await dbContext.DocumentHeaders.AnyAsync(d => d.TenantId == DefaultTenantId, ct);
        if (hasDocuments)
        {
            logger.LogInformation("Development seed skipped: documents already exist.");
            return;
        }

        var now = DateTime.UtcNow;
        var month0 = new DateTime(now.Year, now.Month, 20, 8, 0, 0, DateTimeKind.Utc);
        var month1 = month0.AddMonths(-1);
        var month2 = month0.AddMonths(-2);
        var month3 = month0.AddMonths(-3);
        var month4 = month0.AddMonths(-4);
        var month5 = month0.AddMonths(-5);

        var docs = new List<DocumentHeader>
        {
            // Recent activity (current month)
            CreateDocument(
                documentType: DocumentType.TaxInvoice,
                status: DocumentStatus.Issued,
                documentDate: month0,
                createdAt: now.AddHours(-2),
                sequence: 12,
                customer: customers[0],
                lines:
                [
                    new SeedLine(products["หมึกพิมพ์ Toner"], "หมึกพิมพ์ Toner", 2m, "ตลับ", 12000m),
                    new SeedLine(products["บริการซ่อม"], "บริการซ่อม", 1m, "งาน", 6000m)
                ]),

            CreateDocument(
                documentType: DocumentType.Receipt,
                status: DocumentStatus.Issued,
                documentDate: month0.AddDays(-2),
                createdAt: now.AddHours(-5),
                sequence: 45,
                customer: customers[1],
                lines:
                [
                    new SeedLine(products["กระดาษ A4"], "กระดาษ A4", 10m, "รีม", 650m),
                    new SeedLine(products["บริการซ่อม"], "บริการซ่อม", 1m, "งาน", 1500m)
                ]),

            CreateDocument(
                documentType: DocumentType.CashBill,
                status: DocumentStatus.Issued,
                documentDate: month0.AddDays(-4),
                createdAt: now.AddDays(-1),
                sequence: 23,
                customer: customers[2],
                lines:
                [
                    new SeedLine(products["เครื่องเขียน"], "เครื่องเขียน", 20m, "ชิ้น", 120m),
                    new SeedLine(products["แฟ้มเอกสาร"], "แฟ้มเอกสาร", 8m, "ชิ้น", 80m)
                ]),

            CreateDocument(
                documentType: DocumentType.DeliveryNote,
                status: DocumentStatus.Issued,
                documentDate: month0.AddDays(-6),
                createdAt: now.AddDays(-1).AddHours(-2),
                sequence: 18,
                customer: customers[3],
                lines:
                [
                    new SeedLine(products["หมึกพิมพ์ Toner"], "หมึกพิมพ์ Toner", 3m, "ตลับ", 15000m),
                    new SeedLine(products["กระดาษ A4"], "กระดาษ A4", 20m, "รีม", 900m)
                ]),

            CreateDocument(
                documentType: DocumentType.Quotation,
                status: DocumentStatus.Draft,
                documentDate: month0.AddDays(-1),
                createdAt: now.AddHours(-3),
                sequence: 6,
                customer: customers[1],
                lines:
                [
                    new SeedLine(products["บริการซ่อม"], "บริการซ่อม", 2m, "งาน", 4500m),
                    new SeedLine(products["หมึกพิมพ์ Toner"], "หมึกพิมพ์ Toner", 1m, "ตลับ", 12000m)
                ]),

            // Historical months for charts
            CreateDocument(
                documentType: DocumentType.TaxInvoice,
                status: DocumentStatus.Issued,
                documentDate: month1,
                createdAt: month1,
                sequence: 7,
                customer: customers[0],
                lines:
                [
                    new SeedLine(products["หมึกพิมพ์ Toner"], "หมึกพิมพ์ Toner", 8m, "ตลับ", 20000m),
                    new SeedLine(products["กระดาษ A4"], "กระดาษ A4", 40m, "รีม", 1250m)
                ]),

            CreateDocument(
                documentType: DocumentType.TaxInvoice,
                status: DocumentStatus.Issued,
                documentDate: month2,
                createdAt: month2,
                sequence: 11,
                customer: customers[1],
                lines:
                [
                    new SeedLine(products["บริการซ่อม"], "บริการซ่อม", 5m, "งาน", 16000m),
                    new SeedLine(products["กระดาษ A4"], "กระดาษ A4", 30m, "รีม", 2000m)
                ]),

            CreateDocument(
                documentType: DocumentType.TaxInvoice,
                status: DocumentStatus.Issued,
                documentDate: month3,
                createdAt: month3,
                sequence: 9,
                customer: customers[2],
                lines:
                [
                    new SeedLine(products["หมึกพิมพ์ Toner"], "หมึกพิมพ์ Toner", 4m, "ตลับ", 18000m),
                    new SeedLine(products["เครื่องเขียน"], "เครื่องเขียน", 200m, "ชิ้น", 120m)
                ]),

            CreateDocument(
                documentType: DocumentType.TaxInvoice,
                status: DocumentStatus.Issued,
                documentDate: month4,
                createdAt: month4,
                sequence: 6,
                customer: customers[3],
                lines:
                [
                    new SeedLine(products["กระดาษ A4"], "กระดาษ A4", 120m, "รีม", 900m),
                    new SeedLine(products["แฟ้มเอกสาร"], "แฟ้มเอกสาร", 500m, "ชิ้น", 80m)
                ]),

            CreateDocument(
                documentType: DocumentType.TaxInvoice,
                status: DocumentStatus.Issued,
                documentDate: month5,
                createdAt: month5,
                sequence: 3,
                customer: customers[0],
                lines:
                [
                    new SeedLine(products["บริการซ่อม"], "บริการซ่อม", 6m, "งาน", 15000m),
                    new SeedLine(products["หมึกพิมพ์ Toner"], "หมึกพิมพ์ Toner", 2m, "ตลับ", 12000m)
                ]),

            // Pending draft for KPI
            CreateDocument(
                documentType: DocumentType.TaxInvoice,
                status: DocumentStatus.Draft,
                documentDate: now.Date,
                createdAt: now.AddHours(-1),
                sequence: 99,
                customer: customers[0],
                lines:
                [
                    new SeedLine(products["กระดาษ A4"], "กระดาษ A4", 5m, "รีม", 700m)
                ])
        };

        dbContext.DocumentHeaders.AddRange(docs);
        await dbContext.SaveChangesAsync(ct);

        logger.LogInformation("Development seed completed: {Customers} customers, {Products} products, {Documents} documents.",
            customers.Count,
            products.Count,
            docs.Count);
    }

    private async Task<List<Customer>> EnsureCustomersAsync(CancellationToken ct)
    {
        var existing = await dbContext.Customers
            .Where(c => c.TenantId == DefaultTenantId)
            .ToListAsync(ct);

        if (existing.Count > 0)
            return existing;

        var customers = new List<Customer>
        {
            new()
            {
                Id = Guid.Parse("10000000-0000-0000-0000-000000000001"),
                TenantId = DefaultTenantId,
                Name = "บจก. เอบีซี",
                TaxId = "0105550000001",
                Address = "123 ถนนสุขุมวิท กรุงเทพฯ",
                Phone = "02-111-1111",
                Email = "contact@abc.co.th",
                ContactPerson = "คุณสมชาย",
                CreatedAt = DateTime.UtcNow
            },
            new()
            {
                Id = Guid.Parse("10000000-0000-0000-0000-000000000002"),
                TenantId = DefaultTenantId,
                Name = "ร้านมิตรภาพ",
                TaxId = "0105550000002",
                Address = "456 ถนนสีลม กรุงเทพฯ",
                Phone = "02-222-2222",
                ContactPerson = "คุณวิภา",
                CreatedAt = DateTime.UtcNow
            },
            new()
            {
                Id = Guid.Parse("10000000-0000-0000-0000-000000000003"),
                TenantId = DefaultTenantId,
                Name = "คุณสมชาย",
                Address = "88 ถนนเพชรบุรี กรุงเทพฯ",
                Phone = "081-234-5678",
                CreatedAt = DateTime.UtcNow
            },
            new()
            {
                Id = Guid.Parse("10000000-0000-0000-0000-000000000004"),
                TenantId = DefaultTenantId,
                Name = "บจก. ดีเอฟจี",
                TaxId = "0105550000004",
                Address = "99 ถนนวิภาวดี กรุงเทพฯ",
                Phone = "02-444-5555",
                ContactPerson = "คุณกิตติ",
                CreatedAt = DateTime.UtcNow
            }
        };

        dbContext.Customers.AddRange(customers);
        await dbContext.SaveChangesAsync(ct);
        return customers;
    }

    private async Task<Dictionary<string, Guid>> EnsureProductsAsync(CancellationToken ct)
    {
        var existing = await dbContext.Products
            .Where(p => p.TenantId == DefaultTenantId && p.IsActive)
            .ToListAsync(ct);

        if (existing.Count == 0)
        {
            var products = new List<Product>
            {
                new()
                {
                    Id = Guid.Parse("20000000-0000-0000-0000-000000000001"),
                    TenantId = DefaultTenantId,
                    Sku = "P-001",
                    Name = "กระดาษ A4",
                    Unit = "รีม",
                    UnitPrice = 900m,
                    Category = "เครื่องใช้สำนักงาน",
                    CreatedAt = DateTime.UtcNow
                },
                new()
                {
                    Id = Guid.Parse("20000000-0000-0000-0000-000000000002"),
                    TenantId = DefaultTenantId,
                    Sku = "P-002",
                    Name = "หมึกพิมพ์ Toner",
                    Unit = "ตลับ",
                    UnitPrice = 15000m,
                    Category = "อุปกรณ์ไอที",
                    CreatedAt = DateTime.UtcNow
                },
                new()
                {
                    Id = Guid.Parse("20000000-0000-0000-0000-000000000003"),
                    TenantId = DefaultTenantId,
                    Sku = "S-001",
                    Name = "บริการซ่อม",
                    Unit = "งาน",
                    UnitPrice = 2000m,
                    Category = "บริการ",
                    CreatedAt = DateTime.UtcNow
                },
                new()
                {
                    Id = Guid.Parse("20000000-0000-0000-0000-000000000004"),
                    TenantId = DefaultTenantId,
                    Sku = "P-003",
                    Name = "เครื่องเขียน",
                    Unit = "ชิ้น",
                    UnitPrice = 120m,
                    Category = "เครื่องเขียน",
                    CreatedAt = DateTime.UtcNow
                },
                new()
                {
                    Id = Guid.Parse("20000000-0000-0000-0000-000000000005"),
                    TenantId = DefaultTenantId,
                    Sku = "P-004",
                    Name = "แฟ้มเอกสาร",
                    Unit = "ชิ้น",
                    UnitPrice = 80m,
                    Category = "เครื่องใช้สำนักงาน",
                    CreatedAt = DateTime.UtcNow
                }
            };

            dbContext.Products.AddRange(products);
            await dbContext.SaveChangesAsync(ct);
            existing = products;
        }

        return existing
            .GroupBy(p => p.Name)
            .ToDictionary(g => g.Key, g => g.First().Id);
    }

    private static DocumentHeader CreateDocument(
        DocumentType documentType,
        DocumentStatus status,
        DateTime documentDate,
        DateTime createdAt,
        int sequence,
        Customer customer,
        List<SeedLine> lines)
    {
        var documentId = Guid.NewGuid();
        var prefix = documentType switch
        {
            DocumentType.TaxInvoice => "INV",
            DocumentType.Receipt => "RCP",
            DocumentType.CashBill => "CSB",
            DocumentType.DeliveryNote => "DLV",
            DocumentType.Quotation => "QUO",
            _ => "DOC"
        };

        var lineEntities = lines.Select((l, idx) => new DocumentLine
        {
            Id = Guid.NewGuid(),
            DocumentHeaderId = documentId,
            ProductId = l.ProductId,
            SortOrder = idx + 1,
            Description = l.Description,
            Quantity = l.Quantity,
            Unit = l.Unit,
            UnitPrice = l.UnitPrice,
            DiscountAmount = l.Discount,
            LineTotal = (l.Quantity * l.UnitPrice) - l.Discount
        }).ToList();

        var subtotal = lineEntities.Sum(x => x.LineTotal);
        var totalBeforeVat = subtotal;
        var vatAmount = Math.Round(totalBeforeVat * 0.07m, 2, MidpointRounding.AwayFromZero);
        var grandTotal = totalBeforeVat + vatAmount;

        return new DocumentHeader
        {
            Id = documentId,
            TenantId = DefaultTenantId,
            DocumentType = documentType,
            DocumentNumber = $"{prefix}-{documentDate:yyyyMM}-{sequence:0000}",
            DocumentDate = documentDate,
            DueDate = documentType is DocumentType.TaxInvoice or DocumentType.Quotation
                ? documentDate.AddDays(30)
                : null,
            CustomerId = customer.Id,
            CustomerName = customer.Name,
            CustomerAddress = customer.Address,
            CustomerTaxId = customer.TaxId,
            Status = status,
            VatMode = VatCalculationMode.Exclusive,
            VatRate = 7m,
            Subtotal = subtotal,
            DiscountAmount = 0m,
            TotalBeforeVat = totalBeforeVat,
            VatAmount = vatAmount,
            GrandTotal = grandTotal,
            Notes = "Seeded development data",
            CreatedAt = createdAt,
            CreatedBy = "seed",
            Lines = lineEntities
        };
    }
}
