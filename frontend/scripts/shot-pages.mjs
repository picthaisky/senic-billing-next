// Verify Customers / Products pages (they use internal mock data).
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const baseUrl = process.argv[2] || 'http://localhost:5174';
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'responsive-shots');
mkdirSync(outDir, { recursive: true });

const authState = { state: { token: 'dev', user: { id: '1', email: 'demo@senic.co', firstName: 'สมหญิง', lastName: 'ใจดี', tenantId: 't' }, isAuthenticated: true }, version: 0 };
const storageState = { cookies: [], origins: [{ origin: baseUrl, localStorage: [{ name: 'senic-auth-storage', value: JSON.stringify(authState) }] }] };

// label shown in both sidebar (desktop) and bottom nav (mobile)
const targets = [
  { id: 'customers', label: 'ลูกค้า' },
  { id: 'products', label: 'สินค้า' },
];

const browser = await chromium.launch();
try {
  for (const vp of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 375, height: 812 }]) {
    for (const t of targets) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, storageState });
      const page = await ctx.newPage();
      await page.route('**/api/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":{}}' }));
      await page.goto(baseUrl, { waitUntil: 'networkidle' });
      await page.waitForSelector('header.layout-header', { timeout: 15000 });
      await page.getByRole('button', { name: t.label, exact: true }).first().click();
      await page.waitForTimeout(900); // mock fetch (500ms) + render
      await page.screenshot({ path: join(outDir, `${vp.name}-${t.id}.png`), fullPage: true });
      console.log(`✓ ${vp.name} ${t.id}`);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}
