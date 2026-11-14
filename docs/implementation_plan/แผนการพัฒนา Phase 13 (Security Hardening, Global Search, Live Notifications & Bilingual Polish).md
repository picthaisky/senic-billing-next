# แผนการพัฒนา Phase 13: Security & Tenant Boundary Hardening, Live Notifications, Global Search, Storage/AI Polish & Bilingual UX

เอกสารฉบับนี้กำหนดขอบเขต สถาปัตยกรรม และขั้นตอนการพัฒนา **Phase 13** แบ่งออกเป็น **4 Sprints** ตามลำดับ เพื่อปิดช่องโหว่การแยกสิทธิ์ข้ามองค์กร แก้จุดที่ยังใช้ Mock/ยังไม่สมบูรณ์ในโค้ดจริง และยกระดับประสบการณ์ใช้งานสองภาษาครบทั้งแพลตฟอร์ม

---

## Sprint 13.1 — Security & Multi-Tenant Privilege Boundary Hardening
- [x] สร้าง `ClaimsPrincipalExtensions.cs` (`GetTenantId`, `TryGetUserId`, `GetUserId`, `GetUsername`, `IsPlatformAdmin`) และเพิ่ม claim `"id"` + `"username"` ใน `JwtTokenService.cs` ให้ทุก Controller/SignalR Hub อ่าน User Identity ได้ตรงกัน
- [x] กำหนด Authorization Policy `"PlatformAdmin"` ใน `Program.cs` (อนุญาตเฉพาะ `SuperAdmin`/`SystemAdmin` หรือ Platform Owner Tenant `00000000-0000-0000-0000-000000000001` ที่เป็น `Admin`) และใช้กับ `SaTenantsController`, `SaPlansController`, `SaBillingController`, `SaAnnouncementsController` เพื่อป้องกัน `Admin` ขององค์กรอื่นเข้าถึง Super Admin API
- [x] เพิ่ม `SuperAdmin` ใน `PermissionAuthorizationHandler` และ `[Authorize(Roles = "Admin,SystemAdmin,SuperAdmin")]` ใน `AccountingController`, `AdminRolesController`, `AdminUsersController`, `TenantsController`, `TenantUsersController`, และ `AuthController.Register`
- [x] แก้ช่องโหว่ IDOR ใน `AttachmentsController.cs` (บังคับ `TenantId` check ทั้ง Upload/Download + ตรวจขนาด <= 10 MB และ Allowlist นามสกุลไฟล์ปลอดภัย) และแก้ `TryGetUserId()` ใน `NotificationsController.cs` & `SenicBillingHub.cs`
- [x] ปิดช่องโหว่ใน `AuthController` (`DemoLogin` จำกัดเฉพาะ Platform Owner Demo Tenant + ตรวจสถานะ `Suspended`, `Register` ตรวจโควต้า `MaxUsers`, เพิ่ม `IsPlatformAdmin` ใน `UserInfo` / `/api/auth/me`) และปรับ `admin-frontend/src/App.tsx` ให้ตรวจสอบสิทธิ์ผ่าน `/api/auth/me` โดยไม่ดึง `senic_token` ของ SME Tenant มาใช้ข้ามสิทธิ์

## Sprint 13.2 — Live Notification Center & Global `⌘K` Command Search
- [x] สร้าง `SearchController.cs` (`GET /api/search?q=...`) ค้นหาข้ามโมดูล (เอกสาร, ลูกค้า, สินค้า, ค่าใช้จ่าย, ใบสั่งซื้อ) แบบแยกตาม `TenantId` อย่างเคร่งครัด
- [x] เพิ่ม `GET /api/notifications/feed` ใน `NotificationsController.cs` ดึงรายการแจ้งเตือนจริงจากฐานข้อมูล (บิลเกินกำหนด/ใกล้ครบกำหนด, คำขออนุมัติ/ปฏิเสธจากลูกค้า, รายการชำระเงินล่าสุด, สินค้าต่ำกว่าจุดสั่งซื้อ) และ Broadcast Event `"NotificationReceived"` ผ่าน `SenicBillingHub` ใน `SharedDocumentController` & `PaymentsController`
- [x] ปรับ `frontend/src/components/layout/Header.tsx` และ `signalrClient.ts` ถอด `initialNotifications` ที่เป็น Mock ออกทั้งหมด เชื่อม `/notifications/feed` + SignalR + บันทึกสถานะอ่านแล้ว/ซ่อนใน `localStorage` พร้อมทำ Desktop/Mobile Global Search Dropdown (`⌘K`, คีย์บอร์ด `ArrowUp`/`ArrowDown`/`Enter`/`Escape`)

## Sprint 13.3 — AI Context Accuracy, Tenant Logo Upload & Super Admin Billing Operations
- [x] แก้สูตรรายได้เดือนปัจจุบันใน `AIAssistantController.cs` ให้สอดคล้องกับ `DashboardController` (ไม่นับ `Draft`/`Cancelled`/`Quotation`/`DeliveryNote` และหัก `CreditNote`) พร้อมเพิ่มบริบทภาษีซื้อ ภาษีขาย WHT และสินค้าใกล้หมด
- [x] เพิ่ม `POST /api/tenants/logo` และ `GET /api/tenants/logo/{tenantId}/{fileName}` (`[AllowAnonymous]`) ใน `TenantsController.cs` (ตรวจสอบ `.png/.jpg/.jpeg/.webp` <= 5 MB, อัปโหลดผ่าน `IStorageService` พร้อม local `App_Data` fallback) และเพิ่มปุ่มอัปโหลดโลโก้ + Preview ใน `SettingsPage.tsx`
- [x] เพิ่ม `POST /api/superadmin/billing/invoices/{id}/mark-paid` ใน `SaBillingController.cs` (พร้อมบันทึก `AuditLog` และปลดล็อก/เปิดใช้งานองค์กร) และเพิ่มปุ่ม "ยืนยันชำระเงิน" + สรุปยอดใน `admin-frontend/src/pages/BillingInvoices.tsx`

## Sprint 13.4 — Full Bilingual (`TH`/`EN`) Shell, Route Cleanup, Automated QA & Docs
- [x] เติมคีย์แปลภาษา `th`/`en` ใน `frontend/src/i18n/resources.ts` ให้ครบทุกเมนู Phase 9–13 และเปลี่ยนข้อความที่ Hardcode ใน `Sidebar.tsx`, `BottomNav.tsx`, `FloatingActionButton.tsx`, `DashboardLayout.tsx`, `App.tsx`, และ `Header.tsx` ให้ใช้ `t(...)` ทั้งหมด
- [x] รวมศูนย์ route `/staff` ใน `frontend/src/App.tsx` ให้ Redirect ไปยัง `/users` อย่างเป็นมาตรฐานเดียวกัน
- [x] เพิ่มชุดทดสอบอัตโนมัติใน `backend/tests/SenicBilling.Tests/Phase13SecuritySearchAndOperationsTests.cs`, `frontend/scripts/phase13-unit.test.mjs`, และขยาย `frontend/e2e/senic-e2e.spec.ts` (Playwright Chromium E2E ทดสอบ Live Notifications, Global `⌘K` Search, และ Bilingual `TH`/`EN` toggle) รวมถึงอัปเดต `แผนแม่บทโครงการ.md` และ `.ai-agents/knowledge/`
