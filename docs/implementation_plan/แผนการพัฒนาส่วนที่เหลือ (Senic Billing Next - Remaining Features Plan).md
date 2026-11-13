# แผนการพัฒนาส่วนที่เหลือฉบับสมบูรณ์ (Senic Billing Next — Master Remaining Features Plan)

> **อัปเดตล่าสุด:** 13 พฤศจิกายน 2026  
> **สถานะปัจจุบัน:** ✅ **ดำเนินการพัฒนาครบถ้วน 100% ทั้ง 4 Sprints เรียบร้อยแล้ว** (ผ่านการ Build และ Automated Unit Tests ครบทุกส่วน: `backend`, `frontend`, `admin-frontend`, และ `SenicBilling.Tests`)

---

## 🤖 ทีมผู้เชี่ยวชาญ AI (AI Specialists) ที่จัดตั้งเพิ่มเติมสำหรับแผนนี้

เพื่อให้การพัฒนาส่วนที่เหลือมีความแม่นยำสูงสุด ระบบได้เพิ่มผู้เชี่ยวชาญเฉพาะทางอีก **4 บทบาท** (พร้อม Playbooks ใน `.ai-agents/skills/` และ Skills ใน `.github/skills/`):

1. ✅ **`senic-inventory-pos-specialist` (Inventory, Stock & Barcode POS Specialist)**  
   ดูแลการแยก SKU/Barcode, การบันทึกจำนวนสต็อก, การตัดสต็อกอัตโนมัติ (`CashBill`, `DeliveryNote`, `TaxInvoice`), และการคืนสต็อก (`Restock`) เมื่อแก้ไข/ยกเลิกเอกสาร
2. ✅ **`senic-etax-report-specialist` (Thai Tax Compliance, e-Tax XML & Reporting Specialist)**  
   ดูแลความถูกต้องตามหลักกรมสรรพากร, ไฟล์ e-Tax Invoice XML (ETDA), ภาษีหัก ณ ที่จ่าย (WHT), รายงานภาษีขาย Excel (`ClosedXML`), และความตรงกันของ DTO ในหน้า Dashboard Analytics
3. ✅ **`senic-saas-portal-specialist` (SaaS Multi-Tenant Subscription, Quota & Super Admin Specialist)**  
   ดูแลระบบแพ็กเกจ (`SubscriptionPlan`), การจำกัดโควต้า (`MaxUsers`, `MaxDocumentsPerMonth`, `TenantUsageStat`), ความปลอดภัยของ `/api/superadmin/*`, และระบบ `admin-frontend`
4. ✅ **`senic-ai-automation-specialist` (AI Assistant, Background Workers & Notification Specialist)**  
   ดูแล `GeminiAIAssistantService`, Background Jobs (`RecurringInvoiceWorker`, `OverdueMonitorWorker`), และระบบแจ้งเตือนผ่าน SignalR, LINE Notify, Web Push, และ SMTP Email

---

## 📋 สรุปผลการพัฒนาตามลำดับ (Sequential Implementation Status — 100% Completed)

### ✅ ลำดับที่ 1 (Sprint 1): แก้ไข Bug วิกฤตและปรับ Contract ข้อมูลให้ตรงกัน (Critical Fixes & API Parity) — **เสร็จสมบูรณ์**

#### 1.1 ระบบจัดการสต็อกและบาร์โค้ด (`senic-inventory-pos-specialist`)
- [x] **[MODIFY] `frontend/src/components/products/ProductsPage.tsx`**
  - แก้ไข `handleSave` ให้ส่ง `stockQuantity: formData.stockQuantity ?? null` และ `barcode: formData.barcode?.trim() || null` พร้อมรองรับการค้นหาด้วย Barcode
  - แก้ไข `colSpan={6}` ในแถว Loading/Empty ของตารางสินค้าเป็น `colSpan={7}` ให้ตรงกับจำนวนคอลัมน์จริง
- [x] **[MODIFY] `backend/src/SenicBilling.API/Controllers/TaxInvoiceController.cs` & `DocumentControllerBase.cs`**
  - เพิ่มการตัดสต็อก (`DeductStockAsync`) เมื่อสร้างใบกำกับภาษี (`TaxInvoice`)
  - เพิ่มลอจิก **คืนสต็อก (Restock)** (`RestoreStockAsync`) เมื่อทำการยกเลิกเอกสาร (`Cancel`) หรือปรับปรุงจำนวนสินค้าเมื่อแก้ไขเอกสาร (`Update`) สำหรับเอกสารประเภท `CashBill`, `DeliveryNote`, `Receipt`, และ `TaxInvoice`

#### 1.2 ปรับจูน API Contract ของหน้า Dashboard (`senic-etax-report-specialist`)
- [x] **[MODIFY] `backend/src/SenicBilling.API/Controllers/DashboardController.cs` & `frontend/src/components/dashboard/DashboardPage.tsx`**
  - **`GET /api/dashboard/tax-estimator`**: ตั้งค่า Default ของพารามิเตอร์ `year` และ `month` ให้เป็นปี/เดือนปัจจุบันเมื่อ Frontend ไม่ได้ส่งค่ามา และปรับโครงสร้างข้อมูลให้รองรับ `totalSalesVat`, `totalPurchaseVat`, `estimatedTaxPayable`, และ `whtDeducted` ตรงกันทั้งสองฝั่ง
  - **`GET /api/dashboard/aging-report`**: ปรับให้คืนค่า `AgingSummaryDto` (`current`, `overdue1_30`, `overdue31_60`, `overdue61_90`, `overdue90Plus`, `totalOverdue`, `customers`) ตรงกันระหว่าง Backend และ `DashboardPage.tsx`

#### 1.3 แก้ไขการแปลงเอกสารและ Encoding ภาษาไทย (`senic-ledger` & `senic-sage`)
- [x] **[MODIFY] `backend/src/SenicBilling.API/Controllers/SharedDocumentController.cs` & `frontend/src/pages/DocumentPrintView.tsx`**
  - เพิ่ม `POST /api/documents/{id}/convert` และแก้ไขปุ่ม "แปลงเป็นใบกำกับภาษี" ให้เรียก Endpoint ที่ถูกต้องพร้อมตัดสต็อกอัตโนมัติเมื่อแปลงจากใบเสนอราคาเป็นใบกำกับภาษี
- [x] **[MODIFY] `backend/src/SenicBilling.API/Controllers/DocumentControllerBase.cs`**
  - แก้ไขข้อความภาษาไทยที่แสดงผลเพี้ยน (Mojibake) ใน Response Message ทั้งหมดให้เป็นภาษาไทยที่ถูกต้อง

---

### ✅ ลำดับที่ 2 (Sprint 2): เชื่อมต่อฟีเจอร์ระดับพรีเมียมให้ครบวงจร (End-to-End Premium Features Integration) — **เสร็จสมบูรณ์**

#### 2.1 ปุ่มดาวน์โหลดรายงานภาษีขาย Excel, e-Tax XML และ Server PDF (`senic-etax-report-specialist` & `senic-nova`)
- [x] **[MODIFY] `frontend/src/components/documents/DocumentsListPage.tsx`, `DashboardPage.tsx` & `frontend/src/pages/DocumentPrintView.tsx`**
  - เพิ่มปุ่มดาวน์โหลด **e-Tax Invoice XML** (`GET /api/tax-invoices/{id}/e-tax-xml`) สำหรับใบกำกับภาษีที่ออกแล้ว
  - เพิ่มปุ่มดาวน์โหลด **ไฟล์ PDF มาตรฐานจาก Server (QuestPDF)** (`GET /api/documents/{id}/pdf`)
  - เพิ่มปุ่มดาวน์โหลด **รายงานภาษีขายประจำเดือน (Excel `.xlsx`)** (`GET /api/reports/tax/export?year=...&month=...`) พร้อมตัวเลือกเดือน/ปี

#### 2.2 ระบบ Public Shared Link สำหรับลูกค้าปลายทาง (`senic-aegis` & `senic-nova`)
- [x] **[MODIFY] `backend/src/SenicBilling.API/Controllers/SharedDocumentController.cs`, `PaymentsController.cs` & `frontend/src/App.tsx`**
  - สร้าง `GET /api/documents/{id}/public` สำหรับดูข้อมูลเอกสารที่แชร์โดยไม่ต้องใช้ Token ของพนักงานภายใน
  - ปรับ `/print/:id` ให้ลูกค้าเปิดจากลิงก์ที่แชร์ผ่าน LINE ได้ทันที บันทึกสถานะ `ViewedAt` อัตโนมัติ และกดสแกนจ่าย PromptPay QR ได้ทันที

#### 2.3 ระบบแจ้งเตือน LINE Notify อัตโนมัติฝั่ง Backend (`senic-ai-automation-specialist`)
- [x] **[NEW] `backend/src/SenicBilling.Application/Interfaces/ILineNotifyService.cs` & `Infrastructure/Services/LineNotifyService.cs`**
  - เชื่อมต่อ `https://notify-api.line.me/api/notify` โดยใช้ `Tenant.LineNotifyToken`
  - เรียกใช้งานอัตโนมัติใน `PaymentsController.OmiseWebhook` เมื่อลูกค้าชำระเงินสำเร็จ และเมื่อมีการออกเอกสารใหม่ พร้อมปุ่มทดสอบ `POST /api/tenants/test-line-notify` ในหน้า `SettingsPage.tsx`

#### 2.4 ตัวเลือกสินค้าจากฐานข้อมูลในหน้าออกบิล (`senic-inventory-pos-specialist` & `senic-milo`)
- [x] **[MODIFY] `frontend/src/components/forms/InvoiceForm.tsx`**
  - เพิ่มตัวเลือกสินค้าจากฐานข้อมูล (`catalogProducts`) ในตารางรายการสินค้า (Line Items) เพื่อให้ผูก `productId`, ราคา, และหน่วยนับได้อย่างแม่นยำควบคู่กับการสแกนบาร์โค้ด (`/api/products/barcode/{code}`)

---

### ✅ ลำดับที่ 3 (Sprint 3): ยกระดับระบบ SaaS Multi-Tenant, Quota Enforcement และ Super Admin Portal — **เสร็จสมบูรณ์**

#### 3.1 ความปลอดภัยและการเชื่อมต่อ Super Admin Portal (`senic-saas-portal-specialist` & `senic-aegis`)
- [x] **[MODIFY] `SaTenantsController.cs`, `SaPlansController.cs` & `[NEW] SaBillingController.cs`**
  - เปิดใช้งาน `[Authorize(Roles = "Admin,SystemAdmin,SuperAdmin")]` และ Seed แพ็กเกจเริ่มต้น 4 ระดับใน `DevelopmentDataSeeder.cs`
  - สร้าง `SaBillingController` (`GET /api/superadmin/billing/stats`, `GET /api/superadmin/billing/invoices`) เพื่อดึงข้อมูล KPI จริง (จำนวน Tenants, Users, MRR, ประวัติการสมัครแพ็กเกจ)
- [x] **[MODIFY] `admin-frontend/` & `backend/src/SenicBilling.API/Program.cs`**
  - เพิ่ม CORS origin สำหรับ `admin-frontend` (`http://localhost:5174`, `http://localhost:8811`)
  - เพิ่มหน้า Login, `saApiClient` พร้อม JWT Interceptor, เชื่อมต่อข้อมูลจริงใน `Dashboard.tsx`, ค้นหาและเปลี่ยนแพ็กเกจใน `TenantsList.tsx`, และเพิ่ม Modal สร้าง/แก้ไขแพ็กเกจใน `PackagesList.tsx`

#### 3.2 ระบบบังคับใช้โควต้า (Quota Enforcement) และหน้าแพ็กเกจฝั่ง SME (`senic-saas-portal-specialist`)
- [x] **[MODIFY] `TenantSubscriptionController.cs`, `DocumentControllerBase.cs`, `TaxInvoiceController.cs`, `TenantUsersController.cs`, `AdminUsersController.cs`**
  - เพิ่ม `GET /api/subscriptions/current` และ `GET /api/subscriptions/plans` เพื่อดึงข้อมูลแพ็กเกจปัจจุบันและโควต้าที่ใช้ไป
  - ตรวจสอบสถานะองค์กร (`IsActive` / `SubscriptionStatus != "Suspended"`) และโควต้า `MaxDocumentsPerMonth` / `MaxUsers` ก่อนอนุญาตให้สร้างเอกสารหรือเพิ่มพนักงาน พร้อมบันทึก `TenantUsageStat`
- [x] **[MODIFY] `frontend/src/components/settings/SettingsPage.tsx` & `UsersManagementPage.tsx`**
  - เพิ่มส่วนแสดงแพ็กเกจปัจจุบัน โควต้าการใช้งาน และปุ่มอัปเกรดแพ็กเกจใน `SettingsPage.tsx`
  - รวมความสามารถการเปลี่ยนสิทธิ์ (Role) และการระงับ/ลบผู้ใช้งานเข้าไว้ใน `UsersManagementPage.tsx`

---

### ✅ ลำดับที่ 4 (Sprint 4): ความมั่นคงปลอดภัย การทดสอบอัตโนมัติ และความพร้อมระดับ Production — **เสร็จสมบูรณ์**

#### 4.1 Security & Dependency Hardening (`senic-aegis` & `senic-hermes`)
- [x] อัปเกรดแพ็กเกจ `System.Security.Cryptography.Pkcs` และกำหนด `Directory.Build.props`
- [x] ยกระดับการ Hash รหัสผ่านจาก Unsalted SHA-256 เป็น Salted Password Hashing (`PBKDF2-SHA256` 100,000 รอบใน `PasswordHasher.cs`) พร้อม Auto-migration สำหรับผู้ใช้เดิมตอนล็อกอิน

#### 4.2 Automated Unit & Integration Tests (`senic-argus`)
- [x] **[NEW] `backend/tests/SenicBilling.Tests/`**
  - สร้างชุดทดสอบอัตโนมัติใน `BillingDomainAndSecurityTests.cs` ครอบคลุม:
    1. Salted PBKDF2 Password Hashing และการรองรับ SHA-256 เดิม (`NeedsUpgrade`)
    2. การสร้างไฟล์มาตรฐาน ETDA e-Tax Invoice XML (`ETaxXmlGenerator`)
    3. สูตรคำนวณ VAT 7% (Inclusive/Exclusive), หัก ณ ที่จ่าย (WHT), และการตัด/คืนสต็อกเมื่อสร้าง/แก้ไข/ยกเลิกเอกสาร
    4. การแปลงเอกสาร 1-Click (`Quotation` -> `TaxInvoice`) พร้อมตัดสต็อก และการกั้นข้อมูลข้ามบริษัท (Tenant Isolation)
    5. การบังคับใช้โควต้าจำนวนเอกสารรายเดือน (`MaxDocumentsPerMonth`)

---

## ✅ ผลการตรวจสอบความสมบูรณ์ (Verification Results)

- [x] `cd backend && dotnet build SenicBilling.slnx` — **ผ่านสมบูรณ์ (`0 Error`, `0 Warning`)**
- [x] `cd backend && dotnet test SenicBilling.slnx` — **ผ่านสมบูรณ์ (`Passed: 6/6, Failed: 0`)**
- [x] `cd frontend && npm run build` — **ผ่านสมบูรณ์ (`built in ~900ms`)**
- [x] `cd admin-frontend && npm run build` — **ผ่านสมบูรณ์ (`built in ~400ms`)**
