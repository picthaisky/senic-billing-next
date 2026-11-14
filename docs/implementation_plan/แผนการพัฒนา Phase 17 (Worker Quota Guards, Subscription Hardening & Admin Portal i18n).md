# แผนการพัฒนา Phase 17: Background Worker SaaS Quota & Suspension Guards, Subscription Checkout/Webhook Hardening & Super Admin Portal Bilingual (`TH`/`EN`) Parity

**สถานะ:** ดำเนินการเสร็จสมบูรณ์ 100% (Verified)
**เป้าหมายหลัก:** ป้องกัน Background Workers (`RecurringInvoiceWorker`, `OverdueMonitorWorker`) ไม่ให้ออกเอกสารอัตโนมัติเกินโควต้าแพ็กเกจรายเดือน (`MaxDocumentsPerMonth`) หรือส่งแจ้งเตือนในองค์กรที่ถูกระงับ (`Suspended`), ยกระดับความปลอดภัยของ `TenantSubscriptionController` (`Checkout` & `OmiseWebhook`), `TenantsController.UpdateProfile` และ `SaPlansController` พร้อมเพิ่มระบบสองภาษา (`TH`/`EN`) เต็มรูปแบบบน Super Admin Portal (`admin-frontend`) และรองรับการตั้งค่าโควต้าไม่จำกัด (`-1`) ในหน้าจัดการแพ็กเกจ

---

## Sprint 17.1 — Background Worker Suspension & Monthly Document Quota Guards (`RecurringInvoiceWorker.cs`, `OverdueMonitorWorker.cs`)
- [x] **Enforce Tenant Active Status & `MaxDocumentsPerMonth` Quota in `RecurringInvoiceWorker`:** ข้ามการสร้างเอกสารซ้ำอัตโนมัติหากองค์กรถูกระงับ (`!tenant.IsActive || tenant.SubscriptionStatus == "Suspended"`), เอกสารต้นฉบับถูกยกเลิก (`SourceDocument.Status == Cancelled`), หรือจำนวนเอกสารที่ออกในเดือนปัจจุบันถึงเพดาน `tenant.CurrentPlan.MaxDocumentsPerMonth` แล้ว (`MaxDocumentsPerMonth > 0`)
- [x] **Skip Suspended/Inactive Tenants in `OverdueMonitorWorker`:** ป้องกันไม่ให้ส่งอีเมลและ LINE แจ้งเตือนทวงหนี้สำหรับเอกสารขององค์กรที่ถูกระงับการใช้งาน

## Sprint 17.2 — Subscription Checkout/Webhook & Tenant Profile RBAC/Audit Hardening (`TenantSubscriptionController.cs`, `TenantsController.cs`, `SaPlansController.cs`)
- [x] **Harden `TenantSubscriptionController.Checkout`:** จำกัดสิทธิ์เฉพาะ `Admin,SystemAdmin,SuperAdmin`, บล็อกแพ็กเกจที่ปิดใช้งาน (`!plan.IsActive`), ป้องกันการเปลี่ยนแพ็กเกจที่มี `MaxUsers > 0` ตำ่กว่าจำนวนผู้ใช้งานที่เปิดอยู่ในปัจจุบัน (`activeUsersCount > plan.MaxUsers`) และบันทึก `AuditLog` (`Action = "CheckoutSubscriptionPlan"`)
- [x] **Safe & Functional `TenantSubscriptionController.OmiseWebhook`:** ใช้ `TryGetProperty` ป้องกัน `KeyNotFoundException` เมื่อได้รับ payload ไม่สมบูรณ์ และเมื่อได้รับ `charge.complete` (`status == "successful"`) ที่ระบุ `tenantId` ใน `description` หรือ `metadata.tenantId` ให้ต่ออายุ `SubscriptionValidUntil` และ `TenantSubscription.EndDate` ออกไป 1 เดือนพร้อมบันทึก `AuditLog`
- [x] **RBAC & Audit Logging on `TenantsController` & `SaPlansController`:** จำกัดสิทธิ์ `TenantsController.UpdateProfile` และ `TestLineNotify` เฉพาะ `Admin,SystemAdmin,SuperAdmin` พร้อมบันทึก `AuditLog` (`UpdateTenantProfile`, `CreateSubscriptionPlan`, `UpdateSubscriptionPlan`)
- [x] **Phase 17 Backend Test Suite (`Phase17WorkerQuotaAndSubscriptionTests.cs`):** เพิ่มชุดทดสอบ xUnit ทดสอบโควต้าและการระงับองค์กรใน `RecurringInvoiceWorker` / `OverdueMonitorWorker`, การป้องกัน Downgrade เกิน `MaxUsers` และ Inactive Plan ใน `Checkout`, การต่ออายุผ่าน `OmiseWebhook` และการจำกัดสิทธิ์ใน `TenantsController` (รวม 59/59 xUnit tests ผ่านทั้งหมด)

## Sprint 17.3 — Super Admin Portal (`admin-frontend`) Bilingual (`TH`/`EN`) Support & Unlimited (`-1`) Plan Input Fix
- [x] **Fix Unlimited (`-1`) Plan Quota Input (`PackagesList.tsx`):** ปรับ `min={-1}` บนช่อง `maxUsers` และ `maxDocumentsPerMonth` เพื่อให้สามารถแก้ไขแพ็กเกจแบบไม่จำกัด (`-1`) ได้โดยไม่ติด HTML5 validation
- [x] **Super Admin Bilingual (`TH`/`EN`) Context & UI (`AdminLocaleContext.tsx`, `App.tsx`, `Sidebar.tsx`, `Dashboard.tsx`, `TenantsList.tsx`, `PackagesList.tsx`, `BillingInvoices.tsx`, `AnnouncementsPage.tsx`):** สร้างระบบสลับภาษา `TH`/`EN` ใน `admin-frontend` พร้อมปุ่มสลับภาษาใน Sidebar และแปลข้อความทุกหน้าจอครบ 100%

## Sprint 17.4 — Automated Unit Gates, Admin E2E Expansion & Documentation Sync
- [x] **Phase 17 Unit & Parity Suites (`phase17-unit.test.mjs`, `admin-unit.test.mjs`):** เพิ่มการตรวจสอบอัตโนมัติสำหรับ Backend Worker/Subscription guards และความครบถ้วนของระบบสองภาษาใน `admin-frontend` (25/25 Frontend unit tests และ 4/4 Admin unit tests ผ่านทั้งหมด)
- [x] **Expand Super Admin Playwright E2E (`admin-e2e.spec.ts`):** เพิ่มการทดสอบสลับภาษา `TH` ↔ `EN` และการสร้างแพ็กเกจ Unlimited (`-1`) ใน `admin-e2e.spec.ts`
- [x] **Documentation & Knowledge Sync:** อัปเดต `docs/แผนแม่บทโครงการ.md` (Section 12), `.ai-agents/knowledge/domain-rules.md`, `.ai-agents/knowledge/codebase-index.md` และ `.ai-agents/knowledge/feedback/lessons-learned.md`
