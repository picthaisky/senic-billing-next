using System.Globalization;
using System.Security.Cryptography.X509Certificates;
using System.Security.Cryptography.Xml;
using System.Text;
using System.Xml;
using System.Xml.Linq;
using SenicBilling.Domain.Entities;
using SenicBilling.Domain.Enums;

namespace SenicBilling.Application.Services;

/// <summary>
/// Generates ETDA e-Tax Invoice / e-Receipt XML conforming to
/// Thai Electronic Transactions Development Agency (ETDA) CrossIndustryInvoice v2.0 schema
/// with full line items, tax breakdown, reference documents, and optional Enveloped XMLDSig signing.
/// </summary>
public static class ETaxXmlGenerator
{
    public static readonly XNamespace Rsm = "urn:etda:uncefact:data:standard:TaxInvoice_CrossIndustryInvoice:2";
    public static readonly XNamespace Ram = "urn:etda:uncefact:data:standard:TaxInvoice_ReusableAggregateBusinessInformationEntity:2";

    public static byte[] GenerateXml(DocumentHeader doc, Tenant? tenant) =>
        GenerateXml(doc, tenant, signingCertificate: null);

    public static byte[] GenerateXml(
        DocumentHeader doc,
        Tenant? tenant,
        string? certificatePath,
        string? certificatePassword = null)
    {
        if (string.IsNullOrWhiteSpace(certificatePath) || !File.Exists(certificatePath))
        {
            return GenerateXml(doc, tenant, signingCertificate: null);
        }

        using var cert = X509CertificateLoader.LoadPkcs12FromFile(
            certificatePath,
            certificatePassword,
            X509KeyStorageFlags.Exportable);

        return GenerateXml(doc, tenant, cert);
    }

    public static byte[] GenerateXml(
        DocumentHeader doc,
        Tenant? tenant,
        X509Certificate2? signingCertificate)
    {
        var (typeCode, typeName) = MapDocumentType(doc.DocumentType);
        var sellerName = string.IsNullOrWhiteSpace(tenant?.CompanyName) ? "Senic Billing Tenant" : tenant.CompanyName;
        var sellerTaxId = NormalizeTaxId(tenant?.TaxId);
        var sellerBranch = NormalizeBranchCode(tenant?.BranchName);
        var sellerAddress = tenant?.Address ?? "-";

        var buyerName = string.IsNullOrWhiteSpace(doc.CustomerName) ? "ไม่ระบุผู้ซื้อ" : doc.CustomerName;
        var buyerTaxId = NormalizeTaxId(doc.CustomerTaxId);
        var buyerBranch = NormalizeBranchCode(doc.CustomerBranch);
        var buyerAddress = doc.CustomerAddress ?? "-";

        var issueDateStr = FormatThailandIsoTimestamp(doc.DocumentDate);
        var createdDateStr = FormatThailandIsoTimestamp(doc.CreatedAt);

        var agreement = new XElement(Ram + "ApplicableHeaderTradeAgreement",
            BuildSellerParty(sellerName, sellerTaxId, sellerBranch, sellerAddress, tenant?.Email),
            BuildBuyerParty(buyerName, buyerTaxId, buyerBranch, buyerAddress));

        if (doc.ReferenceDocument is not null || doc.ReferenceDocumentId is not null)
        {
            var refDocNum = doc.ReferenceDocument?.DocumentNumber ?? doc.ReferenceDocumentId!.Value.ToString("N");
            var refDate = doc.ReferenceDocument?.DocumentDate ?? doc.DocumentDate;
            var (refTypeCode, _) = MapDocumentType(doc.ReferenceDocument?.DocumentType ?? DocumentType.TaxInvoice);

            agreement.Add(new XElement(Ram + "AdditionalReferencedDocument",
                new XElement(Ram + "IssuerAssignedID", refDocNum),
                new XElement(Ram + "FormattedIssueDateTime", FormatThailandIsoTimestamp(refDate)),
                new XElement(Ram + "ReferenceTypeCode", refTypeCode)));
        }

        var settlement = new XElement(Ram + "ApplicableHeaderTradeSettlement",
            new XElement(Ram + "InvoiceCurrencyCode", "THB"),
            new XElement(Ram + "ApplicableTradeTax",
                new XElement(Ram + "TypeCode", "VAT"),
                new XElement(Ram + "CalculatedRate", Fmt(doc.VatRate)),
                new XElement(Ram + "BasisAmount", Fmt(doc.TotalBeforeVat)),
                new XElement(Ram + "CalculatedAmount", Fmt(doc.VatAmount))));

        if (doc.DiscountAmount > 0m)
        {
            settlement.Add(new XElement(Ram + "SpecifiedTradeAllowanceCharge",
                new XElement(Ram + "ChargeIndicator", "false"),
                new XElement(Ram + "ActualAmount", Fmt(doc.DiscountAmount)),
                new XElement(Ram + "Reason", "ส่วนลดการค้า")));
        }

        settlement.Add(new XElement(Ram + "SpecifiedTradeSettlementHeaderMonetarySummation",
            new XElement(Ram + "LineTotalAmount", Fmt(doc.Subtotal)),
            new XElement(Ram + "AllowanceTotalAmount", Fmt(doc.DiscountAmount)),
            new XElement(Ram + "TaxBasisTotalAmount", Fmt(doc.TotalBeforeVat)),
            new XElement(Ram + "TaxTotalAmount", Fmt(doc.VatAmount)),
            new XElement(Ram + "GrandTotalAmount", Fmt(doc.GrandTotal))));

        var transaction = new XElement(Rsm + "SupplyChainTradeTransaction",
            agreement,
            new XElement(Ram + "ApplicableHeaderTradeDelivery",
                new XElement(Ram + "ActualDeliverySupplyChainEvent",
                    new XElement(Ram + "OccurrenceDateTime", issueDateStr))),
            settlement);

        foreach (var (line, idx) in (doc.Lines ?? []).OrderBy(l => l.SortOrder).Select((l, i) => (l, i + 1)))
        {
            transaction.Add(BuildLineItem(line, idx, doc.VatRate));
        }

        var exchangedDoc = new XElement(Rsm + "ExchangedDocument",
            new XElement(Rsm + "ID", doc.DocumentNumber),
            new XElement(Rsm + "Name", typeName),
            new XElement(Rsm + "TypeCode", typeCode),
            new XElement(Rsm + "IssueDateTime", issueDateStr),
            new XElement(Rsm + "CreationDateTime", createdDateStr));

        if (!string.IsNullOrWhiteSpace(doc.Notes))
        {
            exchangedDoc.Add(new XElement(Rsm + "IncludedNote",
                new XElement(Rsm + "SubjectCode", "REG"),
                new XElement(Rsm + "Content", doc.Notes)));
        }

        var root = new XElement(Rsm + "TaxInvoice_CrossIndustryInvoice",
            new XAttribute("xmlns", Rsm.NamespaceName),
            new XAttribute(XNamespace.Xmlns + "ram", Ram.NamespaceName),
            new XElement(Rsm + "ExchangedDocumentContext",
                new XElement(Ram + "GuidelineSpecifiedDocumentContextParameter",
                    new XElement(Ram + "ID",
                        new XAttribute("schemeAgencyID", "ETDA"),
                        new XAttribute("schemeVersionID", "v2.0"),
                        "ER3-2560"))),
            exchangedDoc,
            transaction);

        var xdoc = new XDocument(new XDeclaration("1.0", "UTF-8", null), root);

        if (signingCertificate is not null)
        {
            return SignXmlDocument(xdoc, signingCertificate);
        }

        using var ms = new MemoryStream();
        var writerSettings = new XmlWriterSettings
        {
            Encoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false),
            Indent = true
        };
        using (var writer = XmlWriter.Create(ms, writerSettings))
        {
            xdoc.Save(writer);
        }
        return ms.ToArray();
    }

    private static XElement BuildSellerParty(string name, string taxId, string branchCode, string address, string? email)
    {
        var party = new XElement(Ram + "SellerTradeParty",
            new XElement(Ram + "Name", name),
            new XElement(Ram + "SpecifiedTaxRegistration",
                new XElement(Ram + "ID",
                    new XAttribute("schemeID", "TXID"),
                    $"{taxId}{branchCode}")));

        if (!string.IsNullOrWhiteSpace(email))
        {
            party.Add(new XElement(Ram + "DefinedTradeContact",
                new XElement(Ram + "EmailURIUniversalCommunication",
                    new XElement(Ram + "URIID", email))));
        }

        party.Add(new XElement(Ram + "PostalTradeAddress",
            new XElement(Ram + "LineOne", address),
            new XElement(Ram + "CountryID", "TH")));

        return party;
    }

    private static XElement BuildBuyerParty(string name, string taxId, string branchCode, string address) =>
        new(Ram + "BuyerTradeParty",
            new XElement(Ram + "Name", name),
            new XElement(Ram + "SpecifiedTaxRegistration",
                new XElement(Ram + "ID",
                    new XAttribute("schemeID", "TXID"),
                    $"{taxId}{branchCode}")),
            new XElement(Ram + "PostalTradeAddress",
                new XElement(Ram + "LineOne", address),
                new XElement(Ram + "CountryID", "TH")));

    private static XElement BuildLineItem(DocumentLine line, int lineNo, decimal vatRate)
    {
        var itemSettlement = new XElement(Ram + "SpecifiedLineTradeSettlement",
            new XElement(Ram + "ApplicableTradeTax",
                new XElement(Ram + "TypeCode", "VAT"),
                new XElement(Ram + "CalculatedRate", Fmt(vatRate)),
                new XElement(Ram + "BasisAmount", Fmt(line.LineTotal)),
                new XElement(Ram + "CalculatedAmount", Fmt(Math.Round(line.LineTotal * vatRate / 100m, 2)))));

        if (line.DiscountAmount > 0m)
        {
            itemSettlement.Add(new XElement(Ram + "SpecifiedTradeAllowanceCharge",
                new XElement(Ram + "ChargeIndicator", "false"),
                new XElement(Ram + "ActualAmount", Fmt(line.DiscountAmount))));
        }

        itemSettlement.Add(new XElement(Ram + "SpecifiedTradeSettlementLineMonetarySummation",
            new XElement(Ram + "LineTotalAmount", Fmt(line.LineTotal))));

        return new XElement(Ram + "IncludedSupplyChainTradeLineItem",
            new XElement(Ram + "AssociatedDocumentLineDocument",
                new XElement(Ram + "LineID", lineNo.ToString(CultureInfo.InvariantCulture))),
            new XElement(Ram + "SpecifiedTradeProduct",
                new XElement(Ram + "ID", (line.ProductId?.ToString("N") ?? $"LINE-{lineNo}")),
                new XElement(Ram + "Name", line.Description)),
            new XElement(Ram + "SpecifiedLineTradeAgreement",
                new XElement(Ram + "GrossPriceProductTradePrice",
                    new XElement(Ram + "ChargeAmount", Fmt(line.UnitPrice)))),
            new XElement(Ram + "SpecifiedLineTradeDelivery",
                new XElement(Ram + "BilledQuantity",
                    new XAttribute("unitCode", string.IsNullOrWhiteSpace(line.Unit) ? "C62" : line.Unit),
                    line.Quantity.ToString("0.####", CultureInfo.InvariantCulture))),
            itemSettlement);
    }

    private static byte[] SignXmlDocument(XDocument xdoc, X509Certificate2 cert)
    {
        var xmlDoc = new XmlDocument { PreserveWhitespace = true };
        using (var reader = xdoc.CreateReader())
        {
            xmlDoc.Load(reader);
        }

        using var rsa = cert.GetRSAPrivateKey()
            ?? throw new InvalidOperationException("ETax signing certificate does not contain an RSA private key.");

        var signedXml = new SignedXml(xmlDoc)
        {
            SigningKey = rsa
        };
        if (signedXml.SignedInfo is not null)
            signedXml.SignedInfo.SignatureMethod = SignedXml.XmlDsigRSASHA256Url;

        var reference = new Reference(string.Empty)
        {
            DigestMethod = SignedXml.XmlDsigSHA256Url
        };
        reference.AddTransform(new XmlDsigEnvelopedSignatureTransform());
        signedXml.AddReference(reference);

        var keyInfo = new KeyInfo();
        keyInfo.AddClause(new KeyInfoX509Data(cert));
        signedXml.KeyInfo = keyInfo;

        signedXml.ComputeSignature();
        var xmlDigitalSignature = signedXml.GetXml();
        xmlDoc.DocumentElement?.AppendChild(xmlDoc.ImportNode(xmlDigitalSignature, true));

        using var ms = new MemoryStream();
        using (var writer = XmlWriter.Create(ms, new XmlWriterSettings
        {
            Encoding = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false),
            Indent = false
        }))
        {
            xmlDoc.Save(writer);
        }
        return ms.ToArray();
    }

    private static string Fmt(decimal value) => value.ToString("0.00", CultureInfo.InvariantCulture);

    private static string NormalizeTaxId(string? taxId)
    {
        if (string.IsNullOrWhiteSpace(taxId)) return "0000000000000";
        var digits = new string(taxId.Where(char.IsDigit).ToArray());
        return digits.Length == 13 ? digits : taxId.Trim();
    }

    private static string NormalizeBranchCode(string? branch)
    {
        if (string.IsNullOrWhiteSpace(branch) || branch.Contains("สำนักงานใหญ่", StringComparison.Ordinal))
            return "00000";

        var digits = new string(branch.Where(char.IsDigit).ToArray());
        return digits.Length > 0 ? digits.PadLeft(5, '0')[..5] : "00000";
    }

    private static string FormatThailandIsoTimestamp(DateTime dt)
    {
        var utc = dt.Kind == DateTimeKind.Utc ? dt : dt.ToUniversalTime();
        var bangkok = utc.AddHours(7);
        return $"{bangkok:yyyy-MM-ddTHH:mm:ss}+07:00";
    }

    private static (string Code, string Name) MapDocumentType(DocumentType docType) => docType switch
    {
        DocumentType.TaxInvoice => ("388", "ใบกำกับภาษี"),
        DocumentType.CreditNote => ("381", "ใบลดหนี้"),
        DocumentType.DebitNote => ("383", "ใบเพิ่มหนี้"),
        DocumentType.Receipt => ("380", "ใบเสร็จรับเงิน"),
        DocumentType.CashBill => ("380", "บิลเงินสด"),
        _ => ("388", "ใบกำกับภาษี")
    };
}
