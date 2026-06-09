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
    public QuestPdfService()
    {
        // Must configure license for QuestPDF 2022.12+
        QuestPDF.Settings.License = LicenseType.Community;
        
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
                page.DefaultTextStyle(x => x.FontSize(11).FontFamily(Fonts.Tahoma));

                page.Header().Element(c => ComposeHeader(c, document, documentTitle));
                page.Content().Element(c => ComposeContent(c, document));
                page.Footer().Element(ComposeFooter);
            });
        }).GeneratePdf();

        return pdfBytes;
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
            _ => "เอกสาร"
        };
    }

    private void ComposeHeader(IContainer container, DocumentHeader document, string title)
    {
        var tenant = document.Tenant;

        container.Row(row =>
        {
            row.RelativeItem().Column(column =>
            {
                column.Item().Text(tenant.CompanyName).FontSize(16).SemiBold();
                if (!string.IsNullOrEmpty(tenant.TaxId))
                {
                    column.Item().Text($"เลขประจำตัวผู้เสียภาษี: {tenant.TaxId}");
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
