# แผนการพัฒนา Phase 16: Deep Bilingual Completion (Zero Hardcoded Thai UI), RBAC Privilege/Quota Hardening & Bundle Chunk Optimization

**สถานะ:** เสร็จสมบูรณ์ 100% (Verified)
**เป้าหมายหลัก:** เก็บตกข้อความภาษาไทยที่ยังฝังอยู่ใน Modal, Validation, Alert/Confirm, LINE Webhook, SaaS Subscription Card และ Mobile `data-label` ในหน้าจอหลัก (`ProductsPage`, `CustomersPage`, `DashboardPage`, `DocumentsListPage`, `SettingsPage`, `ProfilePage`, `DashboardLayout`) ให้ใช้ `useTranslation()` ครบ 100% พร้อมป้องกันช่องโหว่ยกระดับสิทธิ์ (`Role Privilege Escalation`) และการเปิดใช้งานบัญชีเกินโควต้า (`MaxUsers`) ใน Backend รวมถึงแยก Vendor/i18n Chunks ใน `vite.config.ts` ให้ขนาดทุก Chunk ต่ำกว่า 500 kB

---

## Sprint 16.1 — Backend RBAC Privilege Escalation Guards, Re-Activation Quota Check & Claim Unification
- [x] **Prevent Role Privilege Escalation (`AdminUsersController.cs`, `TenantUsersController.cs`, `AdminRolesController.cs`):** ห้ามผู้ดูแลระบบระดับองค์กรทั่วไป (`!User.IsPlatformAdmin()`) ตั้งค่าหรือแก้ไข Role เป็น `"SuperAdmin"` หรือ `"SystemAdmin"` และห้ามแก้ไข Permission ของ Role ระดับแพลตฟอร์ม
- [x] **Enforce `MaxUsers` Quota on Re-Activation (`AdminUsersController.cs`):** ตรวจสอบโควต้า `tenant.CurrentPlan.MaxUsers` ใน `ToggleUserStatus` เมื่อเปิดใช้งานผู้ใช้งานที่ถูกระงับ (`!user.IsActive && request.IsActive`) เพื่อป้องกันการหลบเลี่ยงโควต้า
- [x] **Unified Claim Resolution & Tenant Scope (`UserController.cs`, `AdminUsersController.cs`, `TenantUsersController.cs`, `AdminRolesController.cs`):** ใช้ `User.GetUserId()` และ `User.GetTenantId()` จาก `ClaimsPrincipalExtensions` และตรวจสอบ `u.TenantId == tenantId` ใน `UserController` ทุก endpoint
- [x] **Phase 16 Backend Test Suite (`Phase16SecurityRbacAndQuotaTests.cs`):** เพิ่มชุดทดสอบ xUnit ตรวจสอบการบล็อก Privilege Escalation, การบล็อก Re-activation เกินโควต้า `MaxUsers`, การแยกข้อมูลข้ามองค์กรใน `UserController` และการป้องกันการแก้ไข Role ระดับแพลตฟอร์มใน `AdminRolesController`

## Sprint 16.2 — Deep Bilingual Completion Part 1 (`ProductsPage`, `CustomersPage`, `DashboardPage`, `DocumentsListPage`)
- [x] **Expand `TH`/`EN` Dictionary (`resources.ts`):** เพิ่มคีย์แปลสำหรับข้อความตรวจสอบฟอร์ม (Validation), หัวตาราง Export Excel, Mobile `data-label`, สถานะจัดส่ง, ข้อความยืนยัน/แจ้งเตือน (`confirm`/`alert`/`prompt`), เวลาสัมพัทธ์ (`เมื่อวาน`, `นาทีที่แล้ว`, `ชั่วโมงที่แล้ว`) และชื่อย่อเดือนใน `DashboardPage`, `DocumentsListPage`, `CustomersPage`, `ProductsPage`
- [x] **Connect `t(...)` Across All 4 Core Pages:** แทนที่ข้อความภาษาไทยที่ฝังอยู่ใน `ProductsPage.tsx`, `CustomersPage.tsx`, `DashboardPage.tsx` และ `DocumentsListPage.tsx`

## Sprint 16.3 — Deep Bilingual Completion Part 2 (`SettingsPage`, `ProfilePage`, `DashboardLayout`) & Vite Vendor Chunk Splitting
- [x] **Settings, Profile & Layout Deep i18n (`SettingsPage.tsx`, `ProfilePage.tsx`, `DashboardLayout.tsx`):** แปลส่วนตั้งค่า LINE Messaging API / Webhook, การ์ดแพ็กเกจ SaaS & โควต้าการใช้งาน, สถานะรองรับ Web Push, ข้อความแจ้งเตือนใน `ProfilePage.tsx` และ `aria-label` แบนเนอร์ประกาศใน `DashboardLayout.tsx`
- [x] **Production Bundle Chunk Splitting (`frontend/vite.config.ts`):** ตั้งค่า `build.rollupOptions.output.manualChunks` แยก `i18n-resources`, `vendor-react`, `vendor-signalr`, `vendor-i18n`, `vendor-icons`, `vendor-xlsx`, `vendor-charts` เพื่อให้ทุก JS chunk มีขนาด `< 500 kB` โดยไม่มีคำเตือนตอน `npm run build`

## Sprint 16.4 — Automated Zero-Hardcoded-Thai Unit Gate (`phase16-unit.test.mjs`), E2E Expansion & Documentation Sync
- [x] **Phase 16 Frontend Unit & Parity Suite (`phase16-unit.test.mjs`):** ตรวจสอบความครบถ้วนของ key `th`/`en` 100%, ตรวจว่าไม่มีข้อความ UI ภาษาไทยตกค้างใน `ProductsPage`, `CustomersPage`, `DashboardPage`, `DocumentsListPage`, `SettingsPage`, `ProfilePage`, `DashboardLayout`, ตรวจ `manualChunks` ใน `vite.config.ts` และตรวจ RBAC/Quota guards ใน Backend
- [x] **Playwright E2E Expansion (`senic-e2e.spec.ts`):** เพิ่มการทดสอบสลับภาษา `TH`/`EN` บนหน้า `Products`, `Customers` และ `Settings`
- [x] **Documentation & Knowledge Sync:** อัปเดต `docs/แผนแม่บทโครงการ.md`, `.ai-agents/knowledge/codebase-index.md` และ `.ai-agents/knowledge/feedback/lessons-learned.md` พร้อมรันการตรวจสอบครบทุกโปรเจกต์
