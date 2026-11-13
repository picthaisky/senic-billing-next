using System.Globalization;
using System.Text.RegularExpressions;
using SenicBilling.Application.DTOs;
using SenicBilling.Domain.Enums;

namespace SenicBilling.Application.Services;

/// <summary>
/// Rule-based (offline) parser for Thai receipt / tax-invoice text.
/// Used as fallback when the Gemini API is not configured or fails, and to validate AI output.
/// </summary>
public static partial class ReceiptTextParser
{
    [GeneratedRegex(@"(?<!\d)(\d[\s-]?\d{4}[\s-]?\d{5}[\s-]?\d{2}[\s-]?\d)(?!\d)")]
    private static partial Regex TaxIdRegex();

    [GeneratedRegex(@"(?:เลขที่(?:ใบกำกับภาษี)?|Tax\s*Invoice\s*No\.?|Invoice\s*No\.?|No\.)\s*[:：]?\s*([A-Za-z0-9\-/]{3,30})", RegexOptions.IgnoreCase)]
    private static partial Regex InvoiceNoRegex();

    [GeneratedRegex(@"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})")]
    private static partial Regex DateRegex();

    [GeneratedRegex(@"-?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|-?\d+(?:\.\d{1,2})?")]
    private static partial Regex AmountRegex();

    [GeneratedRegex(@"สาขา(?:ที่)?\s*[:：]?\s*(\d{1,5})")]
    private static partial Regex BranchRegex();

    public static ParsedExpenseDto Parse(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return new ParsedExpenseDto(null, null, null, null, null, null, null, null, null, null, null, null, false);
        }

        var lines = text.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        // Tax ID (first 13-digit number)
        string? taxId = null;
        var taxMatch = TaxIdRegex().Match(text);
        if (taxMatch.Success)
        {
            taxId = new string(taxMatch.Groups[1].Value.Where(char.IsDigit).ToArray());
        }

        // Vendor name — first line containing a company keyword, else first non-numeric line
        string? vendor = lines.FirstOrDefault(l =>
            l.Contains("บริษัท") || l.Contains("ห้างหุ้นส่วน") || l.Contains("หจก") || l.Contains("บจก") ||
            l.Contains("Co.,", StringComparison.OrdinalIgnoreCase) || l.Contains("Ltd", StringComparison.OrdinalIgnoreCase) ||
            l.Contains("ร้าน"))
            ?? lines.FirstOrDefault(l => l.Any(char.IsLetter) && !l.Contains("ใบกำกับ") && !l.Contains("ใบเสร็จ"));
        vendor = vendor?.Trim();

        string? branch = null;
        if (text.Contains("สำนักงานใหญ่")) branch = "00000";
        var branchMatch = BranchRegex().Match(text);
        if (branchMatch.Success) branch = branchMatch.Groups[1].Value.PadLeft(5, '0');

        string? invoiceNo = null;
        var invMatch = InvoiceNoRegex().Match(text);
        if (invMatch.Success) invoiceNo = invMatch.Groups[1].Value.Trim();

        DateTime? date = null;
        var dateMatch = DateRegex().Match(text);
        if (dateMatch.Success &&
            int.TryParse(dateMatch.Groups[1].Value, out var d) &&
            int.TryParse(dateMatch.Groups[2].Value, out var m) &&
            int.TryParse(dateMatch.Groups[3].Value, out var y))
        {
            if (y < 100) y += y >= 40 ? 2500 : 2000; // 2-digit Thai BE (e.g. 69) or CE
            if (y > 2400) y -= 543; // Buddhist Era → Common Era
            if (m is >= 1 and <= 12 && d >= 1 && d <= DateTime.DaysInMonth(y, m))
            {
                date = new DateTime(y, m, d, 0, 0, 0, DateTimeKind.Utc);
            }
        }

        decimal? vat = FindAmountOnLine(lines, ["ภาษีมูลค่าเพิ่ม", "VAT", "ภาษี 7"]);
        decimal? grand = FindAmountOnLine(lines, ["รวมทั้งสิ้น", "ยอดสุทธิ", "จำนวนเงินรวม", "Grand Total", "Total Amount", "ยอดรวม"]);
        decimal? beforeVat = FindAmountOnLine(lines, ["มูลค่าสินค้า", "ก่อนภาษี", "Sub Total", "Subtotal", "ราคาก่อน"]);

        if (grand is null)
        {
            var all = AmountRegex().Matches(TaxIdRegex().Replace(DateRegex().Replace(text, " "), " "))
                .Where(x => x.Value.Contains('.') || x.Value.Contains(','))
                .Select(x => ParseDecimal(x.Value))
                .Where(x => x.HasValue && x.Value > 0 && x.Value < 1_000_000_000m)
                .Select(x => x!.Value)
                .ToList();
            if (all.Count > 0) grand = all.Max();
        }

        if (grand.HasValue && vat.HasValue && beforeVat is null) beforeVat = grand - vat;
        if (grand.HasValue && beforeVat.HasValue && vat is null && grand > beforeVat) vat = grand - beforeVat;
        if (beforeVat.HasValue && vat.HasValue && grand is null) grand = beforeVat + vat;

        var category = SuggestCategory(text);
        var (whtRate, pnd) = SuggestWht(category, taxId, vendor);

        return new ParsedExpenseDto(
            vendor, taxId, branch, invoiceNo, date,
            beforeVat, vat, grand,
            category, whtRate, pnd,
            vendor is null ? null : $"ค่าใช้จ่ายจาก {vendor}",
            false);
    }

    public static ExpenseCategory SuggestCategory(string text)
    {
        var t = text.ToLowerInvariant();
        if (ContainsAny(t, "ค่าเช่า", "rent", "ค่าไฟ", "ค่าน้ำ", "การไฟฟ้า", "การประปา", "internet", "อินเทอร์เน็ต", "โทรศัพท์")) return ExpenseCategory.RentAndUtilities;
        if (ContainsAny(t, "โฆษณา", "facebook", "google ads", "marketing", "การตลาด", "ads")) return ExpenseCategory.Marketing;
        if (ContainsAny(t, "ค่าบริการ", "ที่ปรึกษา", "consult", "service", "จ้างทำของ", "ค่าจ้าง", "ออกแบบ", "ทำบัญชี")) return ExpenseCategory.ProfessionalService;
        if (ContainsAny(t, "ขนส่ง", "kerry", "flash", "ไปรษณีย์", "น้ำมัน", "ทางด่วน", "grab", "taxi", "ค่าเดินทาง", "ปตท", "บางจาก")) return ExpenseCategory.Transportation;
        if (ContainsAny(t, "กระดาษ", "เครื่องเขียน", "office", "หมึก", "อุปกรณ์สำนักงาน", "ofm")) return ExpenseCategory.OfficeSupplies;
        if (ContainsAny(t, "วัตถุดิบ", "สินค้า", "ต้นทุน", "makro", "แม็คโคร")) return ExpenseCategory.CostOfGoods;
        return ExpenseCategory.Other;
    }

    public static (decimal Rate, PndType Pnd) SuggestWht(ExpenseCategory category, string? taxId, string? vendor)
    {
        var isCorporate = (taxId?.StartsWith('0') ?? false) ||
                          (vendor is not null && (vendor.Contains("บริษัท") || vendor.Contains("ห้างหุ้นส่วน") ||
                                                  vendor.Contains("บจก") || vendor.Contains("หจก") ||
                                                  vendor.Contains("Ltd", StringComparison.OrdinalIgnoreCase)));
        var pnd = isCorporate ? PndType.PND53 : PndType.PND3;

        return category switch
        {
            ExpenseCategory.ProfessionalService => (3m, pnd),
            ExpenseCategory.RentAndUtilities when vendor is not null && !vendor.Contains("การไฟฟ้า") && !vendor.Contains("การประปา") => (5m, pnd),
            ExpenseCategory.Marketing => (2m, pnd),
            ExpenseCategory.Transportation when isCorporate => (1m, pnd),
            _ => (0m, PndType.None)
        };
    }

    private static decimal? FindAmountOnLine(string[] lines, string[] keywords)
    {
        foreach (var keyword in keywords)
        foreach (var line in lines)
        {
            if (!line.Contains(keyword, StringComparison.OrdinalIgnoreCase)) continue;
            var matches = AmountRegex().Matches(line);
            if (matches.Count == 0) continue;
            // take the last number on the line (amounts are usually right-aligned); skip "7%" style rates
            for (var i = matches.Count - 1; i >= 0; i--)
            {
                var value = ParseDecimal(matches[i].Value);
                var after = matches[i].Index + matches[i].Length;
                var isPercent = after < line.Length && line[after] == '%';
                if (value.HasValue && !isPercent) return value;
            }
        }
        return null;
    }

    private static decimal? ParseDecimal(string raw) =>
        decimal.TryParse(raw.Replace(",", ""), NumberStyles.Number, CultureInfo.InvariantCulture, out var v) ? v : null;

    private static bool ContainsAny(string text, params string[] keywords) =>
        keywords.Any(k => text.Contains(k, StringComparison.OrdinalIgnoreCase));
}
