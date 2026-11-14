# แผนการพัฒนา Phase 15: 100% App-Wide Bilingual Parity, Omise Payment Callback, Object-Storage PDF Logo & Production Infra Parity

**สถานะ:** เสร็จสมบูรณ์ (Verified 100%)
**เป้าหมายหลัก:** ปิดช่องว่างที่เหลือทั้งหมดทั้งระบบให้พร้อมขึ้น Production เต็มรูปแบบ 100% ได้แก่ การรับ Payment Callback จาก Omise บน Frontend, การโหลดโลโก้จาก Object Storage (`MinIO`) ใน `QuestPdfService`, การป้องกันไฟล์ภาพปลอมด้วย Magic-Byte Signature, ความสอดคล้องของ Docker/Production Environment & JWT Config และการแปลภาษา `TH`/`EN` ครบทั้ง 100% ของทุกหน้าจอใน SME Frontend Portal (`frontend`)

---

## Sprint 15.1 — Payment Callback API, Object-Storage PDF Logo, Security & Docker/Env Parity
- [x] **Omise Callback Status & Webhook Safety (`PaymentsController.cs`):** เพิ่ม `[HttpGet("callback-status")]` (AllowAnonymous) สำหรับตรวจสถานะเอกสาร/การชำระเงินจาก `/payments/callback` และป้องกัน exception ใน `OmiseWebhook` ด้วย `TryGetProperty`
- [x] **Object-Storage Logo in QuestPDF (`QuestPdfService.cs`):** เพิ่ม `[ActivatorUtilitiesConstructor]` พร้อม `IStorageService? storageService = null` เพื่อดึงโลโก้จาก MinIO bucket `"senic-billing-logos"` (`tenants/{tenantId}/{safeFileName}`) เป็น fallback เมื่อไฟล์ไม่ได้อยู่บน `App_Data` ท้องถิ่น
- [x] **Magic-Byte Logo Signature Guard (`TenantsController.cs`):** ตรวจสอบหัวไฟล์ภาพจริง (PNG/JPEG/WEBP) ตอน `UploadLogo` (`HasSupportedLogoHeader`) ป้องกันไฟล์ปลอมนามสกุล
- [x] **Impersonation Redirect URL (`Phase12Dtos.cs`, `SaTenantsController.cs`, `TenantsList.tsx`):** คืนค่า `FrontendUrl` จาก `App:FrontendBaseUrl` ในผลลัพธ์ `ImpersonateTenant` เพื่อให้ Admin Portal เปิด URL องค์กรที่ถูกต้องใน Production
- [x] **Docker, Production Config & JWT Parity:** จัดแนว `appsettings.json` (`JwtSettings`, `Omise`, `Minio`, `App`), `appsettings.Production.json` (`JwtSettings`, `Omise`, `Minio`, `App`), `docker-compose.yml` (`senic-app-data:/app/App_Data`, `Minio__BucketName`, `App__FrontendBaseUrl`, `App__AdminBaseUrl`), `stack.env` (`APP_FRONTEND_BASE_URL`, `APP_ADMIN_BASE_URL`) และ `frontend/nginx.conf` / `admin-frontend/nginx.conf` (`client_max_body_size 15M`)
- [x] **Phase 15 Backend Test Suite:** สร้าง `Phase15ProductionAndPaymentTests.cs` ทดสอบ callback status, malformed webhook, QuestPDF กับ `IStorageService` mock, magic-byte upload guard และ `ImpersonateTenant` `FrontendUrl`

## Sprint 15.2 — Payment Callback Route, Document Authoring, Print & Share/Pay Bilingual (`TH`/`EN`)
- [x] **Payment Callback Route & Page:** สร้าง `frontend/src/pages/PaymentCallbackPage.tsx` และลงทะเบียน route `/payments/callback` ใน `frontend/src/App.tsx`
- [x] **Document Authoring, Print & Payment i18n Dictionary:** เพิ่มคีย์ `TH`/`EN` ใน `frontend/src/i18n/resources.ts` (`a4Template`, `attachmentUpload`, `customerSelect`, `shareModal`, `historyModal`, `paymentModal`, `printView`, `invoiceForm`, `paymentCallback`)
- [x] **Connect `useTranslation()` Across Authoring & Print Components:** เชื่อม `useTranslation()` ใน `InvoiceForm.tsx`, `A4DocumentTemplate.tsx`, `AttachmentUpload.tsx`, `CustomerSelectModal.tsx`, `DocumentPrintView.tsx`, `ShareDocumentModal.tsx`, `DocumentHistoryModal.tsx` และ `PaymentModal.tsx`

## Sprint 15.3 — Enterprise Operations, Users, Audit & Settings Subcomponents Bilingual (`TH`/`EN`)
- [x] **Enterprise & Admin i18n Dictionary:** เพิ่มคีย์ `TH`/`EN` ใน `frontend/src/i18n/resources.ts` (`expenses`, `purchasing`, `warehouses`, `accounting`, `bankReconciliation`, `usersPage`, `auditLogs`, `recurring`, `backup`)
- [x] **Connect `useTranslation()` Across All 10 Remaining Screens:** เชื่อม `useTranslation()` ใน `ExpensesPage.tsx`, `PurchaseOrdersPage.tsx`, `WarehousesPage.tsx`, `AccountingPage.tsx`, `BankReconciliationPage.tsx`, `UsersManagementPage.tsx`, `UserFormModal.tsx`, `AuditLogsPage.tsx`, `RecurringInvoicesConfig.tsx` และ `TenantBackupCard.tsx` พร้อมลบไฟล์ค้างเก่า `StaffManagementPage.tsx`

## Sprint 15.4 — 100% Bilingual Verification, Playwright E2E, CI/CD & Documentation Sync
- [x] **Phase 15 Frontend Unit & Parity Suite (`phase15-unit.test.mjs`):** ตรวจสอบความครบถ้วนของ key `th`/`en` 100%, ตรวจว่าทุกหน้าจอ/คอมโพเนนต์ใน `frontend/src` (ยกเว้น `main.tsx`) ใช้ `useTranslation`, ตรวจ `/payments/callback`, การลบ `StaffManagementPage.tsx`, `appsettings*.json` และ `docker-compose.yml` volume/env parity
- [x] **Playwright E2E Expansion (`senic-e2e.spec.ts` & `admin-e2e.spec.ts`):** เพิ่มการทดสอบสลับภาษา `TH`/`EN` บนหน้า `Dashboard`, `DocumentsList`, `AuditLogs`, `Accounting`, `Expenses`, `InvoiceForm` การทดสอบหน้า `/payments/callback` และตรวจ `frontendUrl` Impersonation ใน Admin Portal E2E
- [x] **Admin Unit Test & Docs Sync:** อัปเดต `admin-frontend/scripts/admin-unit.test.mjs`, `docs/แผนแม่บทโครงการ.md` และ `.ai-agents/knowledge/` พร้อมรันการตรวจสอบครบทุกโปรเจกต์
