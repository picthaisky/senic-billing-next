# Frontend Integration Plan: Senic Billing Next

เป้าหมายของเฟสนี้คือการนำ API ทั้งหมดที่พัฒนาขึ้นใน Phase 1-4 มาเชื่อมต่อกับ React Frontend อย่างสมบูรณ์ พร้อมปรับปรุงหน้าตาและ UX (User Experience) ให้ดูทันสมัยและใช้งานง่ายที่สุด (WOW Experience)

## User Review Required
> [!IMPORTANT]
> แผนนี้จะมีการเพิ่มหน้าต่างและปุ่มกดจำนวนมาก กรุณาตรวจสอบว่ามีฟีเจอร์ใดที่คุณต้องการเน้นย้ำ หรือมีรูปแบบ UI เฉพาะเจาะจงที่ต้องการให้ปรับปรุงเป็นพิเศษหรือไม่

## Proposed Changes

### 1. AI Assistant (Gemini Chat UI)
สร้างหน้าต่างแชท AI แบบ Floating (ลอยอยู่มุมล่างขวาของจอ) หรือปุ่มกดใน Sidebar เพื่อให้ผู้ใช้สามารถเรียกใช้งาน AI Assistant ได้ทุกเมื่อ
- **UI**: กล่องแชทแบบ Modern (คล้าย ChatGPT/Copilot)
- **API**: เชื่อมต่อ `POST /api/AIAssistant/chat` เพื่อรับข้อมูลสรุปกระแสเงินสดมาวิเคราะห์

### 2. Dashboard Analytics (A/R Aging & Tax Estimator)
ปรับปรุง `DashboardPage.tsx` ให้มีข้อมูลลึกขึ้น
- **A/R Aging Report**: เพิ่มกราฟแท่งหรือตารางแสดงหนี้ค้างชำระแบ่งตามช่วงอายุหนี้
- **Tax Estimator**: เพิ่ม Card แสดงยอดประมาณการภาษีมูลค่าเพิ่มที่ต้องนำส่งในเดือนนี้
- **API**: เชื่อมต่อ `/api/dashboard/aging-report`, `/api/dashboard/tax-estimator`, และ `/api/dashboard/top-spenders`

### 3. Smart Document Management
เพิ่มปุ่มลัดและฟังก์ชันในหน้าจอการจัดการเอกสาร (`DocumentList` หรือภายใน View ของเอกสาร)
- **1-Click Convert**: ปุ่ม "แปลงเอกสาร" (เช่น จากใบเสนอราคาเป็นใบส่งของ/ใบกำกับภาษี)
- **Credit / Debit Notes**: ปุ่มสำหรับสร้างใบลดหนี้/เพิ่มหนี้ โดยอ้างอิงเอกสารเดิม
- **WHT Support**: เพิ่มฟิลด์ให้เลือก หัก ณ ที่จ่าย 1%, 3%, 5% ใน `InvoiceForm.tsx`

### 4. Payments & Omise Links
- เพิ่มปุ่ม **"สร้างลิงก์รับชำระเงิน" (Payment Link)** ในหน้าจอเอกสารที่รอการชำระเงิน
- เมื่อกดจะเรียก API `/api/payments/{id}/payment-link` และแสดงลิงก์ หรือปุ่ม "คัดลอกลิงก์" เพื่อให้ส่งต่อให้ลูกค้าได้
- การแจ้งเตือนเมื่อมีการจ่ายเงินผ่าน Omise Webhook สำเร็จ (ผ่าน SignalR ที่มีอยู่แล้ว)

### 5. Automation (Recurring Invoices)
เพิ่มเมนูตั้งค่าสำหรับตั้งเวลาออกเอกสารอัตโนมัติ
- เพิ่ม UI ในฟอร์มสร้างเอกสาร ให้ระบุรอบ (รายสัปดาห์/เดือน/ปี)
- เพิ่มหน้าต่างรายชื่อ "กำหนดการออกเอกสารอัตโนมัติ" ไว้ใช้เรียกดู หรือปิดการทำงาน

## Verification Plan
### Automated Tests
- ตรวจสอบ `npm run build` ไม่พบข้อผิดพลาด
- ตรวจสอบ `npm run lint` ของ TypeScript

### Manual Verification
- ทดสอบเข้าสู่ระบบและเปิดหน้า Dashboard ว่าเห็นข้อมูล A/R Aging และ Tax Estimator
- ทดสอบเปิดกล่องแชท AI และพิมพ์ถามข้อมูล เช่น "มีใครค้างจ่ายเราบ้าง?"
- ทดสอบสร้างใบเสนอราคา และกดปุ่ม "แปลงเป็นใบกำกับภาษี" 
- ทดสอบกด "สร้างลิงก์ชำระเงิน" และรับลิงก์กลับมาแสดงบนจอ
