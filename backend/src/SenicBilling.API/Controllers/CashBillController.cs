using Microsoft.AspNetCore.Mvc;
using SenicBilling.Domain.Enums;
using SenicBilling.Domain.Interfaces;
using SenicBilling.Infrastructure.Data;

namespace SenicBilling.API.Controllers;

[ApiController]
[Route("api/cashbills")]
public class CashBillController(SenicBillingDbContext dbContext, IDocumentNumberGeneratorService numberGenerator)
    : DocumentControllerBase(dbContext, numberGenerator)
{
    protected override DocumentType TargetDocumentType => DocumentType.CashBill;
}
