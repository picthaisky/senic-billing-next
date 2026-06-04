# Billing App — UI Kit

A high-fidelity, interactive recreation of the **Senic Billing Next** web app, built from the product source (`senic-billing-next/frontend`). It is a cosmetic recreation for design work — visuals and click-through flows are faithful, but it is not production code (no real API, auth, or persistence).

## Run it
Open `index.html`. It loads React 18 + Babel from CDN and the design tokens from `../../colors_and_type.css` + `../../preview/_components.css`. Best viewed at ≥1100px wide.

## Flow
1. **Login** — any credentials; press เข้าสู่ระบบ (the form is pre-filled). 
2. **Dashboard** — KPI cards, revenue/VAT bar chart, top-products donut, recent-documents table.
3. **Documents** — pick any of the four doc types in the sidebar (ใบเสร็จ / บิลเงินสด / ใบส่งของ / ใบกำกับภาษี) to open the document form: editable line items, VAT 7% inclusive/exclusive toggle, live totals.
4. **ลูกค้า / สินค้า** — customer and product list tables.
5. **ตั้งค่า** — business-info settings form.
6. **Theme toggle** (header sun/moon) — switches live between Warm Horizon and Deep Ocean; persisted to `localStorage`.

## Files
| File | What |
|------|------|
| `index.html` | Entry point — loads React/Babel + all component scripts |
| `styles.css` | Kit-specific layout (app shell, sidebar, header, KPI, charts, form) |
| `Icons.jsx` | Lucide icons as inline-SVG React components (real geometry, 1.8/2.5 stroke) |
| `Shell.jsx` | `Sidebar` (dark, collapsible) + `Header` (search, theme, profile menu) |
| `Login.jsx` | `Login` screen |
| `Dashboard.jsx` | `Dashboard` — KPI cards, CSS bar + donut charts, recent docs table |
| `DocumentForm.jsx` | `DocumentForm` — customer info, line items, VAT totals |
| `Customers.jsx` | `DataPage` (customers + products lists) + `SettingsPage` |
| `App.jsx` | Root: auth + theme + page routing; mounts to `#root` |

## Component notes
- Components export to `window` so each Babel script can see the others.
- Charts are hand-built with CSS (`conic-gradient` donut, flex bars) rather than Recharts — lighter, same look. Chart palettes switch with theme.
- All copy is Thai, matching the product. Icons are Lucide. No emoji.

## Fidelity / omissions
- Recreated from code, so layout, spacing, color, and component anatomy match the source closely.
- Intentionally simplified or omitted: real charts (Recharts), file attachments, the payment modal, A4 print templates, mobile bottom-nav + FAB + pull-to-refresh (the source has these — see `components/layout/BottomNav.tsx`, `FloatingActionButton.tsx`, `forms/A4DocumentTemplate.tsx`). Add them by following the same token + utility-class conventions if needed.
