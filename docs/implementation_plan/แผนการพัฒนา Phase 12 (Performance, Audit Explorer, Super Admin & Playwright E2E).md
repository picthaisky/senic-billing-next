# แผนการพัฒนา Phase 12: Enterprise Performance, Audit Log Explorer, Super Admin Operations & Playwright E2E

เอกสารฉบับนี้กำหนดขอบเขต สถาปัตยกรรม และขั้นตอนการพัฒนา **Phase 12** แบ่งออกเป็น **4 Sprints** ตามลำดับ เพื่อยกระดับประสิทธิภาพ Build & Bundle, ปิดช่องโหว่ความปลอดภัย SaaS Tenant Suspension & Timezone, เปิดระบบ Audit Log Explorer, ยกระดับ Super Admin Platform Operations และสร้างชุดทดสอบ Browser E2E อัตโนมัติด้วย Playwright

---

## Sprint 12.1 — Performance Optimization, Date/CSS Hardening & SaaS Suspension Guard
- [x] ทำ Route-based Code Splitting (`React.lazy` + `Suspense`) ใน `frontend/src/App.tsx` เพื่อลดขนาด JS Bundle หลักจาก `1,454.31 kB` เหลือ `445.94 kB` (ไม่มีคำเตือนขนาด chunk เกิน 500 kB)
- [x] แก้ลำดับ `@import url(...)` ให้อยู่ก่อน `@import "tailwindcss";` ใน `admin-frontend/src/index.css` และอัปเดต `admin-frontend/index.html` ให้ใช้ `lang="th"` และชื่อระบบที่ถูกต้อง (`0 CSS warnings`)
- [x] สร้าง `frontend/src/utils/dateUtils.ts` (`getLocalIsoDate`) และแก้ `todayIsoDate()` ใน `frontend/src/components/forms/InvoiceForm.tsx` ให้ใช้วันที่ตามเวลาท้องถิ่น (`Asia/Bangkok`) แทน UTC
- [x] เพิ่มการตรวจสอบสถานะองค์กรถูกระงับ (`!Tenant.IsActive || SubscriptionStatus == "Suspended"`) ใน `AuthController.Login` (`backend/src/SenicBilling.API/Controllers/AuthController.cs`) โดยยกเว้น `SystemAdmin` / `SuperAdmin`

## Sprint 12.2 — Audit Log Explorer (Backend API + SME Admin UI)
- [x] สร้าง `AuditLogsController.cs` (`GET /api/audit-logs`, `GET /api/audit-logs/filters`, `GET /api/audit-logs/export` Excel ผ่าน ClosedXML) จำกัดสิทธิ์เฉพาะ `Admin,SystemAdmin,SuperAdmin` และกรอง `TenantId` อย่างเคร่งครัด
- [x] สร้างหน้า `frontend/src/components/users/AuditLogsPage.tsx` พร้อม Summary KPI Cards, ตัวกรองคำค้น/เอนทิตี/การกระทำ/ช่วงวันที่, ปุ่ม Export Excel และ Diff Modal แสดง `OldValues` vs `NewValues`
- [x] เพิ่ม Route `/audit-logs` ใน `frontend/src/App.tsx` และเพิ่มเมนูสำหรับผู้ดูแลระบบใน `Sidebar.tsx` และ `BottomNav.tsx`

## Sprint 12.3 — Super Admin Platform Operations & Global Announcements
- [x] เพิ่มเอนทิตี `PlatformAnnouncement` ใน `SenicBilling.Domain`, DbSet ใน `SenicBillingDbContext` และสร้าง EF Core Migration `20261114015115_AddPhase12PlatformAnnouncements`
- [x] เพิ่ม `SaAnnouncementsController.cs` (CRUD ประกาศระบบสำหรับ Super Admin) และ `AnnouncementsController.cs` (`GET /api/announcements/active` สำหรับ SME Tenant)
- [x] ขยาย `SaTenantsController.cs` ให้คืนค่าสถิติการใช้งานจริง (`UserCount`, `MaxUsers`, `DocumentsCreatedThisMonth`, `MaxDocumentsPerMonth`) และเพิ่ม `POST /api/superadmin/tenants/{id}/impersonate` (ออก Scoped Token พร้อมบันทึก `AuditLog`)
- [x] เพิ่มแบนเนอร์ประกาศจากระบบใน `frontend/src/components/layout/DashboardLayout.tsx`, รองรับ `#impersonate=` บน `LoginPage.tsx` (ยืนยันผ่าน `GET /api/auth/me` บนเซิร์ฟเวอร์)
- [x] อัปเกรด `admin-frontend`: แสดง Usage Quota Bars & ปุ่ม Impersonate ใน `TenantsList.tsx`, เพิ่มหน้า `BillingInvoices.tsx` (`/invoices` เชื่อม `/api/superadmin/billing/invoices`), และหน้า `AnnouncementsPage.tsx` (`/announcements`) พร้อมอัปเดต CORS ใน `Program.cs` สำหรับ `:4173` Preview/E2E

## Sprint 12.4 — Automated Tests, Real-Browser Playwright E2E, CI/CD & Knowledge Update
- [x] เพิ่ม `Phase12EnterpriseOperationsTests.cs` ใน `SenicBilling.Tests` ทดสอบ Tenant Suspension Login Block, Audit Log Tenant Isolation + Filtering + Excel Export, Tenant Usage Stats + Impersonation Audit Log, และ Platform Announcements Window (`30/30` tests passed)
- [x] สร้าง `frontend/playwright.config.ts` และ `frontend/e2e/senic-e2e.spec.ts` ทดสอบ Browser จริง (Chromium headless) ครบ Flow: Login + Announcement Banner + Dashboard Top Spenders -> Create Tax Invoice (Local Date/DueDate) -> Audit Log Explorer & Diff Modal -> Lazy Routes Navigation
- [x] เพิ่มสคริปต์ `test:e2e` ใน `frontend/package.json` และเพิ่มขั้นตอน Playwright E2E ใน `.github/workflows/ci-cd.yml` (`quality-checks`)
- [x] อัปเดต `docs/แผนแม่บทโครงการ.md`, `.ai-agents/knowledge/codebase-index.md`, และ `.ai-agents/knowledge/feedback/lessons-learned.md` พร้อมตรวจสอบ Build/Lint/Tests/Migration Cleanliness 100%
