# แผนการพัฒนา Phase 19 (LINE Webhook & AI Parity, Payment Guardrails, Recurring Validation & Master Data Hardening)

> **วันที่จัดทำ:** 14 พฤศจิกายน 2026  
> **สถานะ:** ✅ ดำเนินการพัฒนาและทดสอบครบถ้วน 100% ทั้ง 4 Sprints

---

## 🎯 วัตถุประสงค์ของ Phase 19

ต่อยอดจาก Phase 18 เพื่อปิดช่องว่างเชิงลึกในส่วนของระบบอัตโนมัติ (LINE Webhook & AI Assistant), ระบบรับชำระเงินออนไลน์ (`PaymentsController`), ระบบตั้งเวลาออกบิลอัตโนมัติ (`RecurringInvoiceController`), การตรวจสอบความถูกต้องของข้อมูลหลัก (`CustomersController`, `ProductsController`, `VendorsController`), และการแก้ไขที่อยู่/สาขาของลูกค้าในหน้าออกเอกสาร (`InvoiceForm.tsx`):

1. **Sprint 19.1 — LINE Webhook & AI Assistant CreditNote/Overdue Parity & Base URL Alignment (`LineWebhookController.cs`, `AIAssistantController.cs`)**
   - **`LineWebhookController`**:
     - บล็อกองค์กรที่ถูกระงับการใช้งาน (`!tenant.IsActive || tenant.SubscriptionStatus == "Suspended"`)
     - ปรับคำสั่ง `"สรุปยอด"` / `"ยอดขาย"` ให้หักยอดใบลดหนี้ (`CreditNote`) ออกจากยอดขายสุทธิและไม่นับใบลดหนี้เป็นรายการค้างชำระ เพื่อให้ตัวเลขตรงกับ `DashboardController` และ `TaxSummaryQuery`
     - ดึงค่า Base URL จาก `App:FrontendBaseUrl` ก่อน fallback ไปยัง `Frontend:BaseUrl` เมื่อส่งลิงก์เปิดดูบิลผ่าน LINE
   - **`AIAssistantController`**:
     - กรองรายการค้างชำระ (`overdueDocs`) ใน `Chat` โดยไม่รวมเอกสารร่าง (`Draft`), ใบส่งของ (`DeliveryNote`), ใบลดหนี้ (`CreditNote`), ใบเสร็จรับเงิน (`Receipt`), และบิลเงินสด (`CashBill`) ให้ตรงกับรายงาน `A/R Aging`
     - ตรวจสอบสิทธิ์ `tenantId` ใน `ParseExpense`

2. **Sprint 19.2 — Payment Gateway Guardrails & Recurring Schedule Validation (`PaymentsController.cs`, `RecurringInvoiceController.cs`)**
   - **`PaymentsController`**:
     - ป้องกันการสร้าง PromptPay QR (`CreatePromptPayCharge`) และ Payment Link (`CreatePaymentLink`) สำหรับเอกสารที่ถูกยกเลิก (`Cancelled`), เอกสารร่าง (`Draft`), หรือเอกสารที่ไม่ใช่ใบเรียกเก็บเงิน (`Quotation`, `DeliveryNote`, `CreditNote`)
     - ป้องกัน `OmiseWebhook` ไม่ให้เปลี่ยนสถานะเอกสารที่ถูกยกเลิก (`Cancelled`) เป็นชำระแล้ว (`Paid`) และบันทึกสถานะ `PaymentTransaction` เสมอ
   - **`RecurringInvoiceController`**:
     - ตรวจสอบความถี่ (`Frequency`) ให้รองรับเฉพาะ `Daily`, `Weekly`, `Monthly`, `Yearly`, ตรวจสอบ `MaxOccurrences > 0`, และไม่อนุญาตให้ตั้งเวลาจากเอกสารต้นฉบับที่ถูกยกเลิก (`Cancelled`)

3. **Sprint 19.3 — Master Data Validation (`CustomersController`, `ProductsController`, `VendorsController`) & `InvoiceForm.tsx` Customer Address/Branch Inputs**
   - **`CustomersController` & `VendorsController`**:
     - ตรวจสอบชื่อ (`Name` ห้ามว่าง) และเลขประจำตัวผู้เสียภาษี (`TaxId` หากระบุต้องเป็นตัวเลข 13 หลัก)
   - **`ProductsController`**:
     - ตรวจสอบชื่อสินค้า (`Name` ห้ามว่าง) และราคาขาย/ราคาทุนต้องไม่ติดลบ (`UnitPrice >= 0`, `CostPrice >= 0`)
   - **`InvoiceForm.tsx` & `resources.ts`**:
     - เพิ่มช่องกรอก/แก้ไข **สาขา (`customerBranch`)** และ **ที่อยู่ลูกค้า (`customerAddress`)** ในฟอร์มออกเอกสาร พร้อมคำแปล 2 ภาษา (`TH`/`EN`)

4. **Sprint 19.4 — Automated Tests & Knowledge Base Sync**
   - สร้าง `backend/tests/SenicBilling.Tests/Phase19WebhookPaymentAndMasterDataTests.cs`
   - สร้าง `frontend/scripts/phase19-unit.test.mjs` และผูกเข้ากับ `frontend/package.json`
   - อัปเดตเอกสารแผนแม่บทและ Knowledge Base ครบทุกไฟล์
