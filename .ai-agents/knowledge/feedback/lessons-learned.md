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

## 2026-11-13 - Phase 11 EF Core Navigation Cycles, React Compiler Memoization & Thai UTF-8 JSON Exports

- Type: bug-lesson
- Source: test
- Evidence: `AccountingController.cs`, `TenantsController.cs`, `AccountingPage.tsx`, `Phase11EnterpriseTests.cs`
- Confidence: high
- Lesson: Query downward from parent (`JournalEntries.AsNoTracking().Include(j => j.Lines).ThenInclude(l => l.Account)`) instead of bouncing child -> parent -> children (which throws EF Core cycle exceptions under `AsNoTracking`), set `JavaScriptEncoder.UnsafeRelaxedJsonEscaping` when exporting UTF-8 Thai JSON datasets into `.zip` backups, and avoid manual `useCallback` wrappers that trigger `react-hooks/preserve-manual-memoization` in React 19 Compiler ESLint.
- Follow-up: Always run all suites (`dotnet test`, `npm run lint`, `npm run build`, `npm test`) after touching EF includes or React state loaders.

## 2026-11-14 - Phase 12 Bundle Splitting, Local Date Safety, Impersonation Fragment Auth & Playwright E2E

- Type: bug-lesson
- Source: test
- Evidence: `frontend/src/App.tsx`, `frontend/src/utils/dateUtils.ts`, `frontend/src/components/auth/LoginPage.tsx`, `admin-frontend/src/index.css`, `backend/src/SenicBilling.API/Controllers/AuthController.cs`, `frontend/e2e/senic-e2e.spec.ts`
- Confidence: high
- Lesson: Use local timezone `getLocalIsoDate()` instead of `toISOString().split('T')[0]` for Thai date defaults (preventing -1 day shifts before 07:00 UTC+7), keep external `@import url(...)` before `@import "tailwindcss";` to avoid CSS minifier warnings, deliver Super Admin impersonation tokens via URL fragment `#impersonate=` verified against `GET /api/auth/me`, and enforce tenant suspension checks on `AuthController.Login` directly.
- Follow-up: Run `npm run test:e2e` alongside `dotnet test` and `npm test` after every release-level change.

## 2026-11-14 - Phase 13 Privilege Boundaries, JWT Claim Sync, React 19 Effect State & DemoTenant Isolation

- Type: bug-lesson
- Source: test
- Evidence: `ClaimsPrincipalExtensions.cs`, `JwtTokenService.cs`, `AuthController.cs`, `AttachmentsController.cs`, `Header.tsx`, `admin-frontend/src/App.tsx`, `Phase13SecuritySearchAndOperationsTests.cs`
- Confidence: high
- Lesson: Always pair `[Authorize(Policy = "PlatformAdmin")]` with explicit platform-owner/SuperAdmin role checks instead of generic `"Admin"` roles that match every customer tenant's admin; scope `DemoLogin` strictly to `PlatformOwnerTenantId` so a suspended demo tenant can never fall back to another customer tenant's admin account; emit both `"sub"`/`"id"` and `"unique_name"`/`"username"` claims and resolve via `ClaimsPrincipalExtensions`; keep async fetches inside React `useEffect` promise callbacks rather than calling synchronous `setState` in the effect body to satisfy React 19 Compiler `react-hooks/set-state-in-effect`.
- Follow-up: Validate cross-tenant negative test cases (IDOR on attachments, search, notifications feed, and `DemoLogin`) whenever adding tenant-facing endpoints.

## 2026-11-14 - Phase 14 Public PDF Tenant Include, Logo Embedding, Inner-Page i18n & Admin E2E

- Type: hardening-lesson
- Source: test
- Evidence: `SharedDocumentController.cs`, `QuestPdfService.cs`, `ETaxXmlGenerator.cs`, `OverdueMonitorWorker.cs`, `RecurringInvoiceWorker.cs`, `OmisePaymentService.cs`, `admin-frontend/src/services/apiClient.ts`, `Phase14ProductionHardeningTests.cs`
- Confidence: high
- Lesson: Always `.Include(d => d.Tenant)` on public document PDF endpoints and guard `Tenant`/`Buyer` properties inside PDF and ETDA e-Tax XML generators; verify image headers (PNG/JPEG/WEBP) when embedding tenant logo bytes into QuestPDF; avoid hardcoded `http://localhost:5173` links in emails, LINE reminders, workers, and Omise return URIs by injecting `App:FrontendBaseUrl`; isolate `saApiClient` strictly to `sa_token` without falling back to `senic_token`; and extract testable `RunOverdueCheckAsync` / `ProcessDueRecurringInvoicesAsync` entrypoints on `BackgroundService` workers so background jobs are unit-tested cleanly.
- Follow-up: Keep `frontend/src/i18n/resources.ts` `th` and `en` key parity enforced in `phase14-unit.test.mjs`, and verify both `frontend` and `admin-frontend` Playwright E2E suites cleanly in CI.

## 2026-11-14 - Phase 15 App-Wide Bilingual Parity, Omise Callback, Storage PDF Logo & Prod Infra Parity

- Type: hardening-lesson
- Source: test
- Evidence: `PaymentsController.cs`, `PaymentCallbackPage.tsx`, `QuestPdfService.cs`, `TenantsController.cs`, `SaTenantsController.cs`, `TenantsList.tsx`, `appsettings.json`, `appsettings.Production.json`, `docker-compose.yml`, `Phase15ProductionAndPaymentTests.cs`, `phase15-unit.test.mjs`
- Confidence: high
- Lesson: Always keep local filesystem assets (`App_Data/logos`) backed by object-storage fallback (`IStorageService` MinIO bucket `senic-billing-logos`) and persist `/app/App_Data` via named Docker volumes (`senic-app-data:/app/App_Data`), validate magic-byte headers (`HasSupportedLogoHeader`) alongside filename extensions on upload, expose explicit public payment callback routes (`/api/payments/callback-status` + `/payments/callback`), populate environment-configured `FrontendUrl` from `App:FrontendBaseUrl` for cross-portal impersonation, align `JwtSettings`/`Omise`/`Minio`/`App` schemas across base and Production appsettings, and use translation sentinel keys rather than putting `t` inside React 19 `useCallback`/`useEffect` dependency arrays.
- Follow-up: Enforce 100% active `.tsx` `useTranslation()` coverage and `th`/`en` resource key parity continuously via `phase15-unit.test.mjs`.

## 2026-11-14 - Phase 16 Deep Bilingual Completion, RBAC Privilege/Quota Hardening & Bundle Splitting

- Type: hardening-lesson
- Source: test
- Evidence: `AdminUsersController.cs`, `TenantUsersController.cs`, `AdminRolesController.cs`, `UserController.cs`, `Phase16SecurityRbacAndQuotaTests.cs`, `ProductsPage.tsx`, `CustomersPage.tsx`, `DashboardPage.tsx`, `DocumentsListPage.tsx`, `SettingsPage.tsx`, `ProfilePage.tsx`, `DashboardLayout.tsx`, `frontend/vite.config.ts`, `phase16-unit.test.mjs`
- Confidence: high
- Lesson: Always forbid non-`PlatformAdmin` callers from assigning or modifying reserved platform roles (`SuperAdmin`, `SystemAdmin`) across all tenant user/role endpoints; enforce `MaxUsers` plan quota not only on user creation/invitation but also when re-activating a disabled user (`!user.IsActive && request.IsActive`); scope `UserController` profile/password queries by both `u.Id == userId` and `u.TenantId == tenantId`; keep backend enum values (`'รอส่ง'`, `'กำลังจัดส่ง'`, `'ส่งสำเร็จแล้ว'`) intact on `<option value>` while translating display labels via `getDeliveryStatusLabel`; and split large vendor/i18n modules via `manualChunks` in `vite.config.ts` so every production JS chunk stays under 500 kB.
- Follow-up: Run `phase16-unit.test.mjs` and `Phase16SecurityRbacAndQuotaTests.cs` to prevent regressions in deep bilingual coverage, bundle chunk sizing, and RBAC/quota boundaries.

## 2026-11-14 - Phase 17 Worker Quota/Suspension Guards, Subscription Hardening & Super Admin Portal Bilingual Parity

- Type: hardening-lesson
- Source: test
- Evidence: `RecurringInvoiceWorker.cs`, `OverdueMonitorWorker.cs`, `TenantSubscriptionController.cs`, `TenantsController.cs`, `SaPlansController.cs`, `Phase17WorkerQuotaAndSubscriptionTests.cs`, `AdminLocaleContext.tsx`, `PackagesList.tsx`, `phase17-unit.test.mjs`, `admin-unit.test.mjs`, `admin-e2e.spec.ts`
- Confidence: high
- Lesson: Background workers (`RecurringInvoiceWorker`, `OverdueMonitorWorker`) must enforce the same tenant suspension (`!tenant.IsActive || tenant.SubscriptionStatus == "Suspended"`) and monthly document quota (`MaxDocumentsPerMonth > 0`) rules as interactive API controllers; `TenantSubscriptionController.Checkout` must verify `plan.IsActive`, check `activeUsers <= plan.MaxUsers` before allowing plan switches, and require `Admin,SystemAdmin,SuperAdmin`; webhook endpoints (`OmiseWebhook`) must always use `TryGetProperty` rather than `GetProperty` to avoid `KeyNotFoundException` on incomplete/ping payloads; and `PackagesList.tsx` number inputs for `maxUsers` and `maxDocumentsPerMonth` must use `min={-1}` so Super Admins can save `-1` (unlimited) plans.
- Follow-up: Keep `Phase17WorkerQuotaAndSubscriptionTests.cs`, `phase17-unit.test.mjs`, and `admin-unit.test.mjs` in the standard test suite.

