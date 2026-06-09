# Implementation Plan: Tenant Settings & Super Admin Portal

ตามที่คุณต้องการให้พัฒนาทั้ง 2 ส่วนหลักคือ **Tenant Settings** (สำหรับลูกค้า SME) และ **Super Admin Portal** (สำหรับคุณในฐานะ Platform Provider) โดยแยก Web UI ออกจากกันอย่างชัดเจน ผมได้วางแผนขั้นตอนการทำงาน (Implementation Plan) ไว้ดังนี้ครับ

## User Review Required
> [!IMPORTANT]
> - **Super Admin Frontend:** ผมจะสร้างโปรเจกต์ React (Vite) ขึ้นมาใหม่ชื่อ `admin-frontend` ในโฟลเดอร์หลักของโปรเจกต์ เพื่อให้แยก UI ออกจากฝั่งผู้ใช้งาน (SME) อย่างเด็ดขาดตามที่คุณต้องการ (จะแยก Port รันคนละอัน เช่น SME รัน 5173, Admin รัน 5174)
> - **Database Migration:** จะมีการเพิ่มตารางที่เกี่ยวกับ Package & Subscription เข้าไปในฐานข้อมูลหลัก
> - รบกวนตรวจสอบและยืนยันแผนนี้ หากเห็นด้วย ผมจะเริ่มลงมือเขียนโค้ดและดำเนินการตามแผนนี้ทีละขั้นตอนครับ

## Proposed Changes

---

### Phase 1: Database & Backend Domain Updates
เป็นการสร้างโครงสร้างฐานข้อมูลตามการออกแบบ `saas_database_design.md` เพื่อรองรับทั้ง 2 ฝั่ง
#### [MODIFY] `backend/src/SenicBilling.Domain/Entities/Tenant.cs`
- เพิ่มฟิลด์ `CurrentPlanId`, `SubscriptionStatus`, `SubscriptionValidUntil`
#### [NEW] `backend/src/SenicBilling.Domain/Entities/SubscriptionPlan.cs`
- ตารางแพ็กเกจ (Id, Name, MonthlyPrice, MaxUsers, MaxDocumentsPerMonth, Features JSONB)
#### [NEW] `backend/src/SenicBilling.Domain/Entities/TenantSubscription.cs`
- ประวัติการเช่าแพ็กเกจ
#### [NEW] `backend/src/SenicBilling.Domain/Entities/BillingInvoice.cs`
- บิลค่าบริการที่ Platform เรียกเก็บจาก SME
#### [NEW] `backend/src/SenicBilling.Domain/Entities/TenantUsageStat.cs`
- สถิติการใช้งานสำหรับนับ Quota
#### [MODIFY] `backend/src/SenicBilling.Infrastructure/Data/SenicBillingDbContext.cs`
- นำตารางใหม่ทั้งหมดเข้าไปผูกกับ EF Core พร้อมระบุ Index ที่เหมาะสม
- รันคำสั่งสร้าง Migration `AddSaaSSubscriptionModule` และอัปเดต Database

---

### Phase 2: ฝั่งผู้ใช้งาน (SME Tenant Settings)
เพิ่มหน้าตั้งค่าสำหรับเจ้าของบริษัท SME เพื่อให้จัดการข้อมูลบริษัทของตัวเองได้
#### [MODIFY] `backend/src/SenicBilling.Application/DTOs/Dtos.cs`
- เพิ่ม `UpdateTenantProfileRequest` (CompanyName, TaxId, Address, Phone, Email, LogoUrl, BranchName)
#### [MODIFY] `backend/src/SenicBilling.API/Controllers/TenantsController.cs`
- เพิ่ม Endpoint `PUT /api/tenants/profile` เพื่อให้แอดมินของ SME เข้ามาแก้ไขข้อมูลบริษัทตัวเอง
#### [NEW] `frontend/src/pages/settings/SettingsLayout.tsx`
- สร้าง Layout ย่อยสำหรับหน้าตั้งค่า (มี Tab ซ้ายมือ เช่น ข้อมูลบริษัท, บัญชีผู้ใช้)
#### [NEW] `frontend/src/pages/settings/CompanyProfilePage.tsx`
- สร้างฟอร์มให้กรอกข้อมูลองค์กร (ชื่อ, ที่อยู่, สาขา, เลขผู้เสียภาษี) และดึงข้อมูลไปแสดงใน Header/PDF อัตโนมัติ

---

### Phase 3: ฝั่งผู้ให้บริการ (Super Admin Portal)
สร้างระบบและ UI 분แยกออกมาต่างหาก
#### [NEW] `backend/src/SenicBilling.API/Controllers/SuperAdmin/` (Folder)
- `SaTenantsController.cs`: ดึงข้อมูลลูกค้าทุกบริษัท (Bypass TenantId filter) พร้อมปุ่ม Suspend/Impersonate
- `SaPlansController.cs`: จัดการแพ็กเกจราคา
- `SaBillingController.cs`: ดูยอดขายและบิลของ Provider
#### [NEW] `admin-frontend/` (Vite + React + Tailwind Project)
- สร้างโปรเจกต์แยกต่างหากด้วยคำสั่ง `npx create-vite admin-frontend`
- ติดตั้ง Tailwind CSS v4 เหมือนโปรเจกต์หลัก
- สร้างหน้า Dashboard (ภาพรวมรายได้, จำนวนลูกค้า)
- สร้างหน้า Tenants List (แสดงลูกค้าทั้งหมด และปุ่มระงับการใช้งาน)
- สร้างหน้า Packages & Plans (ตั้งค่าแพ็กเกจและการจำกัด Quota)

---

## Verification Plan

### Automated Tests & Checks
- `dotnet build` ผ่านฉลุยหลังแก้ Domain และ DbContext
- รัน `dotnet ef database update` ไม่เกิด Error
- `npm run build` ผ่านทั้งโฟลเดอร์ `frontend` และ `admin-frontend`

### Manual Verification
1. **SME User Flow:** ล็อกอินเข้า `frontend` (Port 5173) ในฐานะ Admin ไปที่เมนู "ตั้งค่า" แก้ไขชื่อบริษัท และตรวจสอบว่าชื่อบริษัทบนหัวบิลและ PDF เปลี่ยนตาม
2. **Super Admin Flow:** รัน `admin-frontend` (Port 5174) ล็อกอิน (อาจใช้ User พิเศษที่ตั้งค่า IsSuperAdmin=true ไว้) เข้าไปดูรายชื่อลูกค้า (Tenants) และเปลี่ยนสถานะแพ็กเกจลูกค้าได้
3. **Database Consistency:** ตรวจสอบตาราง `Tenants` ว่ามีข้อมูลแพ็กเกจเชื่อมโยงกับ `SubscriptionPlans` อย่างถูกต้อง
