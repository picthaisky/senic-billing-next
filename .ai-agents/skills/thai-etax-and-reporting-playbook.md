# Playbook: Thai Tax Compliance, e-Tax XML & Financial Reporting

## 1. Trigger & Scope
- **Trigger**: Any task touching `ETaxXmlGenerator.cs`, `TaxInvoiceController.cs`, `ReportsController.cs`, `DashboardController.cs` (`tax-estimator`, `aging-report`), `DashboardPage.tsx`, or WHT/VAT calculations.
- **Owner Agent**: `senic-etax-report-specialist` (under `senic-ledger`)

## 2. Core Invariants
1. **Thai Revenue Department Tax Invoice Rules**:
   - `CustomerTaxId` must be a 13-digit numeric string for `TaxInvoice`.
   - Branch designation (`CustomerBranch` and `Tenant.BranchName`) defaults to `"สำนักงานใหญ่"` when unspecified.
2. **VAT 7% & WHT Formulas**:
   - `Exclusive`: `VatAmount = Round(TotalBeforeVat * VatRate / 100m, 2)`, `GrandTotal = TotalBeforeVat + VatAmount`.
   - `Inclusive`: `GrandTotal = Subtotal - DiscountAmount`, `VatAmount = Round(GrandTotal * VatRate / (100m + VatRate), 2)`, `TotalBeforeVat = GrandTotal - VatAmount`.
   - `WhtAmount = WhtRate > 0 ? Round(TotalBeforeVat * WhtRate / 100m, 2) : 0m` (common rates: 1% transport, 3% service, 5% rent).
3. **Output Tax Excel Report (`ReportsController.cs`)**:
   - Endpoint: `GET /api/reports/tax/export?year={year}&month={month}`.
   - Must list all `TaxInvoice` documents in chronological/number order for the given month.
   - Cancelled documents (`DocumentStatus.Cancelled`) must be included with `0.00` amounts and `"ยกเลิก"` in the remark column so there are no gaps in running numbers.
4. **ETDA e-Tax Invoice XML (`ETaxXmlGenerator.cs`)**:
   - Endpoint: `GET /api/tax-invoices/{id}/e-tax-xml`.
   - Only allowed for `DocumentStatus.Issued` or `DocumentStatus.Paid`.
5. **Dashboard Analytics Contract Parity**:
   - `GET /api/dashboard/tax-estimator`: Default `year` and `month` to current UTC year/month when omitted (`int? year = null, int? month = null`), and align DTO fields with `DashboardPage.tsx`.
   - `GET /api/dashboard/aging-report`: Ensure `DashboardPage.tsx` and `DashboardController.cs` share a consistent summary/detail structure (`current`, `overdue1_30`, `overdue31_60`, `overdue61_90`, `overdue90Plus`, `totalOverdue`).

## 3. Required Evidence & Validation
- Backend build: `cd backend; dotnet build SenicBilling.slnx`
- Frontend build: `cd frontend; npm run build`
- Numeric test vectors for VAT Inclusive/Exclusive, WHT 3%, and Cancelled Invoice Excel export.

