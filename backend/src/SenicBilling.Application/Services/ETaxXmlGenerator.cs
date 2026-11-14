using System.Text;
using System.Xml;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;

namespace SenicBilling.Application.Services;

public class ETaxXmlGenerator
{
    public static byte[] GenerateXml(DocumentHeader document, Tenant? tenant)
    {
        // This is a simplified mockup of ETDA e-Tax Invoice XML structure.
        // In a real implementation, it must strictly follow the UN/CEFACT XML standard
        // and include namespaces like urn:etda:uncefact:data:standard:TaxInvoice_CrossIndustryInvoice:2

        var settings = new XmlWriterSettings
        {
            Encoding = Encoding.UTF8,
            Indent = true
        };

        using var ms = new MemoryStream();
        using var writer = XmlWriter.Create(ms, settings);

        var (typeCode, documentName) = ResolveEtdaDocumentType(document.DocumentType);

        writer.WriteStartDocument();
        writer.WriteStartElement("TaxInvoice_CrossIndustryInvoice", "urn:etda:uncefact:data:standard:TaxInvoice_CrossIndustryInvoice:2");

        // Document Context
        writer.WriteStartElement("ExchangedDocumentContext");
        writer.WriteElementString("GuidelineSpecifiedDocumentContextParameter", "urn:etda:data:standard:TaxInvoice_CrossIndustryInvoice:2.0");
        writer.WriteEndElement();

        // Exchanged Document
        writer.WriteStartElement("ExchangedDocument");
        writer.WriteElementString("ID", document.DocumentNumber ?? "");
        writer.WriteElementString("Name", documentName);
        writer.WriteElementString("TypeCode", typeCode);
        writer.WriteElementString("IssueDateTime", document.DocumentDate.ToString("yyyy-MM-ddTHH:mm:ss"));
        writer.WriteElementString("Purpose", string.IsNullOrWhiteSpace(document.Notes) ? "ค่าสินค้าและบริการ" : document.Notes);
        writer.WriteEndElement();

        // Supply Chain Trade Transaction
        writer.WriteStartElement("SupplyChainTradeTransaction");

        // Seller Trade Party (Tenant)
        writer.WriteStartElement("ApplicableHeaderTradeAgreement");
        writer.WriteStartElement("SellerTradeParty");
        writer.WriteElementString("Name", tenant?.CompanyName ?? "-");
        writer.WriteStartElement("SpecifiedTaxRegistration");
        writer.WriteElementString("ID", tenant?.TaxId ?? "");
        writer.WriteEndElement();
        if (!string.IsNullOrWhiteSpace(tenant?.Address))
        {
            writer.WriteStartElement("PostalTradeAddress");
            writer.WriteElementString("LineOne", tenant.Address);
            writer.WriteEndElement();
        }
        writer.WriteEndElement(); // SellerTradeParty

        // Buyer Trade Party (Customer)
        writer.WriteStartElement("BuyerTradeParty");
        writer.WriteElementString("Name", document.CustomerName ?? "-");
        writer.WriteStartElement("SpecifiedTaxRegistration");
        writer.WriteElementString("ID", document.CustomerTaxId ?? "");
        writer.WriteEndElement();
        if (!string.IsNullOrWhiteSpace(document.CustomerAddress))
        {
            writer.WriteStartElement("PostalTradeAddress");
            writer.WriteElementString("LineOne", document.CustomerAddress);
            writer.WriteEndElement();
        }
        writer.WriteEndElement(); // BuyerTradeParty

        writer.WriteEndElement(); // ApplicableHeaderTradeAgreement

        // Summary
        writer.WriteStartElement("ApplicableHeaderTradeSettlement");
        writer.WriteStartElement("SpecifiedTradeSettlementHeaderMonetarySummation");
        writer.WriteElementString("LineTotalAmount", document.TotalBeforeVat.ToString("F2"));
        writer.WriteElementString("TaxBasisTotalAmount", document.TotalBeforeVat.ToString("F2"));
        writer.WriteElementString("TaxTotalAmount", document.VatAmount.ToString("F2"));
        writer.WriteElementString("GrandTotalAmount", document.GrandTotal.ToString("F2"));
        writer.WriteEndElement(); // SpecifiedTradeSettlementHeaderMonetarySummation
        writer.WriteEndElement(); // ApplicableHeaderTradeSettlement

        writer.WriteEndElement(); // SupplyChainTradeTransaction

        writer.WriteEndElement(); // TaxInvoice_CrossIndustryInvoice
        writer.WriteEndDocument();

        writer.Flush();
        return ms.ToArray();
    }

    private static (string TypeCode, string DocumentName) ResolveEtdaDocumentType(DocumentType documentType) => documentType switch
    {
        DocumentType.CreditNote => ("381", "ใบลดหนี้"),
        DocumentType.DebitNote => ("383", "ใบเพิ่มหนี้"),
        DocumentType.Receipt => ("380", "ใบเสร็จรับเงิน"),
        DocumentType.CashBill => ("380", "บิลเงินสด"),
        _ => ("388", "ใบกำกับภาษี")
    };
}
