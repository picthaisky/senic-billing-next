# Senic Billing Next — Design System

A design system reconstructed from the **Senic Billing Next** product codebase. Use it to build on-brand interfaces, mocks, slides, and prototypes for the Senic Billing product family.

---

## 1. Product Context

**Senic Billing Next** (`SenicBilling`) is a **Thai SaaS billing & financial-document platform** aimed at Thai SME businesses. It lets a business issue and manage the four core Thai commercial documents:

| Doc | Thai | Prefix | Accent |
|-----|------|--------|--------|
| Tax Invoice | ใบกำกับภาษี | `INV` | orange `#ea580c` |
| Receipt | ใบเสร็จรับเงิน | `RCP` | green `#16a34a` |
| Cash Bill | บิลเงินสด | `CSB` | blue `#2563eb` |
| Delivery Note | ใบส่งของ | `DLV` | purple `#9333ea` |

Around document issuance it provides: a real-time **dashboard** (revenue + VAT trend charts, KPI cards), **customer** and **product** master-data management, **online payment**, document **PDF/print** (A4 templates), and **settings/profile**. It is architected as a **multi-tenant** SaaS (`TenantId` row-level isolation), with auto-running sequential document numbers and Thai-law-precise currency math (`decimal(18,4)`, VAT 7% inclusive/exclusive).

The product's two signature UX traits:
- **Dual Theme** — users toggle live between **"Warm Horizon"** (warm orange-brown, default) and **"Deep Ocean"** (cool blue). Charts and modals recolor automatically.
- **Glassmorphism + Balanced Layout** — translucent blurred surfaces, a dark collapsible desktop sidebar, and a native-app-style mobile experience (bottom nav, FAB, pull-to-refresh, card-ified tables).

**Tech stack (for reference):** React 19 + TypeScript + Vite, Tailwind CSS v4 with custom CSS variables, Zustand + React Router v7, Recharts for charts, **Lucide React** for icons. Backend is .NET 10 + PostgreSQL 16 (not relevant to design).

### Sources
This system was reconstructed from one repository the user provided:

- **GitHub:** https://github.com/picthaisky/senic-billing-next
  - Design tokens lifted verbatim from `frontend/src/index.css`
  - Component patterns from `frontend/src/components/**` (layout, dashboard, forms, auth)
  - Brand mark from `frontend/public/senic-favicon.svg`

> Readers with access should explore that repo directly — especially `frontend/src/index.css` (full token set + utility classes) and the `components/` tree — to build higher-fidelity Senic Billing designs than this summary alone allows.

---

## 2. Content Fundamentals

**Language.** The product UI is **Thai-first**. All user-facing copy — labels, buttons, table headers, navigation, toasts — is written in Thai. English appears only as (a) secondary `labelEn` hints in code, (b) document-number prefixes (`INV`, `RCP`), and (c) the brand wordmark "SenicBilling / Next Generation".

**Tone.** Professional, efficient, and businesslike — appropriate for accounting software. Not playful, not chatty. Copy is **instructional and concise**: it names the thing (`บันทึกเอกสาร` = "Save document", `เพิ่มรายการ` = "Add item", `ล้างข้อมูล` = "Clear"). Marketing-speak is reserved for the brand tagline only.

**Person / address.** The product addresses the user's data, not the user personally — labels are nouns ("ชื่อลูกค้า" = Customer name, "ยอดรวมสุทธิ" = Net total), not "your". Imperative verbs for actions ("กรุณากรอกชื่อลูกค้า" = "Please enter customer name" in validation). Polite register (`กรุณา` = "please") in alerts/validation.

**Casing.** Thai has no case. For the Latin bits:
- **UPPERCASE + letter-spacing** for micro-labels: table column headers, form section eyebrows, sidebar group dividers (`เอกสาร`, `ข้อมูลหลัก`, `ระบบ`).
- Title-style weight (bold) for headings; sentence flow for body.
- Document numbers are uppercase monospace: `INV-202606-0012`.

**Numbers & currency.** Always Thai locale formatting (`Intl.NumberFormat('th-TH')`), tabular/`tabular-nums`, 2 decimal places for money, `฿` symbol or "บาท" for totals. Percentages explicit ("ภาษีมูลค่าเพิ่ม 7%"). Relative time in Thai ("2 ชั่วโมงที่แล้ว" = "2 hours ago", "เมื่อวาน" = "yesterday").

**Emoji.** Not used in the product UI. (Emoji appear only as decoration in the repo's developer README, never in the app.) Do not use emoji in Senic Billing interfaces — use Lucide icons instead.

**Example copy:**
- Page/section eyebrows: `ข้อมูลลูกค้า` (Customer info), `รายการสินค้า / บริการ` (Items / services), `สรุปยอดรวม` (Summary).
- Buttons: `เข้าสู่ระบบ` (Log in), `บันทึกเอกสาร` (Save document), `ส่งออก Excel` (Export Excel), `ชำระเงินออนไลน์` (Pay online).
- Empty/validation: `ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง` (Incorrect username or password).
- Brand: `Senic` + `Billing` (primary-colored second word) / eyebrow `NEXT GENERATION`.

---

## 3. Visual Foundations

**Overall vibe.** Premium, modern, "futuristic yet warm" SaaS. Soft, low-contrast neutral canvas; one saturated brand color used decisively; generous rounding; translucent glass surfaces; restrained, tasteful motion. It reads as a polished fintech tool, not a flat enterprise CRUD app.

**Color.** A neutral warm-grey (Warm Horizon) or cool-slate (Deep Ocean) background with a **single dominant brand hue** (orange `#ea580c` / blue `#0284c7`). The brand color appears as a **3-stop diagonal gradient** (`--gradient-brand`, 135°) on the logo, primary buttons, avatars, and active accents — rarely as a flat fill. Text is near-black warm/cool (`#1c1917` / `#0f172a`) with two muted steps below. Status colors (green/amber/red/blue) are constant across themes and always shown as **tinted-background + saturated-text** pills (10% bg, 600-weight text). See `colors_and_type.css`.

**Type.** Single sans family — **Inter** for Latin, **Sarabun** for Thai — no serif, no separate display face. Hierarchy is built from **weight (400→800) and size**, not family changes. Numbers use `tabular-nums`. Micro-labels are uppercase + tracked. Document numbers/tax IDs are monospace.

**Spacing & layout.** Tailwind 4-px base grid; common rhythm is `gap-4` (16px) / `gap-6` (24px) between cards, `space-y-5/6` vertical stacks. Card padding `p-5`/`p-6` (20–24px). Desktop chrome: a dark **collapsible sidebar** (260px ⇄ 72px) + sticky 64px glass header; content max-width ~1200px. Mobile: sidebar hidden, replaced by a blurred **bottom nav** (5 tabs incl. "More" sheet) + a floating action button. Tables become card-lists on mobile.

**Backgrounds.** Flat soft solids (`--color-bg`) — **no full-bleed photos, no busy patterns or textures**. The only "imagery" is gradient fills (brand gradient, glass tints) and faint **watermark icons** (a Lucide glyph at ~5% opacity, rotated 12°, tucked into KPI-card corners). No hand-drawn illustration system.

**Cards.** Three tiers:
1. `.card` — solid white, 1px `--color-border`, `--radius-xl` (20px), very soft shadow; lifts shadow slightly on hover.
2. `.glass-card` — translucent `--color-surface` (85–88% white) + `backdrop-filter: blur(12px)` + tinted glass border + `--glass-shadow`; on hover lifts shadow **and** `translateY(-1px)`.
3. `.kpi-card` — `--gradient-card` tinted glass, `blur(8px)`, lifts `translateY(-2px)` on hover.

**Borders & radii.** Hairline 1px borders in a low-contrast neutral. Rounding is large and consistent: inputs/buttons `--radius-md/lg` (12–16px), cards `--radius-xl` (20px), pills/badges fully round, sidebar icon tiles `rounded-xl`. The 8→24px radius scale lives in `colors_and_type.css`.

**Shadows / elevation.** Soft, diffuse, low-opacity (max ~8% black) — never harsh. A 4-step `--shadow-sm…xl` scale plus colored glow shadows on primary buttons (`rgba(234,88,12,0.25)`) and a `pulse-glow` ring on status dots. Glass cards use a brand-tinted ambient shadow rather than neutral black.

**Transparency & blur.** Central to the brand. Used on: the sticky header (`backdrop-blur-md` over translucent surface), glass cards, mobile bottom nav (`blur(20px)`), and modal scrims (`bg-black/50`). Glass tints carry a faint brand hue (warm peach / cool sky).

**Motion.** Subtle and quick. Standard easing `cubic-bezier(0.4,0,0.2,1)` at 150/250/350ms tiers. Entrances: `fadeInUp` (12px rise + fade, ~0.5s) with **staggered delays** (`.delay-1…5`, 50ms steps) across card grids. Also `slideInLeft/Right`, `fadeIn`. Loading uses **shimmer skeletons**. Decorative loop: `pulse-glow` on live status dots. Mobile adds pull-to-refresh + haptic-tap feedback. No bouncy/springy or long animations.

**Interaction states.**
- **Hover** — buttons lighten via a white overlay (`::after` rgba white) and primary buttons add `translateY(-1px)` + a stronger colored glow; secondary buttons swap to `--color-surface-hover` and a primary-colored border; ghost buttons tint background + recolor text to primary; cards raise their shadow; table rows tint to `--color-surface-hover`.
- **Press/active** — `transform: scale(0.97)` on buttons (a subtle shrink). Mobile uses `haptic-tap`.
- **Focus** — inputs get a `--color-primary` border + a 3px primary-tinted focus ring (`0 0 0 3px rgba(234,88,12,0.1)`).
- **Active nav** — tinted background pill + brand-colored icon/label + a small dot indicator; icon stroke-weight thickens (1.8 → 2.5).

**Imagery vibe.** There is essentially no photographic imagery. Visual warmth comes from the gradient + warm neutral palette (Warm Horizon) or a crisp cool palette (Deep Ocean). Everything is vector: gradients, glass, and line icons.

---

## 4. Iconography

- **System:** **Lucide** (`lucide-react` in the product). Clean, consistent 24px line icons, ~1.8 stroke weight, rounded joins. This is the *only* icon system in the UI.
- **Stroke convention:** default `strokeWidth` ~1.8; **active/selected** items thicken to **2.5** (used in sidebar + bottom nav to signal selection). Sizes: 14–16px inline in buttons/tables, 18–22px in nav/header, up to 80px for faint corner watermarks.
- **Recurring glyphs:** `LayoutDashboard`, `Receipt`, `Banknote`, `Truck`, `FileText`/`FileCheck` (the four doc types), `Users`, `Package`, `Settings`, `Search`, `Bell`, `Sun`/`Moon` (theme toggle), `User`, `LogOut`, `Plus`, `Trash2`, `Save`, `Printer`, `Download`, `TrendingUp`, `ArrowUpRight/DownRight`, `ChevronLeft/Right`, `Menu`, `X`, `CreditCard`, `Loader2` (spinner).
- **Usage in this system:** load Lucide from CDN. For static HTML use the icon font / SVG sprite via `https://unpkg.com/lucide-static` or inline SVGs from `https://lucide.dev`. The UI kit uses `lucide` UMD (`https://unpkg.com/lucide@latest`) and calls `lucide.createIcons()`. **No emoji, no unicode-glyph icons.**
- **Brand mark:** `assets/logo-mark.svg` — a rounded square (`rx=28/100`) filled with the brand gradient, white bold **"S"** centered. Reproduce the wordmark as `Senic` + brand-colored `Billing`. There is no separate horizontal-lockup or monochrome logo asset in the repo.
- **Other assets:** `assets/icons.svg` is a small sprite of **social/footer brand icons** (GitHub, X, Discord, Bluesky, etc.) — not part of the core app UI. `assets/favicon.svg` is the app favicon.

> Substitution note: no font files were bundled in the repo — **Inter** and **Sarabun** are pulled live from Google Fonts (matching the product's own `@import`). Icons use the genuine Lucide set, so there is no substitution.

---

## 5. Index — what's in this system

| Path | What |
|------|------|
| `README.md` | This file — context, content + visual foundations, iconography, index |
| `SKILL.md` | Agent-Skill manifest for using this system in Claude Code |
| `colors_and_type.css` | All design tokens: dual-theme colors, status colors, radii, shadows, motion, type scale + semantic roles |
| `assets/logo-mark.svg` | Brand "S" mark (gradient rounded square) |
| `assets/favicon.svg` | App favicon |
| `assets/icons.svg` | Social/footer icon sprite (non-core) |
| `preview/` | Design-system specimen cards (colors, type, components) shown in the Design System tab |
| `ui_kits/billing-app/` | High-fidelity interactive recreation of the Senic Billing web app (login → dashboard → document form). See its own `README.md`. |

**Fonts:** Inter + Sarabun, loaded via Google Fonts `@import` in `colors_and_type.css` (no local files needed).
**Icons:** Lucide, loaded from CDN per file.
