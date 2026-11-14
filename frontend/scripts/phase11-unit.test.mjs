import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');

const readRel = (relPath) => fs.readFileSync(path.join(repoRoot, relPath), 'utf8');

test('Phase 11 navigation routes and menu links are registered cleanly', () => {
  const app = readRel('frontend/src/App.tsx');
  const sidebar = readRel('frontend/src/components/layout/Sidebar.tsx');
  const bottomNav = readRel('frontend/src/components/layout/BottomNav.tsx');

  assert.match(app, /BankReconciliationPage/);
  assert.match(app, /path="bank-reconciliation"/);
  assert.match(sidebar, /\/bank-reconciliation/);
  assert.match(bottomNav, /\/bank-reconciliation/);
});

test('BankReconciliationPage integrates all Phase 11 reconciliation endpoints', () => {
  const page = readRel('frontend/src/components/accounting/BankReconciliationPage.tsx');
  const requiredPaths = [
    '/bank-reconciliation/transactions',
    '/bank-reconciliation/candidates',
    '/bank-reconciliation/import',
    '/bank-reconciliation/auto-reconcile',
    '/match',
    '/ignore',
  ];

  for (const endpoint of requiredPaths) {
    assert.ok(page.includes(endpoint), `Missing endpoint usage: ${endpoint}`);
  }
});

test('AccountingPage integrates Balance Sheet, Cash Flow, Sales Margin, Period Lock, and Excel export', () => {
  const acc = readRel('frontend/src/components/accounting/AccountingPage.tsx');
  const requiredPaths = [
    '/accounting/balance-sheet',
    '/accounting/cash-flow',
    '/accounting/sales-margin',
    '/accounting/periods',
    '/accounting/periods/lock',
    '/accounting/periods/unlock',
    '/accounting/export/financial-statements-excel',
  ];

  for (const endpoint of requiredPaths) {
    assert.ok(acc.includes(endpoint), `Missing accounting endpoint: ${endpoint}`);
  }
});

test('Document Approval, 1-click Payment Reminder, CostPrice, and Admin Tenant Backup UI are wired', () => {
  const printView = readRel('frontend/src/pages/DocumentPrintView.tsx');
  const docsList = readRel('frontend/src/components/documents/DocumentsListPage.tsx');
  const products = readRel('frontend/src/components/products/ProductsPage.tsx');
  const backupCard = readRel('frontend/src/components/settings/TenantBackupCard.tsx');
  const settings = readRel('frontend/src/components/settings/SettingsPage.tsx');

  assert.match(printView, /\/public\/approve/);
  assert.match(printView, /\/public\/reject/);
  assert.match(printView, /customerApprovalStatus/);

  assert.match(docsList, /\/send-reminder/);
  assert.match(docsList, /customerApprovalStatus/);

  assert.match(products, /costPrice/);
  assert.match(backupCard, /\/tenants\/backup\/export/);
  assert.match(backupCard, /Admin/);
  assert.match(settings, /TenantBackupCard/);
});

test('DevOps Docker healthchecks and CI/CD test gates are configured', () => {
  const compose = readRel('docker-compose.yml');
  const workflow = readRel('.github/workflows/ci-cd.yml');
  const backendDocker = readRel('backend/Dockerfile');

  assert.match(compose, /pg_isready/);
  assert.match(compose, /http:\/\/localhost:8080\/health/);
  assert.match(compose, /service_healthy/);
  assert.match(backendDocker, /curl/);

  assert.match(workflow, /quality-checks:/);
  assert.match(workflow, /dotnet test/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm run build/);
  assert.match(workflow, /needs:\s*quality-checks/);
});

