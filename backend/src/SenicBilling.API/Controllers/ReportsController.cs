using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Domain.Entities;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ReportsController : ControllerBase
{
    private readonly SenicBillingDbContext _dbContext;

    public ReportsController(SenicBillingDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet("tax/export")]
    [Authorize]
    public async Task<IActionResult> ExportTaxReport([FromQuery] int year, [FromQuery] int month, CancellationToken ct)
    {
        var tenantIdString = User.FindFirst("tenantId")?.Value;
        if (!Guid.TryParse(tenantIdString, out var tenantId))
            return Unauthorized();

        var tenant = await _dbContext.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null) return NotFound("Tenant not found");

        var startDate = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
        var endDate = startDate.AddMonths(1);

        // Get Tax Invoices for the month
        var invoices = await _dbContext.DocumentHeaders
            .Where(d => d.TenantId == tenantId 
                     && d.DocumentType == SenicBilling.Domain.Enums.DocumentType.TaxInvoice
                     && d.DocumentDate >= startDate 
                     && d.DocumentDate < endDate)
            .OrderBy(d => d.DocumentDate)
            .ToListAsync(ct);

        using var workbook = new XLWorkbook();
        var worksheet = workbook.Worksheets.Add("รายงานภาษีขาย");

        // Header Section
        worksheet.Cell("A1").Value = "รายงานภาษีขาย (Output Tax Report)";
        worksheet.Cell("A1").Style.Font.Bold = true;
        worksheet.Cell("A1").Style.Font.FontSize = 16;
        worksheet.Range("A1:J1").Merge();

        worksheet.Cell("A2").Value = $"ชื่อผู้ประกอบการ: {tenant.CompanyName}";
        worksheet.Cell("A3").Value = $"เลขประจำตัวผู้เสียภาษี: {tenant.TaxId}";
        worksheet.Cell("A4").Value = $"เดือน/ปีภาษี: {month:D2}/{year}";

        // Table Headers
        var row = 6;
        worksheet.Cell(row, 1).Value = "ลำดับที่";
        worksheet.Cell(row, 2).Value = "วัน/เดือน/ปี";
        worksheet.Cell(row, 3).Value = "เลขที่ใบกำกับภาษี";
        worksheet.Cell(row, 4).Value = "ชื่อผู้ซื้อสินค้า/ผู้รับบริการ";
        worksheet.Cell(row, 5).Value = "เลขประจำตัวผู้เสียภาษี (ผู้ซื้อ)";
        worksheet.Cell(row, 6).Value = "สาขา";
        worksheet.Cell(row, 7).Value = "มูลค่าสินค้า/บริการ";
        worksheet.Cell(row, 8).Value = "จำนวนเงินภาษีมูลค่าเพิ่ม";
        worksheet.Cell(row, 9).Value = "จำนวนเงินรวม";
        worksheet.Cell(row, 10).Value = "หมายเหตุ (ยกเลิก)";

        var headerRange = worksheet.Range("A" + row + ":J" + row);
        headerRange.Style.Font.Bold = true;
        headerRange.Style.Fill.BackgroundColor = XLColor.LightGray;

        row++;
        decimal sumTotalBeforeVat = 0;
        decimal sumVat = 0;
        decimal sumGrandTotal = 0;

        // Table Data
        for (int i = 0; i < invoices.Count; i++)
        {
            var inv = invoices[i];
            
            // Handle Canceled Status (normally we show 0 amount in report if canceled, depending on strict accounting rules, but here we just mark it)
            bool isCanceled = inv.Status == SenicBilling.Domain.Enums.DocumentStatus.Cancelled;

            worksheet.Cell(row, 1).Value = i + 1;
            worksheet.Cell(row, 2).Value = inv.DocumentDate.ToString("dd/MM/yyyy");
            worksheet.Cell(row, 3).Value = inv.DocumentNumber;
            worksheet.Cell(row, 4).Value = inv.CustomerName;
            worksheet.Cell(row, 5).Value = inv.CustomerTaxId ?? "-";
            worksheet.Cell(row, 6).Value = string.IsNullOrWhiteSpace(inv.CustomerBranch) ? "สำนักงานใหญ่" : inv.CustomerBranch;
            
            worksheet.Cell(row, 7).Value = isCanceled ? 0 : inv.TotalBeforeVat;
            worksheet.Cell(row, 8).Value = isCanceled ? 0 : inv.VatAmount;
            worksheet.Cell(row, 9).Value = isCanceled ? 0 : inv.GrandTotal;
            worksheet.Cell(row, 10).Value = isCanceled ? "ยกเลิก" : "";

            if (!isCanceled)
            {
                sumTotalBeforeVat += inv.TotalBeforeVat;
                sumVat += inv.VatAmount;
                sumGrandTotal += inv.GrandTotal;
            }

            row++;
        }

        // Table Footer (Sums)
        worksheet.Cell(row, 1).Value = "รวมทั้งสิ้น";
        worksheet.Range("A" + row + ":F" + row).Merge();
        worksheet.Cell(row, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
        worksheet.Cell(row, 1).Style.Font.Bold = true;

        worksheet.Cell(row, 7).Value = sumTotalBeforeVat;
        worksheet.Cell(row, 8).Value = sumVat;
        worksheet.Cell(row, 9).Value = sumGrandTotal;
        worksheet.Range("G" + row + ":I" + row).Style.Font.Bold = true;

        // Format Numbers
        worksheet.Range("G7:I" + row).Style.NumberFormat.Format = "#,##0.00";
        worksheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        var content = stream.ToArray();

        return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", $"TaxReport_{year}_{month:D2}.xlsx");
    }
}
