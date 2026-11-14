# Domain Rules

Last reviewed: 2026-11-13

## Financial Documents

- Primary commercial documents: `Quotation` (`QUO`), `TaxInvoice` (`INV`), `Receipt` (`RCP`), `CashBill` (`CSB`), `DeliveryNote` (`DLV`), plus `CreditNote` (`CN`) and `DebitNote` (`DN`).
- Document number format is `{PREFIX}-{YYYYMM}-{NNNN}` and must be unique and sequential per tenant, document type, and month.
- Document history must preserve issued financial records via `AuditLog`; cancellation requires an explicit reason (`CancellationReason`).
- Cancelled Tax Invoices must still appear in monthly Output Tax Excel reports with `0.00` value and `"ยกเลิก"` remark.

## Inventory, Multi-Warehouse & Barcode POS

- `Product.StockQuantity` is `decimal?(18,4)`: `null` means a non-stock/service item (never deduct/restock or track per-warehouse); non-null tracks inventory and syncs with the sum of `ProductWarehouseStock.Quantity` across tenant warehouses via `IInventoryService`.
- `Sku` and `Barcode` are separate fields on `Product`; search and barcode scanning match against both.
- Stock deduction applies to `CashBill`, `DeliveryNote`, and `TaxInvoice` (unless converted from a `DeliveryNote` that already deducted stock), recording `SaleOut` / `SaleRestock` in `StockMovement` with document number reference.
- Updating or cancelling a stock-deducting document must restore/reconcile both `ProductWarehouseStock` and `Product.StockQuantity`.
- Receiving a Purchase Order (`PurchaseOrdersController.Receive`) supports partial/full line receiving into multi-warehouse stock (`PurchaseIn`) and optionally auto-creates a linked `ExpenseRecord` with Input VAT plus vendor `DefaultWhtRate` / `DefaultPndType` withholding tax.
- Warehouse stock transfers (`InventoryService.TransferStockAsync`) validate source quantity and emit paired `TransferOut` and `TransferIn` movements; warehouses also support `PUT /api/warehouses/{id}` updates.

## VAT, WHT, Expenses, e-Tax, and Auto-Accounting

- Thai VAT default rate is 7%. Withholding Tax (WHT) supports 0%, 1%, 3%, and 5% applied against `TotalBeforeVat`.
- Backend monetary storage uses `decimal(18,4)`.
- Frontend display uses Thai locale formatting (`th-TH`) with 2 decimal places (`tabular-nums`).
- VAT may be `Exclusive` or `Inclusive`; frontend (`useDocumentForm.ts`) and backend (`CalculateTotals`) formulas must match.
- e-Tax Invoice XML (`ETaxXmlGenerator`) follows ETDA UN/CEFACT structure and can only be generated for issued/paid Tax Invoices.
- Expenses (`ExpenseRecord`, `EXP-YYYYMM-XXXX`) distinguish eligible Input VAT (`IsVatClaimable`) from Output VAT in the monthly ภ.พ.30 estimator (`DashboardController.GetTaxEstimator`) and Input Tax Excel export (`ReportsController`), while WHT expenses classify ภ.ง.ด.3 (บุคคลธรรมดา) vs ภ.ง.ด.53 (นิติบุคคล) and generate 50 ทวิ PDFs (`QuestPdfService`).
- Auto-Accounting (`IAccountingService`) ensures a default Thai SME Chart of Accounts (`1110`–`5290`) and creates balanced double-entry `JournalEntry` (`JV-YYYYMM-XXXX`, `TotalDebit == TotalCredit`) on sales, credit notes (reversing revenue/VAT via `Dr. 4100 + Dr. 2130 / Cr. 1130`), receipts/payments, and approved expenses; `SourceType` + `SourceId` prevent duplicate auto-postings.
- Cancelling a financial document (`TaxInvoiceController.Cancel`, `DocumentControllerBase.Cancel`) or an expense (`ExpensesController.Cancel`) automatically generates balanced `JournalSourceType.Reversal` journal entries, and updating an approved/paid expense reverses prior entries and re-posts updated amounts.

## Tenant Isolation & SaaS Quotas

- Tenant-owned data must include and enforce `TenantId`.
- Users must not read, update, delete, export, print, or pay documents from another tenant.
- Suspended tenants (`IsActive == false` or `SubscriptionStatus == "Suspended"`) must be blocked from active operations, including background recurring document generation (`RecurringInvoiceWorker`) and overdue reminder dispatches (`OverdueMonitorWorker`).
- SaaS plans (`SubscriptionPlan`) define `MaxUsers` and `MaxDocumentsPerMonth` (`-1` = unlimited), tracked via `TenantUsageStat` and enforced across document creation, `RecurringInvoiceWorker`, user creation/reactivation, and subscription plan checkout downgrades (`TenantSubscriptionController.Checkout`).
- SuperAdmin endpoints (`/api/superadmin/*`) must require `SystemAdmin` / `SuperAdmin` (`PlatformAdmin` policy) role authorization, while tenant-level profile/settings/subscription mutations (`TenantsController.UpdateProfile`, `TestLineNotify`, `TenantSubscriptionController.Checkout`) require `Admin,SystemAdmin,SuperAdmin` and record `AuditLog` entries.

## Payment & Notifications

- Online payment is modeled through `PaymentTransaction` (PromptPay QR, Payment Link, SaaS Card Checkout via Omise).
- Webhook handling must be idempotent; database state is authoritative.
- Outbound notifications (SignalR `Tenant_{tenantId}`, LINE Messaging API / LINE Notify, Web Push, SMTP Email) must be tenant-scoped and non-blocking.
- `LineWebhookController` verifies `x-line-signature` HMAC-SHA256 using the tenant's configured Channel Secret before replying with summary inquiries (`สรุปยอดวันนี้` / `ใบแจ้งหนี้ค้างชำระ`).

## UX and Language

- UI is Thai-first with instant Thai/English (`i18next`) switching where supported.
- App UI uses Lucide icons instead of emoji.
- Preserve the `Warm Horizon` and `Deep Ocean` dual themes and responsive mobile-first layout (`BottomNav`, `FAB`).
