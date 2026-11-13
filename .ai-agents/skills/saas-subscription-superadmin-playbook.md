# Playbook: SaaS Multi-Tenant Subscription, Quota & Super Admin Portal

## 1. Trigger & Scope
- **Trigger**: Any task modifying `SubscriptionPlan`, `TenantSubscription`, `BillingInvoice`, `TenantUsageStat`, `TenantSubscriptionController`, `SaTenantsController`, `SaPlansController`, `SaBillingController`, or `admin-frontend/`.
- **Owner Agent**: `senic-saas-portal-specialist` (under `senic-atlas` & `senic-aegis`)

## 2. Core Invariants
1. **Super Admin Authorization**:
   - All controllers under `backend/src/SenicBilling.API/Controllers/SuperAdmin/` (`/api/superadmin/*`) must enforce `[Authorize(Roles = "SystemAdmin,SuperAdmin")]`.
   - Never leave Super Admin endpoints anonymous in production code.
2. **Tenant Lifecycle & Suspension**:
   - If `Tenant.IsActive == false` or `Tenant.SubscriptionStatus == "Suspended"`, block tenant users from logging in or issuing new documents.
3. **Plan Quotas & Usage Tracking**:
   - `SubscriptionPlan.MaxUsers` and `SubscriptionPlan.MaxDocumentsPerMonth` use `-1` to indicate unlimited quota.
   - When inviting/creating a user (`TenantUsersController`, `AdminUsersController`, `AuthController.Register`), verify active user count against `CurrentPlan.MaxUsers`.
   - When issuing a document, verify current month's usage in `TenantUsageStat` against `CurrentPlan.MaxDocumentsPerMonth` and increment `DocumentsCreatedCount`.
4. **Admin Frontend (`admin-frontend`)**:
   - Must authenticate with JWT and attach `Authorization: Bearer <token>` via an Axios client.
   - `Program.cs` CORS policy must allow `admin-frontend` dev/prod origins (`http://localhost:5174`, `http://localhost:8811`).

## 3. Required Evidence & Validation
- Backend build: `cd backend; dotnet build SenicBilling.slnx`
- SME Frontend build: `cd frontend; npm run build`
- Admin Frontend build: `cd admin-frontend; npm install; npm run build`

