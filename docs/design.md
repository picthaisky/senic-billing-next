# 🎨 Senic Billing Next — Design System & Layout Architecture

> เอกสาร Design System ของ Senic Billing Next  
> ปรับปรุงล่าสุดจากการศึกษา Layout ของ PMO-Meeting-Action-Tracking-System

---

## 📐 Layout Architecture

### Desktop Layout (≥769px)

```
┌──────────┬────────────────────────────────────────────────┐
│          │  Header (h-16, sticky, backdrop-blur)          │
│ Sidebar  ├────────────────────────────────────────────────┤
│ w-64     │                                                │
│ (fixed)  │  Main Content Area                             │
│          │  max-w-[1440px], mx-auto                       │
│ collapse │  px-4 sm:px-6 lg:px-8                          │
│ → w-[72] │                                                │
│          │  ┌─────────────────────────────────────────┐    │
│          │  │  Page Content (max-w-[1200px] for forms)│    │
│          │  └─────────────────────────────────────────┘    │
│          │                                                │
└──────────┴────────────────────────────────────────────────┘
```

### Mobile Layout (<769px)

```
┌────────────────────────────────────────────────┐
│  Header (h-14, greeting + title)               │
├────────────────────────────────────────────────┤
│                                                │
│  Main Content Area                             │
│  p-4, pb-24 (safe area for BottomNav)          │
│                                                │
│                                                │
│                                                │
├────────────────────────────────────────────────┤
│  BottomNav (fixed bottom, h-16, glass blur)    │
│  [Home] [เอกสาร] [ลูกค้า] [สินค้า] [More]     │
└────────────────────────────────────────────────┘
   ┌──────┐
   │  +   │  FloatingActionButton (z-40)
   └──────┘
```

---

## 🧩 Layout Components

### 1. Sidebar (Desktop)

| Property | Value |
|---|---|
| Position | `fixed left-0 top-0 h-screen` |
| Width | `w-64` (expanded) / `w-[72px]` (collapsed) |
| Background | CSS gradient `var(--sidebar-bg)` |
| Collapse State | Persisted in `localStorage('sidebar_collapsed')` |
| z-index | `z-50` |

**Key Features (จาก PMO):**
- ✅ Smooth transition `duration-300`
- ✅ Section dividers (เส้นแบ่งกลุ่มเมนู)
- ✅ Active indicator dot
- ✅ Collapse toggle button (circular, absolute positioned)
- ✅ Version badge ที่ footer ของ Sidebar

### 2. Header (Desktop + Mobile)

| Platform | Height | Content |
|---|---|---|
| Desktop | `h-16` | Title + Search Bar + Actions |
| Mobile | `h-14` | Greeting + Title + Compact Actions |

**Key Features (จาก PMO):**
- ✅ Center search bar (`max-w-md mx-8`) พร้อม ⌘K shortcut
- ✅ User profile avatar พร้อม initials fallback
- ✅ Theme toggle (Sun/Moon)
- ✅ Notification bell with badge
- ✅ `backdrop-filter: blur` for glassmorphism effect

### 3. BottomNav (Mobile Only)

| Property | Value |
|---|---|
| Position | `fixed bottom-0 left-0 right-0` |
| Height | `h-16` + `safe-area-inset-bottom` |
| Backdrop | `blur(20px)` glassmorphism |
| Visibility | `md:hidden` |

**Key Features (จาก PMO):**
- ✅ 4-5 main tabs + "More" button
- ✅ Active tab indicator (top bar)
- ✅ Unread badge counts
- ✅ "More" menu slides up as bottom sheet

### 4. FloatingActionButton (Mobile Only)

| Property | Value |
|---|---|
| Size | `56px` circle |
| Position | Above BottomNav, right-aligned |
| Interaction | Expand to show quick actions |

---

## 🎨 Design Tokens

### Color Palette

#### Theme: Warm Horizon (Default)

```css
--color-primary:       #ea580c     /* Orange-600 */
--color-primary-hover:  #c2410c     /* Orange-700 */
--color-primary-dark:   #9a3412     /* Orange-800 */
--color-primary-light:  #fed7aa     /* Orange-200 */
--color-primary-50:     #fff7ed     /* Orange-50 */

--color-bg:             #faf9f7     /* Warm white */
--color-bg-secondary:   #f5f4f0     /* Warm gray */
--color-surface:        rgba(255, 255, 255, 0.85)
--color-surface-solid:  #ffffff

--color-text:           #1c1917     /* Stone-900 */
--color-text-secondary: #57534e     /* Stone-600 */
--color-text-muted:     #a8a29e     /* Stone-400 */
```

#### Theme: Deep Ocean

```css
--color-primary:       #0284c7     /* Sky-600 */
--color-bg:            #f8fafc     /* Slate-50 */
--color-text:          #0f172a     /* Slate-900 */
```

### Typography

| Element | Font | Size | Weight |
|---|---|---|---|
| Body | Inter, Sarabun | 16px | 400 |
| H1 (Page Title) | Inter | 1.25rem (20px) | 700 |
| H2 (Section) | Inter | 0.875rem (14px) | 600 |
| Label | Inter | 0.6875rem (11px) | 700, uppercase |
| Body text | Inter | 0.875rem (14px) | 400 |
| Small / Caption | Inter | 0.75rem (12px) | 500 |
| Monospace (ID) | Mono stack | 0.875rem | 600 |

### Spacing Scale

| Token | Value | Usage |
|---|---|---|
| `gap-2` | 0.5rem | Between compact items |
| `gap-4` | 1rem | Between form fields |
| `gap-5` | 1.25rem | Between card sections |
| `gap-6` | 1.5rem | Between major sections |
| `p-4` | 1rem | Mobile padding |
| `p-5` | 1.25rem | Card internal padding |
| `p-6` | 1.5rem | Desktop padding / large cards |

### Border Radius

```css
--radius-sm:  0.5rem    /* 8px — Small elements */
--radius-md:  0.75rem   /* 12px — Inputs, buttons */
--radius-lg:  1rem      /* 16px — Cards, panels */
--radius-xl:  1.25rem   /* 20px — Main cards */
--radius-2xl: 1.5rem    /* 24px — Hero/large cards */
```

### Shadows

```css
--shadow-sm:  0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
--shadow-md:  0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05)
--shadow-lg:  0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.05)
--shadow-xl:  0 20px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.04)
```

---

## 🧱 Component Library

### Cards

| Class | Usage | Hover |
|---|---|---|
| `.card` | Default solid card | Subtle shadow lift |
| `.glass-card` | Summary panels, KPI | Shadow + translateY(-1px) |
| `.kpi-card` | Dashboard KPI metric | Shadow + translateY(-2px) |

### Buttons

| Class | Style | Usage |
|---|---|---|
| `.btn-primary` | Gradient brand fill | Primary CTA |
| `.btn-secondary` | White bg, border | Secondary actions |
| `.btn-ghost` | Transparent | Tertiary / reset |
| `.btn-danger` | Red gradient | Destructive actions |

### Form Inputs

```css
.input-field {
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);   /* 12px */
  font-size: 0.9375rem;             /* 15px */
  focus: 3px ring in primary color
}
```

### Data Table

```css
.data-table th {
  font-size: 0.6875rem;         /* 11px */
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: var(--color-bg-secondary);
  border-bottom: 2px solid;     /* Strong visual anchor */
}
```

### Badges

| Class | Color | Usage |
|---|---|---|
| `.badge-success` | Green | Paid, Complete |
| `.badge-warning` | Yellow | Pending |
| `.badge-danger` | Red | Overdue, Error |
| `.badge-info` | Blue | Info, Processing |
| `.badge-neutral` | Gray | Draft |

---

## 📱 Responsive Design Patterns (จาก PMO)

### Breakpoints

| Breakpoint | Width | Behavior |
|---|---|---|
| Mobile | `< 768px` | Single column, BottomNav, FAB |
| Tablet | `768px — 1024px` | Sidebar visible, 2-col grid |
| Desktop | `> 1024px` | Full sidebar, multi-col grids |

### Mobile-First Principles

1. **Touch Targets**: ขั้นต่ำ `44px × 44px` (`.touch-target`)
2. **Safe Areas**: `env(safe-area-inset-*)` สำหรับ notch/Dynamic Island
3. **Bottom Sheet Pattern**: Modal บน mobile → slide-up bottom sheet
4. **Card Hover**: ปิด hover effect บน touch devices (`@media (hover: none)`)
5. **Scrollbar**: `scrollbar-thin` / `scrollbar-none` สำหรับ mobile containers
6. **Table → Card**: `.table-responsive` แปลง table เป็น card list บน mobile

### Key CSS Utilities

```css
/* Dynamic viewport height */
.h-dvh { height: 100dvh; }

/* Hide/show by platform */
.hide-mobile   { display: none !important; } /* @media ≤768px */
.hide-desktop  { display: none !important; } /* @media ≥769px */

/* Mobile adjustments */
@media (max-width: 768px) {
  .card { border-radius: 1rem; padding: 1rem; }
  .btn  { min-height: 44px; }
  body  { padding-bottom: var(--bottom-nav-height, 64px); }
  main  { padding-bottom: calc(var(--bottom-nav-height) + 16px); }
}
```

---

## 🎭 Animation System

| Animation | Duration | Usage |
|---|---|---|
| `fadeInUp` | 0.5s ease-out | Page entry |
| `fadeIn` | 0.4s ease-out | Element appear |
| `slideInLeft` | 0.4s ease-out | Sidebar enter |
| `slideInRight` | 0.4s ease-out | Panel slide |
| `slideUp` | 0.3s cubic-bezier | BottomSheet open |
| `pulse-glow` | 2s infinite | Status indicator |
| `shimmer` | 1.5s infinite | Skeleton loading |

### Staggered Animation

```css
.delay-1 { animation-delay: 0.05s; }
.delay-2 { animation-delay: 0.10s; }
.delay-3 { animation-delay: 0.15s; }
.delay-4 { animation-delay: 0.20s; }
```

---

## 📋 Layout Rules & Best Practices

### Content Width Constraints

| Component | Max Width | Reason |
|---|---|---|
| Main Content Wrapper | `1440px` | ป้องกันเนื้อหายืดเกิน |
| Form Pages | `1200px` | ฟอร์มอ่านง่าย |
| Dashboard Cards | `auto` (grid) | Grid จัดการ |

### Grid Patterns

| Pattern | Desktop | Tablet | Mobile |
|---|---|---|---|
| Dashboard KPI | 4 cols | 2 cols | 1 col |
| Form: Customer Info | 2 cols | 2 cols | 1 col |
| Summary Panel | 2/5 + 3/5 | 1 col | 1 col |
| Products/Customers | 3 cols | 2 cols | 1 col |

### Z-Index Scale

| Layer | z-index | Usage |
|---|---|---|
| Base content | 0 | Normal flow |
| Sticky header | 30 | Header bar |
| FAB | 40 | Floating Action Button |
| Sidebar | 50 | Navigation sidebar |
| Bottom sheet | 55 | Mobile modals |
| Overlay/backdrop | 50+ | Modal backdrops |
| Toast/alert | 100 | System notifications |

---

## 🔄 Design Evolution Log

| Date | Change | Reason |
|---|---|---|
| 2026-06-03 | Initial design system created | Project bootstrap |
| 2026-06-03 | Added Payment Modal | Omise integration |
| 2026-06-04 | Layout rebalanced from PMO study | PMO patterns adopted |
| 2026-06-04 | Added BottomNav for mobile | Mobile-first approach |
| 2026-06-04 | Added FAB component | Quick actions on mobile |
| 2026-06-04 | Added responsive breakpoint system | Consistent responsiveness |
| 2026-06-04 | Added touch optimization CSS | iOS/Android UX |
