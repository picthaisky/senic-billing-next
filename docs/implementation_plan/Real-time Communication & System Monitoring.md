# 📡 Real-time Communication & System Monitoring

ระบบการสื่อสารแบบ Real-time ด้วย WebSocket (SignalR) และระบบจัดการสถานะขั้นสูง (Zustand) ติดตั้งเสร็จสมบูรณ์แล้ว! 🚀

## ✨ ฟีเจอร์ที่พัฒนาเสร็จสิ้น

### 1. 🔄 **Global State Management (Zustand & Facade)**
- นำ **Zustand** เข้ามาจัดการ System State อย่างเป็นระบบใน `useSystemStore.ts` (รองรับสถานะการเชื่อมต่อ, ค่า Health Check จากระบบ, และจำนวนผู้ใช้ออนไลน์)
- ออกแบบ **Compatibility Facade Pattern** (`useAppSystem.ts`) ซึ่งช่วยให้ Component (อย่างหน้า UI ต่างๆ) สามารถดึงค่าระบบไปใช้งานได้ง่ายขึ้น โดยไม่ถูกยึดติดกับ Zustand หากอนาคตมีการเปลี่ยนเครื่องมือ State Management โค้ดส่วน UI จะไม่ได้รับผลกระทบใดๆ (Enterprise Grade!)

### 2. ⚡ **SignalR WebSocket Communication**
- ติดตั้ง SignalR Hub (`SenicBillingHub.cs`) ที่ Backend รองรับการดักจับพฤติกรรม `OnConnected` และ `OnDisconnected` ของผู้ใช้ได้
- มี `signalrClient.ts` ที่ฝั่งแอปพลิเคชัน (React) ที่จะตั้งค่า Auto-Reconnect ให้อัตโนมัติเมื่อเน็ตหลุด และทำการอัปเดตสถานะ "ออนไลน์" มายัง Zustand ทันที
- **Presence Notification:** รองรับการเช็คว่ามี User กี่คนออนไลน์อยู่ในขณะนั้น 

### 3. 🛡️ **System Monitoring (Health Checks)**
- ติดตั้ง **ASP.NET Core Health Checks** สำหรับ `PostgreSQL` และ `MinIO` (ผ่าน `MinioHealthCheck.cs`)
- Backend มี `SystemMonitorService` ซึ่งทำงานเป็นเบื้องหลัง (Background Worker) คอยเช็คชีพจรการทำงานของ ฐานข้อมูลและสอตร์เรจ ทุกๆ **15 วินาที**
- หากพบปัญหา Backend จะยิง (Broadcast) สัญญาณ `ReceiveSystemStatus` บอกทุกเครื่องที่ต่อเน็ตอยู่แบบ Real-time ทันที

### 4. 🏷️ **Real-time Status Badge UI**
- เพิ่ม Badge สถานะระบบเล็กๆ ไว้ที่มุมขวาบนของเมนูด้านบนสุด (Header) ข้างๆ ปุ่มตั้งค่า 
- กดคลิกที่ตัวสถานะ จะแสดงเมนู Dropdown สรุปผลการตรวจสอบของแต่ละระบบ 
   - 🟢 `Healthy`: ระบบทำงานปกติ
   - 🟡 `Degraded`: ระบบทำงานแต่ช้า
   - 🔴 `Unhealthy`: ระบบเข้าใช้งานไม่ได้
   - ✖️ `Offline`: ขาดการเชื่อมต่อกับ Server

---

## 🛠️ วิธีการทดสอบ
1. เปิดหน้าจอเบราว์เซอร์ดูที่ Header มุมขวาบน จะมีสถานะระบบแสดงขึ้นมา (เช่น `Offline` ถ้าไม่ได้รันเซิร์ฟเวอร์ หรือ `Healthy` พร้อมมีไฟกะพริบ)
2. ลองทดสอบ ปิดฐานข้อมูล (Docker Postgres) แล้วดูว่าระบบมีการเปลี่ยนสถานะเป็น 🔴 และเตือน `Unhealthy` ด้วยตนเองในเวลาไม่เกิน 15 วินาทีหรือไม่
3. ลองกดที่ไฟสถานะ จะเห็นรายละเอียดเวลา (Latency) ที่ใช้เชื่อมต่อแต่ละ Component
