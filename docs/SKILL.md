---
name: senic-billing-design
description: Use this skill to generate well-branded interfaces and assets for Senic Billing Next (a Thai SaaS billing / financial-document platform), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

Key files:
- `README.md` — product context, content + visual foundations, iconography, full index
- `colors_and_type.css` — dual-theme tokens (Warm Horizon / Deep Ocean), status colors, radii, shadows, motion, type scale + Kanit display face
- `preview/_components.css` — ready utility classes: `.card` / `.glass-card` / `.kpi-card`, `.btn-*`, `.badge-*`, `.input-field`, `.data-table`
- `assets/` — brand logo mark + favicon
- `ui_kits/billing-app/` — interactive React recreation of the app; lift components/patterns from here
- `preview/` — specimen cards for every token group

Remember: Thai-first copy, single Inter/Sarabun UI font (Kanit for display), Lucide icons (no emoji), glassmorphism, large radii, soft shadows, one saturated brand hue per theme used as a 135° gradient.
