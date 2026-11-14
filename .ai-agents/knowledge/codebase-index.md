# Codebase Index

Last reviewed: 2026-11-14

## Repository Shape

```text
senic-billing-next/
├── backend/
│   ├── SenicBilling.slnx
│   └── src/
│       ├── SenicBilling.API/
│       ├── SenicBilling.Application/
│       ├── SenicBilling.Domain/
│       └── SenicBilling.Infrastructure/
├── frontend/                   # SME Tenant Portal (React 19 + Vite + Tailwind v4)
│   ├── package.json
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── i18n/
│       ├── pages/
│       ├── services/
│       ├── store/
│       └── utils/
├── admin-frontend/             # Super Admin / Platform Provider Portal (React 19 + Vite + Tailwind v4)
│   ├── package.json
│   └── src/
│       ├── components/
│       └── pages/
├── .ai-agents/                 # Multi AI Agents config, knowledge, and playbooks
├── .agents/                    # Antigravity workspace skill bindings (skills.json)
├── .github/                    # Agents, skills, prompts, and CI/CD workflow
└── docs/
```

## Backend Map

- API startup: `backend/src/SenicBilling.API/Program.cs`
- Controllers: `backend/src/SenicBilling.API/Controllers/`
  - Document controllers: `TaxInvoiceController.cs`, `ReceiptController.cs`, `CashBillController.cs`, `DeliveryNoteController.cs`, `QuotationController.cs`, `DocumentControllerBase.cs`, `SharedDocumentController.cs`
  - Master data & attachments: `CustomersController.cs`, `ProductsController.cs`, `VendorsController.cs`, `WarehousesController.cs`, `AttachmentsController.cs`
  - Purchasing, Expenses & Accounting: `ExpensesController.cs`, `PurchaseOrdersController.cs`, `AccountingController.cs`, `BankReconciliationController.cs`
  - Analytics & reporting: `DashboardController.cs`, `ReportsController.cs`
  - Auth, RBAC & Tenants: `AuthController.cs`, `UserController.cs`, `TenantsController.cs`, `TenantUsersController.cs`, `AdminUsersController.cs`, `AdminRolesController.cs`, `AuditLogsController.cs`
  - SaaS & Payments: `PaymentsController.cs`, `TenantSubscriptionController.cs`, `AnnouncementsController.cs`, `SuperAdmin/SaTenantsController.cs`, `SuperAdmin/SaPlansController.cs`, `SuperAdmin/SaBillingController.cs`, `SuperAdmin/SaAnnouncementsController.cs`
  - AI, LINE & Automation: `AIAssistantController.cs`, `RecurringInvoiceController.cs`, `NotificationsController.cs`, `LineWebhookController.cs`
- SignalR hub: `backend/src/SenicBilling.API/Hubs/SenicBillingHub.cs`
- System monitor & Seeder: `backend/src/SenicBilling.API/Services/SystemMonitorService.cs`, `DevelopmentDataSeeder.cs`
- DbContext & Interceptors: `backend/src/SenicBilling.Infrastructure/Data/SenicBillingDbContext.cs`, `Interceptors/AuditInterceptor.cs`
- Background Jobs: `backend/src/SenicBilling.Infrastructure/BackgroundJobs/RecurringInvoiceWorker.cs`, `OverdueMonitorWorker.cs`
- Services: `DocumentNumberGeneratorService.cs`, `OmisePaymentService.cs`, `QuestPdfService.cs`, `GeminiAIAssistantService.cs`, `ReceiptTextParser.cs`, `PushNotificationService.cs`, `SmtpEmailService.cs`, `LineNotifyService.cs`, `ETaxXmlGenerator.cs`, `InventoryService.cs`, `AccountingService.cs`
- Storage: `backend/src/SenicBilling.Infrastructure/Storage/MinioStorageService.cs`
- Domain entities: `backend/src/SenicBilling.Domain/Entities/` (`Tenant`, `AppUser`, `Permission`, `RolePermission`, `Customer`, `Product`, `Vendor`, `PurchaseOrder`, `PurchaseOrderLine`, `Warehouse`, `ProductWarehouseStock`, `StockMovement`, `ExpenseRecord`, `ChartOfAccount`, `JournalEntry`, `JournalEntryLine`, `AccountingPeriodLock`, `BankStatementTransaction`, `DocumentHeader`, `DocumentLine`, `DocumentNumberSequence`, `Attachment`, `AuditLog`, `PaymentTransaction`, `PushSubscription`, `RecurringInvoice`, `SubscriptionPlan`, `TenantSubscription`, `BillingInvoice`, `TenantUsageStat`, `PlatformAnnouncement`)

## Frontend Map (`frontend/` — SME Portal)

- Root routing: `frontend/src/App.tsx` (React.lazy code-split routes)
- API & SignalR clients: `frontend/src/services/apiClient.ts`, `signalrClient.ts`
- Zustand stores: `useAuthStore.ts`, `useSystemStore.ts`, `useLocaleStore.ts`
- Layout & AI Chat: `frontend/src/components/layout/` (`DashboardLayout.tsx`, `Sidebar.tsx`, `Header.tsx`, `BottomNav.tsx`, `FloatingActionButton.tsx`, `FloatingAIChat.tsx`, `SystemStatusBadge.tsx`)
- Documents & Forms: `DocumentsListPage.tsx`, `DocumentHistoryModal.tsx`, `ShareDocumentModal.tsx`, `InvoiceForm.tsx`, `A4DocumentTemplate.tsx`, `AttachmentUpload.tsx`, `DocumentPrintView.tsx`, `PaymentCallbackPage.tsx` (`/payments/callback`)
- Expenses, Purchasing, Inventory & Accounting: `ExpensesPage.tsx`, `PurchaseOrdersPage.tsx`, `WarehousesPage.tsx`, `AccountingPage.tsx`, `BankReconciliationPage.tsx`
- Master Data: `CustomersPage.tsx`, `CustomerSelectModal.tsx`, `ProductsPage.tsx`
- Settings & RBAC: `SettingsPage.tsx`, `RecurringInvoicesConfig.tsx`, `TenantBackupCard.tsx`, `UsersManagementPage.tsx`, `AuditLogsPage.tsx`, `ProfilePage.tsx`
- E2E & Unit tests: `frontend/playwright.config.ts`, `frontend/e2e/senic-e2e.spec.ts`, `frontend/scripts/phase11-unit.test.mjs`, `frontend/scripts/phase12-unit.test.mjs`, `frontend/scripts/phase13-unit.test.mjs`, `frontend/scripts/phase14-unit.test.mjs`, `frontend/scripts/phase15-unit.test.mjs`, `frontend/scripts/phase16-unit.test.mjs`, `frontend/scripts/phase17-unit.test.mjs`, `frontend/scripts/phase18-unit.test.mjs`, `frontend/scripts/phase19-unit.test.mjs`

## Admin Frontend Map (`admin-frontend/` — Super Admin Portal)

- Root routing, i18n & API client: `admin-frontend/src/App.tsx`, `admin-frontend/src/i18n/AdminLocaleContext.tsx` (`sa_locale` `TH`/`EN` bilingual context), `admin-frontend/src/services/apiClient.ts` (`sa_token` strict isolation)
- Pages: `Dashboard.tsx`, `TenantsList.tsx`, `PackagesList.tsx` (`min={-1}` unlimited quota support), `BillingInvoices.tsx`, `AnnouncementsPage.tsx`
- E2E & Unit tests: `admin-frontend/playwright.config.ts`, `admin-frontend/e2e/admin-e2e.spec.ts`, `admin-frontend/scripts/admin-unit.test.mjs`

## Verified Commands

- Backend build & tests: `cd backend; dotnet build SenicBilling.slnx; dotnet test SenicBilling.slnx` (`BillingDomainAndSecurityTests`, `Phase9ExpenseAndLineTests`, `Phase10PurchaseWarehouseAccountingTests`, `Phase11EnterpriseTests`, `Phase12EnterpriseOperationsTests`, `Phase13SecuritySearchAndOperationsTests`, `Phase14ProductionHardeningTests`, `Phase15ProductionAndPaymentTests`, `Phase16SecurityRbacAndQuotaTests`, `Phase17WorkerQuotaAndSubscriptionTests`, `Phase18DocumentTaxAndStockParityTests`, `Phase19WebhookPaymentAndMasterDataTests`)
- Frontend build: `cd frontend; npm run build`
- Frontend lint, unit & Playwright E2E tests: `cd frontend; npm run lint; npm test; npm run test:e2e`
- Admin Frontend lint, build, unit & Playwright E2E tests: `cd admin-frontend; npm run lint; npm test; npm run build; npm run test:e2e`

## High-Risk Modules

- `ClaimsPrincipalExtensions` & `Program.cs` `"PlatformAdmin"` policy & `Sa*Controller`: platform-owner/SuperAdmin privilege boundary isolating `/api/superadmin/*` from regular tenant admins, plus `JwtTokenService` `"sub"`/`"id"` & `"username"` claim synchronization and `AuthController.DemoLogin`/`Register` quota & tenant guards.
- `App:FrontendBaseUrl` / `App:AdminBaseUrl` / `App:CorsOrigins` in `appsettings.json`, `Program.cs`, `SharedDocumentController`, `OverdueMonitorWorker` (`RunOverdueCheckAsync`), `RecurringInvoiceWorker` (`ProcessDueRecurringInvoicesAsync`), `OmisePaymentService` (`DefaultReturnUri`), and `QuestPdfService` logo loading (`App_Data/logos/{tenantId}/{safeFileName}`) + `ETaxXmlGenerator` `TypeCode` mapping (`388`/`381`/`383`/`380`).
- `AttachmentsController` & `TenantsController` (`UploadLogo`/`GetLogo`): strict tenant isolation on file uploads/downloads, size/extension allowlists, and `IStorageService` MinIO upload with local `App_Data` fallback.
- `SearchController` & `NotificationsController.GetFeed` & `SenicBillingHub`: multi-entity tenant-scoped global search and live SignalR `"NotificationReceived"` alert feed.

- `DocumentNumberGeneratorService`: uniqueness and concurrency across tenants and document types (`INV`, `QUO`, `RCP`, `EXP`, `PO`, `JV`, etc.).
- `SenicBillingDbContext`: tenant relationships, decimal precision (`18,4`), unique composite indexes (`ProductWarehouseStock`, `ChartOfAccount`, `JournalEntry`), seed data, migrations.
- `DocumentControllerBase` & `TaxInvoiceController` & `SharedDocumentController`: VAT/WHT formulas, stock deduction (`IInventoryService` / `DeductStockAsync`), restocking on update/cancel, 1-Click conversion, automatic accounting posting.
- `PurchaseOrdersController` & `InventoryService`: PO receiving into multi-warehouse stock, stock transfers/adjustments, automatic Input VAT `ExpenseRecord` generation.
- `AccountingController` & `AccountingService`: Double-entry journal generation (`TotalDebit == TotalCredit`), manual JV validation, Trial Balance, P&L, Express/FlowAccount CSV & Excel export.
- `ExpensesController` & `ReportsController`: Expense `EXP-YYYYMM-XXXX` lifecycle, Input VAT / ภ.พ.30 net tax estimation, ภ.ง.ด.3 / ภ.ง.ด.53 Excel exports, and 50 ทวิ WHT certificates (`QuestPdfService`).
- `LineWebhookController` & `LineNotifyService`: Channel Secret HMAC-SHA256 webhook signature validation, tenant Messaging API replies/push fallback.
- `AuthController` / `JwtTokenService` / `SaTenantsController` / `SaPlansController` / `AdminUsersController` / `TenantUsersController` / `AdminRolesController` / `UserController`: token claims, role & permission enforcement, `IsReservedPlatformRole` privilege escalation guards, `MaxUsers` quota enforcement on user creation and re-activation, and tenant-scoped profile/password management.
- `PaymentsController` / `TenantSubscriptionController` / `OmisePaymentService` / `PaymentCallbackPage`: payment state, `[AllowAnonymous]` `callback-status` lookup, safe `TryGetProperty` webhook parsing, webhook integrity, and idempotency.
- `QuestPdfService` & `TenantsController.HasSupportedLogoHeader` & `SaTenantsController.ImpersonateTenant`: local `App_Data` + MinIO `senic-billing-logos` PDF logo fallback, upload PNG/JPEG/WEBP magic-byte verification, `FrontendUrl` resolution via `App:FrontendBaseUrl`, and `senic-app-data:/app/App_Data` Docker volume persistence.
- `ETaxXmlGenerator` / `ReportsController` / `QuestPdfService`: Thai tax compliance, e-Tax XML, Output/Input VAT Excel reports, PO PDF, 50 ทวิ PDF, A4 print/PDF accuracy.
- `frontend/src/i18n/resources.ts` & `frontend/vite.config.ts`: 100% deep bilingual (`TH`/`EN`) coverage across all 37 active `.tsx` files with zero hardcoded Thai UI strings, plus Rollup `manualChunks` splitting (`i18n-resources`, `vendor-react`, `vendor-charts`, `vendor-xlsx`, `vendor-signalr`, `vendor-i18n`, `vendor-icons`) keeping all JS chunks `< 500 kB`.
