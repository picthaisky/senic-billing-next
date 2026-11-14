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

function listTsxFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listTsxFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}

test('Phase 15 TH/EN resources maintain 100% key parity across payment callback and enterprise modules', () => {
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

  const thKeySet = new Set(thEntries.map(([k]) => k));
  const requiredPaymentCallbackKeys = [
    'paymentCallback.loading',
    'paymentCallback.missingTitle',
    'paymentCallback.missingDesc',
    'paymentCallback.paidTitle',
    'paymentCallback.paidDesc',
    'paymentCallback.pendingTitle',
    'paymentCallback.pendingDesc',
    'paymentCallback.docNumber',
    'paymentCallback.amount',
    'paymentCallback.status',
    'paymentCallback.statusPaid',
    'paymentCallback.statusPending',
    'paymentCallback.refreshBtn',
    'paymentCallback.viewDocBtn',
    'paymentCallback.dashboardBtn',
  ];

  for (const key of requiredPaymentCallbackKeys) {
    assert.ok(thKeySet.has(key), `Missing paymentCallback translation key: ${key}`);
  }

  const requiredNamespaces = [
    'invoiceForm',
    'a4Template',
    'attachmentUpload',
    'customerSelect',
    'printView',
    'shareModal',
    'historyModal',
    'paymentModal',
    'paymentCallback',
    'backup',
    'usersPage',
    'recurring',
    'warehouses',
    'auditLogs',
    'expenses',
    'purchasing',
    'bankReconciliation',
    'accounting',
  ];

  for (const ns of requiredNamespaces) {
    assert.ok(
      resources.th.translation[ns] && typeof resources.th.translation[ns] === 'object',
      `Missing th.translation.${ns}`
    );
    assert.ok(
      resources.en.translation[ns] && typeof resources.en.translation[ns] === 'object',
      `Missing en.translation.${ns}`
    );
    assert.ok(
      collectLeafEntries(resources.th.translation[ns]).length > 0,
      `Namespace th.translation.${ns} should have translation entries`
    );
  }
});

test('100% of active TSX components/pages under frontend/src hook useTranslation() and dead StaffManagementPage is removed', () => {
  const deadFile = path.join(frontendSrc, 'pages', 'settings', 'StaffManagementPage.tsx');
  assert.equal(fs.existsSync(deadFile), false, 'Dead StaffManagementPage.tsx must remain removed');

  const callbackPage = path.join(frontendSrc, 'pages', 'PaymentCallbackPage.tsx');
  assert.equal(fs.existsSync(callbackPage), true, 'PaymentCallbackPage.tsx must exist');

  const appSource = fs.readFileSync(path.join(frontendSrc, 'App.tsx'), 'utf8');
  assert.match(appSource, /PaymentCallbackPage/);
  assert.match(appSource, /\/payments\/callback/);

  const tsxFiles = listTsxFiles(frontendSrc).filter((f) => path.basename(f) !== 'main.tsx');
  assert.ok(tsxFiles.length > 25, `Expected >25 active TSX files, found ${tsxFiles.length}`);

  const missingI18n = [];
  for (const filePath of tsxFiles) {
    const src = fs.readFileSync(filePath, 'utf8');
    if (!/\buseTranslation\b/.test(src)) {
      missingI18n.push(path.relative(repoRoot, filePath));
    }
  }

  assert.deepEqual(
    missingI18n,
    [],
    `Found TSX files without useTranslation(): ${missingI18n.join(', ')}`
  );
});

test('Phase 15 backend payment callback, MinIO logo fallback, upload magic-bytes & production infra parity are wired', () => {
  const paymentsCtrl = fs.readFileSync(
    path.join(backendSrc, 'SenicBilling.API', 'Controllers', 'PaymentsController.cs'),
    'utf8'
  );
  assert.match(paymentsCtrl, /callback-status/);
  assert.match(paymentsCtrl, /AllowAnonymous/);

  const questPdf = fs.readFileSync(
    path.join(backendSrc, 'SenicBilling.Infrastructure', 'Services', 'QuestPdfService.cs'),
    'utf8'
  );
  assert.match(questPdf, /senic-billing-logos/);
  assert.match(questPdf, /TryLoadTenantLogoBytes/);

  const tenantsCtrl = fs.readFileSync(
    path.join(backendSrc, 'SenicBilling.API', 'Controllers', 'TenantsController.cs'),
    'utf8'
  );
  assert.match(tenantsCtrl, /HasSupportedLogoHeader/);

  const compose = fs.readFileSync(path.join(repoRoot, 'docker-compose.yml'), 'utf8');
  assert.match(compose, /senic-app-data:\/app\/App_Data/);
  assert.match(compose, /Minio__BucketName/);
  assert.match(compose, /App__FrontendBaseUrl/);
  assert.match(compose, /App__AdminBaseUrl/);

  const stackEnv = fs.readFileSync(path.join(repoRoot, 'stack.env'), 'utf8');
  assert.match(stackEnv, /APP_FRONTEND_BASE_URL/);
  assert.match(stackEnv, /APP_ADMIN_BASE_URL/);

  for (const nginxRel of ['frontend/nginx.conf', 'admin-frontend/nginx.conf']) {
    const nginxCfg = fs.readFileSync(path.join(repoRoot, nginxRel), 'utf8');
    assert.match(nginxCfg, /client_max_body_size 15M/);
  }

  for (const appSettingsRel of [
    'backend/src/SenicBilling.API/appsettings.json',
    'backend/src/SenicBilling.API/appsettings.Production.json',
  ]) {
    const cfg = fs.readFileSync(path.join(repoRoot, appSettingsRel), 'utf8');
    assert.match(cfg, /"JwtSettings"/);
    assert.match(cfg, /"Omise"/);
    assert.match(cfg, /"Minio"/);
    assert.match(cfg, /"FrontendBaseUrl"/);
  }
});
