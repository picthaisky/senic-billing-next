using SenicBilling.Application.DTOs;

namespace SenicBilling.Application.Interfaces;

public interface IAIAssistantService
{
    Task<string> ChatAsync(string prompt, string context, CancellationToken ct = default);

    /// <summary>
    /// สกัดข้อมูลใบเสร็จ/ใบกำกับภาษีซื้อจากข้อความ (OCR) เป็นโครงสร้าง — ใช้ Gemini เมื่อมี API Key
    /// และ fallback เป็น rule-based parser เมื่อไม่มีหรือเรียกไม่สำเร็จ
    /// </summary>
    Task<ParsedExpenseDto> ParseExpenseAsync(string receiptText, CancellationToken ct = default);
}
