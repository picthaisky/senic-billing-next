import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(frontendRoot, '..');

test('Phase 16: Deep Bilingual Completion removes hardcoded Thai UI strings across all 7 remaining Phase 14 components', () => {
  const resourcesSrc = fs.readFileSync(path.join(frontendRoot, 'src/i18n/resources.ts'), 'utf8');

  const requiredPhase16Keys = [
    'announcementRegionAria:',
    'dismissAnnouncement:',
    'logoUploadError:',
    'confirmUpgradePlan:',
    'lineWebhookTitle:',
    'quotaDocsLabel:',
    'quotaUsersLabel:',
    'planLimitsSummary:',
    'pushSupported:',
    'minutesAgo:',
    'hoursAgo:',
    'yesterday:',
    'confirmMarkPaid:',
    'deliveryPending:',
    'deliveryShipping:',
    'deliveryDelivered:',
    'errTaxIdDigits:',
    'errUnitPrice:',
    'passwordMismatch:',
  ];

  for (const key of requiredPhase16Keys) {
    const matches = resourcesSrc.split(key).length - 1;
    assert.ok(
      matches >= 2,
      `Expected resources.ts to define '${key}' in both th and en dictionaries (found ${matches})`
    );
  }

  const zeroThaiFiles = [
    'src/components/products/ProductsPage.tsx',
    'src/components/dashboard/DashboardPage.tsx',
    'src/components/settings/SettingsPage.tsx',
    'src/components/profile/ProfilePage.tsx',
    'src/components/layout/DashboardLayout.tsx',
  ];

  const thaiLetterRegex = /[\u0E01-\u0E3A\u0E40-\u0E7F]/;

  for (const relPath of zeroThaiFiles) {
    const src = fs.readFileSync(path.join(frontendRoot, relPath), 'utf8');
    assert.doesNotMatch(
      src,
      thaiLetterRegex,
      `Expected ${relPath} to contain zero hardcoded Thai letters`
    );
  }

  // CustomersPage only has the avatar prefix-stripping regex on line 9
  const customersSrc = fs.readFileSync(
    path.join(frontendRoot, 'src/components/customers/CustomersPage.tsx'),
    'utf8'
  );
  const customersWithoutAvatarRegex = customersSrc.replace(
    /name\.replace\(\/\^\([^)]+\)\\s\*\/,\s*''\)/,
    ''
  );
  assert.doesNotMatch(
    customersWithoutAvatarRegex,
    thaiLetterRegex,
    'Expected CustomersPage.tsx to contain zero hardcoded Thai UI strings outside getInitial regex'
  );

  // DocumentsListPage only keeps backend deliveryStatus enum values ('รอส่ง', 'กำลังจัดส่ง', 'ส่งสำเร็จแล้ว') mapped via getDeliveryStatusLabel
  const docsListSrc = fs.readFileSync(
    path.join(frontendRoot, 'src/components/documents/DocumentsListPage.tsx'),
    'utf8'
  );
  assert.match(docsListSrc, /getDeliveryStatusLabel/);
  assert.match(docsListSrc, /t\('documentsList\.deliveryPending'\)/);
  assert.match(docsListSrc, /t\('documentsList\.confirmMarkPaid'/);
});

test('Phase 16: Vite config defines manualChunks for vendor and i18n bundle splitting', () => {
  const viteConfig = fs.readFileSync(path.join(frontendRoot, 'vite.config.ts'), 'utf8');
  assert.match(viteConfig, /manualChunks\(id\)/);
  assert.match(viteConfig, /'i18n-resources'/);
  assert.match(viteConfig, /'vendor-signalr'/);
  assert.match(viteConfig, /'vendor-icons'/);
  assert.match(viteConfig, /'vendor-charts'/);
});

test('Phase 16: Backend RBAC controllers enforce platform role guards, reactivation MaxUsers quota, and tenant-scoped UserController', () => {
  const adminUsersCtrl = fs.readFileSync(
    path.join(repoRoot, 'backend/src/SenicBilling.API/Controllers/AdminUsersController.cs'),
    'utf8'
  );
  assert.match(adminUsersCtrl, /IsReservedPlatformRole/);
  assert.match(adminUsersCtrl, /!user\.IsActive && request\.IsActive/);

  const tenantUsersCtrl = fs.readFileSync(
    path.join(repoRoot, 'backend/src/SenicBilling.API/Controllers/TenantUsersController.cs'),
    'utf8'
  );
  assert.match(tenantUsersCtrl, /IsReservedPlatformRole/);

  const adminRolesCtrl = fs.readFileSync(
    path.join(repoRoot, 'backend/src/SenicBilling.API/Controllers/AdminRolesController.cs'),
    'utf8'
  );
  assert.match(adminRolesCtrl, /IsReservedPlatformRole/);

  const userCtrl = fs.readFileSync(
    path.join(repoRoot, 'backend/src/SenicBilling.API/Controllers/UserController.cs'),
    'utf8'
  );
  assert.match(userCtrl, /User\.GetTenantId\(\)/);
  assert.match(userCtrl, /u\.TenantId == tenantId/);
});
