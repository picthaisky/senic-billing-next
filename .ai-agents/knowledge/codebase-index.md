# Codebase Index

Last reviewed: 2026-11-13

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
  - Purchasing, Expenses & Accounting: `ExpensesController.cs`, `PurchaseOrdersController.cs`, `AccountingController.cs`
  - Analytics & reporting: `DashboardController.cs`, `ReportsController.cs`
  - Auth, RBAC & Tenants: `AuthController.cs`, `UserController.cs`, `TenantsController.cs`, `TenantUsersController.cs`, `AdminUsersController.cs`, `AdminRolesController.cs`
  - SaaS & Payments: `PaymentsController.cs`, `TenantSubscriptionController.cs`, `SuperAdmin/SaTenantsController.cs`, `SuperAdmin/SaPlansController.cs`
  - AI, LINE & Automation: `AIAssistantController.cs`, `RecurringInvoiceController.cs`, `NotificationsController.cs`, `LineWebhookController.cs`
- SignalR hub: `backend/src/SenicBilling.API/Hubs/SenicBillingHub.cs`
- System monitor & Seeder: `backend/src/SenicBilling.API/Services/SystemMonitorService.cs`, `DevelopmentDataSeeder.cs`
- DbContext & Interceptors: `backend/src/SenicBilling.Infrastructure/Data/SenicBillingDbContext.cs`, `Interceptors/AuditInterceptor.cs`
- Background Jobs: `backend/src/SenicBilling.Infrastructure/BackgroundJobs/RecurringInvoiceWorker.cs`, `OverdueMonitorWorker.cs`
- Services: `DocumentNumberGeneratorService.cs`, `OmisePaymentService.cs`, `QuestPdfService.cs`, `GeminiAIAssistantService.cs`, `ReceiptTextParser.cs`, `PushNotificationService.cs`, `SmtpEmailService.cs`, `LineNotifyService.cs`, `ETaxXmlGenerator.cs`, `InventoryService.cs`, `AccountingService.cs`
- Storage: `backend/src/SenicBilling.Infrastructure/Storage/MinioStorageService.cs`
- Domain entities: `backend/src/SenicBilling.Domain/Entities/` (`Tenant`, `AppUser`, `Permission`, `RolePermission`, `Customer`, `Product`, `Vendor`, `PurchaseOrder`, `PurchaseOrderLine`, `Warehouse`, `ProductWarehouseStock`, `StockMovement`, `ExpenseRecord`, `ChartOfAccount`, `JournalEntry`, `JournalEntryLine`, `DocumentHeader`, `DocumentLine`, `DocumentNumberSequence`, `Attachment`, `AuditLog`, `PaymentTransaction`, `PushSubscription`, `RecurringInvoice`, `SubscriptionPlan`, `TenantSubscription`, `BillingInvoice`, `TenantUsageStat`)

## Frontend Map (`frontend/` — SME Portal)

- Root routing: `frontend/src/App.tsx`
- API & SignalR clients: `frontend/src/services/apiClient.ts`, `signalrClient.ts`
- Zustand stores: `useAuthStore.ts`, `useSystemStore.ts`, `useLocaleStore.ts`
- Layout & AI Chat: `frontend/src/components/layout/` (`DashboardLayout.tsx`, `Sidebar.tsx`, `Header.tsx`, `BottomNav.tsx`, `FloatingActionButton.tsx`, `FloatingAIChat.tsx`, `SystemStatusBadge.tsx`)
- Documents & Forms: `DocumentsListPage.tsx`, `DocumentHistoryModal.tsx`, `ShareDocumentModal.tsx`, `InvoiceForm.tsx`, `A4DocumentTemplate.tsx`, `AttachmentUpload.tsx`, `DocumentPrintView.tsx`
- Expenses, Purchasing, Inventory & Accounting: `ExpensesPage.tsx`, `PurchaseOrdersPage.tsx`, `WarehousesPage.tsx`, `AccountingPage.tsx`
- Master Data: `CustomersPage.tsx`, `CustomerSelectModal.tsx`, `ProductsPage.tsx`
- Settings & RBAC: `SettingsPage.tsx`, `RecurringInvoicesConfig.tsx`, `UsersManagementPage.tsx`, `StaffManagementPage.tsx`, `ProfilePage.tsx`

## Admin Frontend Map (`admin-frontend/` — Super Admin Portal)

- Root routing: `admin-frontend/src/App.tsx`
- Pages: `Dashboard.tsx`, `TenantsList.tsx`, `PackagesList.tsx`

## Verified Commands

- Backend build & tests: `cd backend; dotnet build SenicBilling.slnx; dotnet test SenicBilling.slnx` (`BillingDomainAndSecurityTests`, `Phase9ExpenseAndLineTests`, `Phase10PurchaseWarehouseAccountingTests`)
- Frontend build: `cd frontend; npm run build`
- Frontend lint: `cd frontend; npm run lint`
- Admin Frontend lint & build: `cd admin-frontend; npm run lint; npm run build`

## High-Risk Modules

- `DocumentNumberGeneratorService`: uniqueness and concurrency across tenants and document types (`INV`, `QUO`, `RCP`, `EXP`, `PO`, `JV`, etc.).
- `SenicBillingDbContext`: tenant relationships, decimal precision (`18,4`), unique composite indexes (`ProductWarehouseStock`, `ChartOfAccount`, `JournalEntry`), seed data, migrations.
- `DocumentControllerBase` & `TaxInvoiceController` & `SharedDocumentController`: VAT/WHT formulas, stock deduction (`IInventoryService` / `DeductStockAsync`), restocking on update/cancel, 1-Click conversion, automatic accounting posting.
- `PurchaseOrdersController` & `InventoryService`: PO receiving into multi-warehouse stock, stock transfers/adjustments, automatic Input VAT `ExpenseRecord` generation.
- `AccountingController` & `AccountingService`: Double-entry journal generation (`TotalDebit == TotalCredit`), manual JV validation, Trial Balance, P&L, Express/FlowAccount CSV & Excel export.
- `ExpensesController` & `ReportsController`: Expense `EXP-YYYYMM-XXXX` lifecycle, Input VAT / ภ.พ.30 net tax estimation, ภ.ง.ด.3 / ภ.ง.ด.53 Excel exports, and 50 ทวิ WHT certificates (`QuestPdfService`).
- `LineWebhookController` & `LineNotifyService`: Channel Secret HMAC-SHA256 webhook signature validation, tenant Messaging API replies/push fallback.
- `AuthController` / `JwtTokenService` / `SaTenantsController` / `SaPlansController`: token claims, role & permission enforcement, SuperAdmin security.
- `PaymentsController` / `TenantSubscriptionController` / `OmisePaymentService`: payment state, webhook integrity, idempotency.
- `ETaxXmlGenerator` / `ReportsController` / `QuestPdfService`: Thai tax compliance, e-Tax XML, Output/Input VAT Excel reports, PO PDF, 50 ทวิ PDF, A4 print/PDF accuracy.
