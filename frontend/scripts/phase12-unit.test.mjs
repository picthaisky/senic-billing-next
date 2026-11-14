import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..', '..');

const readProjectFile = (relPath) =>
  readFileSync(resolve(rootDir, relPath), 'utf8');

test('Frontend App.tsx uses React.lazy route code splitting and registers AuditLogsPage', () => {
  const app = readProjectFile('frontend/src/App.tsx');
  assert.match(app, /lazy\(\(\) => import\('\.\/components\/dashboard\/DashboardPage'\)\)/);
  assert.match(app, /lazy\(\(\) => import\('\.\/components\/users\/AuditLogsPage'\)\)/);
  assert.match(app, /<Suspense fallback={<PageLoadingFallback \/>}>/);
  assert.match(app, /path="audit-logs" element={<AuditLogsPage \/>}/);
});

test('InvoiceForm uses local timezone getLocalIsoDate instead of UTC toISOString', () => {
  const dateUtils = readProjectFile('frontend/src/utils/dateUtils.ts');
  const invoiceForm = readProjectFile('frontend/src/components/forms/InvoiceForm.tsx');
  assert.match(dateUtils, /export function getLocalIsoDate/);
  assert.match(invoiceForm, /getLocalIsoDate\(\)/);
  assert.doesNotMatch(invoiceForm, /new Date\(\)\.toISOString\(\)\.split\('T'\)\[0\]/);
});

test('Admin Frontend CSS @import ordering and Phase 12 Super Admin routes are configured cleanly', () => {
  const adminCss = readProjectFile('admin-frontend/src/index.css');
  const fontImportIndex = adminCss.indexOf('@import url(');
  const tailwindImportIndex = adminCss.indexOf('@import "tailwindcss";');
  assert.ok(fontImportIndex !== -1 && tailwindImportIndex !== -1);
  assert.ok(fontImportIndex < tailwindImportIndex, '@import url must precede @import "tailwindcss"');

  const adminApp = readProjectFile('admin-frontend/src/App.tsx');
  assert.match(adminApp, /path="\/invoices" element={<BillingInvoices \/>}/);
  assert.match(adminApp, /path="\/announcements" element={<AnnouncementsPage \/>}/);

  const tenantsList = readProjectFile('admin-frontend/src/pages/TenantsList.tsx');
  assert.match(tenantsList, /\/superadmin\/tenants\/\$\{tenant\.id\}\/impersonate/);
  assert.match(tenantsList, /documentsCreatedThisMonth/);
});

test('CI/CD quality-checks runs unit tests and Playwright E2E', () => {
  const ci = readProjectFile('.github/workflows/ci-cd.yml');
  assert.match(ci, /npx playwright install chromium --with-deps/);
  assert.match(ci, /npm run test:e2e/);
});

