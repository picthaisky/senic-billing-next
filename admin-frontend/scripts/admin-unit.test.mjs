import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const adminRoot = path.resolve(import.meta.dirname, '..');
const adminSrc = path.join(adminRoot, 'src');

test('Admin apiClient and App isolate sa_token from SME senic_token and verify /auth/me', () => {
  const apiClientSource = fs.readFileSync(path.join(adminSrc, 'services', 'apiClient.ts'), 'utf8');
  assert.match(apiClientSource, /sa_token/);
  assert.doesNotMatch(apiClientSource, /senic_token/);

  const appSource = fs.readFileSync(path.join(adminSrc, 'App.tsx'), 'utf8');
  assert.doesNotMatch(appSource, /senic_token/);
  assert.match(appSource, /\/auth\/me/);
  assert.match(appSource, /isPlatformAdmin/);
});

test('BillingInvoices supports manual mark-paid flow and TenantsList uses fragment impersonation URL', () => {
  const billingSource = fs.readFileSync(path.join(adminSrc, 'pages', 'BillingInvoices.tsx'), 'utf8');
  assert.match(billingSource, /\/superadmin\/billing\/invoices\/\$\{row\.id\}\/mark-paid/);
  assert.match(billingSource, /ยืนยันชำระเงิน/);

  const tenantsSource = fs.readFileSync(path.join(adminSrc, 'pages', 'TenantsList.tsx'), 'utf8');
  assert.match(tenantsSource, /\/superadmin\/tenants\/\$\{tenant\.id\}\/impersonate/);
  assert.match(tenantsSource, /\/login#impersonate=/);
  assert.match(tenantsSource, /res\.data\?\.data\?\.frontendUrl/);
});

test('Phase 15 SaTenantsController populates dynamic FrontendUrl from App:FrontendBaseUrl for impersonation', () => {
  const repoRoot = path.resolve(adminRoot, '..');
  const dtoSource = fs.readFileSync(
    path.join(repoRoot, 'backend', 'src', 'SenicBilling.Application', 'DTOs', 'Phase12Dtos.cs'),
    'utf8'
  );
  assert.match(dtoSource, /TenantImpersonationResultDto/);
  assert.match(dtoSource, /FrontendUrl/);

  const saTenantsSource = fs.readFileSync(
    path.join(repoRoot, 'backend', 'src', 'SenicBilling.API', 'Controllers', 'SuperAdmin', 'SaTenantsController.cs'),
    'utf8'
  );
  assert.match(saTenantsSource, /App:FrontendBaseUrl/);
  assert.match(saTenantsSource, /FrontendUrl/);
});

test('Phase 17 Super Admin Portal provides TH/EN AdminLocaleContext across all pages and allows -1 unlimited quotas', () => {
  const localeCtxSource = fs.readFileSync(path.join(adminSrc, 'i18n', 'AdminLocaleContext.tsx'), 'utf8');
  assert.match(localeCtxSource, /sa_locale/);
  assert.match(localeCtxSource, /ADMIN_RESOURCES/);

  for (const relPath of [
    'App.tsx',
    'components/Sidebar.tsx',
    'pages/Dashboard.tsx',
    'pages/TenantsList.tsx',
    'pages/PackagesList.tsx',
    'pages/BillingInvoices.tsx',
    'pages/AnnouncementsPage.tsx',
  ]) {
    const src = fs.readFileSync(path.join(adminSrc, relPath), 'utf8');
    assert.match(src, /useAdminLocale/, `Expected ${relPath} to use useAdminLocale()`);
  }

  const packagesSource = fs.readFileSync(path.join(adminSrc, 'pages', 'PackagesList.tsx'), 'utf8');
  assert.match(packagesSource, /min=\{-1\}/);
  assert.doesNotMatch(packagesSource, /min=\{1\}/);
});

test('Phase 21 TenantsList supports Super Admin Create Tenant modal and bilingual TH/EN keys', () => {
  const tenantsSource = fs.readFileSync(path.join(adminSrc, 'pages', 'TenantsList.tsx'), 'utf8');
  assert.match(tenantsSource, /saApiClient\.post\('\/superadmin\/tenants'/);
  assert.match(tenantsSource, /t\.tenants\.createBtn/);
  assert.match(tenantsSource, /t\.tenants\.createModalTitle/);

  const localeCtxSource = fs.readFileSync(path.join(adminSrc, 'i18n', 'AdminLocaleContext.tsx'), 'utf8');
  assert.match(localeCtxSource, /createModalTitle/);
  assert.match(localeCtxSource, /adminUsernameLabel/);
});


