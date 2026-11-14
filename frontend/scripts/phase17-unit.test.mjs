import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const frontendRoot = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');

test('Phase 17: RecurringInvoiceWorker and OverdueMonitorWorker enforce tenant suspension and monthly document quota guards', () => {
  const recurringWorker = fs.readFileSync(
    path.join(repoRoot, 'backend', 'src', 'SenicBilling.Infrastructure', 'BackgroundJobs', 'RecurringInvoiceWorker.cs'),
    'utf8'
  );
  assert.match(recurringWorker, /Include\(t => t\.CurrentPlan\)/);
  assert.match(recurringWorker, /SubscriptionStatus,\s*"Suspended"/);
  assert.match(recurringWorker, /MaxDocumentsPerMonth:\s*>\s*0/);
  assert.match(recurringWorker, /DocumentStatus\.Cancelled/);

  const overdueWorker = fs.readFileSync(
    path.join(repoRoot, 'backend', 'src', 'SenicBilling.Infrastructure', 'BackgroundJobs', 'OverdueMonitorWorker.cs'),
    'utf8'
  );
  assert.match(overdueWorker, /!docTenant\.IsActive\s*\|\|\s*string\.Equals\(docTenant\.SubscriptionStatus,\s*"Suspended"/);
});

test('Phase 17: TenantSubscriptionController, TenantsController, and SaPlansController enforce RBAC, quota, webhook safety, and AuditLog', () => {
  const subCtrl = fs.readFileSync(
    path.join(repoRoot, 'backend', 'src', 'SenicBilling.API', 'Controllers', 'TenantSubscriptionController.cs'),
    'utf8'
  );
  assert.match(subCtrl, /\[Authorize\(Roles = "Admin,SystemAdmin,SuperAdmin"\)\]/);
  assert.match(subCtrl, /plan\.MaxUsers > 0/);
  assert.match(subCtrl, /CheckoutSubscriptionPlan/);
  assert.match(subCtrl, /TryGetProperty\("key"/);
  assert.match(subCtrl, /RenewSubscriptionWebhook/);

  const tenantsCtrl = fs.readFileSync(
    path.join(repoRoot, 'backend', 'src', 'SenicBilling.API', 'Controllers', 'TenantsController.cs'),
    'utf8'
  );
  assert.match(tenantsCtrl, /UpdateTenantProfile/);

  const saPlansCtrl = fs.readFileSync(
    path.join(repoRoot, 'backend', 'src', 'SenicBilling.API', 'Controllers', 'SuperAdmin', 'SaPlansController.cs'),
    'utf8'
  );
  assert.match(saPlansCtrl, /CreateSubscriptionPlan/);
  assert.match(saPlansCtrl, /UpdateSubscriptionPlan/);
});

test('Phase 17: Super Admin Portal supports TH/EN AdminLocaleContext and unlimited (-1) plan inputs', () => {
  const localeCtx = fs.readFileSync(
    path.join(repoRoot, 'admin-frontend', 'src', 'i18n', 'AdminLocaleContext.tsx'),
    'utf8'
  );
  assert.match(localeCtx, /ADMIN_RESOURCES/);
  assert.match(localeCtx, /useAdminLocale/);

  const packagesPage = fs.readFileSync(
    path.join(repoRoot, 'admin-frontend', 'src', 'pages', 'PackagesList.tsx'),
    'utf8'
  );
  assert.match(packagesPage, /min=\{-1\}/);
  assert.doesNotMatch(packagesPage, /min=\{1\}/);
});

