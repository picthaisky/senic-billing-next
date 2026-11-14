import { test, expect } from '../../frontend/node_modules/@playwright/test/index.mjs';
import type { Page } from '../../frontend/node_modules/@playwright/test/index.mjs';

interface BillingInvoiceMock {
  id: string;
  tenantName: string;
  planName: string;
  amount: number;
  status: string;
  startDate: string;
  endDate: string;
}

interface AnnouncementMock {
  id: string;
  title: string;
  message: string;
  severity: 'Info' | 'Warning' | 'Critical';
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

async function setupAdminMocks(page: Page) {
  const invoices: BillingInvoiceMock[] = [
    {
      id: 'inv-saas-1',
      tenantName: 'บจก. สยามเทค โซลูชั่น',
      planName: 'Pro Business',
      amount: 990,
      status: 'Pending',
      startDate: '2026-11-01T00:00:00Z',
      endDate: '2026-12-01T00:00:00Z',
    },
  ];

  const plans = [
    {
      id: 'plan-1',
      name: 'Pro Business',
      monthlyPrice: 990,
      yearlyPrice: 9900,
      maxUsers: 10,
      maxDocumentsPerMonth: 1000,
      features: '["ออกเอกสารครบทุกประเภท","PromptPay QR","รายงานภาษีขาย Excel"]',
      isActive: true,
    },
  ];

  const announcements: AnnouncementMock[] = [
    {
      id: 'ann-1',
      title: 'อัปเดตระบบ Phase 14',
      message: 'เพิ่มความเสถียรของ PDF โลโก้และ e-Tax XML',
      severity: 'Info',
      isActive: true,
      startsAt: null,
      endsAt: null,
      createdBy: 'superadmin',
      createdAt: '2026-11-14T00:00:00Z',
    },
  ];

  const tenants = [
    {
      id: 'ten-1',
      companyName: 'บจก. สยามเทค โซลูชั่น',
      email: 'owner@siamtech.co.th',
      currentPlanId: 'plan-1',
      currentPlan: 'Pro Business',
      maxUsers: 10,
      maxDocumentsPerMonth: 1000,
      userCount: 4,
      documentsCreatedThisMonth: 120,
      subscriptionStatus: 'Active',
    },
  ];

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const pathname = url.pathname;
    const method = req.method();

    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (pathname === '/api/auth/login' && method === 'POST') {
      return json({
        success: true,
        data: {
          token: 'sa-jwt-token',
          user: {
            id: 'sa-user-1',
            username: 'superadmin',
            role: 'SuperAdmin',
            isPlatformAdmin: true,
          },
        },
      });
    }

    if (pathname === '/api/auth/me') {
      return json({
        success: true,
        data: {
          id: 'sa-user-1',
          username: 'superadmin',
          role: 'SuperAdmin',
          isPlatformAdmin: true,
        },
      });
    }

    if (pathname === '/api/superadmin/billing/stats') {
      return json({
        success: true,
        data: {
          totalTenants: 42,
          activeTenants: 39,
          totalUsers: 128,
          mrr: 19500,
          recentInvoices: invoices,
        },
      });
    }

    if (pathname === '/api/superadmin/tenants' && method === 'GET') {
      return json({ success: true, data: tenants });
    }

    if (pathname === '/api/superadmin/tenants' && method === 'POST') {
      const payload = req.postDataJSON() as Record<string, unknown>;
      const created = {
        id: `ten-${tenants.length + 1}`,
        companyName: String(payload.companyName || 'New Tenant Co.'),
        email: (payload.email as string) || 'contact@newtenant.th',
        currentPlanId: 'plan-1',
        currentPlan: 'Pro Business',
        maxUsers: 10,
        maxDocumentsPerMonth: 1000,
        userCount: 1,
        documentsCreatedThisMonth: 0,
        subscriptionStatus: 'Active',
      };
      tenants.push(created);
      return json({ success: true, data: created });
    }

    if (pathname === '/api/superadmin/tenants/ten-1/impersonate' && method === 'POST') {
      return json({
        success: true,
        data: {
          token: 'impersonate-token-xyz',
          frontendUrl: 'https://app.senic.co.th',
        },
      });
    }

    if (pathname === '/api/superadmin/plans' && method === 'GET') {
      return json({ success: true, data: plans });
    }

    if (pathname === '/api/superadmin/plans' && method === 'POST') {
      const payload = req.postDataJSON() as Record<string, unknown>;
      const created = {
        id: `plan-${plans.length + 1}`,
        name: String(payload.name || 'Enterprise'),
        monthlyPrice: Number(payload.monthlyPrice || 0),
        yearlyPrice: Number(payload.yearlyPrice || 0),
        maxUsers: Number(payload.maxUsers || 5),
        maxDocumentsPerMonth: Number(payload.maxDocumentsPerMonth || 300),
        features: String(payload.features || '[]'),
        isActive: Boolean(payload.isActive ?? true),
      };
      plans.push(created);
      return json({ success: true, data: created });
    }

    if (pathname === '/api/superadmin/billing/invoices' && method === 'GET') {
      return json({ success: true, data: invoices });
    }

    if (pathname === '/api/superadmin/billing/invoices/inv-saas-1/mark-paid' && method === 'POST') {
      invoices[0].status = 'Paid';
      return json({ success: true, data: invoices[0] });
    }

    if (pathname === '/api/superadmin/announcements' && method === 'GET') {
      return json({ success: true, data: announcements });
    }

    if (pathname === '/api/superadmin/announcements' && method === 'POST') {
      const payload = req.postDataJSON() as Partial<AnnouncementMock>;
      const created: AnnouncementMock = {
        id: `ann-${announcements.length + 1}`,
        title: payload.title || 'New Alert',
        message: payload.message || 'Maintenance scheduled',
        severity: payload.severity || 'Warning',
        isActive: payload.isActive ?? true,
        startsAt: null,
        endsAt: null,
        createdBy: 'superadmin',
        createdAt: '2026-11-14T12:00:00Z',
      };
      announcements.unshift(created);
      return json({ success: true, data: created });
    }

    return json({ success: true, data: null });
  });
}

test('Super Admin Portal enforces token isolation and completes Dashboard, Tenants, Packages, Invoices & Announcements E2E', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await setupAdminMocks(page);

  // 1. Pre-seeding SME senic_token alone must NOT authenticate Admin Portal
  await page.addInitScript(() => {
    if (!localStorage.getItem('sa_token')) {
      localStorage.setItem('senic_token', 'sme-tenant-token-should-be-ignored');
    }
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Senic Super Admin Portal' })).toBeVisible();

  // 2. Super Admin Login -> Dashboard
  await page.locator('input[type="text"]').fill('superadmin');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'ภาพรวมระบบ (Platform Dashboard)' })).toBeVisible();
  await expect(page.getByText('42')).toBeVisible();
  await expect(page.getByText('฿ 19,500')).toBeVisible();

  // 3. Tenants List & Impersonation URL guard
  await page.getByRole('link', { name: 'ผู้ใช้บริการ (Tenants)' }).click();
  await expect(page.getByRole('heading', { name: 'ผู้ใช้บริการ (Tenants)' })).toBeVisible();
  await expect(page.getByText('4 / 10')).toBeVisible();

  await page.evaluate(() => {
    const win = window as Window & { __lastOpenedUrl?: string };
    window.open = (url?: string | URL) => {
      win.__lastOpenedUrl = String(url || '');
      return null;
    };
  });
  await page.getByRole('button', { name: 'เข้าดูในฐานะองค์กร' }).click();
  await expect(page.getByText(/สร้างลิงก์เข้าดู บจก\. สยามเทค โซลูชั่น สำเร็จ/)).toBeVisible();
  const openedUrl = await page.evaluate(() => (window as Window & { __lastOpenedUrl?: string }).__lastOpenedUrl);
  expect(openedUrl).toBe('https://app.senic.co.th/login#impersonate=impersonate-token-xyz');

  // 4. Packages List & Create Plan Modal
  await page.getByRole('link', { name: 'แพ็กเกจราคา (Packages)' }).click();
  await expect(page.getByRole('heading', { name: 'แพ็กเกจราคา (Subscription Plans)' })).toBeVisible();
  await expect(page.getByText('Pro Business')).toBeVisible();

  // 5. SaaS Billing Invoices & Manual Mark-Paid flow
  await page.getByRole('link', { name: 'บิลค่าบริการ SaaS' }).click();
  await expect(page.getByRole('heading', { name: 'บิลค่าบริการแพ็กเกจ (SaaS Billing Invoices)' })).toBeVisible();
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'ยืนยันชำระเงิน' }).click();
  await expect(page.getByText('ชำระแล้ว')).toBeVisible();

  // 6. Platform Announcements & Create Announcement flow
  await page.getByRole('link', { name: 'ประกาศส่วนกลาง' }).click();
  await expect(page.getByRole('heading', { name: 'ประกาศส่วนกลาง (Platform Announcements)' })).toBeVisible();
  await expect(page.getByText('อัปเดตระบบ Phase 14')).toBeVisible();

  await page.getByRole('button', { name: 'สร้างประกาศใหม่' }).click();
  await page.locator('form input[type="text"]').fill('แจ้งเปิดใช้งาน PromptPay เวอร์ชันใหม่');
  await page.locator('form textarea').fill('อัปเกรดการรับ Webhook สำเร็จแล้ว');
  await page.getByRole('button', { name: 'บันทึกประกาศ' }).click();
  await expect(page.getByText('แจ้งเปิดใช้งาน PromptPay เวอร์ชันใหม่')).toBeVisible();

  // 7. Toggle TH -> EN locale and verify English UI labels + Unlimited (-1) plan creation
  await page.getByTestId('admin-locale-toggle').click();
  await expect(page.getByRole('heading', { name: 'Platform Announcements' })).toBeVisible();

  await page.getByRole('link', { name: 'Pricing Plans (Packages)' }).click();
  await expect(page.getByRole('heading', { name: 'Subscription Plans' })).toBeVisible();
  await page.getByRole('button', { name: 'Add New Plan' }).click();
  await page.locator('form input[type="text"]').fill('Enterprise Unlimited');
  const numInputs = page.locator('form input[type="number"]');
  await numInputs.nth(2).fill('-1');
  await numInputs.nth(3).fill('-1');
  await page.getByRole('button', { name: 'Save Plan' }).click();
  await expect(page.getByText('Enterprise Unlimited')).toBeVisible();
  await expect(page.getByText('Unlimited').first()).toBeVisible();

  // 8. Provision New Tenant modal in Super Admin Tenants page
  await page.getByRole('link', { name: 'Organizations (Tenants)' }).click();
  await page.getByRole('button', { name: 'Add Tenant' }).click();
  await expect(page.getByRole('heading', { name: 'Provision New Tenant Organization' })).toBeVisible();
  const tenantInputs = page.locator('form input');
  await tenantInputs.nth(0).fill('Siam Provisioned Co.');
  await tenantInputs.nth(5).fill('siamadmin');
  await tenantInputs.nth(6).fill('Pass1234!');
  await page.getByRole('button', { name: 'Create Organization' }).click();
  await expect(page.getByText('Siam Provisioned Co.')).toBeVisible();

  expect(pageErrors).toEqual([]);
});
test('Admin Portal mobile viewport (390x844) provides slide-over sidebar drawer, zero horizontal overflow, and PWA offline assets', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.setViewportSize({ width: 390, height: 844 });
  await setupAdminMocks(page);

  await page.goto('/');
  await page.locator('input[type="text"]').fill('superadmin');
  await page.locator('input[type="password"]').fill('admin123');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ภาพรวมระบบ (Platform Dashboard)' })).toBeVisible();

  // Check zero page-level horizontal overflow on dashboard
  const dashOverflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dashOverflow.scrollWidth).toBeLessThanOrEqual(dashOverflow.clientWidth + 1);

  // Open mobile hamburger menu -> navigate to Tenants -> close drawer automatically
  const openMenuBtn = page.getByRole('button', { name: 'เปิดเมนูนำทาง' });
  await expect(openMenuBtn).toBeVisible();
  await openMenuBtn.click();

  const tenantsLink = page.getByRole('link', { name: 'ผู้ใช้บริการ (Tenants)' });
  await expect(tenantsLink).toBeVisible();
  await tenantsLink.click();
  await expect(page.getByRole('heading', { name: 'ผู้ใช้บริการ (Tenants)' })).toBeVisible();

  const tenantsOverflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(tenantsOverflow.scrollWidth).toBeLessThanOrEqual(tenantsOverflow.clientWidth + 1);

  // Verify admin PWA manifest and offline page
  const manifestRes = await page.request.get('/manifest.json');
  expect(manifestRes.ok()).toBe(true);
  const offlineRes = await page.request.get('/offline.html');
  expect(offlineRes.ok()).toBe(true);

  expect(pageErrors).toEqual([]);
});
