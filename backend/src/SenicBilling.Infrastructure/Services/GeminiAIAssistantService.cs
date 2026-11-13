using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SenicBilling.Application.Interfaces;
using SenicBilling.Application.DTOs;
using SenicBilling.Application.Services;
using SenicBilling.Domain.Enums;

namespace SenicBilling.Infrastructure.Services;

public class GeminiAIAssistantService : IAIAssistantService
{
    private readonly HttpClient _httpClient;
    private readonly string _apiKey;
    private readonly ILogger<GeminiAIAssistantService> _logger;

    public GeminiAIAssistantService(IConfiguration configuration, ILogger<GeminiAIAssistantService> logger)
    {
        _logger = logger;
        _apiKey = configuration["Gemini:ApiKey"] ?? string.Empty;
        _httpClient = new HttpClient();
    }

    public async Task<string> ChatAsync(string prompt, string context, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(_apiKey))
        {
            _logger.LogWarning("Gemini API Key is not configured. Returning fallback response.");
            return "ระบบ AI Assistant ยังไม่ได้กำหนดค่า API Key. กรุณาติดต่อผู้ดูแลระบบ";
        }

        try
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key={_apiKey}";

            var systemInstruction = "คุณคือ Senic Billing Assistant ผู้ช่วยด้านบัญชีและการเงินที่ฉลาดที่สุดสำหรับธุรกิจในไทย " +
                                  "คุณต้องตอบคำถามโดยอ้างอิงจากข้อมูล Context ที่ให้ไปเท่านั้น ตอบให้กระชับ เป็นมืออาชีพ และให้คำแนะนำที่เป็นประโยชน์";

            var fullPrompt = $"Context (ข้อมูลของบริษัทในระบบ):\n{context}\n\nคำถามจากผู้ใช้:\n{prompt}";

            var payload = new
            {
                system_instruction = new { parts = new[] { new { text = systemInstruction } } },
                contents = new[]
                {
                    new { parts = new[] { new { text = fullPrompt } } }
                },
                generationConfig = new
                {
                    temperature = 0.2,
                    maxOutputTokens = 1000
                }
            };

            var jsonContent = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            
            var response = await _httpClient.PostAsync(url, jsonContent, ct);
            
            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(ct);
                _logger.LogError("Gemini API Error: {StatusCode} {Body}", response.StatusCode, errorBody);
                return "ขออภัย ไม่สามารถติดต่อกับระบบ AI ได้ในขณะนี้";
            }

            var responseJson = await response.Content.ReadAsStringAsync(ct);
            var responseData = JsonSerializer.Deserialize<JsonElement>(responseJson);
            
            // Navigate JSON structure: candidates[0].content.parts[0].text
            var text = responseData
                .GetProperty("candidates")[0]
                .GetProperty("content")
                .GetProperty("parts")[0]
                .GetProperty("text")
                .GetString();

            return text ?? "ไม่มีคำตอบจาก AI";
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Exception while calling Gemini API");
            return "เกิดข้อผิดพลาดในการประมวลผลของ AI Assistant";
        }
    }

    public async Task<ParsedExpenseDto> ParseExpenseAsync(string receiptText, CancellationToken ct = default)
    {
        var fallback = ReceiptTextParser.Parse(receiptText);
        if (string.IsNullOrEmpty(_apiKey) || string.IsNullOrWhiteSpace(receiptText))
        {
            return fallback;
        }

        try
        {
            var url = $"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key={_apiKey}";
            var instruction =
                "คุณคือผู้ช่วยนักบัญชีไทย สกัดข้อมูลจากข้อความใบเสร็จ/ใบกำกับภาษีซื้อ แล้วตอบเป็น JSON เท่านั้น ตาม schema: " +
                "{\"vendorName\":string|null,\"vendorTaxId\":string(13 digits)|null,\"vendorBranch\":string(5 digits, 00000=สำนักงานใหญ่)|null," +
                "\"taxInvoiceNumber\":string|null,\"taxInvoiceDate\":\"yyyy-MM-dd\" (ค.ศ.)|null,\"totalBeforeVat\":number|null," +
                "\"vatAmount\":number|null,\"grandTotal\":number|null," +
                "\"suggestedCategory\":\"CostOfGoods|RentAndUtilities|ProfessionalService|Marketing|OfficeSupplies|Transportation|Other\"," +
                "\"suggestedWhtRate\":0|1|2|3|5,\"suggestedPndType\":\"None|PND3|PND53\",\"description\":string|null}. " +
                "PND53 เมื่อผู้ขายเป็นนิติบุคคล, PND3 เมื่อเป็นบุคคลธรรมดา, ห้ามเดาตัวเลขที่ไม่มีในข้อความ";

            var payload = new
            {
                system_instruction = new { parts = new[] { new { text = instruction } } },
                contents = new[] { new { parts = new[] { new { text = receiptText } } } },
                generationConfig = new { temperature = 0.0, maxOutputTokens = 800, responseMimeType = "application/json" }
            };

            using var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
            var response = await _httpClient.PostAsync(url, content, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Gemini parse-expense returned {StatusCode}; using rule-based fallback", response.StatusCode);
                return fallback;
            }

            var responseJson = await response.Content.ReadAsStringAsync(ct);
            var text = JsonSerializer.Deserialize<JsonElement>(responseJson)
                .GetProperty("candidates")[0].GetProperty("content").GetProperty("parts")[0].GetProperty("text").GetString();
            if (string.IsNullOrWhiteSpace(text)) return fallback;

            var json = JsonSerializer.Deserialize<JsonElement>(text.Trim().Trim('`').Replace("json\n", ""));

            string? Str(string name) => json.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
            decimal? Num(string name) => json.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.Number && v.TryGetDecimal(out var d) ? d : null;

            var taxId = Str("vendorTaxId");
            if (taxId is not null)
            {
                taxId = new string(taxId.Where(char.IsDigit).ToArray());
                if (taxId.Length != 13) taxId = fallback.VendorTaxId;
            }

            DateTime? date = DateTime.TryParse(Str("taxInvoiceDate"), System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.AdjustToUniversal | System.Globalization.DateTimeStyles.AssumeUniversal, out var parsedDate)
                ? DateTime.SpecifyKind(parsedDate.Year > 2400 ? parsedDate.AddYears(-543) : parsedDate, DateTimeKind.Utc)
                : fallback.TaxInvoiceDate;

            ExpenseCategory? category = Enum.TryParse<ExpenseCategory>(Str("suggestedCategory"), true, out var c) ? c : fallback.SuggestedCategory;
            PndType? pnd = Enum.TryParse<PndType>(Str("suggestedPndType"), true, out var p) ? p : fallback.SuggestedPndType;

            return new ParsedExpenseDto(
                Str("vendorName") ?? fallback.VendorName,
                taxId ?? fallback.VendorTaxId,
                Str("vendorBranch") ?? fallback.VendorBranch,
                Str("taxInvoiceNumber") ?? fallback.TaxInvoiceNumber,
                date,
                Num("totalBeforeVat") ?? fallback.TotalBeforeVat,
                Num("vatAmount") ?? fallback.VatAmount,
                Num("grandTotal") ?? fallback.GrandTotal,
                category,
                Num("suggestedWhtRate") ?? fallback.SuggestedWhtRate,
                pnd,
                Str("description") ?? fallback.Description,
                true);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Gemini parse-expense failed; using rule-based fallback");
            return fallback;
        }
    }
}
