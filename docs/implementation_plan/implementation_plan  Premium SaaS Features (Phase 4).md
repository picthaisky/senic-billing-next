# Implementation Plan: Premium SaaS Features (Phase 4)

ตามที่คุณสนใจที่จะพัฒนาฟีเจอร์ระดับพรีเมียมทั้ง 5 ฟีเจอร์ เพื่อยกระดับให้แพลตฟอร์มนี้เป็น SaaS Billing ที่สมบูรณ์แบบที่สุด ผมได้จัดทำแผนการทำงานเพื่อรองรับฟีเจอร์ทั้งหมดดังนี้ครับ

## User Review Required
> [!IMPORTANT]
> **การตัดสินใจที่ต้องการจากคุณ:**
> 1. **การ Export Excel**: ผมขอเสนอให้ใช้ไลบรารี **ClosedXML** ซึ่งใช้งานง่ายและฟรี (MIT License) ในการสร้างไฟล์ Excel (.xlsx) 
> 2. **ระบบ e-Tax**: ในเฟสนี้จะเป็นการ "เตรียมความพร้อม" (Preparation) โดยการสร้าง Endpoint ที่สามารถแปลงข้อมูลใบกำกับภาษีให้ออกมาเป็นโครงสร้าง XML ตามมาตรฐาน ETDA (สำนักงานพัฒนาธุรกรรมทางอิเล็กทรอนิกส์) เบื้องต้นก่อน ส่วนการ Sign ด้วยใบรับรองดิจิทัล (Digital Certificate) อาจจะต้องใช้ผู้ให้บริการภายนอก (Service Provider) ภายหลัง
> 3. **LINE Integration**: สำหรับการส่งบิลให้ลูกค้าปลายทาง (End-user) จะทำเป็นปุ่ม "Share to LINE" ที่สร้าง URL แชร์ได้ทันทีจาก Frontend ส่วนการตั้งค่า **LINE Notify** จะเพิ่มเข้าไปในหน้าตั้งค่า Tenant เพื่อให้บริษัท (SME) รับแจ้งเตือนเมื่อมีลูกค้าชำระเงินเข้ามา
> 
> หากคุณเห็นด้วยกับแนวทางนี้ สามารถอนุมัติให้ผมเริ่มลงมือเขียนโค้ดได้เลยครับ!

---

## Proposed Changes

### 1. Payment Integration (Automated SaaS Billing)
การเชื่อมต่อ Omise สำหรับตัดบัตรเครดิตค่าแพ็กเกจ SaaS
#### [NEW] `backend/src/SenicBilling.API/Controllers/TenantSubscriptionController.cs`
- สร้าง Endpoint `POST /api/subscriptions/checkout` เพื่อสร้างการชาร์จเงิน (Charge) และผูกบัตร (Customer) ผ่าน Omise
- สร้าง Endpoint `POST /api/webhooks/omise` เพื่อรับ Webhook การตัดเงินรายเดือนและต่ออายุ (Renew) สถานะในตาราง `TenantSubscription` ให้อัตโนมัติ

---

### 2. Tax Reports & Excel Export
ระบบสรุปรายงานและดาวน์โหลดเป็น Excel
#### [MODIFY] `backend/src/SenicBilling.API/SenicBilling.API.csproj`
- ติดตั้งไลบรารี `ClosedXML` (`dotnet add package ClosedXML`)
#### [NEW] `backend/src/SenicBilling.API/Controllers/ReportsController.cs`
- สร้าง Endpoint `GET /api/reports/tax/export` (รับพารามิเตอร์ month/year) คิวรี่ใบกำกับภาษีและใบเสร็จรับเงิน แล้วใช้ ClosedXML จัด Format ตารางให้เป็น Excel พร้อม Header กรมสรรพากร

---

### 3. LINE Integration
#### [MODIFY] `backend/src/SenicBilling.Domain/Entities/Tenant.cs`
- เพิ่มฟิลด์ `LineNotifyToken`
#### [MODIFY] `frontend/src/components/documents/ShareDocumentModal.tsx` (หรือไฟล์ที่เกี่ยวข้อง)
- สร้างปุ่ม **Share via LINE** โดยใช้ `https://line.me/R/msg/text/?{URL}` เพื่อให้ผู้ใช้แชร์ลิงก์ให้ลูกค้าได้อย่างรวดเร็ว

---

### 4. Role-based Access Control (SME Staff Permissions)
ระบบจำกัดสิทธิ์พนักงานภายในบริษัท
#### [MODIFY] `backend/src/SenicBilling.Domain/Entities/User.cs`
- เพิ่มฟิลด์ `Role` (Enum: Admin, Accountant, Sales)
#### [NEW] `backend/src/SenicBilling.API/Controllers/TenantUsersController.cs`
- สร้าง Endpoint ให้ SME Admin สามารถดึงรายชื่อพนักงาน (GET), เชิญพนักงานใหม่ (POST), เปลี่ยน Role (PUT) หรือลบพนักงาน (DELETE) ภายใน Tenant เดียวกันได้
#### [MODIFY] `backend/src/SenicBilling.API/Controllers/AuthController.cs`
- อัปเดตการสร้าง JWT Token ให้บรรจุ `role` claim ลงไปด้วย
#### [NEW] `frontend/src/pages/settings/StaffManagementPage.tsx`
- หน้าจอ UI จัดการพนักงาน เชิญ/ลบพนักงาน

---

### 5. e-Tax XML Preparation
#### [NEW] `backend/src/SenicBilling.Application/Services/ETaxXmlGenerator.cs`
- สร้าง Service จำลองการแปลง `BillingInvoice` (หรือใบกำกับภาษี) เป็นฟอร์แมต XML (อ้างอิง โครงสร้างพื้นฐานของ INVOICE)
#### [MODIFY] `backend/src/SenicBilling.API/Controllers/TaxInvoiceController.cs`
- เพิ่ม Endpoint `GET /api/tax-invoices/{id}/e-tax` เพื่อให้ดาวน์โหลดออกมาเป็น XML ไฟล์

---

## Verification Plan
1. **Omise**: ทดสอบเรียกใช้ Endpoint Checkout ด้วย Token ทดสอบของ Omise หากสำเร็จ `SubscriptionStatus` ของ Tenant ต้องเป็น `Active`
2. **Excel Export**: ยิง API ของ Report และตรวจสอบไฟล์ Excel ที่โหลดมาว่ามี Column ที่ถูกต้องและเปิดได้
3. **LINE**: ตรวจสอบปุ่มแชร์บน UI ในโหมด Desktop/Mobile ว่าเปิดแอปพลิเคชัน LINE ได้ถูกต้อง
4. **RBAC**: ทดสอบ Login ด้วย User ที่เป็น Sales และลองยิง API ฝั่งบัญชี จะต้องติด Error `403 Forbidden`
5. **e-Tax**: ดาวน์โหลดไฟล์ XML และตรวจสอบแท็กพื้นฐานว่าตรงกับข้อมูลของบิลหรือไม่
