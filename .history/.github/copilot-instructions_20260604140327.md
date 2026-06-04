# Senic Billing Next Copilot Instructions

## Project Context

Senic Billing Next is a Thai-first SaaS billing and financial-document platform for Thai SME businesses. It supports tax invoices, receipts, cash bills, delivery notes, dashboard analytics, customer/product master data, online payment, PDF/print output, and real-time system status.

Use `.ai-agents/README.md` as the Multi AI Agents operating model and `.ai-agents/knowledge/` as the living project knowledge base.

## Architecture

- Backend follows Clean Architecture under `backend/src/`: `SenicBilling.Domain`, `SenicBilling.Application`, `SenicBilling.Infrastructure`, `SenicBilling.API`.
- Frontend is React 19 + TypeScript + Vite under `frontend/src/` with `components`, `hooks`, `services`, `store`, `pages`, and shared CSS theme files.
- Database is PostgreSQL via EF Core. Financial fields must preserve backend `decimal(18,4)` precision.
- State management uses Zustand. API access goes through `frontend/src/services/apiClient.ts` unless a feature has an established local service wrapper.
- Real-time communication uses SignalR through `backend/src/SenicBilling.API/Hubs/SenicBillingHub.cs` and `frontend/src/services/signalrClient.ts`.

## Backend Rules

- Keep domain entities infrastructure-free. Put EF Core configuration in `SenicBilling.Infrastructure/Data/SenicBillingDbContext.cs`.
- Keep interfaces and DTO contracts in application/domain layers according to existing patterns; implementations belong in infrastructure or API as appropriate.
- Every tenant-owned query, command, and DTO mapping must preserve `TenantId` isolation.
- Do not weaken document-number generation. Preserve uniqueness per tenant, document type, and year-month.
- Never hardcode production secrets. Development fallbacks must be clearly marked and not promoted to production guidance.
- Validate backend changes with `cd backend; dotnet build SenicBilling.slnx` when feasible.

## Frontend Rules

- UI copy is Thai-first. English is acceptable for code, document prefixes, and internal identifiers.
- Preserve the dual theme system: `Warm Horizon` and `Deep Ocean`. Use existing CSS variables and tokens before adding new colors.
- Use Lucide React icons. Do not use emoji in app UI.
- Preserve desktop sidebar, mobile bottom navigation, floating action button, pull-to-refresh, and responsive table/card behavior where relevant.
- Keep financial calculations explicit and aligned with backend VAT and decimal behavior.
- Validate frontend changes with `cd frontend; npm run build` or `cd frontend; npm run lint` when feasible.

## Multi Agent Workflow

- For complex work, route through `senic-maestro` first.
- For billing, VAT, document lifecycle, payment, or numbering changes, consult `senic-ledger`.
- For tenant isolation, auth, uploads, webhooks, or secrets, consult `senic-aegis`.
- For UI/UX, theme, mobile, and Thai copy changes, consult `senic-milo` before finalizing.
- After validated changes, update `.ai-agents/knowledge/` when a reusable pattern, decision, bug lesson, or risk is discovered.

## Validation Discipline

- Prefer narrow validation immediately after the first meaningful edit.
- Do not fix unrelated failures unless the user asks or the failure blocks the requested task.
- Mention any validation that could not be run and why.