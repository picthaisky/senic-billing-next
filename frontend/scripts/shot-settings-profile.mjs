// Verify Settings / Profile pages.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const baseUrl = process.argv[2] || 'http://localhost:5174';
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'responsive-shots');
mkdirSync(outDir, { recursive: true });

const authState = { state: { token: 'dev', user: { id: '1', email: 'demo@senic.co', firstName: 'สมหญิง', lastName: 'ใจดี', tenantId: 't' }, isAuthenticated: true }, version: 0 };
const storageState = { cookies: [], origins: [{ origin: baseUrl, localStorage: [{ name: 'senic-auth-storage', value: JSON.stringify(authState) }] }] };

async function go(page, vp, label) {
  if (vp.width >= 768) {
    await page.getByRole('button', { name: label, exact: true }).first().click();
  } else {
    await page.getByRole('button', { name: 'เพิ่มเติม' }).click();
    await page.getByRole('button', { name: label, exact: true }).click();
  }
  await page.waitForTimeout(700);
}

const browser = await chromium.launch();
try {
  for (const vp of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 375, height: 812 }]) {
    for (const t of [{ id: 'settings', label: 'ตั้งค่า' }, { id: 'profile', label: 'โปรไฟล์' }]) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, storageState });
      const page = await ctx.newPage();
      await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":{}}' }));
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      await page.waitForSelector('header.layout-header', { timeout: 15000 });
      // Profile isn't in nav; reach it via the header profile menu
      if (t.id === 'profile') {
        await page.getByLabel('เมนูผู้ใช้งาน').click();
        await page.getByRole('button', { name: 'โปรไฟล์ของฉัน' }).click();
        await page.waitForTimeout(700);
      } else {
        await go(page, vp, t.label);
      }
      await page.screenshot({ path: join(outDir, `${vp.name}-${t.id}.png`), fullPage: true });
      console.log(`✓ ${vp.name} ${t.id}`);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
