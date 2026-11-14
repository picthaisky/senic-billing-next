import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const frontendSrc = path.join(repoRoot, 'frontend', 'src');
const adminSrc = path.join(repoRoot, 'admin-frontend', 'src');

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

function collectLeafKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') {
      keys.push(...collectLeafKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys.sort();
}

test('i18n resources have full TH/EN parity and include all Phase 9-13 shell keys', () => {
  const resources = loadResources();
  const thKeys = collectLeafKeys(resources.th.translation);
  const enKeys = collectLeafKeys(resources.en.translation);

  assert.deepEqual(enKeys, thKeys);

  const requiredKeys = [
    'nav.creditnote',
    'nav.debitnote',
    'nav.expenses',
    'nav.purchaseOrders',
    'nav.accounting',
    'nav.bankReconciliation',
    'nav.warehouses',
    'nav.users',
    'nav.auditLogs',
    'header.notificationsTitle',
    'header.searchNoResults',
    'header.searchCategories.purchase_order',
    'pageTitles.accounting',
    'pageTitles.auditLogs',
    'sidebar.collapse',
    'fab.openMenu',
  ];

  for (const key of requiredKeys) {
    assert.ok(thKeys.includes(key), `Missing translation key: ${key}`);
  }
});

test('Header replaces hardcoded mock notifications with real API + SignalR + Global Search', () => {
  const headerSource = fs.readFileSync(path.join(frontendSrc, 'components', 'layout', 'Header.tsx'), 'utf8');
  assert.doesNotMatch(headerSource, /#RC-2024-0142/);
  assert.doesNotMatch(headerSource, /#TX-2024-0098/);
  assert.doesNotMatch(headerSource, /initialNotifications/);
  assert.match(headerSource, /\/notifications\/feed/);
  assert.match(headerSource, /\/search/);
  assert.match(headerSource, /senic:notification/);
});

test('App redirects legacy /staff route to /users cleanly', () => {
  const appSource = fs.readFileSync(path.join(frontendSrc, 'App.tsx'), 'utf8');
  assert.match(appSource, /<Route path="staff" element=\{<Navigate to="\/users" replace \/>\} \/>/);
  assert.doesNotMatch(appSource, /StaffManagementPage/);
});

test('Admin Portal verifies /auth/me without trusting tenant-portal senic_token', () => {
  const adminAppSource = fs.readFileSync(path.join(adminSrc, 'App.tsx'), 'utf8');
  assert.doesNotMatch(adminAppSource, /senic_token/);
  assert.match(adminAppSource, /\/auth\/me/);
  assert.match(adminAppSource, /isPlatformAdmin/);
});

