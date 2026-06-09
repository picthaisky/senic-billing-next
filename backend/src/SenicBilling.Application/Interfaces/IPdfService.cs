using SenicBilling.Domain.Entities;

namespace SenicBilling.Application.Interfaces;

public interface IPdfService
{
    byte[] GenerateDocumentPdf(DocumentHeader document);
}
