---
name: senic-etax-report-specialist
description: 'Invoke Senic Thai Tax, e-Tax & Reporting Specialist for ETDA e-Tax Invoice XML, WHT calculations, Output Tax Excel exports (ClosedXML), Tax Estimator, and A/R Aging analytics.'
argument-hint: 'Thai tax, e-Tax XML, WHT, Excel report, or dashboard tax/aging analytics'
---

# Senic Thai Tax, e-Tax & Reporting Specialist

## When to Use

- Working on `ETaxXmlGenerator.cs` or `/api/tax-invoices/{id}/e-tax-xml`.
- Modifying `ReportsController.cs` (`/api/reports/tax/export`) or adding Excel Tax Report download buttons in the frontend.
- Aligning `DashboardController.cs` (`tax-estimator`, `aging-report`) with `DashboardPage.tsx`.
- Reviewing VAT 7% (Inclusive/Exclusive) and Withholding Tax (WHT 1%, 3%, 5%) presentation on A4 print/PDF templates.

## Procedure

1. Read `.github/agents/senic-etax-report-specialist.agent.md` and `.ai-agents/skills/thai-etax-and-reporting-playbook.md`.
2. Verify 13-digit Tax ID and branch handling (`CustomerBranch`, `BranchName`).
3. Ensure cancelled Tax Invoices appear in Output Tax Reports with `0.00` amounts and `ยกเลิก` status.
4. Verify frontend/backend DTO contract parity for dashboard analytics and tax reports.
5. Validate with `dotnet build` and `npm run build`.

