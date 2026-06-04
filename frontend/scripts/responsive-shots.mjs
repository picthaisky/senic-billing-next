// Responsive screenshot harness — captures the app at mobile/tablet/desktop
// breakpoints to verify the responsive UI against the Senic Billing UI Kit.
//
// Usage:
//   1. Start the dev server:  npm run dev   (note the printed port)
//   2. npm run shots          (or: node scripts/responsive-shots.mjs http://localhost:PORT)
//   Output: frontend/responsive-shots/{mobile,tablet,desktop}-{dashboard,receipt}.png
//
// Setup: npm i -D @playwright/test && npx playwright install chromium
//   If `npm i` leaves playwright-core partially extracted on this machine
//   (a flaky-FS symptom seen here), extract the tarball manually instead:
//     npm pack playwright-core@<v>  &&  tar -xzf playwright-core-<v>.tgz \
//       -C node_modules/playwright-core --strip-components=1   (repeat for playwright)
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const baseUrl = process.argv[2] || 'http://localhost:5174';
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'responsive-shots');
mkdirSync(outDir, { recursive: true });

// Pre-seed zustand-persisted auth so ProtectedRoute lets us in (no login UI).
const authState = {
  state: {
    token: 'dev-screenshot-token',
    user: {
      id: 'dev-1',
      email: 'demo@senic.co',
      firstName: 'สมหญิง',
      lastName: 'ใจดี',
      tenantId: 'tenant-1',
    },
    isAuthenticated: true,
  },
  version: 0,
};

const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 900 },
];

// id -> visible label per nav surface
const RECEIPT_DESKTOP = 'ใบเสร็จรับเงิน';
const RECEIPT_MOBILE = 'ใบเสร็จ';

async function gotoReceipt(page, width) {
  if (width >= 768) {
    await page.getByRole('button', { name: RECEIPT_DESKTOP }).first().click();
  } else {
    await page.getByRole('button', { name: RECEIPT_MOBILE, exact: true }).first().click();
  }
  await page.waitForTimeout(600); // let fade-in animation settle
}

const browser = await chromium.launch();
try {
  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      // Seed localStorage at context creation — most reliable auth injection
      storageState: {
        cookies: [],
        origins: [
          {
            origin: baseUrl,
            localStorage: [
              { name: 'senic-auth-storage', value: JSON.stringify(authState) },
            ],
          },
        ],
      },
    });

    const page = await context.newPage();
    // Mock the API: a real 401 (no backend) trips apiClient's interceptor,
    // which auto-logs-out and bounces to /login. Stub it to keep auth intact.
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"data":{}}' })
    );
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    // 1) Dashboard
    await page.screenshot({ path: join(outDir, `${vp.name}-dashboard.png`), fullPage: true });

    // 2) Receipt form (the responsive line-items table)
    try {
      await gotoReceipt(page, vp.width);
      await page.screenshot({ path: join(outDir, `${vp.name}-receipt.png`), fullPage: true });
      console.log(`✓ ${vp.name} (${vp.width}px): dashboard + receipt`);
    } catch (err) {
      console.log(`⚠ ${vp.name} (${vp.width}px): dashboard OK, receipt nav failed — ${err.message}`);
    }

    await context.close();
  }
} finally {
  await browser.close();
}
console.log(`\nScreenshots written to: ${outDir}`);
