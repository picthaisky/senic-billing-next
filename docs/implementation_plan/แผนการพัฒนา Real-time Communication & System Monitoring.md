# 📡 แผนการพัฒนา: Real-time Communication & System Monitoring

อ้างอิงจากความต้องการในการสร้างระบบ State Management ที่แข็งแกร่ง (Zustand), การเชื่อมต่อ Real-time ด้วย WebSocket (SignalR) และระบบ System Monitoring ตรวจสอบสถานะการเชื่อมต่อ ผมได้วางโครงสร้างสถาปัตยกรรมดังนี้:

## 📋 แผนการพัฒนา Backend (.NET 10)

### 1. ระบบ SignalR Real-time Hub
- เพิ่มการเชื่อมต่อ `Microsoft.AspNetCore.SignalR`
- สร้าง `SenicBillingHub` สำหรับกระจายข้อมูลแบบ Real-time ไปยัง Client เช่น การเด้งแจ้งเตือน (Notifications) หรือสถานะผู้ใช้ออนไลน์ (Presence)
- ตั้งค่า CORS และ Authentication ให้รองรับ WebSocket (ผ่าน Token)

### 2. ระบบ System Monitoring (Health Checks)
- นำระบบ **ASP.NET Core Health Checks** มาใช้
- ติดตั้งไลบรารี `AspNetCore.HealthChecks.Npgsql` เพื่อเช็คสถานะ Database อัตโนมัติ
- สร้าง `MinioHealthCheck` แบบกำหนดเอง (Custom Check) เพื่อเช็คสถานะ Storage ของ MinIO
- สร้าง `SystemMonitorService` (เป็น BackgroundService/IHostedService) ให้ทำการ Query สถานะ Health Check ทุกๆ 10-30 วินาที และพ่นข้อมูลออกไปยัง Frontend ผ่าน SignalR Hub เพื่อให้เห็นสถานะแบบ Real-time

## 📱 แผนการพัฒนา Frontend (React + Vite)

### 1. โครงสร้าง State Management (Zustand & Facades)
- สร้าง Store หลัก `useSystemStore.ts` ด้วย Zustand สำหรับเก็บ Global State เช่น (สถานะเซิร์ฟเวอร์, จำนวนแจ้งเตือนที่ยังไม่อ่าน, สถานะผู้ใช้งาน)
- สร้าง **"Compatibility Facade"** (เช่น `useAppSystem()`) ครอบทับ Zustand อีกชั้น เพื่อลดการผูกติด (Coupling) โดยตรงกับ Component ต่างๆ ทำให้โครงสร้างแอปยังคงสะอาดและดูแลรักษาง่าย (เป็นไปตามหลักการออกแบบระดับ Enterprise)

### 2. SignalR Client
- ติดตั้งไลบรารี `@microsoft/signalr` ใน Frontend
- สร้างไฟล์ `signalrClient.ts` เพื่อจัดการวงจรชีวิตการเชื่อมต่อ (Connect, Reconnect อัตโนมัติ, รับ Event)
- เชื่อมต่อ SignalR Event เข้ากับ Zustand Store เพื่อให้ UI อัปเดตทันที (Reactive) เมื่อเซิร์ฟเวอร์พ่นข้อมูลใหม่มา

### 3. UI: Real-time Status Indicator
- พัฒนา UI Component `SystemStatusBadge.tsx` นำไปติดไว้ที่ Header ด้านบนของทุกหน้า
- แสดงไฟสถานะ 🟢 (สมบูรณ์), 🟡 (มีบางระบบหน่วง), 🔴 (ระบบมีปัญหา) โดยดึงข้อมูลแบบ Real-time มาจาก Zustand Store

---

## ⚠️ User Review Required

> [!IMPORTANT]
> **เกี่ยวกับ Health Check Frequency (ความถี่ในการเช็คสถานะ):**
> ในแผนเบื้องต้น ผมจะตั้งค่าให้ Backend ทำการ Ping เช็ค Database และ MinIO เพื่อส่งให้ Frontend **ทุกๆ 15 วินาที** เพื่อลดภาระเซิร์ฟเวอร์ แต่ยังคงความรู้สึก Real-time ไว้ 
>
> หากตรงตามความต้องการ สามารถพิมพ์ **"ลุยเลย"** เพื่อให้ผมเริ่มติดตั้งไลบรารีและเขียนโค้ดได้ทันทีครับ!
