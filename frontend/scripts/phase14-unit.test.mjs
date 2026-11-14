import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const frontendSrc = path.join(repoRoot, 'frontend', 'src');
const backendSrc = path.join(repoRoot, 'backend', 'src');

function loadResources() {
  const filePath = path.join(frontendSrc, 'i18n', 'resources.ts');
  const source = fs.readFileSync(filePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const mod = { exports: {} };
  vm.runInNewContext(transpiled, { exports: mod.exports, module: mod });
  return mod.exports.resources;
}

function collectLeafEntries(obj, prefix = '') {
  const entries = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') {
      entries.push(...collectLeafEntries(v, full));
    } else {
      entries.push([full, v]);
    }
  }
  return entries.sort(([a], [b]) => a.localeCompare(b));
}

test('Phase 14 inner-page TH/EN i18n keys have full parity and non-empty values', () => {
  const resources = loadResources();
  const thEntries = collectLeafEntries(resources.th.translation);
  const enEntries = collectLeafEntries(resources.en.translation);

  assert.deepEqual(
    enEntries.map(([k]) => k),
    thEntries.map(([k]) => k)
  );

  for (const [key, value] of [...thEntries, ...enEntries]) {
    assert.equal(typeof value, 'string', `Expected string value for key ${key}`);
    assert.ok(value.trim().length > 0, `Empty translation string for key ${key}`);
  }

  const requiredInnerKeys = [
    'auth.submit',
    'auth.username',
    'status.healthy',
    'status.monitorTitle',
    'aiChat.welcome',
    'aiChat.placeholder',
    'dashboard.title',
    'dashboard.taxEstimatorTitle',
    'dashboard.topSpendersTitle',
    'documentsList.pageTitle',
    'documentsList.statusPaid',
    'customers.title',
    'customers.addBtn',
    'products.title',
    'products.addBtn',
    'profile.verifiedBadge',
    'profile.securityTitle',
    'settings.pageTitle',
    'settings.pushTitle',
  ];

  const thKeySet = new Set(thEntries.map(([k]) => k));
  for (const key of requiredInnerKeys) {
    assert.ok(thKeySet.has(key), `Missing inner-page key: ${key}`);
  }
});

test('Core SME frontend screens use useTranslation()', () => {
  const targets = [
    path.join(frontendSrc, 'components', 'auth', 'LoginPage.tsx'),
    path.join(frontendSrc, 'components', 'layout', 'SystemStatusBadge.tsx'),
    path.join(frontendSrc, 'components', 'layout', 'FloatingAIChat.tsx'),
    path.join(frontendSrc, 'components', 'dashboard', 'DashboardPage.tsx'),
    path.join(frontendSrc, 'components', 'documents', 'DocumentsListPage.tsx'),
    path.join(frontendSrc, 'components', 'customers', 'CustomersPage.tsx'),
    path.join(frontendSrc, 'components', 'products', 'ProductsPage.tsx'),
    path.join(frontendSrc, 'components', 'profile', 'ProfilePage.tsx'),
    path.join(frontendSrc, 'components', 'settings', 'SettingsPage.tsx'),
  ];

  for (const filePath of targets) {
    const src = fs.readFileSync(filePath, 'utf8');
    assert.match(src, /useTranslation/, `${path.basename(filePath)} should hook useTranslation()`);
  }
});

test('Backend production hardening removes hardcoded localhost fallback URLs & fixes PDF/Worker/e-Tax paths', () => {
  const sharedDocCtrl = fs.readFileSync(
    path.join(backendSrc, 'SenicBilling.API', 'Controllers', 'SharedDocumentController.cs'),
    'utf8'
  );
  assert.match(sharedDocCtrl, /\.Include\(d => d\.Tenant\)/);
  assert.match(sharedDocCtrl, /App:FrontendBaseUrl/);

  const overdueWorker = fs.readFileSync(
    path.join(backendSrc, 'SenicBilling.Infrastructure', 'BackgroundJobs', 'OverdueMonitorWorker.cs'),
    'utf8'
  );
  assert.match(overdueWorker, /public async Task<int> RunOverdueCheckAsync/);
  assert.match(overdueWorker, /App:FrontendBaseUrl/);

  const recurringWorker = fs.readFileSync(
    path.join(backendSrc, 'SenicBilling.Infrastructure', 'BackgroundJobs', 'RecurringInvoiceWorker.cs'),
    'utf8'
  );
  assert.match(recurringWorker, /public async Task<int> ProcessDueRecurringInvoicesAsync/);

  const omiseService = fs.readFileSync(
    path.join(backendSrc, 'SenicBilling.Infrastructure', 'Services', 'OmisePaymentService.cs'),
    'utf8'
  );
  assert.match(omiseService, /App:FrontendBaseUrl/);

  const questPdf = fs.readFileSync(
    path.join(backendSrc, 'SenicBilling.Infrastructure', 'Services', 'QuestPdfService.cs'),
    'utf8'
  );
  assert.match(questPdf, /DocumentType\.CreditNote => "ใบลดหนี้"/);
  assert.match(questPdf, /DocumentType\.DebitNote => "ใบเพิ่มหนี้"/);
  assert.match(questPdf, /TryLoadTenantLogoBytes/);

  const etax = fs.readFileSync(
    path.join(backendSrc, 'SenicBilling.Application', 'Services', 'ETaxXmlGenerator.cs'),
    'utf8'
  );
  assert.match(etax, /DocumentType\.CreditNote => \("381"/);
  assert.match(etax, /DocumentType\.DebitNote => \("383"/);
});

