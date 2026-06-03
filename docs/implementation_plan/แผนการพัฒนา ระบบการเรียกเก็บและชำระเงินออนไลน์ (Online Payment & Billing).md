# 💳 แผนการพัฒนา: ระบบการเรียกเก็บและชำระเงินออนไลน์ (Online Payment & Billing)

อ้างอิงจากความต้องการในการสร้างระบบรับชำระเงินออนไลน์ ผมขอเสนอให้ใช้ **Omise (Opn Payments)** ซึ่งเป็น Payment Gateway ยอดนิยมในไทยที่รองรับ **PromptPay QR Code** และบัตรเครดิตได้ดีเยี่ยม ผสมผสานกับการใช้ **SignalR (Real-time)** ที่เราเพิ่งทำเสร็จ เพื่อให้เมื่อลูกค้าโอนเงินปุ๊บ หน้าจอแอปจะขึ้นว่า "ชำระแล้ว" ทันทีโดยไม่ต้องรีเฟรช!

## 📋 แผนการพัฒนา Backend (.NET 10)

### 1. โครงสร้าง Database & Domain
- อัปเดต `DocumentStatus` (Enum) ให้มีสถานะ `Paid = 4` (ชำระเงินแล้ว)
- สร้าง Entity ใหม่ `PaymentTransaction` เพื่อเก็บประวัติการจ่ายเงิน (Id, DocumentId, Amount, PaymentMethod, GatewayReference, Status)
- สร้าง EF Core Migration และ Update Database

### 2. Omise Payment Integration
- ติดตั้งไลบรารี `Omise.Net`
- เพิ่มตั้งค่า `Omise:PublicKey` และ `Omise:SecretKey` ใน `appsettings.json`
- สร้าง `IPaymentService` และ `OmisePaymentService` เพื่อเรียกใช้ API ของ Omise สำหรับการสร้าง **PromptPay QR Code (Charge)**

### 3. Payment API & Webhook Controller
- `POST /api/payments/{documentId}/promptpay`: สร้าง QR Code สำหรับชำระบิลนั้นๆ
- `POST /api/payments/webhook`: สำหรับรับ Callback จาก Omise (Event: `charge.complete`) เมื่อลูกค้าสแกนจ่ายสำเร็จ
- เมื่อ Webhook ทำงาน จะทำการเปลี่ยนสถานะบิลเป็น `Paid` และ **ยิง SignalR Event (`PaymentReceived`)** ไปยัง Frontend แบบ Real-time ทันที

## 📱 แผนการพัฒนา Frontend (React + Vite)

### 1. Payment UI Components
- สร้าง `PaymentModal.tsx` ที่จะแสดง QR Code พร้อมยอดเงิน โดยดึงภาพ QR จาก API
- โชว์สถานะ "กำลังรอการชำระเงิน..." พร้อมสัญลักษณ์โหลดดิ่ง

### 2. Integration with Documents
- เพิ่มปุ่ม **"ชำระเงินออนไลน์ (Pay Now)"** ในหน้ารายละเอียดเอกสารหรือหน้าสร้างใบเสร็จ หากสถานะเป็น `Issued`
- เมื่อคลิก จะเรียก API ไปขอ QR Code และเปิด Modal ให้ลูกค้าสแกน

### 3. Real-time Payment Success
- ใช้ `signalrClient.ts` ที่ทำไว้ ดักจับ Event `PaymentReceived`
- เมื่อได้รับสัญญาณว่า "จ่ายแล้ว" ตัวหน้าต่าง QR Code จะเปลี่ยนเป็นเครื่องหมายถูกสีเขียว (Success) อัตโนมัติและเปลี่ยนสถานะบิลเป็น `Paid` ใน UI ทันที

---

## ⚠️ User Review Required

> [!IMPORTANT]
> **เกี่ยวกับ Payment Gateway (Omise):**
> 1. ในการทดสอบ ผมจะใช้ **Test Mode Keys** ของ Omise ซึ่งคุณสามารถสแกนจำลองการจ่ายใน Environment ทดสอบได้เลย 
> 2. ผมขออนุญาตเลือกสร้างเป็นแบบ **PromptPay QR** เป็นหลักก่อน เพราะนิยมมากที่สุดสำหรับธุรกิจ SME หากต้องการบัตรเครดิตด้วยสามารถแจ้งได้ครับ
>
> หากแผนนี้ตอบโจทย์และพร้อมลุย พิมพ์ **"ลุยเลย"** ได้เลยครับ!
