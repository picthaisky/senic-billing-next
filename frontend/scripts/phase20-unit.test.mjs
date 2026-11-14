import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const frontendSrc = path.join(repoRoot, 'frontend', 'src');

function transpileAndRun(tsFilePath) {
  const source = fs.readFileSync(tsFilePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;

  const mod = { exports: {} };
  vm.runInNewContext(transpiled, { exports: mod.exports, module: mod });
  return mod.exports;
}

function assertLocalizedNonEmpty(val, context) {
  assert.ok(val && typeof val === 'object', `${context} must be a LocalizedText object`);
  assert.ok(typeof val.th === 'string' && val.th.trim().length > 0, `${context}.th missing`);
  assert.ok(typeof val.en === 'string' && val.en.trim().length > 0, `${context}.en missing`);
}

test('Phase 20: Help route and navigation links are registered in App, Sidebar, BottomNav, Header, and DashboardLayout', () => {
  const appSource = fs.readFileSync(path.join(frontendSrc, 'App.tsx'), 'utf8');
  const sidebarSource = fs.readFileSync(path.join(frontendSrc, 'components', 'layout', 'Sidebar.tsx'), 'utf8');
  const bottomNavSource = fs.readFileSync(path.join(frontendSrc, 'components', 'layout', 'BottomNav.tsx'), 'utf8');
  const headerSource = fs.readFileSync(path.join(frontendSrc, 'components', 'layout', 'Header.tsx'), 'utf8');
  const layoutSource = fs.readFileSync(path.join(frontendSrc, 'components', 'layout', 'DashboardLayout.tsx'), 'utf8');

  assert.match(appSource, /lazy\(\(\)\s*=>\s*import\(['"]\.\/components\/help\/HelpPage['"]\)\)/);
  assert.match(appSource, /<Route path="help" element=\{<HelpPage \/>\} \/>/);

  assert.match(sidebarSource, /HelpCircle/);
  assert.match(sidebarSource, /path:\s*['"]\/help['"]/);
  assert.match(sidebarSource, /t\(['"]nav\.help['"]\)/);

  assert.match(bottomNavSource, /HelpCircle/);
  assert.match(bottomNavSource, /path:\s*['"]\/help['"]/);
  assert.match(bottomNavSource, /t\(['"]nav\.help['"]\)/);

  assert.match(headerSource, /HelpCircle/);
  assert.match(headerSource, /navigate\(['"]\/help['"]\)/);
  assert.match(headerSource, /data-testid="header-help-btn"/);

  assert.match(layoutSource, /path\.startsWith\(['"]\/help['"]\).*t\(['"]pageTitles\.help['"]\)/);
});

test('Phase 20: Help knowledge base covers every menu with bilingual guides, Dr./Cr. journals, COA, Tax Calendar, and Monthly Closing checklist', () => {
  const data = transpileAndRun(path.join(frontendSrc, 'components', 'help', 'helpKnowledgeData.ts'));

  const expectedMenuIds = [
    'overview-accounting-cycle',
    'dashboard',
    'receipt',
    'cashbill',
    'delivery',
    'quotation',
    'taxinvoice',
    'creditnote',
    'debitnote',
    'expenses',
    'purchase-orders',
    'accounting',
    'bank-reconciliation',
    'customers',
    'products',
    'warehouses',
    'settings',
    'users',
    'audit-logs',
    'profile',
  ];

  const guideIds = new Set(data.MENU_HELP_GUIDES.map((g) => g.id));
  for (const id of expectedMenuIds) {
    assert.ok(guideIds.has(id), `Missing help guide for menu: ${id}`);
  }

  for (const guide of data.MENU_HELP_GUIDES) {
    assertLocalizedNonEmpty(guide.menuName, `guide[${guide.id}].menuName`);
    assertLocalizedNonEmpty(guide.shortDesc, `guide[${guide.id}].shortDesc`);
    assertLocalizedNonEmpty(guide.whoShouldUse, `guide[${guide.id}].whoShouldUse`);
    assert.ok(guide.steps.length >= 2, `guide[${guide.id}] must document at least 2 detailed steps`);
    assert.ok(guide.accountantTips.length >= 1, `guide[${guide.id}] must include accountant tips`);
    assert.ok(guide.commonPitfalls.length >= 1, `guide[${guide.id}] must list common pitfalls`);
    assertLocalizedNonEmpty(guide.impactSummary.stock, `guide[${guide.id}].impactSummary.stock`);
    assertLocalizedNonEmpty(guide.impactSummary.vat, `guide[${guide.id}].impactSummary.vat`);
    assertLocalizedNonEmpty(guide.impactSummary.wht, `guide[${guide.id}].impactSummary.wht`);
    assertLocalizedNonEmpty(guide.impactSummary.journal, `guide[${guide.id}].impactSummary.journal`);

    for (const step of guide.steps) {
      assertLocalizedNonEmpty(step.title, `guide[${guide.id}].step.title`);
      assertLocalizedNonEmpty(step.detail, `guide[${guide.id}].step.detail`);
    }
    for (const relId of guide.relatedIds) {
      assert.ok(guideIds.has(relId), `guide[${guide.id}] references unknown relatedId: ${relId}`);
    }
  }

  const coaCodes = new Set(data.SYSTEM_CHART_OF_ACCOUNTS.map((a) => a.code));
  for (const code of ['1110', '1130', '1140', '1150', '1170', '2110', '2130', '2140', '3100', '4100', '5100', '5200']) {
    assert.ok(coaCodes.has(code), `Missing system account ${code} in Help COA reference`);
  }

  assert.equal(data.MONTHLY_CLOSING_CHECKLIST.length, 6);
  assert.equal(data.DOCUMENT_IMPACT_MATRIX.length, 7);
  assert.ok(data.THAI_TAX_CALENDAR.length >= 4);
});

test('Phase 20: HelpPage uses useTranslation, Lucide icons without emoji, and full TH/EN i18n keys exist', () => {
  const helpPageSource = fs.readFileSync(path.join(frontendSrc, 'components', 'help', 'HelpPage.tsx'), 'utf8');
  assert.match(helpPageSource, /useTranslation\(/);
  assert.doesNotMatch(helpPageSource, /[\u{1F300}-\u{1FAFF}]/u);

  const { resources } = transpileAndRun(path.join(frontendSrc, 'i18n', 'resources.ts'));
  assert.ok(resources.th.translation.nav.help);
  assert.ok(resources.en.translation.nav.help);
  assert.ok(resources.th.translation.pageTitles.help);
  assert.ok(resources.en.translation.pageTitles.help);
  assert.deepEqual(
    Object.keys(resources.th.translation.help).sort(),
    Object.keys(resources.en.translation.help).sort(),
  );
});
