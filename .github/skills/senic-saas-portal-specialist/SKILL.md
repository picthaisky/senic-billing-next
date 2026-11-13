---
name: senic-saas-portal-specialist
description: 'Invoke Senic SaaS Multi-Tenant & Super Admin Portal Specialist for SubscriptionPlan, TenantSubscription, quota enforcement, Omise SaaS checkout, and admin-frontend (Super Admin Portal).'
argument-hint: 'SaaS subscription, tenant quota, or Super Admin Portal task'
---

# Senic SaaS Multi-Tenant & Super Admin Portal Specialist

## When to Use

- Working on `SubscriptionPlan`, `TenantSubscription`, `BillingInvoice`, or `TenantUsageStat`.
- Securing or extending `SaTenantsController`, `SaPlansController`, `SaBillingController`, or `TenantSubscriptionController`.
- Enforcing plan quotas (`MaxUsers`, `MaxDocumentsPerMonth`) or tenant suspension (`SubscriptionStatus`).
- Building or fixing `admin-frontend` (Super Admin Portal) or SME Subscription Settings UI.

## Procedure

1. Read `.github/agents/senic-saas-portal-specialist.agent.md` and `.ai-agents/skills/saas-subscription-superadmin-playbook.md`.
2. Ensure all `/api/superadmin/*` endpoints require `SystemAdmin` / `SuperAdmin` role authorization.
3. Verify quota checks handle `-1` as unlimited and update `TenantUsageStat` atomically.
4. Validate `backend`, `frontend`, and `admin-frontend` builds.

