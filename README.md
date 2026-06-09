# Senic Billing Next 🚀

**ระบบจัดการเอกสารการเงินและบิลลิ่งออนไลน์ (SaaS)** ที่ออกแบบมาเพื่อยกระดับการทำบัญชีและออกเอกสารสำหรับธุรกิจ SME และธุรกิจค้าปลีกของไทย รองรับการพิมพ์ใบเสนอราคา, ใบกำกับภาษี, ใบเสร็จรับเงิน, บิลเงินสด และใบส่งของ

ตัวระบบถูกสร้างด้วยสถาปัตยกรรมระดับ Enterprise (**Clean Architecture** และ **Multi-tenant**) รองรับความปลอดภัยสูง และมาพร้อมกับ UI ที่หรูหรา ใช้งานง่าย (Glassmorphism & Dual Theme) ตอบโจทย์ทั้งการใช้งานผ่านคอมพิวเตอร์และโทรศัพท์มือถือ

---

## 🌟 ฟีเจอร์หลัก (Key Features)

### 📦 ระบบจัดการคลังสินค้าและบาร์โค้ด (Inventory & Barcode POS-ready)
- **Automated Stock Deduction**: ระบบตัดสต็อกสินค้าอัตโนมัติเมื่อมีการออกเอกสาร บิลเงินสด, ใบส่งของ หรือ ใบกำกับภาษี
- **Barcode Scanner Integration**: รองรับการใช้งานร่วมกับเครื่องสแกนบาร์โค้ด (Barcode Scanner) ในหน้าออกบิล สแกนปุ๊บ สินค้าเด้งเข้าบิลปั๊บ พร้อมบวกจำนวน (Quantity) ให้อัตโนมัติหากสแกนสินค้าเดิมซ้ำ
- **SKU & Barcode Separation**: รองรับการจัดเก็บทั้งรหัสสินค้า (SKU) ภายใน และรหัสบาร์โค้ดสากลแยกกันอย่างชัดเจน

### 🤖 AI Integration & Advanced Workflow
- **Multi AI Agents System**: สถาปัตยกรรมที่รองรับการทำงานของ AI หลายตัวร่วมกัน เพื่อช่วยประมวลผลข้อมูล วิเคราะห์ และให้คำแนะนำแบบเจาะลึก
- **Senic AI Assistant**: ระบบแชทบอทอัจฉริยะแบบลอยตัว (Floating Chat) ที่ช่วยตอบคำถามและให้คำแนะนำผู้ใช้งาน พร้อม Integrated Database Search
- **Recurring Invoices**: ระบบตั้งเวลาสร้างเอกสารซ้ำอัตโนมัติ (Background Service) พร้อม Cron Job Scheduling (รองรับรายวัน, สัปดาห์, เดือน, ปี)
- **Public Shared Links**: สามารถสร้างลิงก์สำหรับแชร์เอกสาร (Invoices, Quotations) ให้ลูกค้าเปิดดูผ่านเว็บได้ทันทีโดยไม่ต้องล็อกอิน
- **Payment Gateway (Omise)**: รองรับการสร้าง Payment Link เพื่อให้ลูกค้าชำระเงินออนไลน์ และอัปเดตสถานะบิลอัตโนมัติ

### 👥 Customer & Document Management
- **Customer Branch Management**: รองรับระบบสาขาของลูกค้า (เช่น สำนักงานใหญ่ หรือ สาขาย่อย) เพื่อการออกใบกำกับภาษีที่ถูกต้องตามหลักสรรพากร
- **Document Attachments**: สามารถอัปโหลดไฟล์แนบ (สลิปโอนเงิน, เอกสารอ้างอิง) ผูกติดกับเอกสารแต่ละใบได้
- **Smart Forms**: ฟอร์มออกเอกสารที่รองรับการคำนวณภาษีมูลค่าเพิ่ม (VAT 7%) ทั้งแบบ **รวมภาษี (Inclusive)** และ **แยกภาษี (Exclusive)**

### 🏢 SaaS Multi-Tenant & Super Admin Portal
- **Super Admin Portal**: ระบบ Web Portal สำหรับผู้ให้บริการ (Platform Provider) แบบแยกขาดจากหน้าบ้าน SME เพื่อบริหารจัดการระบบในภาพรวม
- **Subscription Plans**: สร้างและปรับแต่งแพ็กเกจราคา (เช่น Free, Basic, Pro, Enterprise) พร้อมตั้งค่าราคาแบบรายเดือนและรายปี
- **Usage & Quota Limits**: จัดการขีดจำกัดของผู้ใช้บริการ เช่น จำนวน User สูงสุดต่อองค์กร หรือโควต้าเอกสารสูงสุดต่อเดือน
- **Tenant Management**: ดูรายชื่อลูกค้าแบบรวมศูนย์ พร้อมปุ่มระงับการเข้าถึงระบบ (Suspend/Activate) ได้ทันทีจากฝั่ง Admin
- **SME Settings**: หน้าต่างจัดการ Profile องค์กรสำหรับลูกค้า นำโลโก้/ข้อมูลบริษัทไปแสดงผลลงใบแจ้งหนี้อัตโนมัติ

### 🚀 Premium SaaS & Enterprise Features
- **SaaS Payment Integration**: รองรับการชำระเงินตัดบัตรเครดิตเพื่อเช่าแพ็กเกจ SaaS ทันทีผ่าน **Omise Payment Gateway**
- **Tax Reports & Excel Export**: ประมวลผลและส่งออกรายงานภาษีขายประจำเดือนในรูปแบบไฟล์ **Excel (.xlsx)** ด้วย `ClosedXML`
- **LINE Integration**: ลูกค้า (Tenant) สามารถบันทึก LINE Notify Token เพื่อรับการแจ้งเตือนต่างๆ และสามารถ **แชร์ลิงก์เอกสารให้ลูกค้าผ่าน LINE ได้ทันที** ด้วยปุ่ม "Share to LINE"
- **Role-based Access Control (RBAC)**: ระบบจัดการพนักงานภายในองค์กรแบบเจาะจงสิทธิ์ (Admin, Accountant, Sales, User) พร้อมระบบจัดการ Token ภายใน JWT
- **e-Tax XML Preparation**: สร้างไฟล์ **e-Tax Invoice XML** ตามมาตรฐาน UN/CEFACT สำหรับนำไปเซ็นดิจิทัลและส่งกรมสรรพากรได้อย่างสมบูรณ์

### 🎨 Frontend & User Experience (React 19 + Tailwind CSS v4)
- **Multi-language (i18n)**: รองรับการสลับภาษา ไทย/อังกฤษ ได้ทันทีแบบไม่ต้องรีเฟรชหน้า 
- **Dual Theme System**: รองรับการเปลี่ยนธีม "Warm Horizon" (สีส้มอบอุ่น) และ "Deep Ocean" (สีน้ำเงินเข้ม) สลับได้ทันทีแบบ Real-time
- **Balanced Layout Architecture**:
  - **Desktop**: Sidebar เลื่อนและหด (Collapse) ได้อย่างลื่นไหล
  - **Mobile**: ใช้ **BottomNav** และ **Floating Action Button (FAB)** สำหรับเรียกออกเอกสารด่วน
  - **Responsive Tables**: แปลงตารางข้อมูลให้เป็น Card List ที่อ่านง่ายเมื่ออยู่บนหน้าจอมือถือ
- **Real-time Notifications (SignalR)**: ระบบแจ้งเตือนแบบเรียลไทม์ผ่าน WebSocket
- **A4 Document Print Templates**: ระบบจำลองการพิมพ์เอกสารมาตรฐาน A4 (Print View) แสดงผลตรงปก (CSS `@media print`)

### 🛡️ Security, Auditing & Architecture (.NET 10 + PostgreSQL)
- **Role-based Access Control (RBAC)**: ระบบจัดการผู้ใช้งานและกำหนดสิทธิ์แบบละเอียดยิบ (Granular Permissions)
- **Document History & Audit Logs**: ระบบบันทึกประวัติการแก้ไขเอกสาร (Audit Trail) ติดตามการเปลี่ยนแปลงระดับ Field
- **Clean Architecture**: โครงสร้างโค้ดที่แยกส่วนประกอบชัดเจน (Domain, Application, Infrastructure, API)
- **Row-level Multi-Tenancy**: รองรับลูกค้าหลายองค์กรในฐานข้อมูลเดียว ป้องกันข้อมูลรั่วไหลข้าม Tenant ด้วย EF Core Global Query Filters
- **High Concurrency Control**: การสร้างเลขเอกสารแบบเรียงลำดับรองรับผู้ใช้งานจำนวนมากพร้อมกันโดยไม่ซ้ำซ้อน ด้วยกลไก Optimistic Concurrency
- **Precision Currency Math**: จัดเก็บข้อมูลทางการเงินด้วย `decimal(18,4)` รองรับเศษสตางค์อย่างแม่นยำ

---

## 💻 เทคโนโลยีที่ใช้ (Tech Stack)

### Frontend (Client-side)
* **Framework:** React 19, TypeScript, Vite
* **Internationalization:** i18next, react-i18next
* **Styling:** Tailwind CSS v4
* **State Management & Routing:** Zustand, React Router v7
* **Real-time:** @microsoft/signalr
* **Icons:** Lucide React

### Backend (Server-side)
* **Framework:** .NET 10 (ASP.NET Core Web API)
* **ORM:** Entity Framework Core 10 (Npgsql)
* **Database:** PostgreSQL 16
* **Background Jobs:** .NET Hosted Services (IHostedService)
* **Security:** JWT Bearer Authentication
* **Integrations:** Omise (Payment), MailKit (SMTP Email)

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
│   ├── src/SenicBilling.Infrastructure/  # EF Core DbContext, Data Access, Background Jobs
│   ├── src/SenicBilling.API/             # Controllers, SignalR Hubs, Middlewares, DI
│   └── Dockerfile                        # .NET Multi-stage build
├── frontend/                             # React 19 SPA (SME Tenant Portal)
│   ├── src/                              # Components, Hooks, Pages, Services
│   ├── public/                           # Static assets & Web App Manifest
│   ├── nginx.conf                        # Reverse proxy rules
│   └── Dockerfile                        # Node + Nginx Multi-stage build
├── admin-frontend/                       # React 19 SPA (Super Admin Portal)
│   ├── src/                              # Components, Hooks, Pages, Services
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

# รัน API Server (ค่าเริ่มต้น http://localhost:5220 หรือตามที่ตั้งค่าไว้ใน launchSettings.json)
cd src/SenicBilling.API
dotnet run
```

### 2. การรันฝั่ง Frontend (SME Portal)
```bash
# เข้าสู่โฟลเดอร์ frontend
cd frontend

# ติดตั้ง Dependencies
npm install

# รัน Development Server (Vite)
npm run dev
```

### 3. การรันฝั่ง Admin Frontend (Super Admin Portal)
```bash
# เข้าสู่โฟลเดอร์ admin-frontend
cd admin-frontend

# ติดตั้ง Dependencies
npm install

# รัน Development Server (Vite)
npm run dev
```

---

## 🚀 การ Deploy ด้วย CI/CD & Portainer

ระบบนี้ได้เตรียม Pipeline การ Deploy อัตโนมัติเอาไว้เรียบร้อยแล้ว:
1. เมื่อทำการ **Push/Merge** โค้ดเข้าสู่ Branch `main`
2. **GitHub Actions** จะทำงาน (`.github/workflows/ci-cd.yml`) โดยการ Build Docker Images ทั้ง 3 ส่วน (Backend, Frontend, Admin Frontend)
3. อัปโหลด Images ไปที่ **GitHub Container Registry (GHCR)**
4. ส่ง HTTP POST ผ่าน Webhook ไปยัง **Portainer** เพื่อทำการ Pull Image ใหม่และ Restart Container อัตโนมัติ (อ่านรายละเอียดเพิ่มเติมในไฟล์ `docker-compose.yml` และ `stack.env`)

> **หมายเหตุ:** โปรดกำหนด `PORTAINER_WEBHOOK_URL` ใน GitHub Secrets ก่อนใช้งาน CI/CD
