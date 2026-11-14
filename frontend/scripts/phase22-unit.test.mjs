import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { resources } from '../src/i18n/resources.ts';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const frontendDir = path.join(repoRoot, 'frontend');
const frontendPublic = path.join(frontendDir, 'public');
const frontendSrc = path.join(frontendDir, 'src');

function collectKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

test('Phase 22 PWA icon suite, offline fallback, manifest.json & index.html meta are complete', () => {
  for (const file of [
    'favicon.ico',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'senic-favicon.svg',
    'apple-touch-icon.png',
    'icon-192x192.png',
    'icon-512x512.png',
    'icon-maskable-512.png',
    'offline.html',
    'manifest.json',
    'sw.js',
  ]) {
    const filePath = path.join(frontendPublic, file);
    assert.ok(fs.existsSync(filePath), `Missing frontend PWA public asset: ${file}`);
    assert.ok(fs.statSync(filePath).size > 0, `Empty frontend PWA asset: ${file}`);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(frontendPublic, 'manifest.json'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.lang, 'th');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 4);
  assert.ok(manifest.icons.some((i) => i.sizes === '192x192' && i.type === 'image/png'));
  assert.ok(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'any'));
  assert.ok(manifest.icons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable'));
  assert.ok(Array.isArray(manifest.shortcuts) && manifest.shortcuts.length >= 2);

  const indexHtml = fs.readFileSync(path.join(frontendDir, 'index.html'), 'utf8');
  assert.match(indexHtml, /viewport-fit=cover/);
  assert.match(indexHtml, /name="theme-color"/);
  assert.match(indexHtml, /apple-mobile-web-app-capable/);
  assert.match(indexHtml, /apple-touch-icon\.png/);
  assert.match(indexHtml, /manifest\.json/);
});

test('Phase 22 Service Worker & Nginx config implement offline caching without caching APIs', () => {
  const swSrc = fs.readFileSync(path.join(frontendPublic, 'sw.js'), 'utf8');
  for (const token of [
    "addEventListener('install'",
    "addEventListener('activate'",
    "addEventListener('fetch'",
    "addEventListener('push'",
    "addEventListener('notificationclick'",
    'SKIP_WAITING',
    '/offline.html',
    '/api/',
    '/hubs/',
  ]) {
    assert.ok(swSrc.includes(token), `sw.js missing expected token: ${token}`);
  }

  const nginxConf = fs.readFileSync(path.join(frontendDir, 'nginx.conf'), 'utf8');
  assert.match(nginxConf, /location = \/sw\.js/);
  assert.match(nginxConf, /location = \/manifest\.json/);
  assert.match(nginxConf, /no-cache, no-store, must-revalidate/);
});

test('Phase 22 PWA hook, banners, Settings card, FloatingAIChat & responsive tables are properly integrated', () => {
  const mainSrc = fs.readFileSync(path.join(frontendSrc, 'main.tsx'), 'utf8');
  assert.match(mainSrc, /registerServiceWorker/);

  const hookSrc = fs.readFileSync(path.join(frontendSrc, 'hooks', 'usePwaStatus.ts'), 'utf8');
  assert.match(hookSrc, /beforeinstallprompt/);
  assert.match(hookSrc, /SKIP_WAITING/);
  assert.match(hookSrc, /isOnline/);

  const themeHookSrc = fs.readFileSync(path.join(frontendSrc, 'hooks', 'useTheme.ts'), 'utf8');
  assert.match(themeHookSrc, /meta\[name="theme-color"\]/);

  const bannersSrc = fs.readFileSync(
    path.join(frontendSrc, 'components', 'pwa', 'PwaStatusBanners.tsx'),
    'utf8'
  );
  const settingsCardSrc = fs.readFileSync(
    path.join(frontendSrc, 'components', 'settings', 'SettingsPwaCard.tsx'),
    'utf8'
  );
  const aiChatSrc = fs.readFileSync(
    path.join(frontendSrc, 'components', 'layout', 'FloatingAIChat.tsx'),
    'utf8'
  );
  const bottomNavSrc = fs.readFileSync(
    path.join(frontendSrc, 'components', 'layout', 'BottomNav.tsx'),
    'utf8'
  );

  // Mobile floating chat avoids BottomNav + bottom-right FAB collision
  assert.match(aiChatSrc, /left-4 bottom-\[calc\(68px\+env\(safe-area-inset-bottom/);
  assert.match(aiChatSrc, /md:right-6/);
  assert.match(bottomNavSrc, /aria-expanded=\{showMore\}/);
  assert.match(bottomNavSrc, /mobile-more-sheet/);

  // Strict zero raw Thai inside TSX components
  for (const [name, src] of [
    ['PwaStatusBanners.tsx', bannersSrc],
    ['SettingsPwaCard.tsx', settingsCardSrc],
    ['FloatingAIChat.tsx', aiChatSrc],
    ['BottomNav.tsx', bottomNavSrc],
  ]) {
    assert.doesNotMatch(src, /[\u0E00-\u0E7F]/, `Expected zero raw Thai in ${name}`);
  }

  // Responsive table-to-card parity
  for (const relPath of [
    'components/accounting/AccountingPage.tsx',
    'components/accounting/BankReconciliationPage.tsx',
    'components/documents/DocumentsListPage.tsx',
    'components/users/AuditLogsPage.tsx',
    'components/users/UsersManagementPage.tsx',
    'components/settings/RecurringInvoicesConfig.tsx',
    'components/warehouses/WarehousesPage.tsx',
    'components/purchasing/PurchaseOrdersPage.tsx',
  ]) {
    const content = fs.readFileSync(path.join(frontendSrc, relPath), 'utf8');
    assert.match(content, /table-responsive/, `${relPath} missing table-responsive`);
    assert.match(content, /data-label=/, `${relPath} missing data-label`);
  }

  const indexCss = fs.readFileSync(path.join(frontendSrc, 'index.css'), 'utf8');
  assert.match(indexCss, /max-height:\s*85dvh/);
  assert.match(indexCss, /a4-preview-scroll/);
  assert.match(indexCss, /@media \(hover: none\)/);

  const mobileCss = fs.readFileSync(path.join(frontendSrc, 'mobile-first.css'), 'utf8');
  assert.match(mobileCss, /\.table-responsive td\[colspan\]/);
});

test('Phase 22 TH/EN i18n keys preserve full parity including pwa.* and mobile navigation keys', () => {
  const thKeys = collectKeys(resources.th.translation).sort();
  const enKeys = collectKeys(resources.en.translation).sort();
  assert.deepEqual(thKeys, enKeys);

  for (const key of [
    'pwa.offlineTitle',
    'pwa.updateTitle',
    'pwa.installBannerTitle',
    'pwa.settingsCardTitle',
    'pwa.iosGuide',
    'nav.mobileNavAria',
    'nav.moreSheetAria',
    'aiChat.openAria',
    'aiChat.closeAria',
    'aiChat.sendAria',
  ]) {
    assert.ok(thKeys.includes(key), `Missing translation key: ${key}`);
  }
});
