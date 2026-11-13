# Lessons Learned

This log stores validated feedback, bug lessons, review findings, and agent workflow improvements.

## Entry Template

```markdown
## YYYY-MM-DD - Short Title

- Type: bug-lesson | review-finding | user-feedback | workflow-improvement | deprecated-assumption
- Source: code | docs | test | user | incident | review
- Evidence: path, command, or user decision
- Confidence: low | medium | high
- Lesson: One actionable sentence
- Follow-up: Optional next action
```

## 2026-06-04 - Multi-Agent System Bootstrapped

- Type: workflow-improvement
- Source: docs and repository structure
- Evidence: `.ai-agents/README.md`, `.github/agents/`, `.github/prompts/`, `.github/skills/`
- Confidence: high
- Lesson: Senic Billing work should route through specialist agents for billing, tenant, UX, QA, security, deployment, and learning risks.
- Follow-up: After the next real feature or bug fix, capture whether routing rules need refinement.

## 2026-11-13 - Sprints 1–4 Full-Stack Completion & EF Core Line Replacement Lesson

- Type: bug-lesson
- Source: test
- Evidence: `backend/src/SenicBilling.API/Controllers/TaxInvoiceController.cs`, `backend/src/SenicBilling.API/Controllers/DocumentControllerBase.cs`, `backend/tests/SenicBilling.Tests/BillingDomainAndSecurityTests.cs`
- Confidence: high
- Lesson: When replacing `DocumentLine` items on a tracked `DocumentHeader` in EF Core with client-generated `Guid.NewGuid()` keys, always call `dbContext.DocumentLines.Add(newLine)` explicitly so EF Core tracks the new line as `Added` rather than `Modified`.
- Follow-up: Always run `dotnet test SenicBilling.slnx` after modifying document CRUD or stock reconciliation logic.

## 2026-11-13 - Stock Reconciliation, Public Shared Links & SaaS Quota Enforcement

- Type: workflow-improvement
- Source: code
- Evidence: `SharedDocumentController.cs`, `DashboardController.cs`, `SaBillingController.cs`, `TenantSubscriptionController.cs`, `PasswordHasher.cs`
- Confidence: high
- Lesson: Stock-affecting documents (`TaxInvoice`, `Receipt`, `CashBill`, `DeliveryNote`) must restore previous stock before updating or cancelling lines, and SaaS plan limits (`MaxDocumentsPerMonth`, `MaxUsers`) must be enforced at the controller boundary before generating sequential document numbers.
- Follow-up: Keep `BillingDomainAndSecurityTests` expanded as new document types or payment gateways are added.

