using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SenicBilling.API.Services;
using SenicBilling.Application.Interfaces;
using SenicBilling.Application.Services;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

/// <summary>
/// LINE Official Account (Messaging API) Webhook endpoint.
/// Validates X-Line-Signature (HMAC-SHA256) per tenant and responds to quick accounting commands.
/// </summary>
[ApiController]
[Route("api/webhooks/line")]
[AllowAnonymous]
public class LineWebhookController(
    SenicBillingDbContext dbContext,
    ILineNotifyService lineService,
    IConfiguration configuration,
    ILogger<LineWebhookController> logger) : ControllerBase
{
    [HttpPost("{tenantId:guid}")]
    public async Task<IActionResult> HandleWebhook(Guid tenantId, CancellationToken ct)
    {
        var tenant = await dbContext.Tenants
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == tenantId && t.IsActive, ct);

        if (tenant is null || string.IsNullOrWhiteSpace(tenant.LineChannelSecret))
        {
            return Unauthorized(new { message = "LINE Messaging API is not configured for this tenant." });
        }

        byte[] bodyBytes;
        using (var ms = new MemoryStream())
        {
            await Request.Body.CopyToAsync(ms, ct);
            bodyBytes = ms.ToArray();
        }

        var signature = Request.Headers["X-Line-Signature"].FirstOrDefault();
        if (!LineSignatureVerifier.IsValid(tenant.LineChannelSecret, bodyBytes, signature))
        {
            logger.LogWarning("Invalid X-Line-Signature for tenant {TenantId}", tenantId);
            return Unauthorized(new { message = "Invalid LINE signature." });
        }

        if (bodyBytes.Length == 0)
        {
            return Ok(new { ok = true });
        }

        JsonDocument payload;
        try
        {
            payload = JsonDocument.Parse(bodyBytes);
        }
        catch (JsonException)
        {
            return BadRequest(new { message = "Invalid JSON payload." });
        }

        using (payload)
        {
            if (!payload.RootElement.TryGetProperty("events", out var eventsProp) ||
                eventsProp.ValueKind != JsonValueKind.Array)
            {
                return Ok(new { ok = true });
            }

            foreach (var ev in eventsProp.EnumerateArray())
            {
                var evType = ev.TryGetProperty("type", out var t) ? t.GetString() : null;
                if (!string.Equals(evType, "message", StringComparison.OrdinalIgnoreCase)) continue;

                var replyToken = ev.TryGetProperty("replyToken", out var rt) ? rt.GetString() : null;
                if (string.IsNullOrWhiteSpace(replyToken)) continue;

                if (!ev.TryGetProperty("message", out var msgProp)) continue;
                var msgType = msgProp.TryGetProperty("type", out var mt) ? mt.GetString() : null;
                if (!string.Equals(msgType, "text", StringComparison.OrdinalIgnoreCase)) continue;

                var text = msgProp.TryGetProperty("text", out var txt) ? txt.GetString() : null;
                if (string.IsNullOrWhiteSpace(text)) continue;

                var replyText = await BuildReplyTextAsync(tenant, text.Trim(), ct);
                if (!string.IsNullOrWhiteSpace(replyText) &&
                    !string.IsNullOrWhiteSpace(tenant.LineChannelAccessToken))
                {
                    await lineService.ReplyMessageAsync(tenant.LineChannelAccessToken, replyToken, replyText, ct);
                }
            }
        }

        return Ok(new { ok = true });
    }

    public async Task<string?> BuildReplyTextAsync(Tenant tenant, string text, CancellationToken ct = default)
    {
        var normalized = text.Trim();
        var lower = normalized.ToLowerInvariant();
        var now = DateTime.UtcNow;

        if (lower is "สรุปยอด" or "ยอดขาย" or "summary" or "sales")
        {
            var (start, end) = TaxSummaryQuery.MonthRange(now.Year, now.Month);
            var docs = await dbContext.DocumentHeaders
                .AsNoTracking()
                .Where(d => d.TenantId == tenant.Id &&
                            d.Status != DocumentStatus.Cancelled &&
                            d.Status != DocumentStatus.Draft &&
                            d.DocumentType != DocumentType.Quotation &&
                            d.DocumentType != DocumentType.DeliveryNote &&
                            d.DocumentDate >= start && d.DocumentDate < end)
                .Select(d => new { d.Status, d.GrandTotal })
                .ToListAsync(ct);

            var totalSales = docs.Sum(d => d.GrandTotal);
            var paidAmount = docs.Where(d => d.Status == DocumentStatus.Paid).Sum(d => d.GrandTotal);
            var unpaidDocs = docs.Where(d => d.Status != DocumentStatus.Paid).ToList();
            var unpaidAmount = unpaidDocs.Sum(d => d.GrandTotal);

            return $"สรุปยอดขาย {tenant.CompanyName} ({now:MM/yyyy})\n" +
                   $"• ยอดขายรวม: {totalSales:N2} บาท ({docs.Count} ใบ)\n" +
                   $"• รับชำระแล้ว: {paidAmount:N2} บาท\n" +
                   $"• ค้างชำระ: {unpaidAmount:N2} บาท ({unpaidDocs.Count} ใบ)";
        }

        if (lower is "ภาษี" or "ภพ30" or "ภ.พ.30" or "tax" or "vat")
        {
            var tax = await TaxSummaryQuery.ComputeAsync(dbContext, tenant.Id, now.Year, now.Month, ct);
            var (pnd3, pnd53) = await TaxSummaryQuery.ComputeWithheldFromVendorsAsync(dbContext, tenant.Id, now.Year, now.Month, ct);
            var netLabel = tax.EstimatedTaxPayable >= 0 ? "ภาษีที่ต้องชำระ (ภ.พ.30)" : "ภาษีชำระเกินยกไป";

            return $"สรุปภาษีประจำเดือน {now:MM/yyyy} — {tenant.CompanyName}\n" +
                   $"• ภาษีขาย (Output VAT): {tax.TotalSalesVat:N2} บาท\n" +
                   $"• ภาษีซื้อขอคืนได้ (Input VAT): {tax.TotalPurchaseVat:N2} บาท\n" +
                   $"• {netLabel}: {Math.Abs(tax.EstimatedTaxPayable):N2} บาท\n" +
                   $"• หัก ณ ที่จ่ายรอนำส่ง: ภ.ง.ด.3 = {pnd3:N2} | ภ.ง.ด.53 = {pnd53:N2} บาท";
        }

        if (lower is "ช่วยเหลือ" or "help" or "คำสั่ง" or "?")
        {
            return $"คำสั่งด่วน {tenant.CompanyName}:\n" +
                   "• พิมพ์ \"สรุปยอด\" — ดูยอดขายและยอดค้างชำระเดือนนี้\n" +
                   "• พิมพ์ \"ภาษี\" หรือ \"ภพ30\" — ดูภาษีขาย ภาษีซื้อ และ ภ.พ.30\n" +
                   "• พิมพ์เลขที่เอกสาร (เช่น INV-202611-0001) — ตรวจสอบสถานะและรับลิงก์เปิดดูบิล";
        }

        // Document number lookup
        if (normalized.Contains('-') && normalized.Length is >= 6 and <= 30)
        {
            var upper = normalized.ToUpperInvariant();
            var doc = await dbContext.DocumentHeaders
                .AsNoTracking()
                .FirstOrDefaultAsync(d => d.TenantId == tenant.Id && d.DocumentNumber.ToUpper() == upper, ct);

            if (doc is null)
            {
                return $"ไม่พบเอกสารเลขที่ {normalized} ในระบบ";
            }

            var baseUrl = configuration["Frontend:BaseUrl"]?.TrimEnd('/');
            var link = string.IsNullOrWhiteSpace(baseUrl)
                ? $"/print/{doc.Id}"
                : $"{baseUrl}/print/{doc.Id}";

            return $"เอกสาร {doc.DocumentNumber}\n" +
                   $"• ลูกค้า: {doc.CustomerName ?? "-"}\n" +
                   $"• สถานะ: {doc.Status}\n" +
                   $"• ยอดสุทธิ: {doc.GrandTotal:N2} บาท\n" +
                   $"• เปิดดู/ชำระเงิน: {link}";
        }

        return null;
    }
}

