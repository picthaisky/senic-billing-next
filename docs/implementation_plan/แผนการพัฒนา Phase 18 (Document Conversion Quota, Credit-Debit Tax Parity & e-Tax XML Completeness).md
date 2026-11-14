# แผนการพัฒนา Phase 18 (Document Conversion Quota, Credit/Debit Tax Parity & e-Tax XML Completeness)

> **วันที่จัดทำ:** 14 พฤศจิกายน 2026  
> **สถานะ:** ✅ ดำเนินการพัฒนาและทดสอบครบถ้วน 100% ทั้ง 4 Sprints

---

## 🎯 วัตถุประสงค์ของ Phase 18

จากการตรวจสอบเชิงลึกทั่วทั้งระบบหลังจบ Phase 17 พบช่องว่างเชิงธุรกิจ (Domain Logic & Tax Compliance Gaps) ในส่วนของการแปลงเอกสาร (`Convert`), การออกใบลดหนี้/เพิ่มหนี้ (`CreditNote` / `DebitNote`), การคำนวณภาษีขายรายเดือน (`ภ.พ.30` / Output Tax Report), การป้องกันการตัดสต็อกซ้ำเมื่อออกใบกำกับภาษีอ้างอิงใบส่งของ (`DeliveryNote -> TaxInvoice`), และการดาวน์โหลดไฟล์มาตรฐาน ETDA e-Tax XML สำหรับใบลดหนี้ (`381`) และใบเพิ่มหนี้ (`383`):

1. **Sprint 18.1 — Document Conversion & Credit/Debit Note Quota, Stock & Delivery-Note Deduplication Parity (`SharedDocumentController.cs`, `DocumentControllerBase.cs`, `TaxInvoiceController.cs`)**
   - **`SharedDocumentController.Convert` (`POST /api/documents/{id}/convert`)**:
     - ตรวจสอบสถานะองค์กร (`!tenant.IsActive || tenant.SubscriptionStatus == "Suspended"`) และโควต้าเอกสารรายเดือน (`MaxDocumentsPerMonth > 0`) พร้อมอัปเดต `TenantUsageStat.DocumentsCreated`
     - เพิ่ม Endpoint `GET /api/documents/{id}/e-tax-xml` รองรับการดาวน์โหลดไฟล์ ETDA e-Tax XML สำหรับเอกสารภาษีที่อนุมัติแล้วทุกประเภท (`TaxInvoice` รหัส `388`, `CreditNote` รหัส `381`, `DebitNote` รหัส `383`, `Receipt`/`CashBill` รหัส `380`)
   - **`DocumentControllerBase.ConvertDocument` & `CreateCreditDebitNote`**:
     - บังคับใช้การตรวจสถานะองค์กร, โควต้า `MaxDocumentsPerMonth`, การตรวจงวดบัญชีที่ปิดแล้ว (`IsPeriodLockedAsync`), และการบันทึก `TenantUsageStat.DocumentsCreated`
     - เมื่อออกใบลดหนี้ (`CreditNote`) อ้างอิงจากเอกสารที่มีผลต่อสต็อก (`TaxInvoice`, `Receipt`, `CashBill`, `DeliveryNote`) ให้คืนสต็อก (`RestoreStockAsync`) อัตโนมัติสำหรับรายการสินค้าที่ผูก `ProductId`
   - **`TaxInvoiceController.Create` Delivery-Note Stock Deduplication (`domain-rules.md`)**:
     - หากสร้างใบกำกับภาษี (`TaxInvoice`) โดยระบุ `ReferenceDocumentId` อ้างอิงไปยังใบส่งของ (`DeliveryNote`) ขององค์กรเดียวกันที่ยังไม่ถูกยกเลิก ให้ข้ามการตัดสต็อกซ้ำ (`DeductStockAsync`) ตามกฎธุรกิจใน `domain-rules.md`

2. **Sprint 18.2 — Tax Estimator (`ภ.พ.30`), Output Tax Excel Report & A/R Aging Credit/Debit Note Parity (`TaxSummaryQuery.cs`, `ReportsController.cs`, `DashboardController.cs`)**
   - **`TaxSummaryQuery.ComputeAsync`**:
     - คำนวณยอดขายและภาษีขาย (`Output VAT`) โดยรวม `TaxInvoice` (+), `DebitNote` (+), และหัก `CreditNote` (-) รวมถึงคำนวณภาษีหัก ณ ที่จ่าย (`WhtDeducted`) โดยหักยอดจาก `CreditNote` เพื่อให้ตรงกับ `DashboardController.GetSummary` / `GetRevenueChart` และ `AccountingService`
   - **`ReportsController.ExportTaxReport` (`GET /api/reports/tax/export`)**:
     - รวมเอกสาร `TaxInvoice`, `CreditNote` (แสดงยอดติดลบตามเกณฑ์กรมสรรพากร), และ `DebitNote` ในรายงานภาษีขายประจำเดือน (Excel `.xlsx`)
   - **`DashboardController.GetAgingReport` (`GET /api/dashboard/aging-report`)**:
     - คำนวณยอดลูกหนี้คงค้างสุทธิโดยรวม `DebitNote` และหักยอด `CreditNote` ที่ออกในงวด/ลูกหนี้รายเดียวกัน

3. **Sprint 18.3 — Frontend e-Tax XML Support for Credit/Debit Notes & `InvoiceForm.tsx` Enhancements (`DocumentsListPage.tsx`, `DocumentPrintView.tsx`, `InvoiceForm.tsx`)**
   - **`DocumentsListPage.tsx` & `DocumentPrintView.tsx`**:
     - เปิดใช้งานปุ่มดาวน์โหลด **e-Tax XML** สำหรับ `creditnote` (`CreditNote`) และ `debitnote` (`DebitNote`) ควบคู่กับ `taxinvoice` (`TaxInvoice`) โดยเรียก `GET /api/documents/{id}/e-tax-xml`
   - **`InvoiceForm.tsx`**:
     - รองรับการกรอก/ตรวจสอบเลขประจำตัวผู้เสียภาษี 13 หลักสำหรับ `creditnote` และ `debitnote` ควบคู่กับ `taxinvoice` และแสดงข้อความแจ้งเตือนจาก Backend (`getApiErrorMessage`) เมื่อบันทึกเอกสารไม่สำเร็จ (เช่น โควต้าเต็ม หรือปิดงวดบัญชีแล้ว)

4. **Sprint 18.4 — Automated Tests & Knowledge Base Sync**
   - สร้าง `backend/tests/SenicBilling.Tests/Phase18DocumentTaxAndStockParityTests.cs`
   - สร้าง `frontend/scripts/phase18-unit.test.mjs` และผูกเข้ากับ `frontend/package.json`
   - อัปเดตเอกสารแผนแม่บทและ Knowledge Base ครบทุกไฟล์
