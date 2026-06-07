using System.Text;
using System.Xml;
using SenicBilling.Domain.Entities;

namespace SenicBilling.Application.Services;

public class ETaxXmlGenerator
{
    public static byte[] GenerateXml(DocumentHeader document, Tenant tenant)
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

        writer.WriteStartDocument();
        writer.WriteStartElement("TaxInvoice_CrossIndustryInvoice", "urn:etda:uncefact:data:standard:TaxInvoice_CrossIndustryInvoice:2");

        // Document Context
        writer.WriteStartElement("ExchangedDocumentContext");
        writer.WriteElementString("GuidelineSpecifiedDocumentContextParameter", "urn:etda:data:standard:TaxInvoice_CrossIndustryInvoice:2.0");
        writer.WriteEndElement();

        // Exchanged Document
        writer.WriteStartElement("ExchangedDocument");
        writer.WriteElementString("ID", document.DocumentNumber);
        writer.WriteElementString("Name", "ใบกำกับภาษี");
        writer.WriteElementString("TypeCode", "388"); // 388 = Tax Invoice
        writer.WriteElementString("IssueDateTime", document.DocumentDate.ToString("yyyy-MM-ddTHH:mm:ss"));
        writer.WriteElementString("Purpose", document.Notes ?? "ค่าสินค้าและบริการ");
        writer.WriteEndElement();

        // Supply Chain Trade Transaction
        writer.WriteStartElement("SupplyChainTradeTransaction");

        // Seller Trade Party (Tenant)
        writer.WriteStartElement("ApplicableHeaderTradeAgreement");
        writer.WriteStartElement("SellerTradeParty");
        writer.WriteElementString("Name", tenant.CompanyName);
        writer.WriteStartElement("SpecifiedTaxRegistration");
        writer.WriteElementString("ID", tenant.TaxId);
        writer.WriteEndElement();
        writer.WriteEndElement(); // SellerTradeParty

        // Buyer Trade Party (Customer)
        writer.WriteStartElement("BuyerTradeParty");
        writer.WriteElementString("Name", document.CustomerName);
        writer.WriteStartElement("SpecifiedTaxRegistration");
        writer.WriteElementString("ID", document.CustomerTaxId ?? "");
        writer.WriteEndElement();
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
}
