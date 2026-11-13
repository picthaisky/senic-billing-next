using SenicBilling.Domain.Entities;

namespace SenicBilling.Application.Interfaces;

public interface IPdfService
{
    byte[] GenerateDocumentPdf(DocumentHeader document);

    /// <summary>หนังสือรับรองการหักภาษี ณ ที่จ่าย ตามมาตรา 50 ทวิ แห่งประมวลรัษฎากร</summary>
    byte[] GenerateWhtCertificatePdf(ExpenseRecord expense, Tenant payer);

    /// <summary>ใบสั่งซื้อ (Purchase Order) PDF</summary>
    byte[] GeneratePurchaseOrderPdf(PurchaseOrder po, Tenant buyer);
}
