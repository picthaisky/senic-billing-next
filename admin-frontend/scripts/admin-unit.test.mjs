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

test('Senic Platform Admin custom favicon suite is present and wired in index.html', () => {
  const indexHtml = fs.readFileSync(path.join(adminRoot, 'index.html'), 'utf8');
  assert.match(indexHtml, /href="\/senic-admin-favicon\.svg"/);
  assert.match(indexHtml, /href="\/favicon-32x32\.png"/);
  assert.match(indexHtml, /href="\/favicon-16x16\.png"/);
  assert.match(indexHtml, /href="\/favicon\.ico"/);
  assert.match(indexHtml, /href="\/apple-touch-icon\.png"/);
  assert.match(indexHtml, /href="\/manifest\.json"/);

  const publicDir = path.join(adminRoot, 'public');
  for (const fileName of [
    'senic-admin-favicon.svg',
    'favicon.svg',
    'favicon.ico',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'apple-touch-icon.png',
    'icon-192.png',
    'icon-512.png',
    'manifest.json',
  ]) {
    const filePath = path.join(publicDir, fileName);
    assert.ok(fs.existsSync(filePath), `Expected favicon asset to exist: ${fileName}`);
    assert.ok(fs.statSync(filePath).size > 0, `Expected favicon asset to be non-empty: ${fileName}`);
  }

  const svgContent = fs.readFileSync(path.join(publicDir, 'senic-admin-favicon.svg'), 'utf8');
  assert.doesNotMatch(svgContent, /#863bff/, 'SVG favicon must not be the default Vite icon');
  assert.match(svgContent, /senic-admin-bg/);
  assert.match(svgContent, /#1d4ed8/);

  const legacySvgContent = fs.readFileSync(path.join(publicDir, 'favicon.svg'), 'utf8');
  assert.equal(legacySvgContent, svgContent);
});



test('Phase 22 Admin Portal supports PWA manifest/sw/offline assets and mobile drawer navigation', () => {
  const adminRootDir = path.resolve(import.meta.dirname, '..');
  const adminPublicDir = path.join(adminRootDir, 'public');
  const adminSrcDir = path.join(adminRootDir, 'src');

  for (const file of [
    'favicon.ico',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'senic-admin-favicon.svg',
    'apple-touch-icon.png',
    'icon-192.png',
    'icon-512.png',
    'icon-maskable-512.png',
    'manifest.json',
    'sw.js',
    'offline.html',
  ]) {
    const p = path.join(adminPublicDir, file);
    assert.ok(fs.existsSync(p), `Missing admin asset: ${file}`);
    assert.ok(fs.statSync(p).size > 0, `Empty admin asset: ${file}`);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(adminPublicDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));

  const indexHtml = fs.readFileSync(path.join(adminRootDir, 'index.html'), 'utf8');
  assert.match(indexHtml, /viewport-fit=cover/);
  assert.match(indexHtml, /apple-mobile-web-app-capable/);

  const mainSrc = fs.readFileSync(path.join(adminSrcDir, 'main.tsx'), 'utf8');
  assert.match(mainSrc, /serviceWorker\.register\('\/sw\.js'/);

  const nginxSrc = fs.readFileSync(path.join(adminRootDir, 'nginx.conf'), 'utf8');
  assert.match(nginxSrc, /location = \/sw\.js/);
  assert.match(nginxSrc, /no-cache, no-store, must-revalidate/);

  const sidebarSrc = fs.readFileSync(path.join(adminSrcDir, 'components', 'Sidebar.tsx'), 'utf8');
  assert.match(sidebarSrc, /-translate-x-full md:translate-x-0/);
  assert.match(sidebarSrc, /min-h-\[44px\]/);

  const appSrc = fs.readFileSync(path.join(adminSrcDir, 'App.tsx'), 'utf8');
  assert.match(appSrc, /md:hidden flex items-center justify-between/);
  assert.match(appSrc, /offlineBanner/);

  const localeSrc = fs.readFileSync(path.join(adminSrcDir, 'i18n', 'AdminLocaleContext.tsx'), 'utf8');
  assert.match(localeSrc, /openMenuAria/);
  assert.match(localeSrc, /closeMenuAria/);
  assert.match(localeSrc, /offlineBanner/);
});
