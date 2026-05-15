# ProcureIQ Design System — Migration Implementation Plan
## v1.0 → v2.0 (White Mode Only)

**Date:** May 15, 2026  
**Author:** Antigravity AI  
**Status:** ![Status: Draft](https://img.shields.io/badge/Status-Draft-yellow)

### Executive Summary
The migration to **ProcureIQ Design System v2.0** transitions the procurement platform to a strictly token-driven, component-centric architecture. This plan focuses exclusively on the **White Mode** implementation, standardizing on the primary light surfaces and semantic tokens defined in the v2.0 library. By focusing on a single high-contrast light theme, we optimize for enterprise data density while ensuring rapid deployment and visual consistency across all procurement modules.

---

### Overview Table

| Phase | Phase Name | Effort (Days) | Dependencies | Deliverables |
| :--- | :--- | :--- | :--- | :--- |
| **0** | [Audit & Inventory](#phase-0-—-audit--inventory) | 2 | None | Visual Audit Spreadsheet, Token Mapping Table |
| **1** | [Design Token Foundation](#phase-1-—-design-token-foundation) | 1 | Phase 0 | `tokens.css`, Refactored `globals.css` |
| **2** | [Typography & Iconography](#phase-2-—-typography--iconography) | 1 | Phase 1 | Global Font Styles, Mono Scale |
| **3** | [Core Component Migration](#phase-3-—-core-component-migration) | 3 | Phase 1 | Button variants, Form controls, Badges |
| **4** | [Layout Components](#phase-4-—-layout-components) | 3 | Phase 3 | Card anatomy, Data tables, Sidebar, Tabs |
| **5** | [Overlay & Feedback](#phase-5-—-overlay--feedback-components) | 2 | Phase 4 | Modals, Toasts, Context menus, Popovers |
| **6** | [Loading & Empty States](#phase-6-—-loading--empty-states) | 1 | Phase 4 | Skeleton Loader system, Empty state components |
| **7** | [Dashboards & Data Viz](#phase-7-—-dashboard--data-visualization) | 2 | Phase 4 | KPI Stat Cards, Sparklines, Progress bars |
| **8** | [Semantic Color Audit](#phase-8-—-semantic-color-audit) | 1 | All | Refactored SCSS/CSS pass, Token linting |
| **9** | [QA & Documentation](#phase-9-—-qa-accessibility--documentation) | 2 | All | QA Report, Accessibility Audit, Component Docs |

---

## Phase 0 — Audit & Inventory
**Goal:** Establish a baseline of existing styles and map them to the v2.0 token set to ensure zero regressions in light mode.

### Scope
- Cataloging all hardcoded hex values, font sizes, and spacing in existing Tailwind/CSS files.
- Identifying non-standard UI patterns that don't exist in the v2.0 spec.
- Mapping shadcn/ui components currently in use to v2.0 component specs.

### Out of scope
- Any dark mode or secondary theme considerations.
- Design of new features.

---

## Phase 1 — Design Token Foundation
**Goal:** Implement the v2.0 CSS variable system (Light Scale) as the single source of truth.

### Scope
- Creation of `styles/tokens.css` containing all primary and neutral foundation tokens.
- Integration of tokens into `tailwind.config.ts`.
- Setting the global page background to the light neutral token.

### Out of scope
- Dark surface tokens (§10).

### Step-by-Step Tasks
1. Extract all `:root` properties (excluding dark-specific ones) from `docs/procurement-design-system (2).html` into `styles/tokens.css`.
2. Update `tailwind.config.ts` to map its color/spacing palette to these CSS variables.
3. Set `body` background to `var(--neutral-100)` and default text to `var(--neutral-900)` in `globals.css`.

---

## Phase 2 — Typography & Iconography
**Goal:** Standardize text hierarchy and monospace usage for optimal legibility on white surfaces.

### Scope
- Applying Inter and JetBrains Mono fonts.
- Implementing the typography scale (§03) globally.
- Standardizing label-caps and mono-IDs.

### Step-by-Step Tasks
1. Add `@font-face` or Google Font imports for Inter and JetBrains Mono.
2. Update `globals.css` to apply `--font-sans` to `body`.
3. Replace all occurrences of numeric IDs (PO numbers, Vendor codes) with font-mono.

---

## Phase 3 — Core Component Migration
**Goal:** Migrate high-frequency interactive elements (Buttons, Forms, Badges) to the v2.0 light-mode spec.

### Scope
- Updating all 7 button variants and 5 sizes.
- Implementing stateful form controls (hover/focus/error/success).
- Migrating the status badge system.

### Step-by-Step Tasks
1. Update `button.tsx` to include `subtle`, `outline-primary`, `ghost`, `success`, `danger`, `warning` variants using token values.
2. Refactor `input.tsx` to use `var(--neutral-300)` for default borders and `var(--primary-500)` for focus.
3. Apply `var(--shadow-focus)` to the focus-ring of all inputs.

---

## Phase 4 — Layout Components
**Goal:** Apply v2.0 card and table anatomy optimized for the light surface hierarchy.

### Scope
- Card header/body/footer structure.
- Enhanced table headers and row selection styles.
- Sidebar navigation and tab navigation.

### Step-by-Step Tasks
1. Update `card.tsx` to use `var(--r-xl)`, `var(--white)` background, and `var(--shadow-sm)`.
2. Modify `table.tsx` `thead` to use `var(--neutral-50)` background and uppercase labels.
3. Update `Sidebar` items to use `var(--primary-900)` background (as defined in §02 for Nav) with light text.

---

## Phase 5 — Overlay & Feedback Components
**Goal:** Implement the new elevation system for modals, toasts, and popovers on light backgrounds.

### Scope
- Modal/Dialog shadows and headers.
- Toast notification variants (Success/Danger/Warning/Info/Neutral).
- Context menus and filter popovers.

### Step-by-Step Tasks
1. Apply `var(--shadow-xl)` to `DialogContent` to ensure pop on light background.
2. Style toasts according to §15 using semantic light backgrounds.
3. Update context menus to use `var(--shadow-lg)` and `var(--r-lg)`.

---

## Phase 6 — Loading & Empty States
**Goal:** Standardize the "zero-data" and "loading" experience using light neutral shades.

### Scope
- Shimmer animation for skeletons using `var(--neutral-200)`.
- Standardized empty state illustrations and light-mode CTA buttons.

### Step-by-Step Tasks
1. Add the `@keyframes shimmer` to `globals.css`.
2. Update `skeleton.tsx` to use the `var(--neutral-200)` gradient.
3. Implement `EmptyState` component following §18 patterns.

---

## Phase 7 — Dashboard & Data Visualization
**Goal:** Apply semantic color usage to metrics and progress indicators.

### Scope
- KPI Stat cards with trend indicators (§20).
- Progress bars for budget tracking.
- Sparkline color mapping (Primary/Success).

### Step-by-Step Tasks
1. Map trend colors: `up` -> `var(--success-600)`, `down` -> `var(--danger-600)`.
2. Update `StatCard` to include the top colored border (§06 pattern).
3. Implement success/warning/danger variants for `Progress` bars.

---

## Phase 8 — Semantic Color Audit
**Goal:** Final pass to ensure all colors are derived from semantic tokens and meet light-mode contrast requirements.

### Step-by-Step Tasks
1. Perform a final codebase search for any hardcoded hex values.
2. Replace ad-hoc color classes with semantic equivalents (e.g., `text-red-500` -> `text-danger-600`).
3. Verify that `var(--neutral-100)` is the only page background used.

---

## Phase 9 — QA, Accessibility & Documentation
**Goal:** Validate implementation against v2.0 light-mode standards and WCAG 2.1.

### Scope
- Cross-browser testing on light surfaces.
- Contrast ratio checks (AA compliance).
- Keyboard navigation of all light-mode overlays.

---

## Appendix A: Token Quick Reference (Light Mode)

| Category | Token Name | Value |
| :--- | :--- | :--- |
| **Primary** | `--primary-600` | `#1a4480` |
| **Background** | `--neutral-100` | `#f3f4f6` |
| **Surface** | `--white` | `#ffffff` |
| **Success** | `--success-600` | `#15803d` |
| **Danger** | `--danger-600` | `#dc2626` |
| **Radius** | `--r-xl` | `12px` |
| **Shadow** | `--shadow-xl` | `0 20px 25px rgba(0,0,0,.1)` |

---

## Appendix B: Component Checklist (White Mode Only)

- [ ] §04 Button System (7 variants)
- [ ] §05 Form Controls (Inputs, Selects, Toggles)
- [ ] §06 Card Anatomy
- [ ] §07 Basic Data Table
- [ ] §08 Badges & Steppers
- [ ] §09 Alerts & Notifications
- [ ] §11 Elevation & Shadows
- [ ] §12 Containers & Panels
- [ ] §13 Skeleton Loaders
- [ ] §14 Modals & Dialogs
- [ ] §15 Toast Notifications
- [ ] §16 Popovers & Context Menus
- [ ] §17 Enhanced Data Table (Selection/Sorting)
- [ ] §18 Empty States
- [ ] §19 File Upload UI
- [ ] §20 KPI Stat Cards
- [ ] §21 Inline Editing Patterns
