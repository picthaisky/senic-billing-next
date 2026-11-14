import { test, expect, type Page } from '@playwright/test';

const envelope = (data: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ success: true, message: 'สำเร็จ', data }),
});

async function setupApiMocks(page: Page, captured: { createdInvoice?: Record<string, unknown> } = {}) {
  await page.route('**/hubs/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ connectionId: 'e2e-conn', availableTransports: [] }),
    });
  });

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();

    if (path.endsWith('/auth/login') && method === 'POST') {
      return route.fulfill(
        envelope({
          token: 'e2e-jwt-token',
          refreshToken: 'e2e-refresh',
          expiresAt: new Date(Date.now() + 8 * 3600_000).toISOString(),
          user: {
            id: '00000000-0000-0000-0000-000000000002',
            username: 'admin',
            displayName: 'System Admin',
            role: 'Admin',
            tenantId: '00000000-0000-0000-0000-000000000001',
            tenantName: 'Senic Corporation',
          },
        })
      );
    }

    if (path.endsWith('/announcements/active')) {
      return route.fulfill(
        envelope([
          {
            id: 'ann-e2e-1',
            title: 'แจ้งปิดปรับปรุงระบบทดสอบ',
            message: 'คืนนี้เวลา 02:00 น. จะมีการสำรองข้อมูลอัตโนมัติ',
            severity: 'Warning',
            isActive: true,
          },
        ])
      );
    }

    if (path.endsWith('/dashboard/summary')) {
      return route.fulfill(
        envelope({ totalRevenue: 325000, documentsIssued: 42, pendingDocuments: 3, monthlyGrowthPercent: 18.5 })
      );
    }

    if (path.endsWith('/dashboard/revenue-chart')) {
      return route.fulfill(envelope([{ month: '2026-11', goodsValue: 180000, vatAmount: 12600 }]));
    }

    if (path.endsWith('/dashboard/top-products')) {
      return route.fulfill(envelope([{ productName: 'บริการระบบบัญชี Cloud', totalRevenue: 95000, totalQuantity: 10 }]));
    }

    if (path.endsWith('/dashboard/recent-activity')) {
      return route.fulfill(envelope([]));
    }

    if (path.endsWith('/dashboard/aging-report')) {
      return route.fulfill(
        envelope({
          current: 25000,
          overdue1_30: 0,
          overdue31_60: 0,
          overdue61_90: 0,
          overdue90Plus: 0,
          totalOverdue: 0,
          customers: [],
        })
      );
    }

    if (path.endsWith('/dashboard/tax-estimator')) {
      return route.fulfill(
        envelope({
          year: 2026,
          month: 11,
          totalSalesBeforeVat: 180000,
          totalVatCollected: 12600,
          totalWhtDeducted: 2400,
          totalInputVat: 4200,
          netVatPayable: 8400,
          documentCount: 15,
        })
      );
    }

    if (path.endsWith('/dashboard/top-spenders')) {
      return route.fulfill(
        envelope([
          {
            customerId: 'cust-1',
            customerName: 'บจก. สยามพริ้นท์',
            totalOrders: 9,
            totalSpent: 145000,
            lastPurchaseDate: '2026-11-12T00:00:00Z',
          },
        ])
      );
    }

    if (path.endsWith('/products')) {
      return route.fulfill(
        envelope({
          items: [
            {
              id: 'prod-1',
              sku: 'SRV-001',
              name: 'ซอฟต์แวร์บัญชีรายปี',
              unitPrice: 1000,
              unit: 'สิทธิ์',
              stockQuantity: 50,
            },
          ],
          totalCount: 1,
        })
      );
    }

    if (path.endsWith('/customers')) {
      return route.fulfill(envelope({ items: [], totalCount: 0 }));
    }

    if (path.endsWith('/tax-invoices') && method === 'POST') {
      captured.createdInvoice = JSON.parse(route.request().postData() || '{}') as Record<string, unknown>;
      return route.fulfill(
        envelope({
          id: 'doc-created-1',
          documentNumber: 'INV-202611-0099',
        })
      );
    }

    if (path.endsWith('/audit-logs/filters')) {
      return route.fulfill(
        envelope({
          entityNames: ['DocumentHeader', 'AccountingPeriodLock'],
          actions: ['Update', 'LockPeriod'],
        })
      );
    }

    if (path.endsWith('/audit-logs')) {
      return route.fulfill(
        envelope({
          items: [
            {
              id: 'log-1',
              username: 'admin',
              action: 'Update',
              entityName: 'DocumentHeader',
              entityId: 'INV-202611-0001',
              oldValues: JSON.stringify({ status: 'Draft', grandTotal: 1070 }),
              newValues: JSON.stringify({ status: 'Issued', grandTotal: 2140 }),
              timestamp: '2026-11-14T01:30:00Z',
            },
          ],
          totalCount: 1,
          page: 1,
          pageSize: 25,
          stats: {
            totalLogs: 12,
            todayLogs: 4,
            distinctUsers: 2,
            latestTimestamp: '2026-11-14T01:30:00Z',
          },
        })
      );
    }

    if (path.includes('/accounting/summary')) {
      return route.fulfill(
        envelope({
          totalAssets: 500000,
          totalLiabilities: 120000,
          totalEquity: 380000,
          revenue: 250000,
          expenses: 110000,
          netProfit: 140000,
        })
      );
    }

    if (path.includes('/bank-reconciliation/summary')) {
      return route.fulfill(
        envelope({
          totalTransactions: 0,
          matchedCount: 0,
          suggestedCount: 0,
          unmatchedCount: 0,
          matchedDepositsTotal: 0,
          unmatchedDepositsTotal: 0,
        })
      );
    }

    if (path.includes('/bank-reconciliation/candidates')) {
      return route.fulfill(envelope({ documents: [], expenses: [] }));
    }

    if (path.endsWith('/notifications/feed')) {
      return route.fulfill(
        envelope([
          {
            id: 'notif-e2e-1',
            title: 'เกินกำหนดชำระ INV-202611-0001',
            detail: 'บจก. สยามพริ้นท์ • ฿12,500.00',
            timeLabel: '2 ชั่วโมงที่แล้ว',
            occurredAt: new Date().toISOString(),
            tone: 'danger',
            route: '/documents/taxinvoice',
          },
        ])
      );
    }

    if (path.endsWith('/search')) {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const items = q.includes('siam') || q.includes('inv')
        ? [
            {
              id: 'search-doc-1',
              category: 'document',
              title: 'INV-202611-0001',
              subtitle: 'บจก. สยามพริ้นท์ • ฿12,500.00',
              badge: 'Issued',
              route: '/documents/taxinvoice',
            },
          ]
        : [];
      return route.fulfill(envelope({ query: q, items }));
    }

    if (path.endsWith('/payments/callback-status')) {
      const docId = url.searchParams.get('documentId') || '';
      if (docId === 'doc-paid-1') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            documentId: 'doc-paid-1',
            documentNumber: 'INV-202611-0099',
            documentType: 'TaxInvoice',
            status: 'Paid',
            isPaid: true,
            grandTotal: 2140,
            paymentStatus: 'successful',
          }),
        });
      }
      if (docId === 'doc-pending-1') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            documentId: 'doc-pending-1',
            documentNumber: 'INV-202611-0088',
            documentType: 'TaxInvoice',
            status: 'Issued',
            isPaid: false,
            grandTotal: 1070,
            paymentStatus: 'pending',
          }),
        });
      }
      return route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'Not found' }),
      });
    }

    if (path.endsWith('/tenants/current') && method === 'GET') {
      return route.fulfill(
        envelope({
          id: '00000000-0000-0000-0000-000000000001',
          companyName: 'Senic Corporation',
          taxId: '0105559999999',
          email: 'billing@senic.co.th',
          phone: '02-123-4567',
          address: '99 Sathorn, Bangkok',
          branchName: 'สำนักงานใหญ่',
          logoUrl: '',
        })
      );
    }

    if (path.endsWith('/subscriptions/current')) {
      return route.fulfill(
        envelope({
          subscriptionStatus: 'Active',
          subscriptionValidUntil: '2026-12-31T00:00:00Z',
          currentPlan: {
            id: 'plan-free',
            name: 'Free Starter',
            monthlyPrice: 0,
            yearlyPrice: 0,
            maxUsers: 2,
            maxDocumentsPerMonth: 20,
            features: '["ออกเอกสารพื้นฐาน"]',
          },
          usage: {
            currentMonthDocuments: 3,
            maxDocumentsPerMonth: 20,
            currentUsers: 1,
            maxUsers: 2,
          },
          availablePlans: [
            {
              id: 'plan-free',
              name: 'Free Starter',
              monthlyPrice: 0,
              yearlyPrice: 0,
              maxUsers: 2,
              maxDocumentsPerMonth: 20,
              features: '["ออกเอกสารพื้นฐาน"]',
            },
            {
              id: 'plan-pro',
              name: 'Pro Business',
              monthlyPrice: 990,
              yearlyPrice: 9900,
              maxUsers: 10,
              maxDocumentsPerMonth: 500,
              features: '["PromptPay QR","e-Tax XML"]',
            },
          ],
        })
      );
    }

    if (path.endsWith('/subscriptions/checkout') && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          requiresPayment: true,
          paymentMethod: 'promptpay',
          status: 'Pending',
          subscriptionId: 'sub-e2e-pp-1',
          chargeId: 'chrg_e2e_pp',
          qrCodeUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
          amount: 990,
          billingCycle: 'Monthly',
          planName: 'Pro Business',
        }),
      });
    }

    if (path.endsWith('/subscriptions/status/sub-e2e-pp-1')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          status: 'Pending',
          isPaid: false,
          subscriptionId: 'sub-e2e-pp-1',
        }),
      });
    }

    if (path.endsWith('/auth/forgot-password') && method === 'POST') {
      return route.fulfill(envelope(null));
    }

    if (path.endsWith('/auth/signup-tenant') && method === 'POST') {
      return route.fulfill(
        envelope({
          token: 'e2e-signup-jwt',
          refreshToken: 'e2e-refresh',
          expiresAt: new Date(Date.now() + 8 * 3600_000).toISOString(),
          user: {
            id: 'user-signup-1',
            username: 'founder1',
            displayName: 'New Organization',
            role: 'Admin',
            tenantId: 'ten-signup-1',
            tenantName: 'บจก. สตาร์ทอัพ ใหม่',
          },
        })
      );
    }

    return route.fulfill(envelope([]));
  });
}

test('Login, Dashboard Top Spenders, Platform Announcement, Invoice Form, Audit Explorer & Lazy Routes work E2E', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  const captured: { createdInvoice?: Record<string, unknown> } = {};
  await setupApiMocks(page, captured);

  // 1. Login -> Dashboard
  await page.goto('/login');
  await page.getByPlaceholder('admin').fill('admin');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText('แจ้งปิดปรับปรุงระบบทดสอบ:')).toBeVisible();
  await expect(page.getByText('บจก. สยามพริ้นท์')).toBeVisible();

  // Dismiss announcement banner
  await page.getByRole('button', { name: 'ปิดประกาศ แจ้งปิดปรับปรุงระบบทดสอบ' }).click();
  await expect(page.getByText('แจ้งปิดปรับปรุงระบบทดสอบ:')).toBeHidden();

  // 1b. Live Notification Bell & Bilingual TH/EN Switcher + Global Search (⌘K)
  await page.getByRole('button', { name: /การแจ้งเตือน \(1 รายการใหม่\)/ }).click();
  await expect(page.getByText('เกินกำหนดชำระ INV-202611-0001')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'เปลี่ยนภาษาเป็น English' }).click();
  await expect(page.getByRole('button', { name: 'Credit Note (CN)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Business Overview' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tax Estimator' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Top Spenders' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recent Documents' })).toBeVisible();

  await page.getByRole('button', { name: 'Switch language to Thai' }).click();
  await expect(page.getByRole('button', { name: 'ใบลดหนี้ (CN)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'ภาพรวมธุรกิจ' })).toBeVisible();

  const searchBox = page.getByPlaceholder('ค้นหาเอกสาร, ลูกค้า, สินค้า...').first();
  await searchBox.fill('INV');
  await expect(page.getByRole('option').filter({ hasText: 'INV-202611-0001' })).toBeVisible();
  await searchBox.press('Escape');

  // 1c. Bilingual Toggle on Documents List Page
  await page.goto('/documents/taxinvoice');
  await expect(page.getByRole('heading', { name: 'รายการใบกำกับภาษี' })).toBeVisible();
  await page.getByRole('button', { name: 'เปลี่ยนภาษาเป็น English' }).click();
  await expect(page.getByRole('heading', { name: 'Tax Invoice List' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'New Tax Invoice' })).toBeVisible();
  await page.getByRole('button', { name: 'Switch language to Thai' }).click();
  await expect(page.getByRole('heading', { name: 'รายการใบกำกับภาษี' })).toBeVisible();

  // 2. Create Tax Invoice with Local Date & DueDate
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/documents/taxinvoice/create');
  await expect(page.getByText('สร้างใบกำกับภาษี')).toBeVisible();

  const docDateVal = await page.getByLabel('วันที่ออกเอกสาร').inputValue();
  expect(docDateVal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await page.getByLabel('วันครบกำหนดชำระ').fill('2026-12-14');
  await page.getByPlaceholder('พิมพ์เพื่อค้นหา...').fill('บริษัท ทดสอบ อีทูอี จำกัด');
  await page.getByPlaceholder('เลข 13 หลัก').fill('0105561234567');
  await page.getByPlaceholder('ชื่อสินค้า / รายละเอียด').first().fill('ซอฟต์แวร์บัญชีรายปี');
  await page.getByLabel('จำนวน').first().fill('2');
  await page.getByLabel('ราคาต่อหน่วย').first().fill('1000');

  await page.getByRole('button', { name: 'บันทึกเอกสาร' }).click();
  await expect
    .poll(() => captured.createdInvoice?.customerName)
    .toBe('บริษัท ทดสอบ อีทูอี จำกัด');
  expect(String(captured.createdInvoice?.dueDate || '')).toContain('2026-12-14');

  // 3. Audit Log Explorer & Diff Modal + Bilingual Toggle
  await page.goto('/audit-logs');
  await expect(page.getByText('ประวัติการใช้งานและตรวจสอบ (Audit Log Explorer)')).toBeVisible();
  await expect(page.getByText('INV-202611-0001')).toBeVisible();

  await page.getByRole('button', { name: 'เปลี่ยนภาษาเป็น English' }).click();
  await expect(page.locator('h1').first()).not.toContainText(/[\u0E00-\u0E7F]/);
  await page.getByRole('button', { name: 'Switch language to Thai' }).click();
  await expect(page.getByText('ประวัติการใช้งานและตรวจสอบ (Audit Log Explorer)')).toBeVisible();

  await page.getByRole('button', { name: 'ดู Diff' }).click();
  await expect(page.getByText('ข้อมูลเดิม (OldValues)')).toBeVisible();
  await expect(page.getByText('ข้อมูลใหม่ (NewValues)')).toBeVisible();
  await page.getByRole('button', { name: 'ปิดหน้าต่าง' }).click();

  // 4. Verify lazy-loaded Phase 9–11 pages mount cleanly & toggle TH/EN cleanly
  const routes: Array<[string, string]> = [
    ['/accounting', 'บัญชีอัตโนมัติ & งบการเงิน (Auto-Accounting)'],
    ['/bank-reconciliation', 'กระทบยอดธนาคาร (Bank Reconciliation)'],
    ['/purchase-orders', 'จัดซื้อ & ใบสั่งซื้อ (Purchase Orders & Vendors)'],
    ['/warehouses', 'คลังสินค้าหลายสาขา (Multi-Warehouse & Stock Ledger)'],
    ['/expenses', 'ค่าใช้จ่าย & ภาษีซื้อ (Expenses & Input VAT)'],
  ];

  for (const [routePath, headingText] of routes) {
    await page.goto(routePath);
    await expect(page.getByText(headingText)).toBeVisible();
  }

  // Toggle TH/EN on Enterprise Accounting & Expenses pages
  await page.goto('/accounting');
  await expect(page.getByText('บัญชีอัตโนมัติ & งบการเงิน (Auto-Accounting)')).toBeVisible();
  await page.getByRole('button', { name: 'เปลี่ยนภาษาเป็น English' }).click();
  await expect(page.locator('h1').first()).not.toContainText(/[\u0E00-\u0E7F]/);
  await page.getByRole('button', { name: 'Switch language to Thai' }).click();
  await expect(page.getByText('บัญชีอัตโนมัติ & งบการเงิน (Auto-Accounting)')).toBeVisible();

  await page.goto('/expenses');
  await expect(page.getByText('ค่าใช้จ่าย & ภาษีซื้อ (Expenses & Input VAT)')).toBeVisible();
  await page.getByRole('button', { name: 'เปลี่ยนภาษาเป็น English' }).click();
  await expect(page.locator('h1').first()).not.toContainText(/[\u0E00-\u0E7F]/);
  await page.getByRole('button', { name: 'Switch language to Thai' }).click();
  await expect(page.getByText('ค่าใช้จ่าย & ภาษีซื้อ (Expenses & Input VAT)')).toBeVisible();

  // 5. Phase 16 Deep Bilingual Toggle on Products, Customers & Settings pages
  await page.goto('/products');
  await expect(page.getByRole('heading', { name: 'รายการสินค้า / บริการ' })).toBeVisible();
  await page.getByRole('button', { name: 'เปลี่ยนภาษาเป็น English' }).first().click();
  await expect(page.getByRole('heading', { name: 'Products & Services' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Product' })).toBeVisible();
  await page.getByRole('button', { name: 'Switch language to Thai' }).first().click();
  await expect(page.getByRole('heading', { name: 'รายการสินค้า / บริการ' })).toBeVisible();

  await page.goto('/customers');
  await expect(page.getByRole('heading', { name: 'รายชื่อลูกค้า' })).toBeVisible();
  await page.getByRole('button', { name: 'เปลี่ยนภาษาเป็น English' }).first().click();
  await expect(page.getByRole('heading', { name: 'Customers' }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Customer' })).toBeVisible();
  await page.getByRole('button', { name: 'Switch language to Thai' }).first().click();
  await expect(page.getByRole('heading', { name: 'รายชื่อลูกค้า' })).toBeVisible();

  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'ตั้งค่าระบบ' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'เปลี่ยนภาษาเป็น English' }).first().click();
  await expect(page.getByRole('heading', { name: 'System Settings' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Switch language to Thai' }).first().click();
  await expect(page.getByRole('heading', { name: 'ตั้งค่าระบบ' }).first()).toBeVisible();

  // 6. Phase 20 Help Center & Expert Accountant Knowledge verification
  await page.getByTestId('header-help-btn').click();
  await expect(page).toHaveURL(/\/help/);
  await expect(
    page.getByRole('heading', { name: 'คู่มือการใช้งานทุกเมนู & ความรู้การทำบัญชีในระบบ' }),
  ).toBeVisible();

  await page.getByTestId('help-search-input').fill('2130');
  await page.getByTestId('help-guide-item-taxinvoice').click();
  await expect(page.getByTestId('help-guide-detail')).toContainText('1130');
  await expect(page.getByTestId('help-guide-detail')).toContainText('2130');

  await page.getByTestId('help-tab-academy').click();
  await expect(page.getByTestId('help-academy-view')).toBeVisible();
  await expect(page.getByText('ภ.พ. 30')).toBeVisible();
  await expect(page.getByText('0 / 6')).toBeVisible();
  await page.getByTestId('help-academy-view').locator('input[type="checkbox"]').first().click();
  await expect(page.getByText('1 / 6')).toBeVisible();

  await page.getByRole('button', { name: 'เปลี่ยนภาษาเป็น English' }).first().click();
  await expect(
    page.getByRole('heading', { name: 'Complete Menu Guides & Expert System Accounting Manual' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Switch language to Thai' }).first().click();
  await expect(
    page.getByRole('heading', { name: 'คู่มือการใช้งานทุกเมนู & ความรู้การทำบัญชีในระบบ' }),
  ).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('Payment Callback route renders paid, pending refresh & missing-reference states E2E', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await setupApiMocks(page);

  let callbackHits = 0;
  page.on('request', (req) => {
    if (req.url().includes('/api/payments/callback-status')) {
      callbackHits += 1;
    }
  });

  // 1. Paid callback status
  await page.goto('/payments/callback?documentId=doc-paid-1');
  await expect(page.getByText('INV-202611-0099')).toBeVisible();
  await expect(page.getByText('฿2,140.00')).toBeVisible();
  await expect(page.locator('a[href="/print/doc-paid-1"]')).toBeVisible();
  await expect(page.locator('a[href="/login"]')).toBeVisible();

  // 2. Pending callback status + manual refresh re-query
  await page.goto('/payments/callback?documentId=doc-pending-1');
  await expect(page.getByText('INV-202611-0088')).toBeVisible();
  await expect(page.getByText('฿1,070.00')).toBeVisible();
  const hitsBeforeRefresh = callbackHits;
  await page.locator('button').first().click();
  await expect.poll(() => callbackHits).toBeGreaterThan(hitsBeforeRefresh);

  // 3. Missing query reference state
  await page.goto('/payments/callback');
  await expect(page.locator('h1').first()).toBeVisible();
  await expect(page.locator('a[href="/login"]')).toBeVisible();

  expect(pageErrors).toEqual([]);
});

test('Login Forgot Password / Signup Tenant and Settings SaaS Checkout Modal work E2E', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await setupApiMocks(page);

  // 1. Login -> Forgot Password -> Self-Service Signup
  await page.goto('/login');
  await page.getByRole('button', { name: 'ลืมรหัสผ่าน?' }).click();
  await page.locator('input[type="text"]').fill('admin@senic.co.th');
  await page.getByRole('button', { name: 'ส่งลิงก์ตั้งรหัสผ่านใหม่' }).click();
  await expect(page.getByText(/ลิงก์ตั้งรหัสผ่านใหม่ถูกส่ง/)).toBeVisible();

  await page.getByRole('button', { name: 'กลับไปหน้าเข้าสู่ระบบ' }).click();
  await page.getByRole('button', { name: 'สมัครเปิดใช้งานองค์กรใหม่' }).click();
  await page.locator('form input[type="text"]').first().fill('บจก. สตาร์ทอัพ ใหม่');
  const signupTextInputs = page.locator('form input[type="text"]');
  await signupTextInputs.last().fill('founder1');
  await page.locator('form input[type="password"]').fill('SecretPass123!');
  await page.getByRole('button', { name: 'เปิดใช้งานองค์กรใหม่' }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // 2. Settings -> Open Checkout Modal -> PromptPay QR
  await page.goto('/settings');
  await expect(page.getByText('Pro Business')).toBeVisible();
  await page.getByRole('button', { name: 'เลือกแพ็กเกจนี้' }).first().click();
  await expect(page.getByText(/อัปเกรดแพ็กเกจ \/ ชำระค่าบริการ: Pro Business/)).toBeVisible();
  await page.getByRole('button', { name: 'ดำเนินการชำระเงิน / เปิดใช้งาน' }).click();
  await expect(page.getByAltText('PromptPay QR')).toBeVisible();
  await expect(page.getByRole('button', { name: 'ตรวจสอบสถานะการชำระ' })).toBeVisible();

  expect(pageErrors).toEqual([]);
});

