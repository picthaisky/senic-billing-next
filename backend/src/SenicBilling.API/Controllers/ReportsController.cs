using ClosedXML.Excel;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
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

        // Get Tax Invoices, Credit Notes, and Debit Notes for the month
        var invoices = await _dbContext.DocumentHeaders
            .Where(d => d.TenantId == tenantId 
                     && (d.DocumentType == SenicBilling.Domain.Enums.DocumentType.TaxInvoice
                         || d.DocumentType == SenicBilling.Domain.Enums.DocumentType.CreditNote
                         || d.DocumentType == SenicBilling.Domain.Enums.DocumentType.DebitNote)
                     && d.DocumentDate >= startDate 
                     && d.DocumentDate < endDate)
            .OrderBy(d => d.DocumentDate)
            .ThenBy(d => d.DocumentNumber)
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
            
            bool isCanceled = inv.Status == SenicBilling.Domain.Enums.DocumentStatus.Cancelled;
            decimal sign = inv.DocumentType == SenicBilling.Domain.Enums.DocumentType.CreditNote ? -1m : 1m;
            decimal signedBeforeVat = isCanceled ? 0m : sign * inv.TotalBeforeVat;
            decimal signedVat = isCanceled ? 0m : sign * inv.VatAmount;
            decimal signedGrand = isCanceled ? 0m : sign * inv.GrandTotal;
            string remark = isCanceled
                ? "ยกเลิก"
                : inv.DocumentType == SenicBilling.Domain.Enums.DocumentType.CreditNote
                    ? "ใบลดหนี้"
                    : inv.DocumentType == SenicBilling.Domain.Enums.DocumentType.DebitNote
                        ? "ใบเพิ่มหนี้"
                        : "";

            worksheet.Cell(row, 1).Value = i + 1;
            worksheet.Cell(row, 2).Value = inv.DocumentDate.ToString("dd/MM/yyyy");
            worksheet.Cell(row, 3).Value = inv.DocumentNumber;
            worksheet.Cell(row, 4).Value = inv.CustomerName;
            worksheet.Cell(row, 5).Value = inv.CustomerTaxId ?? "-";
            worksheet.Cell(row, 6).Value = string.IsNullOrWhiteSpace(inv.CustomerBranch) ? "สำนักงานใหญ่" : inv.CustomerBranch;
            
            worksheet.Cell(row, 7).Value = signedBeforeVat;
            worksheet.Cell(row, 8).Value = signedVat;
            worksheet.Cell(row, 9).Value = signedGrand;
            worksheet.Cell(row, 10).Value = remark;

            if (!isCanceled)
            {
                sumTotalBeforeVat += signedBeforeVat;
                sumVat += signedVat;
                sumGrandTotal += signedGrand;
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

    private Guid? GetTenantIdOrNull()
    {
        var tenantIdString = User.FindFirst("tenantId")?.Value;
        return Guid.TryParse(tenantIdString, out var tenantId) ? tenantId : null;
    }

    private static bool IsValidPeriod(int year, int month) => year is >= 2000 and <= 2600 && month is >= 1 and <= 12;

    /// <summary>รายงานภาษีซื้อประจำเดือน + ชีตสรุป ภ.พ.30 (Excel)</summary>
    [HttpGet("input-tax/export")]
    [Authorize]
    public async Task<IActionResult> ExportInputTaxReport([FromQuery] int year, [FromQuery] int month, CancellationToken ct)
    {
        if (GetTenantIdOrNull() is not Guid tenantId) return Unauthorized();
        if (!IsValidPeriod(year, month)) return BadRequest("ระบุปี/เดือนไม่ถูกต้อง");

        var tenant = await _dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null) return NotFound("Tenant not found");

        var (start, end) = SenicBilling.API.Services.TaxSummaryQuery.MonthRange(year, month);
        var expenses = await _dbContext.ExpenseRecords.AsNoTracking()
            .Where(e => e.TenantId == tenantId
                        && e.Status != ExpenseStatus.Cancelled
                        && e.Status != ExpenseStatus.Draft
                        && e.VatAmount > 0
                        && e.IsRefundableVat
                        && e.ExpenseDate >= start && e.ExpenseDate < end)
            .OrderBy(e => e.TaxInvoiceDate ?? e.ExpenseDate)
            .ThenBy(e => e.VoucherNumber)
            .ToListAsync(ct);

        var summary = await SenicBilling.API.Services.TaxSummaryQuery.ComputeAsync(_dbContext, tenantId, year, month, ct);

        using var workbook = new XLWorkbook();
        var ws = workbook.Worksheets.Add("รายงานภาษีซื้อ");

        ws.Cell("A1").Value = "รายงานภาษีซื้อ (Input Tax Report)";
        ws.Cell("A1").Style.Font.Bold = true;
        ws.Cell("A1").Style.Font.FontSize = 16;
        ws.Range("A1:J1").Merge();
        ws.Cell("A2").Value = $"ชื่อผู้ประกอบการ: {tenant.CompanyName}";
        ws.Cell("A3").Value = $"เลขประจำตัวผู้เสียภาษี: {tenant.TaxId}    สถานประกอบการ: {(string.IsNullOrWhiteSpace(tenant.BranchName) ? "สำนักงานใหญ่" : tenant.BranchName)}";
        ws.Cell("A4").Value = $"เดือน/ปีภาษี: {month:D2}/{year}";

        var row = 6;
        string[] headers =
        [
            "ลำดับที่", "วัน/เดือน/ปี", "เลขที่ใบกำกับภาษี", "ชื่อผู้ขายสินค้า/ผู้ให้บริการ",
            "เลขประจำตัวผู้เสียภาษี (ผู้ขาย)", "สถานประกอบการ", "มูลค่าสินค้า/บริการ",
            "จำนวนเงินภาษีมูลค่าเพิ่ม", "จำนวนเงินรวม", "เลขที่ใบสำคัญจ่าย"
        ];
        for (var c = 0; c < headers.Length; c++) ws.Cell(row, c + 1).Value = headers[c];
        var headerRange = ws.Range(row, 1, row, headers.Length);
        headerRange.Style.Font.Bold = true;
        headerRange.Style.Fill.BackgroundColor = XLColor.LightGray;
        row++;

        var firstDataRow = row;
        for (var i = 0; i < expenses.Count; i++)
        {
            var e = expenses[i];
            ws.Cell(row, 1).Value = i + 1;
            ws.Cell(row, 2).Value = (e.TaxInvoiceDate ?? e.ExpenseDate).ToString("dd/MM/yyyy");
            ws.Cell(row, 3).Value = e.TaxInvoiceNumber ?? "-";
            ws.Cell(row, 4).Value = e.VendorName;
            ws.Cell(row, 5).Value = e.VendorTaxId ?? "-";
            ws.Cell(row, 6).Value = string.IsNullOrWhiteSpace(e.VendorBranch) || e.VendorBranch == "00000" ? "สำนักงานใหญ่" : $"สาขา {e.VendorBranch}";
            ws.Cell(row, 7).Value = e.TotalBeforeVat;
            ws.Cell(row, 8).Value = e.VatAmount;
            ws.Cell(row, 9).Value = e.GrandTotal;
            ws.Cell(row, 10).Value = e.VoucherNumber;
            row++;
        }

        ws.Cell(row, 1).Value = "รวมทั้งสิ้น";
        ws.Range(row, 1, row, 6).Merge();
        ws.Cell(row, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
        ws.Cell(row, 7).Value = expenses.Sum(e => e.TotalBeforeVat);
        ws.Cell(row, 8).Value = expenses.Sum(e => e.VatAmount);
        ws.Cell(row, 9).Value = expenses.Sum(e => e.GrandTotal);
        ws.Range(row, 1, row, 9).Style.Font.Bold = true;
        ws.Range(firstDataRow, 7, row, 9).Style.NumberFormat.Format = "#,##0.00";
        ws.Columns().AdjustToContents();

        // Sheet 2: ภ.พ.30 Summary
        var s = workbook.Worksheets.Add("สรุปภาษี ภ.พ.30");
        s.Cell("A1").Value = "สรุปภาษีมูลค่าเพิ่มประจำเดือน (ภ.พ.30)";
        s.Cell("A1").Style.Font.Bold = true;
        s.Cell("A1").Style.Font.FontSize = 16;
        s.Range("A1:C1").Merge();
        s.Cell("A2").Value = $"{tenant.CompanyName} — เดือน/ปีภาษี {month:D2}/{year}";

        s.Cell("A4").Value = "รายการ";
        s.Cell("B4").Value = "มูลค่าฐานภาษี";
        s.Cell("C4").Value = "ภาษีมูลค่าเพิ่ม";
        s.Range("A4:C4").Style.Font.Bold = true;
        s.Range("A4:C4").Style.Fill.BackgroundColor = XLColor.LightGray;

        s.Cell("A5").Value = "1. ยอดขาย / ภาษีขาย (Output VAT)";
        s.Cell("B5").Value = summary.TotalSales;
        s.Cell("C5").Value = summary.TotalSalesVat;
        s.Cell("A6").Value = "2. ยอดซื้อ / ภาษีซื้อที่ขอคืนได้ (Input VAT)";
        s.Cell("B6").Value = summary.TotalPurchases;
        s.Cell("C6").Value = summary.TotalPurchaseVat;

        var net = summary.TotalSalesVat - summary.TotalPurchaseVat;
        s.Cell("A8").Value = net >= 0 ? "3. ภาษีที่ต้องชำระเพิ่มเติม" : "3. ภาษีที่ชำระเกิน (ยกไป/ขอคืน)";
        s.Cell("C8").Value = Math.Abs(net);
        s.Range("A8:C8").Style.Font.Bold = true;
        s.Cell("C8").Style.Font.FontColor = net >= 0 ? XLColor.DarkRed : XLColor.DarkGreen;
        s.Range("B5:C8").Style.NumberFormat.Format = "#,##0.00";
        s.Cell("A10").Value = "หมายเหตุ: ภาษีขายคำนวณจากใบกำกับภาษีที่ออกในเดือน, ภาษีซื้อคำนวณเฉพาะรายการที่ขอคืนได้";
        s.Cell("A10").Style.Font.Italic = true;
        s.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"InputTaxReport_{year}_{month:D2}.xlsx");
    }

    /// <summary>รายงานภาษีหัก ณ ที่จ่าย ภ.ง.ด.3 / ภ.ง.ด.53 (Excel) — pndType=PND3|PND53 หรือเว้นว่างเพื่อรวมทั้งสองชีต</summary>
    [HttpGet("wht/export")]
    [Authorize]
    public async Task<IActionResult> ExportWhtReport([FromQuery] int year, [FromQuery] int month, [FromQuery] PndType? pndType, CancellationToken ct)
    {
        if (GetTenantIdOrNull() is not Guid tenantId) return Unauthorized();
        if (!IsValidPeriod(year, month)) return BadRequest("ระบุปี/เดือนไม่ถูกต้อง");

        var tenant = await _dbContext.Tenants.AsNoTracking().FirstOrDefaultAsync(t => t.Id == tenantId, ct);
        if (tenant == null) return NotFound("Tenant not found");

        var (start, end) = SenicBilling.API.Services.TaxSummaryQuery.MonthRange(year, month);
        var expenses = await _dbContext.ExpenseRecords.AsNoTracking()
            .Where(e => e.TenantId == tenantId
                        && e.Status != ExpenseStatus.Cancelled
                        && e.Status != ExpenseStatus.Draft
                        && e.WhtAmount > 0
                        && e.PndType != PndType.None
                        && e.ExpenseDate >= start && e.ExpenseDate < end)
            .OrderBy(e => e.ExpenseDate)
            .ThenBy(e => e.VoucherNumber)
            .ToListAsync(ct);

        var types = pndType is PndType.PND3 or PndType.PND53
            ? new[] { pndType.Value }
            : new[] { PndType.PND3, PndType.PND53 };

        using var workbook = new XLWorkbook();
        foreach (var type in types)
        {
            var label = type == PndType.PND3 ? "ภ.ง.ด.3" : "ภ.ง.ด.53";
            var ws = workbook.Worksheets.Add(label);
            ws.Cell("A1").Value = $"ใบแนบ {label} — รายงานภาษีเงินได้หัก ณ ที่จ่าย ({(type == PndType.PND3 ? "บุคคลธรรมดา" : "นิติบุคคล")})";
            ws.Cell("A1").Style.Font.Bold = true;
            ws.Cell("A1").Style.Font.FontSize = 14;
            ws.Range("A1:J1").Merge();
            ws.Cell("A2").Value = $"ผู้มีหน้าที่หักภาษี ณ ที่จ่าย: {tenant.CompanyName}  เลขประจำตัวผู้เสียภาษี: {tenant.TaxId}";
            ws.Cell("A3").Value = $"เดือน/ปีที่จ่ายเงินได้: {month:D2}/{year}";

            var row = 5;
            string[] headers =
            [
                "ลำดับที่", "เลขประจำตัวผู้เสียภาษี (ผู้ถูกหัก)", "สาขา", "ชื่อผู้มีเงินได้", "ที่อยู่",
                "วัน/เดือน/ปีที่จ่าย", "ประเภทเงินได้", "อัตราภาษี (%)", "จำนวนเงินที่จ่าย", "ภาษีที่หักและนำส่ง"
            ];
            for (var c = 0; c < headers.Length; c++) ws.Cell(row, c + 1).Value = headers[c];
            ws.Range(row, 1, row, headers.Length).Style.Font.Bold = true;
            ws.Range(row, 1, row, headers.Length).Style.Fill.BackgroundColor = XLColor.LightGray;
            row++;

            var firstDataRow = row;
            var rows = expenses.Where(e => e.PndType == type).ToList();
            for (var i = 0; i < rows.Count; i++)
            {
                var e = rows[i];
                ws.Cell(row, 1).Value = i + 1;
                ws.Cell(row, 2).Value = e.VendorTaxId ?? "-";
                ws.Cell(row, 3).Value = e.VendorBranch ?? "00000";
                ws.Cell(row, 4).Value = e.VendorName;
                ws.Cell(row, 5).Value = e.VendorAddress ?? "-";
                ws.Cell(row, 6).Value = e.ExpenseDate.ToString("dd/MM/yyyy");
                ws.Cell(row, 7).Value = e.IncomeTypeDescription ?? e.Description;
                ws.Cell(row, 8).Value = e.WhtRate;
                ws.Cell(row, 9).Value = e.TotalBeforeVat;
                ws.Cell(row, 10).Value = e.WhtAmount;
                row++;
            }

            ws.Cell(row, 1).Value = "รวมทั้งสิ้น";
            ws.Range(row, 1, row, 8).Merge();
            ws.Cell(row, 1).Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Right;
            ws.Cell(row, 9).Value = rows.Sum(e => e.TotalBeforeVat);
            ws.Cell(row, 10).Value = rows.Sum(e => e.WhtAmount);
            ws.Range(row, 1, row, 10).Style.Font.Bold = true;
            ws.Range(firstDataRow, 9, row, 10).Style.NumberFormat.Format = "#,##0.00";
            ws.Columns().AdjustToContents();
        }

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        var suffix = types.Length == 1 ? types[0].ToString() : "PND3_PND53";
        return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            $"WhtReport_{suffix}_{year}_{month:D2}.xlsx");
    }
}
