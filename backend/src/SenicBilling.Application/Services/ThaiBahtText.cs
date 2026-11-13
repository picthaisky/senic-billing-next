using System.Text;

namespace SenicBilling.Application.Services;

/// <summary>
/// แปลงจำนวนเงินเป็นตัวอักษรภาษาไทย เช่น 1,234.50 → "หนึ่งพันสองร้อยสามสิบสี่บาทห้าสิบสตางค์"
/// </summary>
public static class ThaiBahtText
{
    private static readonly string[] Digits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
    private static readonly string[] Positions = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];

    public static string Convert(decimal amount)
    {
        if (amount < 0) return "ลบ" + Convert(-amount);

        amount = Math.Round(amount, 2, MidpointRounding.AwayFromZero);
        var baht = (long)Math.Truncate(amount);
        var satang = (int)((amount - baht) * 100m);

        if (baht == 0 && satang == 0) return "ศูนย์บาทถ้วน";

        var sb = new StringBuilder();
        if (baht > 0)
        {
            sb.Append(ReadNumber(baht)).Append("บาท");
        }

        if (satang == 0)
        {
            sb.Append("ถ้วน");
        }
        else
        {
            sb.Append(ReadNumber(satang)).Append("สตางค์");
        }

        return sb.ToString();
    }

    private static string ReadNumber(long number)
    {
        if (number == 0) return Digits[0];

        var millions = number / 1_000_000;
        var remainder = number % 1_000_000;

        var sb = new StringBuilder();
        if (millions > 0)
        {
            sb.Append(ReadNumber(millions)).Append("ล้าน");
        }

        if (remainder > 0)
        {
            sb.Append(ReadUnderMillion(remainder, millions > 0));
        }

        return sb.ToString();
    }

    private static string ReadUnderMillion(long number, bool hasHigherPart)
    {
        var text = number.ToString();
        var len = text.Length;
        var sb = new StringBuilder();

        for (var i = 0; i < len; i++)
        {
            var digit = text[i] - '0';
            var position = len - i - 1;
            if (digit == 0) continue;

            if (position == 0 && digit == 1 && (len > 1 || hasHigherPart))
            {
                sb.Append("เอ็ด");
            }
            else if (position == 1 && digit == 2)
            {
                sb.Append("ยี่");
            }
            else if (position == 1 && digit == 1)
            {
                // "สิบ" without "หนึ่ง"
            }
            else
            {
                sb.Append(Digits[digit]);
            }

            sb.Append(Positions[position]);
        }

        return sb.ToString();
    }
}

