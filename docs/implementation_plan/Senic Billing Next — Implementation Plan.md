# Senic Billing Next — Implementation Plan

> **Vision:** ยกระดับการจัดการบิลลิ่งของ SME ไทย สู่ยุคดิจิทัลด้วยเทคโนโลยีขั้นสูงที่เข้าถึงง่าย รวดเร็ว และอบอุ่น

This plan transforms the existing Nanosoft Free Bill legacy desktop application into a cloud-native Progressive Web Application (PWA) named **Senic Billing Next**. The project is greenfield — the repo currently contains only documentation.

---

## User Review Required

> [!IMPORTANT]
> **Monorepo vs Polyrepo:** This plan places both frontend (`/frontend`) and backend (`/backend`) in a single repository for simplicity. If you prefer separate repos, let me know.

> [!IMPORTANT]
> **Tailwind CSS Version:** Your master prompt specifies Tailwind CSS. I'll use **Tailwind CSS v4** (the latest, with CSS-first configuration). Confirm if you'd prefer v3 instead.

> [!IMPORTANT]
> **Database Hosting:** The plan assumes a local PostgreSQL instance for development. For production, are you targeting Azure Database for PostgreSQL, AWS RDS, Supabase, or self-hosted?

> [!WARNING]
> **Scope of Initial Delivery:** Given the project's scale (4 major phases), I will build **all 4 phases end-to-end** as working code within this repository. However, Phase 4 (Premium Assets) will generate image prompts and use the image generation tool for actual asset creation.

---

## Open Questions

1. **Multi-tenancy model:** Should tenants share a single database with a `TenantId` column (row-level isolation) or have separate schemas/databases?
   - *Current assumption:* Row-level isolation with `TenantId` on every entity (simpler, SaaS-standard).

2. **PDF generation:** Client-side (e.g., `jsPDF` / `react-pdf`) or server-side (e.g., QuestPDF in .NET)?
   - *Current assumption:* Server-side with QuestPDF for precise Thai-language PDF output.

3. **State management:** React Context + `useReducer` vs Zustand?
   - *Current assumption:* Zustand (lightweight, recommended in your architecture blueprint).

4. **Running number format:** The master prompt specifies `INV-202605-0001`. Should all 4 document types follow the same pattern with different prefixes?
   - *Current assumption:* Yes — `RCP-YYYYMM-NNNN`, `CSB-YYYYMM-NNNN`, `DLV-YYYYMM-NNNN`, `INV-YYYYMM-NNNN`.

---

## Proposed Changes

The project will be structured as a monorepo:

```
senic-billing-next/
├── docs/                          # (existing) documentation
├── frontend/                      # React 19 + Vite + TypeScript PWA
│   ├── public/
│   │   ├── manifest.json          # PWA manifest
│   │   └── sw.js                  # Service worker
│   ├── src/
│   │   ├── assets/                # Generated 3D isometric images
│   │   ├── components/
│   │   │   ├── layout/            # DashboardLayout, Sidebar, Header
│   │   │   ├── forms/             # InvoiceForm, ReceiptForm, etc.
│   │   │   ├── dashboard/         # Charts, KPI cards
│   │   │   └── ui/                # Button, Input, Card, Modal (design system)
│   │   ├── hooks/
│   │   │   ├── useTheme.ts        # Dynamic theme switching
│   │   │   └── useDocumentForm.ts # Shared billing form logic
│   │   ├── pages/                 # Route-level pages
│   │   ├── services/              # API client (fetch/axios)
│   │   ├── store/                 # Zustand stores
│   │   ├── styles/
│   │   │   └── index.css          # Tailwind + CSS variables for theming
│   │   ├── types/                 # TypeScript interfaces
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── SenicBilling.Domain/          # Entities, Value Objects, Interfaces
│   │   ├── SenicBilling.Application/     # CQRS Handlers, DTOs, Services
│   │   ├── SenicBilling.Infrastructure/  # EF Core, Repositories, JWT
│   │   └── SenicBilling.API/             # Controllers, Middleware, Program.cs
│   └── SenicBilling.sln
└── README.md
```

---

### Phase 1: Database Architecture & Schema Design

#### [NEW] `backend/src/SenicBilling.Domain/Entities/Tenant.cs`
Multi-tenant root entity with company info, tax ID, address, logo URL.

#### [NEW] `backend/src/SenicBilling.Domain/Entities/Customer.cs`
Customer master data: name, tax ID (13-digit), address, phone, email, `TenantId` FK.

#### [NEW] `backend/src/SenicBilling.Domain/Entities/Product.cs`
Product/service catalog: name, SKU, unit, unit price (`decimal(18,4)`), category, `TenantId` FK.

#### [NEW] `backend/src/SenicBilling.Domain/Entities/DocumentHeader.cs`
Unified document header for all 4 types via a `DocumentType` enum (`Receipt`, `CashBill`, `DeliveryNote`, `TaxInvoice`). Fields: document number, date, customer FK, subtotal, discount, VAT amount, grand total, status enum (`Draft`, `Issued`, `Cancelled`), notes, `TenantId` FK.

#### [NEW] `backend/src/SenicBilling.Domain/Entities/DocumentLine.cs`
Line items: product FK (nullable for ad-hoc items), description, quantity (`decimal(18,4)`), unit price (`decimal(18,4)`), discount, line total, sort order.

#### [NEW] `backend/src/SenicBilling.Domain/Entities/DocumentNumberSequence.cs`
Concurrency-safe sequence table: `TenantId`, `DocumentType`, `YearMonth` (e.g. "202606"), `LastNumber` (int), `RowVersion` (concurrency token). Unique index on `(TenantId, DocumentType, YearMonth)`.

#### [NEW] `backend/src/SenicBilling.Domain/Entities/AppUser.cs`
User entity for authentication: username, password hash, role, `TenantId` FK.

#### [NEW] `backend/src/SenicBilling.Domain/Enums/DocumentType.cs`
Enum: `Receipt = 1, CashBill = 2, DeliveryNote = 3, TaxInvoice = 4`.

#### [NEW] `backend/src/SenicBilling.Domain/Enums/DocumentStatus.cs`
Enum: `Draft = 1, Issued = 2, Cancelled = 3`.

#### [NEW] `backend/src/SenicBilling.Infrastructure/Data/SenicBillingDbContext.cs`
EF Core 10 DbContext with Fluent API configuration:
- `decimal(18,4)` precision for all currency fields
- One-to-Many: Tenant → Customers, Products, Documents
- One-to-Many: DocumentHeader → DocumentLines
- Unique composite index on `DocumentNumberSequence(TenantId, DocumentType, YearMonth)` to prevent race conditions
- Concurrency token (`[Timestamp]`) on `DocumentNumberSequence.RowVersion`
- Query filters for soft-delete and tenant isolation

#### [NEW] `backend/src/SenicBilling.Infrastructure/Data/Migrations/` (auto-generated)
Initial EF Core migration.

---

### Phase 2: Backend API & Business Logic (.NET 10)

#### [NEW] `backend/src/SenicBilling.Domain/Interfaces/IDocumentNumberGeneratorService.cs`
Interface: `Task<string> GenerateNextNumberAsync(Guid tenantId, DocumentType type, CancellationToken ct)`

#### [NEW] `backend/src/SenicBilling.Application/Services/DocumentNumberGeneratorService.cs`
Implementation using optimistic concurrency with retry loop:
1. Query `DocumentNumberSequence` for `(tenantId, type, currentYearMonth)`
2. If not found, insert with `LastNumber = 1`
3. If found, increment `LastNumber`
4. Save with concurrency token check — retry on `DbUpdateConcurrencyException`
5. Format as `{PREFIX}-{YYYYMM}-{NNNN:D4}`

#### [NEW] `backend/src/SenicBilling.Application/DTOs/`
Request/Response DTOs: `CreateTaxInvoiceRequest`, `TaxInvoiceResponse`, `DocumentLineDto`, `LoginRequest`, `LoginResponse`, `ApiResponse<T>`.

#### [NEW] `backend/src/SenicBilling.API/Controllers/AuthController.cs`
- `POST /api/auth/login` — validates credentials, returns JWT + refresh token
- `POST /api/auth/register` — creates new user (admin-only)

#### [NEW] `backend/src/SenicBilling.API/Controllers/TaxInvoiceController.cs`
Secure RESTful API:
- `GET /api/tax-invoices` — paginated list with search/filter
- `GET /api/tax-invoices/{id}` — single document with lines
- `POST /api/tax-invoices` — create new (auto-generates number, calculates VAT 7%)
- `PUT /api/tax-invoices/{id}` — update draft only
- `DELETE /api/tax-invoices/{id}` — soft-cancel (issues Credit Note reference)

#### [NEW] `backend/src/SenicBilling.API/Controllers/DocumentController.cs`
Generic controller for Receipt, CashBill, DeliveryNote with CRUD endpoints.

#### [NEW] `backend/src/SenicBilling.API/Controllers/CustomerController.cs`
CRUD for customer master data.

#### [NEW] `backend/src/SenicBilling.API/Controllers/ProductController.cs`
CRUD for product catalog.

#### [NEW] `backend/src/SenicBilling.API/Controllers/DashboardController.cs`
Analytics endpoints: revenue by month, top products, document counts.

#### [NEW] `backend/src/SenicBilling.Infrastructure/Auth/JwtTokenService.cs`
JWT generation with `HS256`, configurable expiry, claims include `TenantId` and `Role`.

#### [NEW] `backend/src/SenicBilling.API/Program.cs`
.NET 10 minimal hosting: EF Core registration, JWT auth middleware, CORS for frontend, Swagger/OpenAPI, structured JSON responses.

---

### Phase 3: Frontend UX/UI & Client Interface (React 19)

#### [NEW] `frontend/` — Vite project scaffolding
Initialize with `npx -y create-vite@latest ./ --template react-ts` in non-interactive mode.

#### [NEW] `frontend/src/styles/index.css`
Design system foundation:
```css
/* CSS Variables for Dynamic Theming */
:root[data-theme="warm-horizon"] {
  --color-primary: #EA580C;      /* Orange 600 */
  --color-primary-dark: #9A3412; /* Orange 800 */
  --color-accent: #92400E;       /* Amber 800 */
  --color-surface: rgba(255,255,255,0.8);
  --glass-bg: rgba(255, 237, 213, 0.15);
  /* ... full palette */
}
:root[data-theme="deep-ocean"] {
  --color-primary: #0284C7;      /* Sky 600 */
  --color-primary-dark: #0C4A6E; /* Sky 900 */
  --color-accent: #164E63;       /* Cyan 900 */
  --color-surface: rgba(255,255,255,0.8);
  --glass-bg: rgba(186, 230, 253, 0.15);
  /* ... full palette */
}
```

#### [NEW] `frontend/src/hooks/useTheme.ts`
Custom hook to toggle `data-theme` attribute on `<html>`, persists preference in `localStorage`.

#### [NEW] `frontend/src/components/layout/DashboardLayout.tsx`
PWA-ready layout:
- Collapsible **Sidebar** with navigation (Dashboard, Receipt, Cash Bill, Delivery Note, Tax Invoice, Customers, Products, Settings)
- **Header** with search bar, theme toggle (sun/moon icon), user avatar dropdown
- **Content Area** with `rounded-xl` cards, soft glassmorphism `backdrop-blur`, minimal borders
- Responsive: sidebar collapses to hamburger on mobile

#### [NEW] `frontend/src/components/layout/Sidebar.tsx`
Animated sidebar with active route highlighting, collapsible groups, and brand logo.

#### [NEW] `frontend/src/components/layout/Header.tsx`
Top bar with global search, notifications bell, theme switcher, and user profile menu.

#### [NEW] `frontend/src/components/forms/InvoiceForm.tsx`
The core interactive billing form:
- **Customer Selection:** Typeahead search from master data
- **Document Lines:** Dynamic add/remove rows — each row has: product selector (typeahead), description, qty, unit price, discount, line total (auto-calculated)
- **Summary Panel:** Real-time computation of Subtotal, VAT (7%, toggleable Include/Exclude), and Grand Total
- **Zero unnecessary re-renders:** Uses `useMemo`, `useCallback`, React 19 concurrent features
- **VAT modes:** Toggle between "ราคารวม VAT" (VAT-inclusive) and "ราคาแยก VAT" (VAT-exclusive) — recalculates instantly
- **Keyboard shortcuts:** Tab through fields, Enter to add new line

#### [NEW] `frontend/src/components/forms/ReceiptForm.tsx`
Simplified form optimized for numpad input, auto-change calculation.

#### [NEW] `frontend/src/components/forms/CashBillForm.tsx`
Minimal-click form for point-of-sale scenarios, large Save & Print button.

#### [NEW] `frontend/src/components/forms/DeliveryNoteForm.tsx`
Form with status tracking badges (รอส่ง, กำลังส่ง, ส่งแล้ว).

#### [NEW] `frontend/src/components/dashboard/DashboardPage.tsx`
Analytics dashboard with:
- **KPI Cards:** Total Revenue, Documents Issued, Pending Invoices, Monthly Growth % — with animated counters
- **Revenue Chart:** Stacked bar chart (goods value + VAT) using Chart.js or Recharts
- **Top Products:** Interactive doughnut chart with toggle (by revenue / by quantity)
- **Recent Activity:** Live feed of recently issued documents

#### [NEW] `frontend/src/components/ui/` — Design System Components
Reusable primitives:
- `Button.tsx` — primary, secondary, ghost, danger variants with hover micro-animations
- `Input.tsx` — floating label, validation states, glassmorphism border
- `Card.tsx` — `rounded-xl`, `backdrop-blur`, soft shadow
- `Modal.tsx` — slide-in with backdrop blur
- `Badge.tsx` — status indicators with dot animation
- `Table.tsx` — sortable, searchable data table with pagination
- `ThemeToggle.tsx` — animated sun/moon icon toggle

#### [NEW] `frontend/src/pages/` — Route Pages
- `LoginPage.tsx` — elegant split-screen login with 3D illustration
- `DashboardPage.tsx`
- `TaxInvoicePage.tsx`, `ReceiptPage.tsx`, `CashBillPage.tsx`, `DeliveryNotePage.tsx` — list views with search/filter + form modal
- `CustomersPage.tsx`, `ProductsPage.tsx` — master data management
- `SettingsPage.tsx` — theme selection, company profile

#### [NEW] `frontend/public/manifest.json`
PWA manifest with app name, icons, theme color, `display: "standalone"`.

#### [NEW] `frontend/public/sw.js`
Basic service worker for offline caching strategy.

---

### Phase 4: Premium Asset Generation & Visual Design

#### Generated images using the image generation tool:
1. **Cloud Database Security** — 3D isometric diorama: glowing server rack, digital documents, Ocean Blue + red accents
2. **Billing Workflow** — 3D isometric: tablet hovering over receipts/invoices, Orange-Brown accents
3. **Real-time Analytics** — 3D isometric: floating bar charts, dashboard UI, Orange + Blue brand colors

These will be saved to `frontend/src/assets/` and used on the login page and empty states.

---

## Verification Plan

### Automated Tests

#### Backend
```bash
cd backend/src
dotnet build SenicBilling.sln          # Verify compilation
dotnet test                             # Run unit tests (if time permits)
```

#### Frontend
```bash
cd frontend
npm install
npm run build                           # Verify TypeScript compilation + Vite build
npm run dev                             # Start dev server for visual verification
```

### Visual Verification
- Use the **browser tool** to navigate the running frontend and verify:
  - Dashboard layout renders correctly with sidebar, header, content
  - Theme toggle switches between Warm Horizon and Deep Ocean dynamically
  - InvoiceForm adds/removes lines, calculates VAT in real-time
  - Charts render with mock data
  - PWA manifest loads correctly
  - Responsive layout works on mobile viewport

### Manual Verification
- User reviews the generated 3D isometric images for brand alignment
- User reviews the database schema for business logic correctness
- User tests the JWT auth flow end-to-end
