// Baseline/verify screenshots for the Dashboard with rich mock data.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync } from 'node:fs';

const baseUrl = process.argv[2] || 'http://localhost:5174';
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'responsive-shots');
mkdirSync(outDir, { recursive: true });

const authState = { state: { token: 'dev', user: { id: '1', email: 'demo@senic.co', firstName: 'สมหญิง', lastName: 'ใจดี', tenantId: 't' }, isAuthenticated: true }, version: 0 };
const storageState = { cookies: [], origins: [{ origin: baseUrl, localStorage: [{ name: 'senic-auth-storage', value: JSON.stringify(authState) }] }] };

const env = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: '', data }) });
const now = new Date();
const ym = (i) => { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const MOCK = {
  summary: { totalRevenue: 1050000, documentsIssued: 156, pendingDocuments: 8, monthlyGrowthPercent: 23.4 },
  revenue: [5, 4, 3, 2, 1, 0].map((i, idx) => ({ month: ym(i), goodsValue: [120000, 150000, 140000, 180000, 210000, 250000][idx], vatAmount: [8400, 10500, 9800, 12600, 14700, 17500][idx] })),
  products: [
    { productName: 'หมึกพิมพ์ Toner', totalRevenue: 85000, totalQuantity: 30 },
    { productName: 'กระดาษ A4', totalRevenue: 45000, totalQuantity: 300 },
    { productName: 'บริการซ่อม', totalRevenue: 30000, totalQuantity: 12 },
    { productName: 'เครื่องเขียน', totalRevenue: 15000, totalQuantity: 200 },
    { productName: 'แฟ้มเอกสาร', totalRevenue: 12000, totalQuantity: 150 },
  ],
  recent: [
    { id: '1', documentNumber: 'INV-202606-0012', documentType: 'TaxInvoice', customerName: 'บจก. เอบีซี', grandTotal: 32100, createdAt: new Date(Date.now() - 2 * 3600e3).toISOString() },
    { id: '2', documentNumber: 'RCP-202606-0045', documentType: 'Receipt', customerName: 'ร้านมิตรภาพ', grandTotal: 8500, createdAt: new Date(Date.now() - 5 * 3600e3).toISOString() },
    { id: '3', documentNumber: 'CSB-202606-0023', documentType: 'CashBill', customerName: 'คุณสมชาย', grandTotal: 3200, createdAt: new Date(Date.now() - 26 * 3600e3).toISOString() },
    { id: '4', documentNumber: 'DLV-202606-0018', documentType: 'DeliveryNote', customerName: 'บจก. ดีเอฟจี', grandTotal: 67800, createdAt: new Date(Date.now() - 28 * 3600e3).toISOString() },
  ],
};

const browser = await chromium.launch();
try {
  for (const vp of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 375, height: 812 }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, storageState });
    const page = await ctx.newPage();
    await page.route('**/api/**', (route) => {
      const u = route.request().url();
      if (u.includes('/dashboard/summary')) return route.fulfill(env(MOCK.summary));
      if (u.includes('/dashboard/revenue-chart')) return route.fulfill(env(MOCK.revenue));
      if (u.includes('/dashboard/top-products')) return route.fulfill(env(MOCK.products));
      if (u.includes('/dashboard/recent-activity')) return route.fulfill(env(MOCK.recent));
      return route.fulfill(env({}));
    });
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('header.layout-header', { timeout: 15000 });
    await page.waitForTimeout(1200); // let charts animate in
    await page.screenshot({ path: join(outDir, `${vp.name}-dashboard.png`), fullPage: true });
    console.log(`✓ ${vp.name} dashboard`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
