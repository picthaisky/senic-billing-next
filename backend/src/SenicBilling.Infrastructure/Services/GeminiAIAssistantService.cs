using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using SenicBilling.Application.Interfaces;

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
}
