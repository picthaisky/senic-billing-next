# Senic Billing Next 🚀

**ระบบจัดการเอกสารการเงินและบิลลิ่งออนไลน์ (SaaS)** ที่ออกแบบมาเพื่อยกระดับการทำบัญชีและออกเอกสารสำหรับธุรกิจ SME ไทย ไม่ว่าจะเป็นการพิมพ์ ใบกำกับภาษี, ใบเสร็จรับเงิน, บิลเงินสด หรือ ใบส่งของ 

ตัวระบบถูกออกแบบด้วยสถาปัตยกรรมที่ทันสมัย (**Clean Architecture** และ **Multi-tenant**) รองรับความปลอดภัยสูง และมาพร้อมกับ UI ที่หรูหรา ใช้งานง่าย (Glassmorphism & Dual Theme)

---

## 🌟 ฟีเจอร์หลัก (Key Features)

### 🎨 Frontend & User Experience (React 19 + Tailwind CSS v4)
- **Dual Theme System**: รองรับการเปลี่ยนธีม "Warm Horizon" (สีส้มอบอุ่น) และ "Deep Ocean" (สีน้ำเงินเข้ม) สลับได้ทันทีแบบ Real-time พร้อมปรับโทนสีของกราฟและ Modal ต่างๆ ให้กลมกลืนอัตโนมัติ
- **Glassmorphism UI**: การออกแบบโปร่งแสงระดับพรีเมียม สบายตาและให้ความรู้สึกทันสมัย
- **Balanced Layout Architecture (ศึกษาต้นแบบจาก PMO)**:
  - **Desktop Layout**: มี Sidebar ขนาดใหญ่เลื่อนและหด (Collapse) ได้อย่างลื่นไหล พร้อมคงความกว้างหลักไว้ไม่ให้เนื้อหาบิดเบี้ยว
  - **Mobile Layout**: ซ่อน Sidebar เพื่อประหยัดพื้นที่ และใช้ **BottomNav** (แถบควบคุมด้านล่างสไตล์ Native App) พร้อม **Floating Action Button (FAB)** สำหรับเรียกออกเอกสารด่วน
  - **Responsive Tables**: แปลงหน้าตารางข้อมูลขนาดใหญ่ (เช่น รายการสินค้า/ลูกค้า) ให้เป็น Card List ที่สวยงามและอ่านง่ายอัตโนมัติเมื่ออยู่บนหน้าจอมือถือ
  - **Micro-interactions**: เพิ่ม Pull-to-refresh บนหน้าแดชบอร์ด, Haptic Tap feedback และ Shimmer skeleton โหลดข้อมูลเสมือนจริง
- **Interactive Dashboard**: สรุปยอดขายแบบ Real-time พร้อมกราฟแบบโต้ตอบได้ (Recharts) และ KPI Cards แบบมี Animation คลาสสิก
- **Smart Forms**: ฟอร์มออกเอกสารที่รองรับการคำนวณภาษีมูลค่าเพิ่ม (VAT 7%) ทั้งแบบ **รวมภาษี (Inclusive)** และ **แยกภาษี (Exclusive)** พร้อมการเพิ่มบรรทัดอัตโนมัติเมื่อกด Enter

### ⚙️ Backend & Architecture (.NET 10 + PostgreSQL)
- **Clean Architecture**: โครงสร้างโค้ดที่แยกส่วนประกอบชัดเจน (Domain, Application, Infrastructure, API) เพื่อให้ดูแลรักษาและขยายต่อได้ง่าย
- **Row-level Multi-Tenancy**: รองรับลูกค้าหลายองค์กรในฐานข้อมูลเดียว โดยใช้ `TenantId` ร่วมกับ EF Core Global Query Filters เพื่อป้องกันข้อมูลรั่วไหลข้าม Tenant
- **High Concurrency Control**: การสร้างเลขเอกสารแบบเรียงลำดับ (Auto-running Sequence) รองรับผู้ใช้งานจำนวนมากพร้อมกันโดยไม่ซ้ำซ้อน ด้วยกลไก Optimistic Concurrency และ `DbUpdateConcurrencyException` Retry Loop
- **Precision Currency Math**: การตั้งค่าโครงสร้างฐานข้อมูลสำหรับเก็บข้อมูลทางการเงินด้วย `decimal(18,4)` เพื่อรองรับเศษสตางค์ตามกฎหมายภาษีไทยได้อย่างแม่นยำ
- **Stateless JWT Security**: ระบบ Authentication ด้วย JWT ที่ผูก `TenantId` ไว้เป็น Claim โดยตรง

---

## 💻 เทคโนโลยีที่ใช้ (Tech Stack)

### Frontend (Client-side)
* **Framework:** React 19, TypeScript, Vite
* **Styling:** Tailwind CSS v4, Custom CSS Variables
* **State Management & Routing:** Zustand, React Router v7
* **Data Visualization:** Recharts
* **Icons:** Lucide React

### Backend (Server-side)
* **Framework:** .NET 10 (ASP.NET Core Web API)
* **ORM:** Entity Framework Core 10 (Npgsql)
* **Database:** PostgreSQL 16
* **Security:** JWT Bearer Authentication

### DevOps & Deployment
* **Containerization:** Docker (Multi-stage builds)
* **CI/CD:** GitHub Actions
* **Container Management:** Portainer (via Webhooks)

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```text
senic-billing-next/
├── backend/                              # .NET 10 Solution
│   ├── src/SenicBilling.Domain/          # แกนกลางธุรกิจ (Entities, Enums, Interfaces)
│   ├── src/SenicBilling.Application/     # ลอจิกการทำงาน (Services, DTOs)
│   ├── src/SenicBilling.Infrastructure/  # EF Core DbContext, Data Access, Services
│   ├── src/SenicBilling.API/             # Controllers, Middlewares, DI Setup
│   └── Dockerfile                        # .NET Multi-stage build
├── frontend/                             # React 19 SPA
│   ├── src/                              # Source Code (Components, Hooks, Pages)
│   ├── public/                           # Static assets & Favicon
│   ├── nginx.conf                        # Reverse proxy rules
│   └── Dockerfile                        # Node + Nginx Multi-stage build
├── .github/workflows/ci-cd.yml           # GitHub Actions Pipeline
├── docker-compose.yml                    # Portainer Stack Deployment
└── stack.env                             # Environment Variables Template
```

---

## 🛠️ วิธีการติดตั้งและรันระบบ (Local Development)

### ข้อกำหนดเบื้องต้น (Prerequisites)
1. **Node.js** v22+
2. **.NET 10 SDK**
3. **PostgreSQL** v16+ (หรือรันผ่าน Docker)

### 1. การรันฝั่ง Backend
```bash
# เข้าสู่โฟลเดอร์ backend
cd backend

# อัปเดตโครงสร้างฐานข้อมูล (EF Core Migrations)
dotnet ef database update --project src/SenicBilling.Infrastructure --startup-project src/SenicBilling.API

# รัน API Server (ค่าเริ่มต้น http://localhost:5000)
cd src/SenicBilling.API
dotnet run
```

### 2. การรันฝั่ง Frontend
```bash
# เข้าสู่โฟลเดอร์ frontend
cd frontend

# ติดตั้ง Dependencies
npm install

# รัน Development Server (Vite)
npm run dev
```

---

## 🚀 การ Deploy ด้วย CI/CD & Portainer

ระบบนี้ได้เตรียม Pipeline การ Deploy อัตโนมัติเอาไว้เรียบร้อยแล้ว:
1. เมื่อทำการ **Push/Merge** โค้ดเข้าสู่กิ่ง `main`
2. **GitHub Actions** จะทำงาน (`.github/workflows/ci-cd.yml`) โดยการ Build Docker Images ของทั้ง Frontend และ Backend
3. อัปโหลด Images ไปที่ **GitHub Container Registry (GHCR)**
4. ส่ง HTTP POST ผ่าน Webhook ไปยัง **Portainer** เพื่อทำการ Pull Image ใหม่และ Restart Container อัตโนมัติ (อ่านรายละเอียดเพิ่มเติมในไฟล์ `docker-compose.yml` และ `stack.env`)

> **หมายเหตุ:** โปรดกำหนด `PORTAINER_WEBHOOK_URL` ใน GitHub Secrets ก่อนใช้งาน CI/CD
