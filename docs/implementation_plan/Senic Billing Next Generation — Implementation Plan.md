# Senic Billing Next Generation — Implementation Plan

## Current State Assessment

I have audited the full codebase. Here is the gap analysis mapping your 7-module vision against what currently exists.

### What Already Exists (Foundations)
| Capability | Status | Evidence |
|---|---|---|
| 4 Document Types (Receipt, CashBill, DeliveryNote, TaxInvoice) + Quotation | ✅ Exists | [DocumentType.cs](file:///c:/Users/supachai.nil/Documents/GitHub/senic-billing-next/backend/src/SenicBilling.Domain/Enums/DocumentType.cs) |
| Running Number (`INV-YYYYMM-NNNN`) with concurrency safety | ✅ Exists | [IDocumentNumberGeneratorService.cs](file:///c:/Users/supachai.nil/Documents/GitHub/senic-billing-next/backend/src/SenicBilling.Domain/Interfaces/IDocumentNumberGeneratorService.cs), RowVersion locking |
| VAT Include/Exclude calculation | ✅ Exists | [TaxInvoiceController.cs](file:///c:/Users/supachai.nil/Documents/GitHub/senic-billing-next/backend/src/SenicBilling.API/Controllers/TaxInvoiceController.cs#L229-L247) |
| Document reference chain (`ReferenceDocumentId`) | ✅ Exists | [DocumentHeader.cs](file:///c:/Users/supachai.nil/Documents/GitHub/senic-billing-next/backend/src/SenicBilling.Domain/Entities/DocumentHeader.cs#L67) |
| PromptPay QR Payment + Omise webhook | ✅ Exists | [PaymentsController.cs](file:///c:/Users/supachai.nil/Documents/GitHub/senic-billing-next/backend/src/SenicBilling.API/Controllers/PaymentsController.cs) |
| Dashboard (Revenue chart, Top Products, Recent Activity) | ✅ Exists | [DashboardController.cs](file:///c:/Users/supachai.nil/Documents/GitHub/senic-billing-next/backend/src/SenicBilling.API/Controllers/DashboardController.cs) |
| Customer & Product master data | ✅ Exists | CRUD controllers with tenant isolation |
| Multi-tenant with JWT auth | ✅ Exists | TenantId on every entity, JWT claims |
| Basic user roles (Admin, User, Viewer) | ✅ Exists | [AppUser.cs](file:///c:/Users/supachai.nil/Documents/GitHub/senic-billing-next/backend/src/SenicBilling.Domain/Entities/AppUser.cs#L25) |
| SignalR real-time updates | ✅ Exists | PaymentReceived event |
| MinIO file storage | ✅ Exists | IStorageService, AttachmentsController |
| Product StockQuantity field | ✅ Exists | [Product.cs](file:///c:/Users/supachai.nil/Documents/GitHub/senic-billing-next/backend/src/SenicBilling.Domain/Entities/Product.cs#L31) (field only, no deduction logic) |

### What's Missing (Gaps by Module)

| # | Module | Gap | Priority |
|---|---|---|---|
| 1.1 | Core Billing | **1-Click Convert** (DeliveryNote → TaxInvoice) — no conversion API | 🔴 High |
| 1.2 | Core Billing | **Credit Note / Debit Note** — missing DocumentTypes and reversal logic | 🔴 High |
| 1.3 | Core Billing | **WHT (Withholding Tax)** calculation 1%/3%/5% — no field or logic | 🟡 Medium |
| 1.4 | Core Billing | **Custom Running Number format** — format is hardcoded | 🟡 Medium |
| 2.1 | AI & Automation | **AI OCR** (business card / company cert scan) — no implementation | 🟡 Medium |
| 2.2 | AI & Automation | **Recurring Invoices** — no scheduling entity or job | 🔴 High |
| 2.3 | AI & Automation | **Auto-Reminders** (overdue follow-up via Email/LINE) — no implementation | 🟡 Medium |
| 3.1 | Payment | **Payment Link** (credit card) — Omise exists but no link generation | 🟡 Medium |
| 3.2 | Payment | **Document status flow** (Draft→Sent→Viewed→Paid→Overdue) — only Draft/Issued/Cancelled/Paid | 🔴 High |
| 3.3 | Payment | **Read Receipt tracking** (Viewed status) — no tracking | 🟡 Medium |
| 4.1 | Analytics | **Tax Estimator** (monthly VAT summary for Revenue Dept.) | 🔴 High |
| 4.2 | Analytics | **Top Spenders** (customer ranking) | 🟢 Low |
| 4.3 | Analytics | **A/R Aging Report** | 🔴 High |
| 5.1 | Master Data | **Customer purchase history & special pricing** | 🟡 Medium |
| 5.2 | Master Data | **Stock deduction on DeliveryNote issue** | 🟡 Medium |
| 6.1 | Integration | **e-Tax XML (RD3/RD3-2)** — no implementation | 🔴 High |
| 6.2 | Integration | **Omnichannel Delivery** (PDF email, LINE share, password-protected) | 🟡 Medium |
| 7.1 | Security | **RBAC** (Sales, Accountant, Admin roles with fine-grained permissions) — basic role field only | 🔴 High |
| 7.2 | Security | **Audit Log** (who created/edited/deleted what) — no implementation | 🔴 High |
| 7.3 | Security | **Auto-Backup** on Cloud | 🟢 Low |

---

## Proposed Phases

> [!IMPORTANT]
> This is a **massive scope** — roughly 20+ new features across backend, frontend, and infrastructure. I recommend delivering in 4 phases, each independently shippable and valuable.

### Phase 1: Core Billing Engine Completion (Foundation)
**Why first:** Every other module depends on a complete document lifecycle.

| Task | Agent | Files |
|---|---|---|
| Add `CreditNote` and `DebitNote` to `DocumentType` enum | Sage / Ledger | `DocumentType.cs`, `IDocumentNumberGeneratorService` |
| Add `Sent`, `Viewed`, `Overdue` to `DocumentStatus` enum | Sage / Ledger | `DocumentStatus.cs` |
| Add WHT fields to `DocumentHeader` (`WhtRate`, `WhtAmount`) | Sage / Ledger | `DocumentHeader.cs`, `Dtos.cs`, Controllers |
| Add WHT to VAT calculation logic | Sage / Ledger | `TaxInvoiceController`, `DocumentController` |
| Create **1-Click Convert API** (`POST /api/documents/{id}/convert`) | Sage | New endpoint in `DocumentController` |
| Create **Credit Note / Debit Note** creation flow | Sage / Ledger | New endpoints, reversal logic |
| EF Core migration for new fields | Sage | New migration |
| Build verification: `dotnet build` + migration dry-run | Argus | — |

---

### Phase 2: Analytics & Security (Business Intelligence + Trust)
**Why second:** Tax reporting and audit trails are legally required for Thai SMEs.

| Task | Agent | Files |
|---|---|---|
| **Tax Estimator API** — monthly VAT output summary | Sage | New endpoint in `DashboardController` |
| **A/R Aging Report API** — overdue bucketing (current, 30d, 60d, 90d+) | Sage | New endpoint in `DashboardController` |
| **Top Spenders API** — customer ranking by revenue | Sage | New endpoint in `DashboardController` |
| **Audit Log entity + middleware** — capture Create/Update/Delete events | Sage / Aegis | New `AuditLog` entity, EF interceptor |
| **RBAC enhancement** — add `Permission` entity, policy-based authorization | Sage / Aegis | New entities, `AuthorizationHandler` |
| Stock deduction on DeliveryNote issue | Sage / Ledger | `DocumentController` + `Product` update |
| Customer purchase history API | Sage | New endpoint in `CustomersController` |
| EF Core migration | Sage | New migration |

---

### Phase 3: Payment & Automation (Cash Flow Acceleration)
**Why third:** Once billing and analytics are solid, automate the revenue cycle.

| Task | Agent | Files |
|---|---|---|
| **Recurring Invoice** entity + scheduling API | Sage | New `RecurringInvoice` entity, controller |
| **Background job service** for scheduled invoice generation | Sage / Hermes | Hosted service or Hangfire |
| **Payment Link** generation (Omise Internet Banking / Card) | Sage | `PaymentsController` |
| **Read Receipt tracking** — secure link + viewed timestamp | Sage | New endpoint, document update |
| **Overdue detection** background job + status update | Sage / Hermes | Hosted service |
| **Auto-Reminder** notification via Email | Sage | New notification service |
| Email service integration (SMTP or SendGrid) | Sage / Hermes | New `IEmailService` |
| EF Core migration | Sage | New migration |

---

### Phase 4: Integration & AI (Next-Gen Differentiators)
**Why last:** These are premium features that build on the complete platform.

| Task | Agent | Files |
|---|---|---|
| **e-Tax XML generation** (RD3/RD3-2 format) | Sage / Ledger | New `EtaxXmlService` |
| **e-Tax Service Provider API integration** | Sage / Atlas | New integration service |
| **Digital Signature** support | Sage / Aegis | Certificate handling |
| **AI OCR** — business card / company cert scanning | Sage / Nova | New `IOcrService`, API endpoint |
| **PDF email delivery** with password protection | Sage | New `IDocumentDeliveryService` |
| **LINE OA integration** for document sharing | Sage | New `ILineNotifyService` |
| **Auto-Backup** scheduling | Hermes | Docker + pg_dump cron |

---

## User Review Required

> [!IMPORTANT]
> **Phase Scope Confirmation**: Do you want me to start with **Phase 1 only** (Core Billing Engine)? This is the recommended approach — it's the foundation all other phases depend on and can be shipped independently.

> [!WARNING]
> **Database Migrations**: Phases 1-3 each require EF Core migrations. These are additive (new columns/tables) so they are safe and reversible. However, the `DocumentStatus` enum expansion (adding `Sent`, `Viewed`, `Overdue`) will affect existing data — we should default existing `Issued` documents to remain `Issued`.

## Open Questions

1. **Running Number format customization** — should this be tenant-configurable via a settings UI, or is the current `PREFIX-YYYYMM-NNNN` format sufficient for Phase 1?
2. **Credit Note numbering** — should Credit Notes get their own prefix (e.g., `CN-202606-0001`) separate from Invoices?
3. **WHT calculation** — should WHT be applied per-line or per-document? Thai accounting practice typically applies WHT per document against the `TotalBeforeVat`.
4. **Recurring Invoices** — should the scheduling be simple (e.g., "every 1st of month") or flexible (e.g., cron-like: every 15 days, quarterly, etc.)?
5. **e-Tax** — do you already have a Service Provider agreement, or should we design the XML generation first and defer the API submission?

## Verification Plan

### Per Phase
- `cd backend && dotnet build SenicBilling.slnx` after every code change
- EF Core migration: `dotnet ef migrations add <Name>` + review generated SQL
- `cd frontend && npm run build` for any frontend changes
- Domain rule validation against `.ai-agents/knowledge/domain-rules.md`

### Security (Aegis)
- Tenant isolation audit on every new entity/endpoint
- RBAC policy review for new controllers
- Audit log coverage verification
