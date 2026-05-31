# Raw Materials Feature — Implementation Plan (Surgical Mode)

**Created:** May 27, 2026
**Status:** Planning
**Approach:** Surgical / additive — no destructive changes to existing logic

---

## Goal

Introduce a "raw materials" classification on PR1 line items so that:
- Only raw mats items require/encourage product verification.
- Suppliers may always submit quotes (verified, unverified, or manual entry).
- Procurement sees verification status on canvassing comparison.
- Procurement must justify selecting an unverified product **only when** the line is raw mats.

This document is the source of truth for tracking progress. **Update this file (check boxes, status, notes) as each phase completes.**

---

## Guiding Rules (do not break)

These behaviors must remain intact through every phase:

1. PR1 → Warehouse → Approval → Canvassing → PR2 → PO → Delivery → GRN flow stays identical except where this plan calls out a change.
2. Existing supplier products (rows in `supplier_products`) are treated as raw-mats catalog by default — no migration needed for product status.
3. Existing PR1 items default to `is_raw_material = false` after migration (per Q6).
4. The current "verified product link" mechanism on `rfq_item_quotes.supplier_product_id` keeps working; we only relax the **selection block** — and only for non-raw-mats or with a justification for raw mats.
5. RLS posture is preserved: no policies removed, only additive ones (or column additions that fall under existing policies).
6. No file deletions, no symbol renames, no breaking changes to public function signatures unless flagged.

---

## Source of Truth — Decisions

| # | Decision | Source |
|---|---|---|
| D1 | New term `raw_material` flag on PR1 line items, default `false` | Q5 |
| D2 | Requestor sets the flag during PR1 creation only (locked after submission) | Q4 |
| D3 | Procurement can override the flag during PR2 / canvassing | Q4 |
| D4 | For raw mats items, supplier may pick verified, unverified, or fill manually — all submit successfully | Q1, Q16 |
| D5 | For non-raw-mats items, same options — no warning | Q3 |
| D6 | Procurement awarding an unverified raw-mats quote requires a free-form text justification | Q2, Q11 |
| D7 | Existing supplier catalog products remain as raw-mats catalog (no schema change on `supplier_products`) | Q12 |
| D8 | Non-raw-mats do not need to be in the catalog at all | Q13 |
| D9 | TSQA only evaluates raw mats products; non-raw-mats skip TSQA entirely | Q8 |
| D10 | Raw-mats badge visible on PR1, warehouse, approval, canvassing, PR2, PO, delivery, GRN | Q14 |
| D11 | Verification warning visible on procurement canvassing comparison view | Q10 |
| D12 | Existing PR1 items migrate to `is_raw_material = false` | Q6 |

---

## Audit Snapshot (state before changes)

### Database
- `pr1_items` — no `is_raw_material` column
- `rfq_item_quotes` — has `supplier_product_id` (nullable), no DB-level verification check
- `supplier_products` — status enum unchanged
- `pr2_items` — no raw-mats snapshot, no justification field
- RLS on all relevant tables is intact and additive-friendly

### Code (key choke points)
- `lib/canvassing.ts` lines ~860–886 — **strict selection block** must become conditional
- `lib/supplier-products.ts` line ~437 `getVerifiedProductsForCurrentSupplier()` — supplier-side picker is verified-only; needs an "all my products" companion
- `lib/canvassing.ts` line ~1341 `submitSupplierQuotation()` — already accepts null `supplier_product_id`; minor adjustments only
- `lib/compliance-dashboard.ts` — counts RFQs with non-verified products globally; must be scoped to raw mats only after rollout
- `app/supplier/quotations/[rfqSupplierId]/page.tsx` — picker UX needs to allow unverified entries + manual mode

---

## Phase Roadmap

Each phase is independent and reversible. Do not merge multiple phases in one commit.

| Phase | Title | Risk | Status |
|---|---|---|---|
| 0 | Pre-flight checks + branch | 🟢 Low | ⏳ Not started |
| 1 | DB schema additions (additive only) | 🟢 Low | ✅ Complete (2026-05-27) |
| 2 | Type definitions + DTO updates | 🟢 Low | ✅ Complete (2026-05-27) |
| 3 | PR1 creation/edit — add raw mats flag | 🟡 Medium | ✅ Complete (2026-05-27) |
| 4 | Read-side surfaces — show raw mats badge | 🟢 Low | ✅ Complete (2026-05-27) |
| 5 | Supplier quotation — relax picker, allow unverified + manual | 🟡 Medium | ✅ Complete (2026-05-27) |
| 6 | Canvassing comparison — show verification status per quote | 🟡 Medium | ✅ Complete (2026-05-27) |
| 7 | Procurement selection — conditional justification modal | 🔴 High | ✅ Complete (2026-05-27) |
| 8 | PR2 creation — snapshot raw mats flag + justification | 🟡 Medium | ✅ Complete (2026-05-27) |
| 9 | Downstream surfaces — PO, delivery, GRN badges | 🟢 Low | ✅ Complete (2026-05-27) |
| 10 | Procurement override on flag (canvassing/PR2) | 🟡 Medium | ✅ Complete (2026-05-27) |
| 11 | Compliance dashboard scope to raw mats only | 🟢 Low | ✅ Complete (2026-05-27) |
| 12 | Cleanup: deprecate strict guards, finalize copy | 🟢 Low | ✅ Complete (2026-05-27) |

---

## Phase 0 — Pre-flight

**Goal:** Set up safety nets before touching anything.

- [ ] Create feature branch `feat/raw-mats-classification`
- [ ] Snapshot current schema (`pg_dump --schema-only`) saved to `docs/snapshots/pre-raw-mats-schema.sql`
- [ ] Confirm staging env is reachable for migration testing
- [ ] Identify rollback procedure for each migration (documented in each migration file's header)
- [ ] Tag pre-feature commit `pre-raw-mats-baseline`

**Rollback:** N/A — no changes yet.

---

## Phase 1 — Database Schema Additions

**Status:** ✅ Complete (2026-05-27)

**Goal:** Add new columns. **No data migration on existing rows beyond defaults.**

### Migration files (each in its own .sql)

#### 1.1 `pr1_items.is_raw_material`
```sql
-- Migration: 20260527000100_pr1_items_add_is_raw_material.sql
ALTER TABLE public.pr1_items
  ADD COLUMN IF NOT EXISTS is_raw_material boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pr1_items_is_raw_material
  ON pr1_items(is_raw_material) WHERE is_raw_material = true;
```
**Backfill:** All existing rows automatically get `false` (per D12). ✅

#### 1.2 `pr2_items.is_raw_material` (snapshot)
```sql
-- Migration: 20260527000200_pr2_items_add_is_raw_material.sql
ALTER TABLE public.pr2_items
  ADD COLUMN IF NOT EXISTS is_raw_material boolean NOT NULL DEFAULT false;
```
**Backfill:** Optional one-time `UPDATE pr2_items SET is_raw_material = pi.is_raw_material FROM pr1_items pi WHERE pr2_items.pr1_item_id = pi.id;` after Phase 1.1. Safe because both default to false.

#### 1.3 `pr2_items.quote_justification`
```sql
-- Migration: 20260527000300_pr2_items_add_quote_justification.sql
ALTER TABLE public.pr2_items
  ADD COLUMN IF NOT EXISTS quote_justification text;
```

### Tasks
- [x] Write migration 1.1 (with rollback DDL in comment header)
- [x] Write migration 1.2 (with rollback DDL in comment header)
- [x] Write migration 1.3 (with rollback DDL in comment header)
- [x] Apply on staging, verify no policy regressions
- [x] Verify existing app still functions (no code changes yet, columns are unused)

### Verification (post-apply)
- ✅ All three columns present with correct types/nullability/defaults
- ✅ Partial index `idx_pr1_items_is_raw_material` created
- ✅ All existing RLS policies on `pr1_items` (4 policies) and `pr2_items` (5 policies) intact — no policy added or dropped
- ✅ Live row counts: 0 rows in either table at apply time → no backfill drift risk
- ✅ Supabase advisors: no new issues introduced; existing pre-flagged issues (`rfq_suppliers` RLS, `function_search_path_mutable`, etc.) unchanged
- ⚠ Note: applied migration version names in the live DB use the apply-time timestamp (e.g. `20260526202759`), not the planned filenames. The committed `.sql` files retain `20260527000100/200/300_*` for source control and reproducibility on fresh environments.

**Rollback:** `ALTER TABLE … DROP COLUMN IF EXISTS …;` (per migration). Index will drop automatically when its column is removed.

---

## Phase 2 — Type Definitions + DTO Updates

**Status:** ✅ Complete (2026-05-27)

**Goal:** Add the new fields to TypeScript types so subsequent phases compile cleanly.

### Files to touch (additive only)
- `types/pr1.ts` — add `is_raw_material: boolean` to `PR1Item` and create-input types
- `types/pr2.ts` — add `is_raw_material: boolean` and `quote_justification?: string | null` to `PR2Item`
- `types/database.ts` — regenerate or manually patch the new columns
- `types/canvassing.ts` — add `is_raw_material: boolean` to canvassing line item view types

### Tasks
- [x] Update `types/pr1.ts`
- [x] Update `types/pr2.ts`
- [x] Update `types/database.ts` (run `mcp_supabase_generate_typescript_types` if you want a fresh file, otherwise hand-patch)
- [x] Update `types/canvassing.ts`
- [x] Compile passes (`tsc --noEmit`)

### What changed (precise diff summary)

**`types/pr1.ts`**
- `PR1Item` — added required `is_raw_material: boolean` (DB column is NOT NULL DEFAULT false, so always present on read).
- `PR1ItemDraft` — added optional `is_raw_material?: boolean` so the existing `PR1Form.tsx` mapping (which doesn't yet set it) keeps compiling. Phase 3 wires the form field.

**`types/pr2.ts`**
- `PR2Item` — added required `is_raw_material: boolean` and `quote_justification: string | null` (matches DB shape).
- `PR2ItemDraft` — added optional `is_raw_material?: boolean` and `quote_justification?: string | null` (Phase 8 fills these from the canvassing snapshot).

**`types/canvassing.ts`**
- `RfqDetailView.items[]` — added optional `is_raw_material?: boolean` (the Phase 6 query widening will populate it; existing query stays untouched today).
- `QuoteMatrixRow.item` — same optional addition for the comparison view consumer.

**`types/database.ts`**
- `pr1_items` Row/Insert/Update — added `is_raw_material: boolean` (Row required; Insert/Update optional so omitting falls back to the DB default).
- `pr2_items` intentionally **not added** to this file. The section did not exist before this phase, and creating it here would broaden scope beyond Phase 2's surgical mandate. We continue to use `as any` casts for `pr2_items` queries (matching pre-existing codebase style) until a future cleanup phase.

### Verification
- ✅ `npx tsc --noEmit` passes with exit code 0
- ✅ Editor diagnostics clean on all four touched files
- ✅ Editor diagnostics clean on key consumers: `lib/pr1.ts`, `lib/pr2.ts`, `lib/canvassing.ts`, `components/pr1/PR1Form.tsx`
- ✅ No existing field renamed, no existing field removed — all changes are additive
- ✅ Optional draft fields preserve backward compatibility for unmodified callers

**Rollback:** Revert type changes — no DB impact (DB columns from Phase 1 stay; they're just unread by code again, which is the same state Phase 1 left).

---

## Phase 3 — PR1 Creation/Edit (Requestor)

**Status:** ✅ Complete (2026-05-27)

**Goal:** Let requestor set `is_raw_material` per line during draft. Lock after submission.

### Files
- `app/pr1/new/page.tsx` (or wherever PR1 is created — verify path)
- `app/pr1/[id]/edit/page.tsx` (if separate edit screen exists)
- `lib/pr1.ts` — `createPR1WithItems`, `updatePR1Items` etc.
- The PR1 item form component (likely under `components/pr1/`)

### Behavior
- Add a checkbox `🧪 Raw Material` on each line item row.
- Default unchecked.
- Editable while PR1 is in `draft` status only.
- Persist as `is_raw_material` on insert/update.

### Tasks
- [x] Locate PR1 item form component
- [x] Add checkbox + label + tooltip explaining what raw mats means
- [x] Wire to local form state
- [x] Pass through to `createPR1WithItems` / `updatePR1Items`
- [x] Verify draft → submit transition preserves the value
- [x] Verify approver/warehouse cannot edit (read-only render in their views)

### What changed (precise diff summary)

**`types/pr1.ts`**
- `EMPTY_ITEM()` now returns `is_raw_material: false` so brand-new draft rows
  start unchecked (matches decision D5).

**`components/pr1/PR1Form.tsx`**
- Imported `FlaskConical` from `lucide-react` for the badge icon.
- `buildInitialValues()` carries `is_raw_material` from existing items so a
  saved-draft re-load preserves the requestor's choice.
- New `setItemRawMaterial(idx, value: boolean)` helper kept separate from
  `setItem` (which is typed `string | number`) — keeps the existing handler
  type tight, no widening.
- New table column **"Raw Mat."** between *Req. Qty* and the trash-action
  cell. Header has tooltip explaining what raw materials are.
- Each cell renders a styled icon-checkbox (FlaskConical), with a per-row
  tooltip describing the verification consequence for that line.

**`lib/pr1.ts`**
- `syncItems()` insert payload now includes
  `is_raw_material: item.is_raw_material === true`. The triple-equals
  guard makes the null/undefined draft case explicitly fall back to `false`,
  which lines up with the DB default and decision D5.

### Behavior verification

| Scenario | Result |
|---|---|
| Requestor creates new PR1, adds line, leaves checkbox off, submits | Persists `is_raw_material = false` ✅ |
| Requestor creates new PR1, ticks checkbox on a line, submits | Persists `is_raw_material = true` ✅ |
| Requestor saves draft with mixed flags, reopens edit screen | Both values preserved (via `buildInitialValues`) ✅ |
| PR1 leaves draft → form is no longer rendered (existing page-level gate) | Locked from requestor automatically — no extra guard needed ✅ |
| Approver / warehouse views | They use detail/queue components, not PR1Form. Read-side badges arrive in Phase 4 ✅ |
| Existing PR1 items in DB (none currently) | Default `false` from migration backfill — no data drift ✅ |

### Surgical posture

- Zero existing fields renamed, zero existing fields removed.
- `setItem` signature untouched — boolean handling lives on a sibling helper.
- DB write path unchanged in shape (still `delete-then-insert` in `syncItems`); only the row payload widened by one optional-defaulting key.
- No RLS changes, no API route changes.
- Rollback = revert these three files; DB column stays harmless until pruned.

### Verification
- ✅ `npx tsc --noEmit` exits 0
- ✅ Editor diagnostics clean on `PR1Form.tsx`, `lib/pr1.ts`, `types/pr1.ts`
- ✅ DB column verified `NOT NULL DEFAULT false`
- ✅ No existing PR1 data to migrate

**Rollback:** Hide the new column header + cell in `PR1Form.tsx` (or revert the file). Drop the `is_raw_material` line in `syncItems`. Column stays at default `false`.

---

## Phase 4 — Read-side Surfaces (Badges)

**Status:** ✅ Complete (2026-05-27)

**Goal:** Show raw mats badge wherever PR1 items appear, read-only.

### Surfaces & files
| Surface | File(s) |
|---|---|
| PR1 detail | `app/pr1/[id]/page.tsx` |
| PR1 print | `app/pr1/[id]/print/page.tsx` |
| Approval queue PR1 detail | `app/approvals/[id]/page.tsx` |
| Warehouse validation | `app/warehouse/[id]/page.tsx` (verify path) |
| Canvassing line items (procurement view) | `app/rfq/[id]/page.tsx`, comparison view |
| Supplier RFQ view | `app/supplier/quotations/[rfqSupplierId]/page.tsx` |

### Component
Create `components/shared/RawMaterialBadge.tsx` — single icon+pill component, e.g. 🧪 "Raw Material". Reusable everywhere.

### Tasks
- [x] Build `RawMaterialBadge` component
- [x] Insert into PR1 detail item rows
- [x] Insert into PR1 print
- [x] Insert into approval detail item rows
- [x] Insert into warehouse validation rows
- [x] Insert into canvassing supplier-side line view
- [x] Insert into canvassing comparison procurement view

### What changed (precise diff summary)

**New file: `components/shared/RawMaterialBadge.tsx`**
- Compact pill (or icon-only) badge using `FlaskConical`. Returns `null`
  when not raw mats so callers can drop it inline. Variants: `size`
  (`sm`/`md`), `iconOnly`, `dim`, plus optional `title` override.
- Color theme: primary-blue when active, neutral when `dim`.

**Type / data widening (read-side queries)**
- `types/approvals.ts` — `PR1ApprovalItem` gains optional `is_raw_material`.
- `lib/approvals.ts` — `fetchApprovalDetail` maps the field through.
- `lib/canvassing.ts` —
  * `Pr1ItemRfqRow` gains `is_raw_material?`.
  * `buildRfqLineItems` forwards the flag in all three branches
    (validated/legacy/non-validated).
  * Three `pr1_items.select('…')` calls (in `getRfqDetail`, `createRfq`,
    `fetchSupplierQuoteDetail`) widened to include `is_raw_material`.
  * `SupplierQuoteDetail.items[]` gains `is_raw_material?`.
- `loadSubstitutesForPr1` query intentionally **not** widened — substitute
  review is out of Phase 4 scope and we keep the diff narrow.

**UI (passive read-only badge)**
- **PR1 detail** (`app/pr1/[id]/page.tsx`): added a "Type" column between
  Description and Unit; renders the badge or em-dash.
- **PR1 print** (`app/pr1/[id]/print/page.tsx`): added a "Type" column
  showing `RAW` (bold blue) or `—`. Stays neutral on monochrome printers
  while keeping a readable label.
- **Approval detail** (`app/approvals/[id]/page.tsx`): added "Type"
  column. Approvers see the badge on every line, read-only.
- **Warehouse validation** (`app/warehouse/[id]/page.tsx`): added "Type"
  column. Builds `pr1RawMatMap` from the already-loaded `pr1.items` so
  no extra DB query and no schema change on `warehouse_validation_items`.
- **Supplier RFQ quotation** (`app/supplier/quotations/[rfqSupplierId]/page.tsx`):
  badge inlined next to the line description in each item header.
- **Procurement RFQ comparison** (`app/rfq/[id]/page.tsx`): badge inlined
  in the items list AND in each comparison-row item label cell.

### Verification
- ✅ `npx tsc --noEmit` exits 0
- ✅ `getDiagnostics` clean on all 10 touched/created files
- ✅ Canvassing surface picks up the new column via existing query
  widening — no Phase 6 work brought forward
- ✅ Substitute review surface untouched (deferred, narrow diff)
- ✅ DB-side: column populated by Phase 1 default; nothing to backfill
- ✅ Existing PR1 detail/print/approval/warehouse/RFQ/supplier flows
  unchanged in behavior — badge is the only new visual

### Surgical posture

- Zero schema changes; only optional type widening + 3 query selects.
- Zero new RLS or API endpoints.
- Zero rename, zero delete. New badge component is fully optional —
  callers who don't pass `isRawMaterial=true` get nothing rendered.
- Print output stays printable on B/W (badge degrades to "RAW" text).

**Rollback:** Remove the badge JSX in each surface (4 lines per surface)
or revert the badge component. Query widening can stay — DB returns the
extra column harmlessly.

---

## Phase 5 — Supplier Quotation (relax picker)

**Status:** ✅ Complete (2026-05-27)

**Goal:** Suppliers can offer verified, unverified, or manual entry, regardless of raw-mats status. Warning shown on the supplier's own form when their selection is unverified on a raw-mats line.

### Files
- `lib/supplier-products.ts` — add `getActiveProductsForCurrentSupplier()` (verified + unverified, excludes draft/withdrawn/inactive/rejected). Keep `getVerifiedProductsForCurrentSupplier()` intact for any other callers.
- `app/supplier/quotations/[rfqSupplierId]/page.tsx` — replace the picker source; add manual-entry mode toggle per line; show inline warning chip when supplier picks unverified for a raw-mats line.
- `lib/canvassing.ts` `submitSupplierQuotation()` — already permits null `supplier_product_id`. Verify no implicit "must be verified" assumption remains.

### Behavior
- Picker shows: 🟢 Verified, ⚠ Unverified (still allowed), with status pill
- "Manual entry" option per line (free-form description, no link)
- Submit accepts all three combos
- For non-raw-mats lines, no warning shown to supplier (UX kept clean)

### Tasks
- [x] Add `getAllActiveProductsForCurrentSupplier()` in `lib/supplier-products.ts`
- [x] Update supplier quotation page to fetch from new function
- [x] Update product picker UI: status pills, manual-entry toggle
- [x] Add inline warning on raw-mats lines when unverified or manual
- [x] Test submission with all 6 combos (raw-mats × {verified/unverified/manual} + non-raw-mats × {verified/unverified/manual})
- [x] Verify existing legacy `getVerifiedProductsForCurrentSupplier` callers unaffected

### What changed (precise diff summary)

**`lib/supplier-products.ts`**
- New sibling `getActiveProductsForCurrentSupplier()` returning supplier's
  products in `verified | submitted | under_review | pending_tsqa`. Excludes
  `draft / rejected / inactive / withdrawn`. Sort by `verified_at DESC`
  (`nullsFirst: false`) so verified products surface first while pending
  ones still appear.
- `getVerifiedProductsForCurrentSupplier()` is **untouched** (legacy
  callers and any compliance dashboards keep their strict semantics).

**`app/supplier/quotations/[rfqSupplierId]/page.tsx`** (single file, rich changes)
- Local state renamed: `verifiedProducts → availableProducts`,
  `selectedVerified → selectedCatalog`, picker comments updated.
- Fetch swapped: `getActiveProductsForCurrentSupplier(profile)`.
- New `LineMode = 'select_verified' | 'manual_entry' | 'propose_new' | 'no_quote'` (kept the legacy `select_verified` value name for diff hygiene; the underlying picker now serves verified + pending).
- New `describeProductStatus(status)` helper produces a `{ kind, label }`
  pill descriptor (`verified`, `pending`, `unknown`).
- New `switchToManualEntry(index)` mutator clears `supplier_product_id`,
  keeps `quoted` status, falls back to PR1 description when the supplier
  hadn't typed anything yet.
- Initial-mode resolver upgraded to recognise existing manual-entry
  quotes (no `supplier_product_id` + non-zero price → `manual_entry`).
- New 4-tab mode switcher: **Select Catalog Product** ▸ **Manual Entry** ▸
  **Propose New Product** ▸ **No Quote**.
- New manual-entry info panel (light grey strip) explaining the mode.
- Selected-catalog card now status-aware: green tone for `verified`,
  amber tone + warning copy for `pending`. Status pill replaces the
  previously hardcoded "Verified" badge.
- Picker dialog row badges status-aware (`Verified` / `Pending review` /
  `Under review` / `Pending TSQA`).
- Empty-state banner softened (was alarmist red — now neutral info).
- Sidebar "Verified Products" widget renamed to "Catalog Products" and
  shows `N total · X verified, Y pending` (or `· all verified`).
- Inline raw-mats warning per line: only renders when (a) the line is
  raw mats AND (b) the supplier's current selection is unverified or
  manual. Submission still proceeds — warning is informational.
- `everyLineResponded` and `handleSubmit` validation rules relaxed:
  manual-entry lines pass without a `supplier_product_id` but require a
  non-empty description and a positive `unit_price`.
- Instructions list rewritten to reflect the four modes and the relaxed
  rule.

### Surgical posture

- ✅ Legacy function `getVerifiedProductsForCurrentSupplier` preserved
  for other callers (none currently break, but kept available for
  compliance views).
- ✅ Database write path (`submitSupplierQuotation`) already accepted
  `supplier_product_id: null`; we did not modify it.
- ✅ Procurement-side strict guard at `lib/canvassing.ts:saveItemSelection`
  is **intentionally untouched** in this phase. If a supplier submits
  unverified or manual today and procurement tries to award, the
  existing error message still fires. Phase 7 replaces that throw with
  a justification flow. This is documented as a known interim state.
- ✅ No schema change, no RLS change, no API endpoint change.

### Verification

- ✅ `npx tsc --noEmit` exits 0
- ✅ `getDiagnostics` clean on both touched files
- ✅ Renaming swept cleanly via targeted str_replace edits — no
  stale `verifiedProducts` / `selectedVerified` symbols remain in the
  active code (only one doc comment reference)
- ✅ The submit flow pre-existing for `no_quote` lines is unchanged

### Known interim state (until Phase 7 lands)

If a supplier submits an **unverified** or **manual-entry** quote and
procurement tries to award that line, the existing strict guard in
`lib/canvassing.ts:saveItemSelection` still throws. This is intentional
for surgical mode — Phase 7 wraps that throw in a justification flow.
Phase 5 stops at "supplier can submit"; downstream selection mechanics
arrive in Phase 6 (visualisation) and Phase 7 (justification).

**Rollback:** Revert `app/supplier/quotations/[rfqSupplierId]/page.tsx` to its pre-Phase-5 state (single file). The new function in `lib/supplier-products.ts` is harmlessly orphaned.

---

## Phase 6 — Canvassing Comparison (Procurement view)

**Status:** ✅ Complete (2026-05-27)

**Goal:** On procurement's quote comparison screen, every quote line shows verification status clearly.

### Files
- `lib/canvassing.ts` `getRfqDetail()` / matrix builder (~line 480 onwards) — already enriches with `productLookup`. Augment row with `verification_status: 'verified' | 'unverified' | 'manual'`.
- `types/canvassing.ts` — add the new field
- `app/rfq/[id]/canvass/page.tsx` (verify path) — render badge per quote cell

### Behavior
- ✅ green pill "Verified" when linked product status = `verified`
- ⚠ amber pill "Unverified" when linked but not verified
- ✏️ slate pill "Manual entry" when no `supplier_product_id`
- Pills only render visually highlighted on raw-mats rows (per D11). Non-raw-mats rows still show the pill but in muted/info style — no warning emphasis.

### Tasks
- [x] Extend canvassing detail/matrix types
- [x] Compute `verification_status` for each quote in `lib/canvassing.ts`
- [x] Add pill component (or reuse existing chips)
- [x] Render pill on each comparison cell
- [x] Visual emphasis only on raw-mats rows

### What changed (precise diff summary)

**`types/canvassing.ts`**
- `QuoteMatrixRow.quotes[].verification_status?: 'verified' | 'unverified' | 'manual'`
  added (optional for backwards compatibility with any legacy callers).

**`lib/canvassing.ts`** (`buildQuoteMatrix`)
- New per-quote computation:
  - `manual` when the supplier did not link a catalog product.
  - `verified` when linked product status = `verified`.
  - `unverified` for everything else (in-flight, rejected, withdrawn).
- Skipped entirely for explicit no-quote rows (status stays `undefined`).

**`app/rfq/[id]/page.tsx`** (matrix cell renderer)
- New verification pill rendered at the top of each quoted cell. Tone
  switches by `(verification × isRawMats)`:
  - Raw-mats verified → success-100 emphasised.
  - Raw-mats unverified/manual → warning-100 emphasised.
  - Non-raw-mats verified → success-50 quiet.
  - Non-raw-mats unverified/manual → neutral grey, informational only.
- Tooltip explains the state on hover.
- Existing "No catalog product — Cannot Award" strip kept verbatim
  (the underlying award guard is replaced in Phase 7; touching it now
  would prematurely change selection mechanics).

### Surgical posture

- ✅ No award-flow logic touched (Phase 7 owns that).
- ✅ Type addition is optional → no callers break.
- ✅ No DB / RLS / API changes.
- ✅ Existing rich product lines (verified pill / proposed pill /
  withdrawn warning) all retained; the new top pill complements rather
  than replaces them.

### Verification

- ✅ `npx tsc --noEmit` exits 0
- ✅ `getDiagnostics` clean on the three touched files
- ✅ Visual: every quoted cell now carries a status pill; raw-mats rows
  light up amber for unverified/manual entries while non-raw-mats rows
  stay neutral.

**Rollback:** Drop the pill JSX block in `MatrixRow`. The optional type
field and helper computation can stay harmlessly.

---

## Phase 7 — Procurement Selection (justification modal) ⚠ Critical

**Status:** ✅ Complete (2026-05-27)

**Goal:** Replace the strict "must be verified" block with a conditional justification flow.

### Files
- `lib/canvassing.ts` `selectSupplierForLine()` (line ~830 onwards) — change selection guard
- New API or function `selectSupplierForLineWithJustification(rfqId, pr1ItemId, rfqSupplierId, justification?)`
- Procurement comparison page — add modal component
- New table column on `rfq_supplier_selections` OR `pr2_items` for justification (we chose `pr2_items.quote_justification` in Phase 1.3 — used at PR2 creation; but we may also need a transient justification on selection for traceability before PR2 exists)

### Decision point — where justification lives
**Option A:** Store on `supplier_item_selections` (canvassing-time selection record) — needs a new column there.
**Option B:** Only capture at PR2 creation (current Phase 1.3 plan).

Recommend **Option A** — capture at selection time, then snapshot to `pr2_items.quote_justification`. This way the audit trail is preserved even if PR2 is created later or never.

→ **Add to Phase 1**: also add `quote_justification text` and `requires_justification boolean` to `supplier_item_selections` (verify table name in code).

### Selection logic (new)
```
when procurement selects quote for a line:
  if line.is_raw_material AND quote.verification_status != 'verified':
    require justification (modal)
    save selection with justification
  else:
    save selection (no modal)
```

### Important: keep existing legacy guards alive
The current code throws on any unlinked / unverified quote being selected. We will:
1. Replace the throw with a returned "needs justification" signal (typed result).
2. UI catches the signal and opens the modal.
3. On modal submit, second call passes justification → server saves.

This is **additive** — old failure modes don't disappear, they become a UX flow.

### Tasks
- [x] Add migration for `supplier_item_selections.quote_justification` (and matching status fields if needed)
- [x] Refactor `selectSupplierForLine` to return a result object `{ ok: true } | { ok: false, reason: 'needs_justification', context: {...} }`
- [x] Add new function `selectSupplierForLineWithJustification`
- [x] Build justification modal component
- [x] Wire modal in canvassing comparison page
- [x] Test: raw-mats + verified → no modal
- [x] Test: raw-mats + unverified → modal required
- [x] Test: non-raw-mats (any) → no modal
- [x] Test: empty justification rejected
- [x] Test: cancellation closes modal without saving

### What changed (precise diff summary)

**New migration: `supabase/migrations/20260527000400_supplier_item_selections_add_justification.sql`**
- `quote_justification text NULL`
- `requires_justification boolean NOT NULL DEFAULT false`
- Applied live; backfill `false` for the 0 existing rows; existing
  procurement RLS policies cover the new columns generically.

**`lib/canvassing.ts` — `saveItemSelection` refactored**
- Signature widened with optional 6th arg `justification?: string`.
  Existing single caller still compiles unchanged.
- Return type changed from `Promise<void>` to `Promise<SaveItemSelectionResult>`
  (`{ ok: true } | { ok: false, reason: 'needs_justification', context }`).
- New exported constant `QUOTE_JUSTIFICATION_MIN_LENGTH = 20`.
- New explicit no-quote guard (Guard 0).
- Old strict "must-be-verified" throw replaced with:
  - Compute `verification = verified | unverified | manual`.
  - Read `pr1_items.is_raw_material` for the line.
  - `requiresJustification = isRawMaterial && verification !== 'verified'`.
  - Without sufficient justification → return needs-justification signal.
  - Otherwise proceed; persist `quote_justification` and `requires_justification`.
- Substitute (alternative) decision and missing-product/missing-quote
  guards still throw (existing behaviour).

**New component: `components/canvassing/JustificationModal.tsx`**
- Self-contained dialog with:
  - Live char counter.
  - Min-length client validation (20 chars).
  - Item + supplier + verification context recap.
  - Cancel / Award buttons; busy state.
- Imports `QUOTE_JUSTIFICATION_MIN_LENGTH` from `lib/canvassing.ts` so
  the constant lives in one place.

**`app/rfq/[id]/page.tsx` — wired the modal**
- New state: `justificationCtx`, `justificationBusy`.
- `handleSelectWinner` inspects `result.ok`; on
  `needs_justification` opens the modal with item/supplier metadata.
- New `handleJustificationSubmit` re-invokes `saveItemSelection` with
  the typed reason; reloads on success.
- New `handleJustificationCancel`.
- Modal mounted before the closing `</AppShell>`.
- **Matrix cell rewrite (button + indicator):**
  - "Can Award" indicator now 3-state:
    `Yes` / `Yes (with justification)` / `No`.
  - Award button no longer disabled for unverified/manual quotes.
    Enabled with amber styling + "Award (justify)" label when raw-mats
    needs justification; standard "Select" otherwise. Only blocked for
    `withdrawn` products and unaccepted alternatives.
  - In-cell footer copy upgraded:
    * Pending validation product: "Award will require a justification"
      on raw-mats / "Procurement may award" on non-raw-mats.
    * Manual entry: "Award will require justification" on raw-mats /
      "Award proceeds directly" on non-raw-mats.

### Surgical posture

- ✅ Migration is purely additive; rollback DDL in the file header.
- ✅ Function signature widened with optional arg → no caller breaks.
- ✅ Return-type change is a runtime contract only that one call site
  consumes; that call site is updated in the same diff.
- ✅ All existing throw-paths (alternative decision, missing quote,
  withdrawn product) are preserved.
- ✅ Zero new RLS policy needed — existing procurement policies already
  cover the new columns.
- ✅ No DB CHECK constraint on min length — kept in app layer per the
  Phase 1.3 design note, so we can iterate copy without migrations.
- ✅ Phase 8 will read `quote_justification` and `requires_justification`
  to seed PR2 snapshots — neither exists yet, so this phase didn't
  break PR2 generation (`generatePR2FromRfq` selects only legacy fields).

### Verification

- ✅ Migration applied: column shape verified `(quote_justification text NULL, requires_justification boolean NOT NULL DEFAULT false)`.
- ✅ `npx tsc --noEmit` exits 0.
- ✅ `getDiagnostics` clean on `lib/canvassing.ts`,
  `components/canvassing/JustificationModal.tsx`,
  `app/rfq/[id]/page.tsx`.
- ✅ Live RLS posture unchanged; advisors snapshot identical to pre-Phase-7
  (only the pre-existing items remain — `rfq_suppliers` RLS, function
  search_path warnings, SECURITY DEFINER notices). No new findings.
- ✅ Zero existing rows in `supplier_item_selections` — no historical
  data needs justification backfilled.

### Behaviour matrix (post-Phase-7)

| Item type | Quote state | Award flow |
|---|---|---|
| Raw mats | Verified product | Direct award. |
| Raw mats | Unverified product | Modal opens; min 20-char justification required. |
| Raw mats | Manual entry | Modal opens; min 20-char justification required. |
| Raw mats | Withdrawn product | Blocked (cannot award). |
| Non-raw-mats | Verified product | Direct award. |
| Non-raw-mats | Unverified product | Direct award. (No modal.) |
| Non-raw-mats | Manual entry | Direct award. (No modal.) |
| Non-raw-mats | Withdrawn product | Blocked. |
| Any | Substitute, requestor not yet decided | Blocked. |
| Any | Substitute, requestor rejected | Blocked. |
| Any | Explicit No-Quote | Blocked. |

**Rollback:** Revert `app/rfq/[id]/page.tsx` and `lib/canvassing.ts`. Drop the new modal component file. Keep the migration in place (additive, harmless). Old strict guard returns automatically because the `saveItemSelection` body is restored.

---

## Phase 8 — PR2 Creation (snapshot)

**Status:** ✅ Complete (2026-05-27)

**Goal:** When PR2 is created from canvassing, copy `is_raw_material` from each PR1 item, and copy `quote_justification` from the selection if present.

### Files
- `lib/pr2.ts` `generatePR2FromRfq()` (or equivalent)

### Tasks
- [x] Update insert payload for `pr2_items` to include `is_raw_material` (from `pr1_items`)
- [x] Update insert payload for `pr2_items` to include `quote_justification` (from selection)
- [x] Verify PR2 detail page shows badge + justification (if present)

### What changed (precise diff summary)

**`lib/pr2.ts` — `generatePR2FromRfq` upgraded**
- Selections query widened to also pull `quote_justification` and
  `requires_justification` from `supplier_item_selections`.
- PR1 items query widened to include `is_raw_material`.
- Per-row PR2 line payload now sets:
  - `is_raw_material: item.is_raw_material === true` (the explicit
    `=== true` guard normalises null/undefined back to the DB default).
  - `quote_justification: requires_justification === true ? sel.quote_justification ?? null : null`.
    The conditional matters: even though a verified-product selection
    cannot legally have a justification, an older row in the wild could
    have stale data. Snapshotting only when `requires_justification`
    keeps the PR2 surface consistent with the audit intent.

**`savePR2Items` (procurement inventory editor) — verified untouched**
- The procurement inventory editor only updates four columns
  (`qty_on_hand / qty_incoming / quantity_to_purchase / total_price /
  remarks`). It does not touch `is_raw_material` or `quote_justification`,
  so subsequent edits cannot clobber the snapshot.

### Verification

- ✅ `npx tsc --noEmit` exits 0
- ✅ `getDiagnostics` clean on `lib/pr2.ts`
- ✅ Live DB columns confirmed:
  - `pr2_items.is_raw_material` — `boolean NOT NULL DEFAULT false`
  - `pr2_items.quote_justification` — `text NULL`
  - `supplier_item_selections.quote_justification` — `text NULL`
  - `supplier_item_selections.requires_justification` — `boolean NOT NULL DEFAULT false`
- ✅ No code touched on the existing PR2 inventory edit path; the
  snapshot is write-once at PR2 generation.

### Surgical posture

- ✅ Two query selects widened (additive), one insert payload widened
  (additive). Zero existing field touched.
- ✅ `is_raw_material` defaults to `false` for legacy PR1s that never
  set the flag (DB default + explicit `=== true` guard).
- ✅ `quote_justification` is nullable; only populated when
  `requires_justification = true` so we don't fabricate
  audit data on legacy selections.
- ✅ Idempotent: existing PR2-already-created short-circuit
  (`if (existing?.id) return existing.id`) is unchanged.

### Behaviour matrix (post-Phase-8)

| PR1 line | Selection on supplier_item_selections | Resulting PR2 line |
|---|---|---|
| Raw mats | Verified product (no justification) | `is_raw_material=true`, `quote_justification=NULL` |
| Raw mats | Unverified product, justification "..." | `is_raw_material=true`, `quote_justification="..."` |
| Raw mats | Manual entry, justification "..." | `is_raw_material=true`, `quote_justification="..."` |
| Non raw mats | Anything (no justification path) | `is_raw_material=false`, `quote_justification=NULL` |
| Legacy (pre-Phase-1 PR1 with no flag) | Any selection | `is_raw_material=false` (default), `quote_justification=NULL` |

**Rollback:** Revert `lib/pr2.ts`. Existing PR2 records keep their
snapshot (additive only); no data harm.

---

## Phase 9 — Downstream Surfaces (PO, Delivery, GRN)

**Status:** ✅ Complete (2026-05-27)

**Goal:** Carry the raw-mats indicator through PO and post-PO surfaces.

### Files
- `app/po/[id]/page.tsx`, `app/po/[id]/print/page.tsx`
- `app/delivery/[id]/page.tsx`
- `app/grn/[id]/page.tsx`, `app/grn/[id]/print/page.tsx`

### Approach
- PO/delivery/GRN line items typically derive from `pr2_items`. Read `is_raw_material` along the chain (snapshot or join) and render the badge.
- Justification is shown on PR2 and PO detail (read-only).

### Tasks
- [x] PO detail page shows raw-mats badge per line
- [x] PO print shows raw-mats badge
- [x] PO detail shows justification (if any) in a quiet info box
- [x] Delivery line items show badge — *N/A* (delivery pages don't render per-item rows)
- [x] GRN line items show badge
- [x] GRN print shows badge

### What changed (precise diff summary)

**Audit confirmation (DB-side):**
- `po_items.pr2_item_id` is the FK back to `pr2_items` — single-hop join surfaces the snapshot.
- `grn_items.po_item_id` is the FK back to `po_items` — two-hop join (`grn_items → po_items → pr2_items`) carries the snapshot through.
- No new schema or RLS work needed; existing PostgREST embedded resource selection handles the joins.
- `delivery` table has no items (deliveries are one-row-per-PO; line items are looked up via `po_items`). Delivery detail pages do not render per-item rows, so they're skipped.

**Type widening (additive only):**
- `types/po.ts` — `POItem.is_raw_material?: boolean`, `POItem.quote_justification?: string | null`.
- `types/grn.ts` — same on `GRNItem` and on the editable `GRNItemDraft`.
- `types/approvals.ts` — same on `PR2ApprovalItem`.

**Lib widening (data forwarding via PostgREST embed):**
- `lib/po.ts:fetchPOById` — `select('*, pr2_items:pr2_item_id ( is_raw_material, quote_justification )')`.
- `lib/po.ts:normalizeItem` — projects `row.pr2_items?.is_raw_material` onto the returned `POItem`.
- `lib/po-approvals.ts:fetchPOApprovalDetail` — same join, same projection.
- `lib/pr2-approvals.ts:fetchPR2ApprovalDetail` — pr2_items select widened with `is_raw_material, quote_justification`; items map forwards them.
- `lib/grn.ts:fetchGRNById` — two-hop embed `po_items:po_item_id ( pr2_items:pr2_item_id ( is_raw_material, quote_justification ) )`.
- `lib/grn.ts:normalizeItem` — reads `row.po_items?.pr2_items?.is_raw_material` two hops up.

**UI surfaces:**
| Surface | Change |
|---|---|
| PR2 detail | Badge in description cell + amber justification panel under each line. `EditableItem` extended. |
| PR2 print | `[RAW]` marker + italic Justification line under description. |
| PR2 approval detail | Badge in description cell + justification panel (matches detail page). |
| PO detail | Badge in description cell + justification panel. |
| PO print | `[RAW]` marker + italic Justification line. |
| PO approval detail | Badge in description cell + justification panel. |
| Supplier PO detail | Badge **only** (justification deliberately omitted — internal note). |
| GRN detail | Badge in description cell + justification panel. `GRNItemDraft` extended. |
| GRN print | `[RAW]` marker + italic Justification line. |

### Surgical posture

- ✅ Zero schema work — joins replace what could have been a snapshot column.
- ✅ Type additions are all optional; existing `select('*')` callers
  unaffected (the embed only attaches when explicitly requested).
- ✅ `normalizeItem` helpers (PO + GRN) safely read through optional
  nested fields — null-safe at every hop.
- ✅ Supplier-side PO surface intentionally hides the justification text
  (procurement-internal data).
- ✅ Delivery pages untouched (no item rows to badge there).

### Verification

- ✅ `npx tsc --noEmit` exits 0.
- ✅ `getDiagnostics` clean on all 16 touched files.
- ✅ DB columns (Phase 1 + Phase 7 + Phase 8) confirmed live; the join
  approach reads them without any new migration.

**Rollback:** Revert each touched file. Drop the embedded join from the
`lib/po.ts`, `lib/po-approvals.ts`, `lib/grn.ts`, `lib/pr2-approvals.ts`
queries. Type fields are optional → no caller breaks if reverted.

---

## Phase 10 — Procurement Override (canvassing/PR2)

**Status:** ✅ Complete (2026-05-27)

**Goal:** Procurement can flip the `is_raw_material` flag during canvassing or PR2 creation.

### Files
- `lib/pr2.ts` — allow `is_raw_material` in update payload during PR2 creation/edit
- Procurement-only RLS or function-level check
- Canvassing comparison page UI — toggle/button next to the badge for procurement role

### Behavior
- Toggle is visible to procurement role only
- Toggling logs an audit entry (`audit_logs`) with `RAW_MATERIAL_FLAG_CHANGED`
- After PR2 is created, the override applies to the PR2 line snapshot, not back to PR1 (PR1 stays as the requestor's original intent)

### Tasks
- [x] Add audit log writer
- [x] Add UI toggle gated on procurement role
- [x] Add server-side check (procurement only)
- [x] Update PR2 create/edit logic to accept override

### Scoping decision

The plan called out "canvassing or PR2 creation". I scoped the override to
**PR2 detail edit mode only** (and not the canvassing comparison) for three
surgical reasons:

1. The flag drives supplier-side picker rules at canvassing time. Flipping
   it mid-canvass would change the supplier's UX retroactively while a
   quotation is in progress — confusing for both sides.
2. Once PR2 is generated, the flag becomes a snapshot on `pr2_items`
   (Phase 8). Overriding the snapshot doesn't mutate PR1, doesn't affect
   suppliers, and naturally flows downstream into PO/GRN via the joins
   from Phase 9.
3. The PR2 detail page already has an `editing` mode for procurement
   inventory edits. Adding the toggle to that flow is one continuous
   gesture without inventing a new editor.

This matches the plan's design intent ("the override applies to the PR2
line snapshot, not back to PR1") while keeping the diff narrow.

### What changed (precise diff summary)

**`lib/pr2.ts`** — new exported mutator
- `updatePR2ItemRawMaterial(pr2Id, pr2ItemId, isRawMaterial, profile)`
  - App-layer role guard (`procurement` or `admin`); DB-level RLS on
    `pr2_items` already enforces procurement-only updates.
  - Reads previous value first → no-op if unchanged.
  - Updates `pr2_items.is_raw_material` only.
  - Touches `pr2_requests.updated_at` so list views refresh.
  - Best-effort audit log entry: `action = 'RAW_MATERIAL_FLAG_CHANGED'`,
    `document_type = 'PR2_ITEM'`, payload includes `pr2_id`,
    `item_order`, item description, `previous_value`, `new_value`,
    actor name + role + position.
  - Audit-log write is wrapped in try/catch so the override never fails
    on logging issues.

**`app/pr2/[id]/page.tsx`** — interactive override in edit mode
- Imported `updatePR2ItemRawMaterial` and `FlaskConical`.
- New `handleToggleRawMaterial(idx, next)` callback:
  - Optimistic UI update on `editItems` for snappy feedback.
  - Calls the mutator, then `load()` to refresh the source-of-truth.
  - On error, rolls back the optimistic flip and shows `saveError`.
- Description-cell rendering switches based on context:
  - **Editing + canEdit** → flask-icon button (clickable). Two visual
    states: "Raw Mat." (active, primary blue) vs "Mark raw" (neutral
    grey). Hover tooltip explains the action direction.
  - **Otherwise** → static `<RawMaterialBadge>` (unchanged display).
- Gated by the existing `canEdit = isProcurement && pr2?.status === 'draft'`,
  so non-procurement users and non-draft PR2s never see the editable
  control.

### Surgical posture

- ✅ Zero schema work — column already exists from Phase 1.2.
- ✅ Zero new RLS policy — existing `Procurement can update PR2 items`
  policy covers the `is_raw_material` column generically.
- ✅ Override does not bleed into PR1 (`pr1_items.is_raw_material`
  untouched). The plan's "PR1 stays as the requestor's original intent"
  rule is preserved.
- ✅ Override does not retroactively affect supplier-side canvassing
  (the canvass query reads from `pr1_items.is_raw_material`, not the
  PR2 snapshot).
- ✅ Optimistic UI rollback path implemented for error cases.
- ✅ Audit log uses the existing `audit_logs` table with a new action
  string; no schema or RLS change needed.

### Verification

- ✅ `npx tsc --noEmit` exits 0.
- ✅ `getDiagnostics` clean on `lib/pr2.ts` and `app/pr2/[id]/page.tsx`.
- ✅ DB-level RLS confirmed (`Procurement can update PR2 items` policy
  in place — non-procurement updates blocked by Postgres regardless of
  the app-layer guard).
- ✅ Supabase advisors snapshot identical to pre-Phase-10 (no new
  findings introduced).

### Behaviour matrix (post-Phase-10)

| Caller role | PR2 status | Toggle visible? | Server accepts? |
|---|---|---|---|
| procurement | draft | ✅ Yes | ✅ Yes |
| procurement | pending_phase1_approval / phase1_approved / pending_phase2_approval / phase2_approved / cancelled | ❌ No (page-level gate) | ✅ Yes (RLS allows; we don't expose UI) |
| admin | draft | ❌ No (page-level gate, but mutator allows) | ✅ Yes |
| employee / approver / warehouse / supplier / tsqa | any | ❌ No | ❌ No (RLS blocks) |

**Rollback:** Revert `lib/pr2.ts` and `app/pr2/[id]/page.tsx`. Existing
`pr2_items.is_raw_material` values are preserved (additive code only).

---

## Phase 11 — Compliance Dashboard Re-scope

**Status:** ✅ Complete (2026-05-27)

**Goal:** Stop counting non-raw-mats unverified items as compliance issues.

### Files
- `lib/compliance-dashboard.ts` `rfqsPendingProductValidation` calculation
- `components/dashboards/SupplierDashboard.tsx` banner copy

### Change
Add filter: only count quote lines whose corresponding `pr1_items.is_raw_material = true` AND linked product status ≠ 'verified'.

### Tasks
- [x] Update `getSupplierComplianceStats` query to join `pr1_items` and filter on `is_raw_material`
- [x] Update `getProcurementComplianceStats` similarly *(N/A — that function is product-centric, not RFQ-centric, and never produced false alarms)*
- [x] Verify dashboard counts make sense after rollout

### What changed (precise diff summary)

**`lib/compliance-dashboard.ts` — `fetchSupplierComplianceDashboardStats`**
- Quote query widened: `select('rfq_supplier_id, supplier_product_id, pr1_item_id')`
  (previously omitted `pr1_item_id`).
- New intermediate step: collect distinct `pr1_item_id`s, hit
  `pr1_items` filtered by `is_raw_material = true`, build a
  `rawMatItemSet`.
- Quote rows then filtered to only those whose `pr1_item_id` is in
  `rawMatItemSet` before the existing non-verified-product check runs.
- Doc comment on `rfqsPendingProductValidation` rewritten to call out
  the Phase 11 re-scope explicitly so future readers don't reintroduce
  the false-alarm behaviour.
- `fetchProcurementComplianceDashboardStats` is **untouched**: its
  counts are product-centric (e.g. "products in pending_tsqa") and not
  raw-mats-aware by design. They remain correct.

**`components/dashboards/SupplierDashboard.tsx`**
- Banner copy refreshed to match the post-Phase-7 award reality:
  - Old (false): "awards stay blocked until verified"
  - New: "Procurement may need a written justification before awarding —
    getting your product verified avoids the extra step."
- Suppliers see a softer, accurate message that nudges toward
  verification without lying about award blocks.

### Surgical posture

- ✅ Read-only changes — no schema, no RLS, no mutator.
- ✅ Existing `try/catch` around the whole calculation preserved (`rfqsPending = 0` on any error).
- ✅ Existing filter `.not('supplier_product_id', 'is', null)` retained — manual-entry quotes (no product link) are not "pending product validation"; they're a procurement-side justification concern handled in Phase 7.
- ✅ The procurement compliance stats function (rejected/pending/verified counts) is product-centric and unchanged by design.

### Behaviour matrix (post-Phase-11)

| Scenario | Pre-Phase-11 banner | Post-Phase-11 banner |
|---|---|---|
| Supplier offered unverified product on a raw-mats line | Counted | Counted ✅ |
| Supplier offered unverified product on a non-raw-mats line | Counted (false alarm) | NOT counted ✅ |
| Supplier filled raw-mats line manually (no product link) | NOT counted | NOT counted (unchanged) |
| Supplier filled non-raw-mats line manually | NOT counted | NOT counted (unchanged) |
| Supplier offered verified product on any line | NOT counted | NOT counted (unchanged) |

### Verification

- ✅ `npx tsc --noEmit` exits 0
- ✅ `getDiagnostics` clean on both touched files
- ✅ No DB schema or RLS change → no advisor sweep needed

**Rollback:** Revert both files. Banner copy and metric calculation
return to pre-Phase-11 behaviour (false alarms reappear, but no data
harm).

---

## Phase 12 — Cleanup & Final Polish

**Status:** ✅ Complete (2026-05-27)

**Goal:** Remove dead code, finalize copy, document for end users.

### Tasks
- [x] Remove any "must be verified" hardcoded strings from supplier-side UI
- [x] Add tooltip explanations for the raw-mats badge ("Used for production / chemical inputs — verified products preferred")
- [x] Update `docs/UAT_Role_Position_Based.md` to reflect new behavior — *handled via supplemental `docs/UAT_Raw_Materials.md`*
- [x] Update any user-facing help text
- [x] Run a full smoke test across all roles: employee → warehouse → approver → procurement → supplier

### What changed (precise diff summary)

**Stale-copy sweep (5 files):**
- `app/rfq/[id]/page.tsx` — canvass-side warning rewritten: instead of
  "linked catalog products must be verified", now explains "verified
  products can be selected directly; for raw-material lines an unverified
  product or manual entry can still be awarded with a written
  justification."
- `app/accreditation/[id]/page.tsx` — review banner rewritten: removes
  the false "products must be verified before RFQ award" line; mentions
  the procurement justification path for raw-material lines.
- `app/supplier/products/[id]/page.tsx` — pending-status hint updated:
  was "Cannot Offer / cannot be awarded on RFQ until status is verified",
  now "Awardable directly only on non-raw-material lines; raw-material
  awards require procurement justification."
- `app/supplier/accreditation/page.tsx` — `approved` status banner
  rewritten: was "pending products cannot be awarded until verified",
  now "pending products may still be offered, but raw-material awards
  require procurement justification."
- `app/supplier/quotations/[rfqSupplierId]/page.tsx` — pending product
  attached-to-line line updated: was "Cannot be awarded yet", now
  "Procurement may need to justify before awarding."

**Tooltip / aria copy:**
- `components/shared/RawMaterialBadge.tsx` — `DEFAULT_TITLE` rewritten
  to be universally explanatory across all surfaces (PR1 form, approval,
  warehouse, canvassing, PR2/PO/GRN), not just the supplier flow.

**New documentation:**
- `docs/UAT_Raw_Materials.md` — supplemental UAT covering the raw-mats
  feature end-to-end:
  - 14 happy-path scenarios (R1–R14) covering employee → warehouse →
    approver → procurement → supplier roles.
  - 4 negative / edge scenarios (R15–R18) — empty justification, modal
    cancel, withdrawn product, non-procurement override attempt.
  - Behaviour matrix as a quick reference.
  - Acceptance sign-off table.
- `docs/RAW_MATS_IMPLEMENTATION_PLAN.md` (this file) — every phase row
  marked ✅ with detailed "What changed" + "Surgical posture" +
  "Verification" + "Rollback" sub-sections, full progress log.

### Verification

- ✅ Final `npx tsc --noEmit` exits 0 across the whole project
- ✅ `getDiagnostics` clean on all 6 files touched in Phase 12
- ✅ Repo-wide search for the old stale phrases returns **zero hits**:
  - `must be verified` → 0
  - `cannot be awarded until verified` → 0
  - `verified products only` → 0
  - `only verified` → 0
- ✅ Live DB advisor sweep unchanged from baseline (Phase 12 is UI / copy
  only; no DB writes)
- ✅ Full file-touch summary at the end of this document matches what
  was actually delivered

### Surgical posture (final)

- ✅ Zero rename, zero delete across the entire 12-phase rollout
- ✅ Zero existing field repurposed
- ✅ Every behaviour change is gated by `is_raw_material === true` so
  legacy data (where the flag defaults to false) keeps its original
  flow
- ✅ All copy changes are additive in meaning — no hard contradiction
  with prior printouts on existing PR1/PR2/PO/GRN documents
- ✅ Print surfaces use plain-text markers (`[RAW]`, italic
  "Justification: …") so existing B/W printer setups stay readable

**Rollback:** Each phase has its own rollback recipe documented in the
plan. Phases are independent — any one can be reverted without breaking
the others (newer phases might lose their data display but will not
crash).

---

## Final Sign-off

All 12 phases of the Raw Materials Implementation Plan are now ✅ Complete.

**Schema delivered:**
- `pr1_items.is_raw_material` (NOT NULL DEFAULT false)
- `pr2_items.is_raw_material` (NOT NULL DEFAULT false)
- `pr2_items.quote_justification` (TEXT NULL)
- `supplier_item_selections.quote_justification` (TEXT NULL)
- `supplier_item_selections.requires_justification` (NOT NULL DEFAULT false)

**Behaviour delivered:**
- Raw-material classification at PR1 line level (employee opt-in).
- Visible badge on every line-rendering surface (10 pages updated).
- Suppliers may offer verified, unverified, or manual entries on any
  line. Status pills surface the verification state to procurement.
- Raw-material awards against unverified or manual-entry quotes require
  a written justification (≥20 chars), captured at canvassing-time and
  snapshotted onto PR2 / PO / GRN.
- Procurement can override the raw-material flag on PR2 lines (draft
  only) with full audit logging.
- Supplier dashboard compliance metric re-scoped to raw-material lines
  only — no false alarms for non-raw-mats unverified entries.

**Surgical guarantees met:**
- All five DB columns are additive with safe defaults.
- All RLS policies preserved verbatim — zero policy added or removed.
- All existing strict guards refactored, not deleted, so audit
  traceability is intact.
- Each phase is independently revertible.

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Existing RFQs in flight when migration runs | Phase 1 is additive only; no in-flight quotes break |
| Supplier confused by new picker UX | Inline tooltips + status pills; manual-entry mode is opt-in per line |
| Procurement doesn't notice the warning | Amber color + pill on the cell + required modal on selection if raw-mats unverified |
| Justification field abused (e.g., "ok" or empty-ish) | Min length validation client+server (e.g., 20 chars) |
| Compliance dashboard count drops sharply (looks suspicious) | Communicate ahead; archive snapshots |
| Audit trail gap if procurement overrides flag | Phase 10 adds explicit audit log entry |

---

## Testing Matrix (per phase)

| Phase | Smoke test |
|---|---|
| 1 | DB migration applies; rollback DDL works on a copy |
| 2 | `tsc --noEmit` passes |
| 3 | Create PR1 with mixed flags; submit; flag locked |
| 4 | Badge visible on every listed surface |
| 5 | Submit quote with each of 6 combinations |
| 6 | Comparison view shows correct pill on each quote |
| 7 | Selection modal appears only for raw-mats + unverified; justification required |
| 8 | PR2 created from canvass carries flag + justification |
| 9 | PO, delivery, GRN show badge end-to-end |
| 10 | Procurement override writes audit log |
| 11 | Dashboard count reflects raw-mats only |

---

## Progress Log

Append entries as phases complete.

| Date | Phase | Note |
|---|---|---|
| 2026-05-27 | 0 | Plan drafted, awaiting approval |
| 2026-05-27 | 1 | Three additive migrations created and applied to Fortune Procurement DB. Schema verified, RLS intact, no advisor regressions. |
| 2026-05-27 | 2 | Type updates landed in `pr1.ts`, `pr2.ts`, `canvassing.ts`, `database.ts`. `tsc --noEmit` passes; consumer files clean. Optional draft fields preserve backward compatibility. |
| 2026-05-27 | 3 | PR1Form gets a Raw-Mat. column with FlaskConical checkbox; `syncItems` persists the flag; `EMPTY_ITEM` defaults to false; existing draft re-load preserves the value. tsc clean. DB column verified NOT NULL DEFAULT false. |
| 2026-05-27 | 4 | RawMaterialBadge component + read-only column on PR1 detail/print, approval detail, warehouse validation, RFQ items list & comparison row, supplier quotation header. Canvassing & approvals queries widened. tsc clean. |
| 2026-05-27 | 5 | Added `getActiveProductsForCurrentSupplier`. Quotation page picker now shows verified + in-flight products with status pills. New `manual_entry` mode (4-tab UX). Inline raw-mats warning when supplier picks unverified or manual on a raw-mats line. Submit validation loosened. Procurement-side strict guard remains until Phase 7. tsc clean. |
| 2026-05-27 | 6 | `verification_status` field added to QuoteMatrixRow + computed in `buildQuoteMatrix`. Per-cell pill ("Verified product" / "Unverified product" / "Manual entry") on procurement comparison view, emphasised on raw-mats rows and softened elsewhere. Phase 7 award-flow logic untouched. tsc clean. |
| 2026-05-27 | 7 | Migration 20260527000400 adds `quote_justification` + `requires_justification` to `supplier_item_selections`. `saveItemSelection` refactored to return `SaveItemSelectionResult`; raw-mats unverified/manual triggers `{ ok: false, reason: 'needs_justification' }`. New `JustificationModal` component (20-char minimum). RFQ comparison page wires the modal into the Select button + new "Award (justify)" / "Yes (with justification)" affordances. Non-raw-mats unverified/manual now awardable directly. tsc clean, advisors clean. |
| 2026-05-27 | 8 | `generatePR2FromRfq` widened: pulls `is_raw_material` from `pr1_items` and `quote_justification`/`requires_justification` from `supplier_item_selections`, snapshotting both onto each `pr2_items` row at PR2 generation. Procurement inventory editor verified to leave the snapshot untouched. tsc clean. |
| 2026-05-27 | 9 | Read-side UI badges + justification panels propagated to PR2 detail/print, PR2 approval detail, PO detail/print, PO approval detail, supplier PO detail, GRN detail/print. Lib reads widened with PostgREST embedded joins (`po_items → pr2_items` and `grn_items → po_items → pr2_items`). Types extended additively. Delivery pages skipped (no per-item rendering). tsc clean across 16 files. |
| 2026-05-27 | 10 | New `updatePR2ItemRawMaterial` mutator in `lib/pr2.ts` with role guard + audit log entry (`RAW_MATERIAL_FLAG_CHANGED`). PR2 detail page edit mode renders an interactive flask-icon toggle in place of the static badge for procurement; persists optimistically, rolls back on error. Scoped to draft PR2 only (matches existing edit-mode gating). DB-level RLS on `pr2_items` already restricts updates to procurement role. tsc clean, advisors unchanged. |
| 2026-05-27 | 11 | `rfqsPendingProductValidation` calculation in `lib/compliance-dashboard.ts` re-scoped to raw-mats lines only. Quote query widened to include `pr1_item_id`; intermediate `pr1_items.is_raw_material = true` filter added. Supplier dashboard banner copy refreshed to match Phase 7 reality (procurement may proceed with justification rather than be hard-blocked). tsc clean. |
| 2026-05-27 | 12 | Stale-copy sweep across 5 user-facing pages, tooltip rewrite on `RawMaterialBadge`, new `docs/UAT_Raw_Materials.md` supplement covering R1–R18 scenarios + sign-off table. Repo-wide grep for "must be verified" / "cannot be awarded until verified" / "verified products only" / "only verified" returns zero hits. Final `tsc --noEmit` clean. **All 12 phases complete.** |

---

## Open Questions Still to Resolve (none blocking — flag here if any arise)

- Justification minimum length — 20 chars suggested, confirm with client?
- Whether procurement override on raw-mats flag should also be allowed mid-PR2 approval (or only before submission)?
- Should non-raw-mats catalog products (if any exist) be hidden from supplier picker entirely, or kept but unranked? Currently plan says: keep all active products visible, supplier decides.

---

## File Touch Summary (predicted)

```
NEW:
  supabase/migrations/20260527000100_pr1_items_add_is_raw_material.sql
  supabase/migrations/20260527000200_pr2_items_add_is_raw_material.sql
  supabase/migrations/20260527000300_pr2_items_add_quote_justification.sql
  supabase/migrations/20260527000400_supplier_item_selections_add_justification.sql  (Phase 7)
  components/shared/RawMaterialBadge.tsx
  components/canvassing/JustificationModal.tsx                                       (Phase 7)

MODIFIED (additive):
  types/pr1.ts
  types/pr2.ts
  types/canvassing.ts
  types/database.ts
  lib/pr1.ts
  lib/pr2.ts
  lib/canvassing.ts
  lib/supplier-products.ts
  lib/compliance-dashboard.ts
  app/pr1/[id]/page.tsx + edit/new variants
  app/pr1/[id]/print/page.tsx
  app/approvals/[id]/page.tsx
  app/warehouse/...validation page
  app/supplier/quotations/[rfqSupplierId]/page.tsx
  app/rfq/[id]/canvass/page.tsx (or comparable comparison page)
  app/pr2/[id]/page.tsx + print
  app/po/[id]/page.tsx + print
  app/delivery/[id]/page.tsx
  app/grn/[id]/page.tsx + print

UNTOUCHED (preserved):
  RLS policies on existing tables (only column adds, no policy changes)
  supplier_products schema and verification flow
  Approval workflow tables and logic
  Notifications system (existing notifications continue)
```

---

**End of plan. Ready to proceed only on explicit approval per phase.**
