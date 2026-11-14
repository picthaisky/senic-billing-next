# แผนการพัฒนา Phase 14: Production PDF/Logo, Configurable Base URL, Inner-Page Bilingual i18n & Admin Portal QA

**สถานะ:** เสร็จสมบูรณ์ (100%)
**เป้าหมายหลัก:** ปิดช่องโหว่ระดับ Production ที่พบจากการตรวจสอบโค้ดจริงนอกเหนือ Phase 1–13 ได้แก่ บั๊ก PDF เอกสารสาธารณะ, การฝังโลโก้บริษัทจริงใน PDF, URL Frontend แบบตั้งค่าได้แทน Hardcode `localhost`, รหัส e-Tax ตามประเภทเอกสาร, ความสามารถในการทดสอบ Background Workers, การแปลภาษา `TH`/`EN` ในหน้าหลักภายในแอป และชุดทดสอบ Unit + Playwright E2E สำหรับ Super Admin Portal (`admin-frontend`)

---

## Sprint 14.1 — Production PDF/Logo Rendering & Configurable Base URL Hardening
- [x] **Configurable Frontend Base URL & CORS:** เพิ่ม section `App` (`FrontendBaseUrl`, `AdminBaseUrl`, `CorsOrigins`) ใน `backend/src/SenicBilling.API/appsettings.json` และอัปเดต `Program.cs` ให้ผสาน CORS origins จาก config ร่วมกับ dev origins
- [x] **Fix Public Share PDF Crash & Link Config:** เพิ่ม `.Include(d => d.Tenant)` ใน `SharedDocumentController.DownloadPdf` เพื่อแก้ `NullReferenceException` และเปลี่ยนลิงก์ชำระเงิน fallback จาก `http://localhost:5173/...` เป็นค่าจาก `App:FrontendBaseUrl`
- [x] **Worker & Payment Base URL Config:** อัปเดต `OverdueMonitorWorker.cs` และ `OmisePaymentService.cs` ให้ใช้ `App:FrontendBaseUrl` แทน hardcoded `http://localhost:5173`
- [x] **QuestPDF Hardening & Real Tenant Logo:** อัปเดต `QuestPdfService.cs` ให้รองรับ `CreditNote` ("ใบลดหนี้") และ `DebitNote` ("ใบเพิ่มหนี้"), ป้องกัน `document.Tenant == null`, แสดงข้อมูลผู้ขาย (เลขผู้เสียภาษี/สาขา/ที่อยู่/เบอร์โทร) และโหลดรูปโลโก้จริงจาก `App_Data/logos/{tenantId}/{fileName}` หรือ Storage service เมื่อ `LogoUrl` ชี้มาที่ `/api/tenants/logo/...` โดยไม่ล่มหากไม่พบไฟล์
- [x] **e-Tax TypeCode Mapping:** อัปเดต `ETaxXmlGenerator.cs` ให้ map `DocumentType` เป็น `TypeCode` มาตรฐาน ETDA (`TaxInvoice` -> `"388"`, `CreditNote` -> `"381"`, `DebitNote` -> `"383"`, `Receipt`/`CashBill` -> `"380"`) พร้อมข้อมูลผู้ขายและ null-safety

## Sprint 14.2 — Background Worker Testability, QuestPDF & e-Tax Automated Tests
- [x] **Testable Worker Entrypoints:** แยก public method `RunOverdueCheckAsync(CancellationToken)` ใน `OverdueMonitorWorker.cs` และ `ProcessDueRecurringInvoicesAsync(CancellationToken)` ใน `RecurringInvoiceWorker.cs` โดยให้ `ExecuteAsync` เรียกใช้งานเมธอดดังกล่าว
- [x] **Phase 14 Backend Test Suite:** สร้าง `backend/tests/SenicBilling.Tests/Phase14ProductionHardeningTests.cs` ครอบคลุม:
  - `SharedDocumentController.DownloadPdf` (โหลด PDF จากแชร์ลิงก์สาธารณะพร้อม `Tenant` และตรวจสอบ header `%PDF-`)
  - `QuestPdfService` สำหรับ `CreditNote`, `DebitNote`, เคส `Tenant == null`, และการฝังรูป PNG โลโก้จริงจากดิสก์
  - `ETaxXmlGenerator` ตรวจสอบ `TypeCode` (`388`/`381`/`383`) และ seller metadata
  - `OverdueMonitorWorker.RunOverdueCheckAsync` (ตรวจสอบ `App:FrontendBaseUrl` ในอีเมล, status overdue, LINE/Email และ cooldown)
  - `RecurringInvoiceWorker.ProcessDueRecurringInvoicesAsync` (สร้างเอกสารลูก, คัดลอกรายการ, อัปเดต `NextRunDate`, `OccurrencesCreated` และเคารพ `MaxOccurrences`)
  - `OmisePaymentService` ใช้ `App:FrontendBaseUrl` เมื่อไม่มี key/fallback

## Sprint 14.3 — Core Inner-Page Bilingual (`TH`/`EN`) Coverage
- [x] **Extended i18n Dictionary:** ขยาย `frontend/src/i18n/resources.ts` (`th`/`en` parity ครบทุกคีย์) สำหรับหน้าหลักภายในแอป (`auth`, `status`, `aiChat`, `dashboard`, `documentsList`, `customers`, `products`, `profile`, `settings`) โดยคงข้อความภาษาไทยเดิมทั้งหมดเพื่อความต่อเนื่องและไม่กระทบการทดสอบเดิม
- [x] **Connect Core Pages & Components:** เชื่อม `useTranslation()` ใน `LoginPage.tsx`, `SystemStatusBadge.tsx`, `FloatingAIChat.tsx`, `DashboardPage.tsx`, `DocumentsListPage.tsx`, `CustomersPage.tsx`, `ProductsPage.tsx`, `ProfilePage.tsx` และส่วนหลักของ `SettingsPage.tsx` ให้สลับภาษา `TH`/`EN` ได้จริงและผ่าน ESLint React Compiler rules

## Sprint 14.4 — Admin Portal Unit & Playwright E2E, Bilingual E2E & Documentation
- [x] **Frontend Bilingual E2E & Parity Test:** เพิ่ม unit test ตรวจสอบความครบถ้วนของ key `th`/`en` (`frontend/scripts/phase14-unit.test.mjs`) และขยาย `frontend/e2e/senic-e2e.spec.ts` ทดสอบการสลับภาษา `TH`/`EN` บนหน้า `Dashboard` และ `Documents`
- [x] **Admin Portal Test Suite:** สร้าง `admin-frontend/scripts/admin-unit.test.mjs`, `admin-frontend/playwright.config.ts` และ `admin-frontend/e2e/admin-e2e.spec.ts` ทดสอบ Super Admin login, `/auth/me` guard, `TenantsList`, `PackagesList`, `BillingInvoices` (`ยืนยันชำระเงิน` `mark-paid`), และ `AnnouncementsPage` โดยใช้ Chromium ที่มีอยู่แล้ว
- [x] **CI/CD & Documentation Sync:** อัปเดต `admin-frontend/package.json` (`test`, `test:e2e`), `.github/workflows/ci-cd.yml` (เพิ่ม `admin-frontend` checks), `docs/แผนแม่บทโครงการ.md` และ `.ai-agents/knowledge/` (`codebase-index.md`, `lessons-learned.md`) พร้อมรัน full build/lint/unit/E2E verification ครบทุกส่วน
