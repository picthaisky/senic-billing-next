using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using SenicBilling.Application.Interfaces;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using System.IO;
using System.Reflection;

namespace SenicBilling.Infrastructure.Services;

public class QuestPdfService : IPdfService
{
    private static readonly string ThaiFontFamily = RegisterBundledFonts();

    private static string RegisterBundledFonts()
    {
        try
        {
            var assembly = typeof(QuestPdfService).Assembly;
            var registeredAny = false;
            foreach (var resourceName in assembly.GetManifestResourceNames())
            {
                if (!resourceName.EndsWith(".ttf", StringComparison.OrdinalIgnoreCase)) continue;
                using var stream = assembly.GetManifestResourceStream(resourceName);
                if (stream is null) continue;
                QuestPDF.Drawing.FontManager.RegisterFont(stream);
                registeredAny = true;
            }
            return registeredAny ? "Kanit" : Fonts.Tahoma;
        }
        catch
        {
            return Fonts.Tahoma;
        }
    }
    private const string LogoBucketName = "senic-billing-logos";
    private readonly IStorageService? _storageService;

    public QuestPdfService() : this(null)
    {
    }

    [Microsoft.Extensions.DependencyInjection.ActivatorUtilitiesConstructor]
    public QuestPdfService(IStorageService? storageService)
    {
        // Must configure license for QuestPDF 2022.12+
        QuestPDF.Settings.License = LicenseType.Community;
        _storageService = storageService;

        // Ensure default font family supports Thai (e.g., Tahoma or specific downloaded font)
        // If not running on Windows, you must ensure fonts are available in the container or load them explicitly
        // Try to use Tahoma as it supports Thai, fallback to Arial.
    }

    public byte[] GenerateDocumentPdf(DocumentHeader document)
    {
        var documentTitle = GetDocumentTitle(document.DocumentType);

        var pdfBytes = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(1, Unit.Centimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(11).FontFamily(ThaiFontFamily));

                page.Header().Element(c => ComposeHeader(c, document, documentTitle));
                page.Content().Element(c => ComposeContent(c, document));
                page.Footer().Element(ComposeFooter);
            });
        }).GeneratePdf();

        return pdfBytes;
    }

    /// <summary>
    /// หนังสือรับรองการหักภาษี ณ ที่จ่าย ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร (A4)
    /// </summary>
    public byte[] GenerateWhtCertificatePdf(ExpenseRecord expense, Tenant payer)
    {
        var isPnd3 = expense.PndType == PndType.PND3;
        var amountText = SenicBilling.Application.Services.ThaiBahtText.Convert(expense.WhtAmount);
        var bookNo = expense.ExpenseDate.ToString("yyyyMM");

        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(1.2f, Unit.Centimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(10).FontFamily(ThaiFontFamily));

                page.Content().Column(col =>
                {
                    col.Spacing(8);

                    col.Item().Row(r =>
                    {
                        r.RelativeItem().Column(c =>
                        {
                            c.Item().AlignCenter().Text("หนังสือรับรองการหักภาษี ณ ที่จ่าย").FontSize(16).SemiBold();
                            c.Item().AlignCenter().Text("ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร").FontSize(11);
                        });
                        r.ConstantItem(150).AlignRight().Column(c =>
                        {
                            c.Item().Text($"เล่มที่: {bookNo}");
                            c.Item().Text($"เลขที่: {expense.VoucherNumber}");
                        });
                    });

                    // Payer (ผู้มีหน้าที่หักภาษี ณ ที่จ่าย)
                    col.Item().Border(1).BorderColor(Colors.Grey.Darken1).Padding(8).Column(c =>
                    {
                        c.Item().Text("ผู้มีหน้าที่หักภาษี ณ ที่จ่าย :").SemiBold();
                        c.Item().Row(r =>
                        {
                            r.RelativeItem().Text($"ชื่อ: {payer.CompanyName}");
                            r.ConstantItem(220).Text($"เลขประจำตัวผู้เสียภาษีอากร: {payer.TaxId ?? "-"}");
                        });
                        c.Item().Text($"ที่อยู่: {payer.Address ?? "-"}");
                    });

                    // Payee (ผู้ถูกหักภาษี ณ ที่จ่าย)
                    col.Item().Border(1).BorderColor(Colors.Grey.Darken1).Padding(8).Column(c =>
                    {
                        c.Item().Text("ผู้ถูกหักภาษี ณ ที่จ่าย :").SemiBold();
                        c.Item().Row(r =>
                        {
                            r.RelativeItem().Text($"ชื่อ: {expense.VendorName}");
                            r.ConstantItem(220).Text($"เลขประจำตัวผู้เสียภาษีอากร: {expense.VendorTaxId ?? "-"}");
                        });
                        c.Item().Text($"ที่อยู่: {expense.VendorAddress ?? "-"}");
                        c.Item().Text($"สาขา: {(string.IsNullOrWhiteSpace(expense.VendorBranch) || expense.VendorBranch == "00000" ? "สำนักงานใหญ่" : expense.VendorBranch)}");
                    });

                    // Form type
                    col.Item().Row(r =>
                    {
                        r.ConstantItem(90).Text("ลำดับที่ในแบบ:");
                        r.RelativeItem().Text(t =>
                        {
                            t.Span(isPnd3 ? "[X] " : "[  ] ").SemiBold();
                            t.Span("ภ.ง.ด.3        ");
                            t.Span(!isPnd3 ? "[X] " : "[  ] ").SemiBold();
                            t.Span("ภ.ง.ด.53        ");
                            t.Span("[  ] ภ.ง.ด.1ก        [  ] ภ.ง.ด.2");
                        });
                    });

                    // Income table
                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(cd =>
                        {
                            cd.RelativeColumn(4);
                            cd.ConstantColumn(80);
                            cd.ConstantColumn(100);
                            cd.ConstantColumn(100);
                        });

                        table.Header(h =>
                        {
                            h.Cell().Element(HeaderCell).Text("ประเภทเงินได้พึงประเมินที่จ่าย");
                            h.Cell().Element(HeaderCell).AlignCenter().Text("วัน เดือน ปี ที่จ่าย");
                            h.Cell().Element(HeaderCell).AlignRight().Text("จำนวนเงินที่จ่าย");
                            h.Cell().Element(HeaderCell).AlignRight().Text("ภาษีที่หักและนำส่งไว้");
                        });

                        var incomeType = string.IsNullOrWhiteSpace(expense.IncomeTypeDescription)
                            ? expense.Description
                            : expense.IncomeTypeDescription;

                        table.Cell().Element(BodyCell).Text($"เงินได้ตามมาตรา 3 เตรส / มาตรา 40 — {incomeType} (อัตรา {expense.WhtRate:0.##}%)");
                        table.Cell().Element(BodyCell).AlignCenter().Text(expense.ExpenseDate.ToString("dd/MM/yyyy"));
                        table.Cell().Element(BodyCell).AlignRight().Text(expense.TotalBeforeVat.ToString("N2"));
                        table.Cell().Element(BodyCell).AlignRight().Text(expense.WhtAmount.ToString("N2"));

                        table.Cell().ColumnSpan(2).Element(BodyCell).AlignRight().Text("รวมเงินที่จ่ายและภาษีที่หักนำส่ง").SemiBold();
                        table.Cell().Element(BodyCell).AlignRight().Text(expense.TotalBeforeVat.ToString("N2")).SemiBold();
                        table.Cell().Element(BodyCell).AlignRight().Text(expense.WhtAmount.ToString("N2")).SemiBold();

                        static IContainer HeaderCell(IContainer c) =>
                            c.Border(1).BorderColor(Colors.Grey.Darken1).Background(Colors.Grey.Lighten3).Padding(5).DefaultTextStyle(x => x.SemiBold());
                        static IContainer BodyCell(IContainer c) =>
                            c.Border(1).BorderColor(Colors.Grey.Darken1).Padding(5);
                    });

                    col.Item().Border(1).BorderColor(Colors.Grey.Darken1).Padding(6)
                        .Text($"รวมเงินภาษีที่หักนำส่ง (ตัวอักษร): {amountText}").SemiBold();

                    col.Item().Text(t =>
                    {
                        t.Span("ผู้จ่ายเงิน:  ");
                        t.Span("[X] หัก ณ ที่จ่าย   ").SemiBold();
                        t.Span("[  ] ออกให้ตลอดไป   [  ] ออกให้ครั้งเดียว   [  ] อื่น ๆ");
                    });

                    col.Item().PaddingTop(20).Row(r =>
                    {
                        r.RelativeItem().Border(1).BorderColor(Colors.Grey.Lighten1).Padding(6).Text(
                            "คำเตือน: ผู้มีหน้าที่ออกหนังสือรับรองการหักภาษี ณ ที่จ่าย ฝ่าฝืนไม่ปฏิบัติตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร ต้องรับโทษทางอาญาตามมาตรา 35 แห่งประมวลรัษฎากร")
                            .FontSize(8).FontColor(Colors.Grey.Darken2);
                        r.ConstantItem(20);
                        r.ConstantItem(230).AlignCenter().Column(c =>
                        {
                            c.Item().AlignCenter().Text("ขอรับรองว่าข้อความและตัวเลขดังกล่าวข้างต้นถูกต้องตรงกับความจริงทุกประการ").FontSize(8);
                            c.Item().PaddingTop(25).AlignCenter().Text("ลงชื่อ ..................................................");
                            c.Item().AlignCenter().Text("ผู้จ่ายเงิน");
                            c.Item().AlignCenter().Text($"วันที่ {expense.ExpenseDate:dd/MM/yyyy}");
                        });
                    });
                });

                page.Footer().AlignCenter().Text($"ออกโดย Senic Billing Next — อ้างอิงใบสำคัญจ่าย {expense.VoucherNumber}")
                    .FontSize(8).FontColor(Colors.Grey.Darken1);
            });
        }).GeneratePdf();
    }

    public byte[] GeneratePurchaseOrderPdf(PurchaseOrder po, Tenant buyer)
    {
        return Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(1.2f, Unit.Centimetre);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontSize(10).FontFamily(ThaiFontFamily));

                page.Header().Row(row =>
                {
                    var buyerLogoBytes = TryLoadTenantLogoBytes(buyer?.LogoUrl);
                    if (buyerLogoBytes is not null)
                    {
                        row.ConstantItem(56).PaddingRight(10).AlignMiddle().Height(48).Image(buyerLogoBytes).FitArea();
                    }

                    row.RelativeItem().Column(c =>
                    {
                        c.Item().Text(!string.IsNullOrWhiteSpace(buyer?.CompanyName) ? buyer.CompanyName : "Senic Billing").FontSize(15).SemiBold();
                        if (!string.IsNullOrWhiteSpace(buyer?.BranchName))
                            c.Item().Text($"สาขา: {buyer.BranchName}").FontSize(9);
                        if (!string.IsNullOrWhiteSpace(buyer?.TaxId))
                            c.Item().Text($"เลขประจำตัวผู้เสียภาษี: {buyer.TaxId}");
                        if (!string.IsNullOrWhiteSpace(buyer?.Address))
                            c.Item().Text(buyer.Address);
                    });
                    row.ConstantItem(210).AlignRight().Column(c =>
                    {
                        c.Item().Text("ใบสั่งซื้อ (PURCHASE ORDER)").FontSize(16).SemiBold().FontColor(Colors.Blue.Darken2);
                        c.Item().Text($"เลขที่: {po.PoNumber}");
                        c.Item().Text($"วันที่สั่งซื้อ: {po.OrderDate:dd/MM/yyyy}");
                        if (po.ExpectedDeliveryDate.HasValue)
                            c.Item().Text($"กำหนดส่งมอบ: {po.ExpectedDeliveryDate.Value:dd/MM/yyyy}");
                    });
                });

                page.Content().PaddingVertical(12).Column(col =>
                {
                    col.Spacing(10);
                    col.Item().Border(1).BorderColor(Colors.Grey.Lighten1).Padding(8).Column(c =>
                    {
                        c.Item().Text("ผู้ขาย / ซัพพลายเออร์ (Vendor):").SemiBold();
                        c.Item().Text(po.VendorName);
                        if (!string.IsNullOrWhiteSpace(po.VendorTaxId))
                            c.Item().Text($"เลขประจำตัวผู้เสียภาษี: {po.VendorTaxId} ({po.VendorBranch ?? "00000"})");
                        if (!string.IsNullOrWhiteSpace(po.VendorAddress))
                            c.Item().Text(po.VendorAddress);
                    });

                    col.Item().Table(table =>
                    {
                        table.ColumnsDefinition(cd =>
                        {
                            cd.ConstantColumn(30);
                            cd.RelativeColumn();
                            cd.ConstantColumn(60);
                            cd.ConstantColumn(60);
                            cd.ConstantColumn(80);
                            cd.ConstantColumn(80);
                        });
                        table.Header(h =>
                        {
                            h.Cell().Element(H).Text("#");
                            h.Cell().Element(H).Text("รายการสินค้า / บริการ");
                            h.Cell().Element(H).AlignRight().Text("จำนวน");
                            h.Cell().Element(H).AlignCenter().Text("หน่วย");
                            h.Cell().Element(H).AlignRight().Text("ราคา/หน่วย");
                            h.Cell().Element(H).AlignRight().Text("รวมเงิน");
                            static IContainer H(IContainer c) => c.BorderBottom(1).BorderColor(Colors.Black).PaddingVertical(5).DefaultTextStyle(x => x.SemiBold());
                        });
                        foreach (var l in po.Lines.OrderBy(x => x.SortOrder))
                        {
                            table.Cell().Element(B).Text(l.SortOrder.ToString());
                            table.Cell().Element(B).Text(l.Description);
                            table.Cell().Element(B).AlignRight().Text(l.Quantity.ToString("N2"));
                            table.Cell().Element(B).AlignCenter().Text(l.Unit);
                            table.Cell().Element(B).AlignRight().Text(l.UnitPrice.ToString("N2"));
                            table.Cell().Element(B).AlignRight().Text(l.LineTotal.ToString("N2"));
                            static IContainer B(IContainer c) => c.BorderBottom(1).BorderColor(Colors.Grey.Lighten2).PaddingVertical(4);
                        }
                    });

                    col.Item().Row(r =>
                    {
                        r.RelativeItem().Column(c =>
                        {
                            if (!string.IsNullOrWhiteSpace(po.Notes))
                            {
                                c.Item().Text("หมายเหตุ:").SemiBold();
                                c.Item().Text(po.Notes);
                            }
                        });
                        r.ConstantItem(240).Column(c =>
                        {
                            c.Item().Row(x => { x.RelativeItem().Text("ยอดก่อนภาษี:"); x.RelativeItem().AlignRight().Text(po.TotalBeforeVat.ToString("N2")); });
                            c.Item().Row(x => { x.RelativeItem().Text($"ภาษีมูลค่าเพิ่ม ({po.VatRate:0.##}%):"); x.RelativeItem().AlignRight().Text(po.VatAmount.ToString("N2")); });
                            c.Item().PaddingTop(4).BorderTop(1).BorderColor(Colors.Black).Row(x =>
                            {
                                x.RelativeItem().Text("ยอดรวมสุทธิ:").SemiBold();
                                x.RelativeItem().AlignRight().Text(po.GrandTotal.ToString("N2")).SemiBold();
                            });
                        });
                    });
                });

                page.Footer().AlignCenter().Text($"ออกโดย Senic Billing Next — {po.PoNumber}").FontSize(8);
            });
        }).GeneratePdf();
    }

    private string GetDocumentTitle(DocumentType type)
    {
        return type switch
        {
            DocumentType.TaxInvoice => "ใบกำกับภาษี / ใบส่งสินค้า",
            DocumentType.Receipt => "ใบเสร็จรับเงิน",
            DocumentType.Quotation => "ใบเสนอราคา",
            DocumentType.CashBill => "บิลเงินสด",
            DocumentType.DeliveryNote => "ใบส่งของ",
            DocumentType.CreditNote => "ใบลดหนี้",
            DocumentType.DebitNote => "ใบเพิ่มหนี้",
            DocumentType.ExpenseVoucher => "ใบสำคัญจ่าย",
            DocumentType.PurchaseOrder => "ใบสั่งซื้อ",
            DocumentType.JournalVoucher => "ใบสำคัญทั่วไป",
            _ => "เอกสาร"
        };
    }

    private void ComposeHeader(IContainer container, DocumentHeader document, string title)
    {
        var tenant = document.Tenant;
        var companyName = !string.IsNullOrWhiteSpace(tenant?.CompanyName) ? tenant.CompanyName : "Senic Billing";
        var logoBytes = TryLoadTenantLogoBytes(tenant?.LogoUrl);

        container.Row(row =>
        {
            if (logoBytes is not null)
            {
                row.ConstantItem(60).PaddingRight(10).AlignMiddle().Height(52).Image(logoBytes).FitArea();
            }

            row.RelativeItem().Column(column =>
            {
                column.Item().Text(companyName).FontSize(16).SemiBold();
                if (!string.IsNullOrWhiteSpace(tenant?.BranchName))
                {
                    column.Item().Text($"สาขา: {tenant.BranchName}").FontSize(9);
                }
                if (!string.IsNullOrWhiteSpace(tenant?.TaxId))
                {
                    column.Item().Text($"เลขประจำตัวผู้เสียภาษี: {tenant.TaxId}").FontSize(9);
                }
                if (!string.IsNullOrWhiteSpace(tenant?.Address))
                {
                    column.Item().Text(tenant.Address).FontSize(9);
                }
                if (!string.IsNullOrWhiteSpace(tenant?.Phone))
                {
                    column.Item().Text($"โทร: {tenant.Phone}").FontSize(9);
                }
            });

            row.ConstantItem(200).AlignRight().Column(column =>
            {
                column.Item().Text(title).FontSize(20).SemiBold().FontColor(Colors.Blue.Darken2);
                column.Item().Text($"เลขที่: {document.DocumentNumber}");
                column.Item().Text($"วันที่: {document.DocumentDate:dd/MM/yyyy}");
                
                if (document.DueDate.HasValue)
                {
                    column.Item().Text($"ครบกำหนด: {document.DueDate.Value:dd/MM/yyyy}");
                }
            });
        });
    }

    private byte[]? TryLoadTenantLogoBytes(string? logoUrl)
    {
        if (string.IsNullOrWhiteSpace(logoUrl))
            return null;

        var rawPath = Uri.TryCreate(logoUrl.Trim(), UriKind.Absolute, out var absUri)
            ? absUri.AbsolutePath
            : logoUrl.Trim().Split('?', '#')[0];

        const string routePrefix = "/api/tenants/logo/";
        var idx = rawPath.IndexOf(routePrefix, StringComparison.OrdinalIgnoreCase);
        if (idx < 0)
            return null;

        var remainder = rawPath[(idx + routePrefix.Length)..];
        var parts = remainder.Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 2)
            return null;

        if (!Guid.TryParse(parts[0], out var tenantId))
            return null;

        var fileName = parts[1];
        var safeFileName = Path.GetFileName(fileName);
        if (string.IsNullOrWhiteSpace(safeFileName) || !string.Equals(safeFileName, fileName, StringComparison.Ordinal))
            return null;

        var ext = Path.GetExtension(safeFileName).ToLowerInvariant();
        if (ext is not (".png" or ".jpg" or ".jpeg" or ".webp"))
            return null;

        var roots = new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory }
            .Where(r => !string.IsNullOrWhiteSpace(r))
            .Distinct(StringComparer.OrdinalIgnoreCase);

        foreach (var root in roots)
        {
            var candidatePath = Path.Combine(root, "App_Data", "logos", tenantId.ToString(), safeFileName);
            if (!File.Exists(candidatePath))
                continue;

            try
            {
                var bytes = File.ReadAllBytes(candidatePath);
                if (HasSupportedImageHeader(bytes))
                    return bytes;
            }
            catch
            {
                // Keep PDF generation resilient if disk read fails
            }
        }

        if (_storageService is not null)
        {
            try
            {
                using var stream = _storageService
                    .DownloadFileAsync(LogoBucketName, $"tenants/{tenantId}/{safeFileName}")
                    .GetAwaiter()
                    .GetResult();
                using var ms = new MemoryStream();
                stream.CopyTo(ms);
                var storageBytes = ms.ToArray();
                if (HasSupportedImageHeader(storageBytes))
                    return storageBytes;
            }
            catch
            {
                // Keep PDF generation resilient if object storage is unavailable or object missing
            }
        }

        return null;
    }

    private static bool HasSupportedImageHeader(byte[] bytes)
    {
        if (bytes.Length < 4)
            return false;

        // PNG
        if (bytes[0] == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47)
            return true;

        // JPEG
        if (bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF)
            return true;

        // WEBP (RIFF....WEBP)
        if (bytes.Length >= 12
            && bytes[0] == (byte)'R' && bytes[1] == (byte)'I' && bytes[2] == (byte)'F' && bytes[3] == (byte)'F'
            && bytes[8] == (byte)'W' && bytes[9] == (byte)'E' && bytes[10] == (byte)'B' && bytes[11] == (byte)'P')
            return true;

        return false;
    }

    private void ComposeContent(IContainer container, DocumentHeader document)
    {
        container.PaddingVertical(1, Unit.Centimetre).Column(column =>
        {
            column.Spacing(10);
            
            // Customer Info
            column.Item().Row(row =>
            {
                row.RelativeItem().Border(1).BorderColor(Colors.Grey.Lighten2).Padding(5).Column(col => 
                {
                    col.Item().Text("ลูกค้า / ผู้ซื้อ (Customer):").SemiBold();
                    col.Item().Text(document.CustomerName ?? "-");
                    col.Item().Text(document.CustomerAddress ?? "");
                    if (!string.IsNullOrEmpty(document.CustomerTaxId))
                    {
                        col.Item().Text($"เลขประจำตัวผู้เสียภาษี: {document.CustomerTaxId}");
                    }
                });
            });

            // Items Table
            column.Item().Element(c => ComposeTable(c, document));

            // Summary
            column.Item().Element(c => ComposeSummary(c, document));
        });
    }

    private void ComposeTable(IContainer container, DocumentHeader document)
    {
        container.Table(table =>
        {
            // Define columns
            table.ColumnsDefinition(columns =>
            {
                columns.ConstantColumn(30); // No
                columns.RelativeColumn();   // Description
                columns.ConstantColumn(50); // Qty
                columns.ConstantColumn(80); // Unit Price
                columns.ConstantColumn(80); // Discount
                columns.ConstantColumn(80); // Total
            });

            // Table Header
            table.Header(header =>
            {
                header.Cell().Element(CellStyle).Text("#");
                header.Cell().Element(CellStyle).Text("รายละเอียด");
                header.Cell().Element(CellStyle).AlignRight().Text("จำนวน");
                header.Cell().Element(CellStyle).AlignRight().Text("ราคา/หน่วย");
                header.Cell().Element(CellStyle).AlignRight().Text("ส่วนลด");
                header.Cell().Element(CellStyle).AlignRight().Text("รวมเป็นเงิน");

                static IContainer CellStyle(IContainer container)
                {
                    return container.DefaultTextStyle(x => x.SemiBold()).PaddingVertical(5).BorderBottom(1).BorderColor(Colors.Black);
                }
            });

            // Table Rows
            foreach (var item in document.Lines)
            {
                table.Cell().Element(CellStyle).Text(item.SortOrder.ToString());
                table.Cell().Element(CellStyle).Text(item.Description);
                table.Cell().Element(CellStyle).AlignRight().Text(item.Quantity.ToString("N2"));
                table.Cell().Element(CellStyle).AlignRight().Text(item.UnitPrice.ToString("N2"));
                table.Cell().Element(CellStyle).AlignRight().Text(item.DiscountAmount > 0 ? item.DiscountAmount.ToString("N2") : "-");
                table.Cell().Element(CellStyle).AlignRight().Text(item.LineTotal.ToString("N2"));

                static IContainer CellStyle(IContainer container)
                {
                    return container.BorderBottom(1).BorderColor(Colors.Grey.Lighten2).PaddingVertical(5);
                }
            }
        });
    }

    private void ComposeSummary(IContainer container, DocumentHeader document)
    {
        container.Row(row =>
        {
            // Left side (notes, signatures)
            row.RelativeItem().Column(column =>
            {
                if (!string.IsNullOrEmpty(document.Notes))
                {
                    column.Item().Text("หมายเหตุ:").SemiBold();
                    column.Item().Text(document.Notes);
                }
                
                column.Item().PaddingTop(40).Row(sigRow => 
                {
                    sigRow.RelativeItem().AlignCenter().Column(sigCol => {
                        sigCol.Item().Text("___________________________");
                        sigCol.Item().Text("ผู้รับสินค้า/บริการ");
                    });
                    
                    sigRow.RelativeItem().AlignCenter().Column(sigCol => {
                        sigCol.Item().Text("___________________________");
                        sigCol.Item().Text("ผู้ออกเอกสาร");
                    });
                });
            });

            // Right side (totals)
            row.ConstantItem(250).PaddingLeft(20).Column(column =>
            {
                column.Item().Row(r => { r.RelativeItem().Text("รวมเป็นเงิน (Subtotal):"); r.RelativeItem().AlignRight().Text(document.Subtotal.ToString("N2")); });
                
                if (document.DiscountAmount > 0)
                {
                    column.Item().Row(r => { r.RelativeItem().Text("หักส่วนลด (Discount):"); r.RelativeItem().AlignRight().Text(document.DiscountAmount.ToString("N2")); });
                }

                if (document.VatAmount > 0)
                {
                    column.Item().Row(r => { r.RelativeItem().Text("ยอดก่อนภาษี (Total before VAT):"); r.RelativeItem().AlignRight().Text(document.TotalBeforeVat.ToString("N2")); });
                    column.Item().Row(r => { r.RelativeItem().Text($"ภาษีมูลค่าเพิ่ม ({document.VatRate}%):"); r.RelativeItem().AlignRight().Text(document.VatAmount.ToString("N2")); });
                }

                column.Item().PaddingTop(5).BorderTop(1).BorderColor(Colors.Black).Row(r => 
                { 
                    r.RelativeItem().Text("ยอดรวมสุทธิ (Grand Total):").SemiBold(); 
                    r.RelativeItem().AlignRight().Text(document.GrandTotal.ToString("N2")).SemiBold(); 
                });
                column.Item().BorderBottom(1).BorderColor(Colors.Black).PaddingBottom(2);

                if (document.WhtAmount > 0)
                {
                    column.Item().PaddingTop(5).Row(r => { r.RelativeItem().Text($"หักภาษี ณ ที่จ่าย ({document.WhtRate}%):"); r.RelativeItem().AlignRight().Text(document.WhtAmount.ToString("N2")); });
                    column.Item().Row(r => { r.RelativeItem().Text("ยอดชำระสุทธิ:").SemiBold(); r.RelativeItem().AlignRight().Text((document.GrandTotal - document.WhtAmount).ToString("N2")).SemiBold(); });
                }
            });
        });
    }

    private void ComposeFooter(IContainer container)
    {
        container.AlignCenter().Text(x =>
        {
            x.Span("หน้า ");
            x.CurrentPageNumber();
            x.Span(" จาก ");
            x.TotalPages();
        });
    }
}
