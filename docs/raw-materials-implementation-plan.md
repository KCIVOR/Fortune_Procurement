# Raw Materials Workflow — Audit & Implementation Plan

> **Reference spec:** `docs/Final_Workflow.md` — *Raw Materials Requisition Approval and Fulfillment Workflow* (lines 91–186)  
> **Goal:** Implement Planning → PR2-direct raw material flow **without breaking** the existing Goods or Services paths.  
> **Method:** Audit-first (migrations + app code). Live DB queries were attempted 2026-07-27; connection failed for some queries — schema facts below cite **migration files** and **verified partial live query** unless marked *assumed*.

---

## How to use this plan

1. Read **Part 1 (Audit)** before writing code — do not assume table/workflow state.
2. Implement **phases in bundle order** (Part 3). Do not ship partial bundles.
3. Tick checkboxes as tasks complete.
4. After each phase, run that phase’s **Verification** block before continuing.
5. **Goods** (`request_type = 'goods'`, PR1 → warehouse → PR2) and **Services** must pass smoke tests after every bundle.

---

## Part 1 — Deep audit (as of 2026-07-27)

### 1.1 Spec summary (Raw Materials)

| Step | Action | Actor |
|------|--------|-------|
| 1 | Create PR2 directly (raw material request); **Prepared By** = Planning | Planning |
| 2 | Certify PR2 — Approve / Reject / Request Revision | Department Head |
| 3 | Final PR2 approval; notify Procurement for canvassing | Operations Manager |
| 4–6 | RFQ prepare + canvass → Proc Manager review → Director final | Procurement / approvers |
| 7–10 | PO create → approvals → manual Send to supplier | Procurement / Finance Director |
| 11–12 | Supplier ack + delivery updates; visible to Procurement, Warehouse, **Planning** | Supplier |
| 13–18 | Warehouse receive → GRN → **mandatory QA** all raw lines → TSQA approve → close → print | Warehouse / TSQA |

**Key distinctions vs Goods (spec §2):**

- No PR1, no warehouse validation before PR2.
- Planning-only requestors.
- Mandatory TSQA on **all** raw material GRN lines (Goods allows optional QA on non-raw lines).

---

### 1.2 Identity & access (verified in code)

| Item | Status | Evidence |
|------|--------|----------|
| `Planning` department (`PLAN`) | **Exists** (migration) | `supabase/migrations/20260727160000_planning_department_and_raw_mat_access.sql` |
| `Planning Staff` position (employee role) | **Exists** (migration) | Same migration |
| Dedicated `planning` app role | **Missing** | `types/auth.ts` — roles: employee, warehouse, procurement, approver, supplier, admin, tsqa |
| Planning nav / routes | **Missing** | `config/navigation.ts` — employee nav: Dashboard, My Requests, Delivery, Substitutes only |
| `/pr2` routes | **Procurement only** | `config/route-access.ts` line 83 |
| Raw mat flag on PR1 | **Planning-only** (interim) | `lib/raw-material-access.ts`, `lib/pr1.ts`, `components/pr1/PR1Form.tsx` |
| PR2 raw mat override | **Procurement + admin** | `lib/pr2.ts` → `updatePR2ItemRawMaterial()` |

**Note:** Interim PR1 raw-mat gating does **not** satisfy spec (Planning should not use PR1 for raw materials). It prevents employees from flagging raw lines until PR2-direct path exists.

---

### 1.3 Database schema (verified from migrations + partial live query)

#### `pr2_requests`

| Column / constraint | Current | Blocks raw-material PR2-direct? |
|---------------------|---------|----------------------------------|
| `pr1_id` | **NOT NULL** FK → `pr1_requests` | **Yes** — cannot create PR2 without PR1 |
| `rfq_id` | **Nullable** (since `20260721150200`) | No |
| `prepared_by_*` | Exists | Ready for Planning Prepared By |
| `request_type` column on table | **Not found in migrations** | Type resolved at read time via PR1 join (`lib/pr2.ts`) |
| Status values in app | `draft`, `pending_approval`, `approved`, `revision_requested`, `rejected`, `cancelled` | Used by `lib/pr2-approvals.ts` |

#### `pr2_items`

| Column | Current | Notes |
|--------|---------|-------|
| `pr1_item_id` | **Nullable** | OK for PR2-native lines |
| `is_raw_material` | NOT NULL default false | OK — raw PR2 lines should be `true` |
| Warehouse qty fields | Required numerics | Planning form can default qty_to_purchase = quantity_requested |

#### `rfq_batches`

| Column / constraint | Current | Blocks raw-material RFQ? |
|---------------------|---------|---------------------------|
| `pr1_id` | **NOT NULL** (live query confirmed) | **Yes** |
| `pr2_id` | **Nullable** (`20260721151000`) | Partial link exists |
| `UNIQUE (pr1_id)` | **Yes** (`20260424010756`) | One RFQ per PR1 — need PR2-based uniqueness for raw path |

#### `supplier_item_selections`

| Column | Current | Blocks raw-material RFQ? |
|--------|---------|---------------------------|
| `pr1_item_id` | **NOT NULL** | **Yes** — selections keyed to PR1 items |
| `rfq_id` | NOT NULL | OK |

#### `rfq_item_quotes`

| Column | Current | Notes |
|--------|---------|-------|
| Line key | `pr1_item_id` (via schema) | All canvassing matrix logic uses PR1 item IDs |

#### `request_type_for_delivery()` / `request_type_for_grn()`

| Behavior | Evidence |
|----------|----------|
| Resolves type via `deliveries → po → pr2 → pr1 → pr1.request_type` | `20260706140000_grn_services_procurement.sql` |
| Returns **NULL** if `pr2.pr1_id` is null | **Will break** warehouse GRN RLS (`= 'goods'`) and TSQA policies |

#### Planning seed

- Department + position migration applied (`20260727160000`).
- **No demo Planning user** in migrations (*assign manually in Admin*).

---

### 1.4 Approval workflows (verified from migrations)

| Workflow code | Steps | Used for |
|---------------|-------|----------|
| `PR2_FINAL` | 1. Dept Head (Certified By) → 2. Ops Manager (Approved By, final) | Goods PR2 (`20260721150100`) |
| `PR2_PHASE1` | Proc Staff → Proc Manager → Director (3 steps; Dept Head removed) | Services / fallback when no goods PR1 (`submitPR2ForApproval()`) |
| `RFQ_APPROVAL` | 1. Procurement Manager → 2. Director (final) | RFQ canvassing sign-off (`20260721151100`) |
| `PO_APPROVAL` | Proc Staff → Proc Manager → Finance Director (final) → Supplier ack (final) | PO (live DB verified 2026-07-27) |

#### Critical app logic: `submitPR2ForApproval()` (`lib/pr2-approvals.ts`)

```text
if (pr2.pr1_id) {
  load pr1.request_type
  if goods → workflowCode = 'PR2_FINAL'
} else {
  workflowCode = 'PR2_PHASE1'   ← raw-material PR2 with null pr1_id would hit this today
}
```

**Risk:** PR2-direct raw materials with `pr1_id = null` would submit to **wrong workflow** unless extended.

#### PR2 final approval side effects (`submitPR2ApprovalAction`)

- Sets `pr2_requests.status = 'approved'`.
- If `workflowCode === 'PR2_FINAL'` **and** `pr2.pr1_id` present → sets PR1 `status = 'pr2_approved'`.
- Notifies procurement (downstream RFQ queue depends on PR1 `pr2_approved` for goods).

**Raw-material PR2-direct** must route to `PR2_FINAL` (not `PR2_PHASE1`). Procurement notification on final approve **already fires** for any `PR2_FINAL` completion (`lib/pr2-approvals.ts` ~637). PR1 status update is **already skipped** when `pr1_id` is null (~539) — Phase 2 mainly adds workflow routing + Planning create path.

---

### 1.5 Downstream flows (verified in app code)

#### RFQ creation (`lib/canvassing.ts` → `createRfq`)

| Guard | Value |
|-------|-------|
| Requires `pr1Id` argument | Always |
| Goods: PR1 status must be `pr2_approved` | Yes |
| Goods: PR2 must exist, `status = approved` | Yes |
| RFQ lines from | `pr1_items` + warehouse procurement qty |
| Links | Sets `rfq_batches.pr2_id`, updates `pr2.rfq_id` |

#### RFQ → PR2 sync (`lib/pr2-rfq-sync.ts`)

- Requires `rfq.pr1_id === pr2.pr1_id` (hard error if mismatch).
- Matches PR2 lines by `pr1_item_id`.

#### PO send (`lib/po-send.ts`)

- `resolvePORequestType()`: if no `pr1_id`, **defaults to `'goods'`** (manual send allowed).
- Raw-material POs without PR1 would behave as goods for send — OK short-term, needs explicit `raw_material` later.

#### GRN / TSQA

| Feature | Status | Evidence |
|---------|--------|----------|
| Auto `requires_qa` when `is_raw_material` | On **Save Progress** only | `lib/grn.ts` `saveGRNProgress()` |
| TSQA queue | Pending `requires_qa` + `qa_status = pending` | `lib/grn-tsqa.ts` |
| TSQA read RLS after QA complete | Fixed | `20260727153000` |
| Close guard | Checks QA before save; **then** calls `saveGRNProgress` | `closeGRN()` ordering risk |
| Print | Always available; no TSQA block on print | `app/grn/[id]/print/page.tsx` |

#### Canvassing rules (raw-material-specific)

| Rule | Status |
|------|--------|
| Justification for unverified/manual on raw lines | Implemented (`saveItemSelection`) |
| `supplier_supply_type = raw_material` filter | Optional UI only — not enforced |
| `PickRawMatSupplierModal` | Catalog creation only — not RFQ assign |

---

### 1.6 What works today (interim path — not spec-compliant entry)

If Planning (or anyone) raises a **Goods PR1**, marks lines `is_raw_material`, and runs warehouse validation:

| Stage | Works? |
|-------|--------|
| PR1 approval | Yes |
| Warehouse → PR2 | Yes (`lib/pr2-warehouse.ts`) — copies `is_raw_material` |
| PR2 approval | Yes (`PR2_FINAL`) |
| RFQ → PO → Delivery | Yes |
| GRN + mandatory QA (after save) | Mostly yes |
| TSQA approve | Yes |

**This path must remain untouched** when implementing PR2-direct raw materials.

---

### 1.7 Gap matrix vs spec

| Spec step | Target | Current | Gap severity |
|-----------|--------|---------|--------------|
| 1 | Planning creates PR2 direct | Warehouse creates PR2 from PR1 | **Critical** |
| 1 | No PR1 | PR1 required (FK NOT NULL) | **Critical** |
| 1 | Prepared By = Planning | Prepared By = Warehouse | **High** |
| 2–3 | PR2 approval chain | `PR2_FINAL` exists | **Reuse** (extend submit logic) |
| 4 | Canvass raw material suppliers | Any supplier assignable | **Medium** |
| 4–6 | RFQ approval | Implemented | **Reuse** |
| 7–10 | PO + send | Implemented for goods | **Extend** type guards |
| 12 | Planning delivery visibility | Employee requisitioner only | **Medium** |
| 15 | Mandatory QA at GRN prep | QA on save only | **Medium** |
| 16–17 | TSQA + close | Implemented | **Minor** hardening |
| 18 | Print finalized GRN | Print always open | **Low** |

---

### 1.8 Surgical principles (do not break existing logic)

1. **Never change Goods PR1 → warehouse → PR2 → RFQ happy path** in place — add parallel branches keyed by `request_type` or `pr2.request_type`.
2. **All new DB columns nullable or defaulted** so existing rows unchanged.
3. **Extend** `request_type_for_delivery()` — do not replace — add `COALESCE(pr2.request_type, pr1.request_type)` once `pr2.request_type` exists.
4. **Feature-flag risky paths** with explicit `isRawMaterialPR2(pr2)` helper; avoid `if (!pr1_id)` alone (ambiguous vs data corruption).
5. **RLS:** add new policies; avoid dropping existing warehouse/procurement policies until new ones verified.
6. **One RFQ uniqueness:** keep `UNIQUE(pr1_id)` for goods; add **`UNIQUE(pr2_id)`** where `pr2_id IS NOT NULL` for raw path.
7. **Regression smoke tests** after each bundle (see Part 4).

---

## Part 2 — Architecture decision (recommended)

### 2.1 Classify at PR2 header

Add to `pr2_requests`:

```sql
request_type text NOT NULL DEFAULT 'goods'
  CHECK (request_type IN ('goods', 'services', 'raw_material'))
```

- **Goods / Services:** unchanged; continue resolving type from PR1 until migrated (read fallback).
- **Raw material:** `pr1_id NULL`, `request_type = 'raw_material'`, all lines `is_raw_material = true`.

### 2.2 RFQ line identity (PR2-native)

Add nullable FK on selection/quote tables:

```sql
supplier_item_selections.pr2_item_id uuid REFERENCES pr2_items(id)
rfq_item_quotes.pr2_item_id uuid REFERENCES pr2_items(id)
```

- Goods RFQ: continue using `pr1_item_id` (both columns populated or pr2_item_id null).
- Raw RFQ: use `pr2_item_id`; `pr1_item_id` null.
- `saveItemSelection()` / matrix builders: resolve line by `(pr1_item_id ?? pr2_item_id)`.

**Rejected alternative:** hidden auto-PR1 shell — faster but contradicts spec wording and duplicates data; only consider if Phase 3 blocked.

### 2.3 Workflow routing

| PR2 type | Submit workflow | On final approve |
|----------|-----------------|------------------|
| goods (via PR1) | `PR2_FINAL` | PR1 → `pr2_approved` |
| services | `PR2_PHASE1` | (existing) |
| raw_material | `PR2_FINAL` (same steps) | Notify procurement; **no PR1 update** |

Option: rename workflow display to “PR2 Approval Routing” (not Goods-only) — cosmetic.

---

## Part 3 — Phase-by-phase implementation

### Deployment bundles

| Bundle | Phases | Safe to ship alone? |
|--------|--------|---------------------|
| **A** | Phase 0 + 1 | Yes (schema only + helpers, no user-facing raw path) |
| **B** | Phase 2 | No — needs A |
| **C** | Phase 3 | No — needs B (approved raw PR2) |
| **D** | Phase 4 + 5 | No — needs C |
| **E** | Phase 6 | Yes after D (GRN hardening helps goods too) |
| **F** | Phase 7 + 8 | Yes (cleanup / UX) |

**Minimum viable raw-material path:** A → B → C → D (through PO send + delivery visibility).

---

### Phase 0 — Decisions & baseline verification

**Goal:** Lock scope; record baseline before schema changes.

- [ ] **0.1** Confirm with stakeholders: PR2-native RFQ (§2.2) vs hidden PR1 shell.
- [ ] **0.2** Confirm Planning users: assign to **Planning** dept and/or **Planning Staff** position in Admin.
- [ ] **0.3** Run Goods smoke test baseline (document PR numbers used):
  - [ ] PR1 create → approve → warehouse validate → PR2 → PR2 approve → RFQ → RFQ approve → PO → send → delivery → GRN
- [ ] **0.4** Run Services smoke test baseline (if used in env).
- [ ] **0.5** Re-run live DB verification when connection available:
  ```sql
  SELECT code, active FROM approval_workflows ORDER BY code;
  SELECT column_name, is_nullable FROM information_schema.columns
    WHERE table_name IN ('pr2_requests','rfq_batches','supplier_item_selections') ORDER BY 1,2;
  ```

**Files:** none (verification only).

---

### Phase 1 — Schema & helpers (Bundle A)

**Goal:** Add raw-material data model **without** enabling user-facing create yet.

#### Tasks

- [ ] **1.1 Migration:** `pr2_requests.request_type` + check constraint; default `'goods'` for existing rows.
- [ ] **1.2 Migration:** `ALTER pr2_requests.pr1_id DROP NOT NULL` (keep FK when present).
- [ ] **1.3 Migration:** `rfq_batches.pr1_id DROP NOT NULL`; add `UNIQUE (pr2_id)` partial index where `pr2_id IS NOT NULL`.
- [ ] **1.4 Migration:** `supplier_item_selections.pr2_item_id` nullable FK; check `(pr1_item_id IS NOT NULL) OR (pr2_item_id IS NOT NULL)`.
- [ ] **1.5 Migration:** `rfq_item_quotes.pr2_item_id` nullable FK (mirror selections).
- [ ] **1.6 Migration:** Extend `request_type_for_delivery()` / `request_type_for_grn()`:
  ```sql
  -- Map raw_material → 'goods' for existing RLS (= 'goods' checks)
  CASE
    WHEN COALESCE(pr2.request_type, pr1.request_type, 'goods') = 'raw_material' THEN 'goods'
    ELSE COALESCE(pr2.request_type, pr1.request_type, 'goods')
  END
  ```
  **Important:** Returning literal `'raw_material'` would **break** warehouse/TSQA RLS until every policy is updated. Prefer mapping in the helper (above) unless you explicitly migrate all GRN policies to `IN ('goods','raw_material')`.
- [ ] **1.7** Add `lib/pr2-classification.ts`:
  - `isRawMaterialPR2(pr2)`, `resolvePR2RequestType(pr2, pr1?)`
- [ ] **1.8** Update `types/pr2.ts`: `request_type: 'goods' | 'services' | 'raw_material'`.
- [ ] **1.9** Update `fetchPR2ById` to prefer `pr2.request_type` column over PR1 join.

#### Do NOT touch yet

- `createRfq`, warehouse validation, PR1 form.

#### Verification

- [ ] Existing Goods PR2 rows have `request_type = 'goods'`, `pr1_id` still populated.
- [ ] `request_type_for_delivery(existing_goods_delivery_id)` still returns `'goods'`.
- [ ] No new user-facing routes.

---

### Phase 2 — Planning PR2 direct create (Bundle B)

**Goal:** Spec steps 1–3 — Planning creates and submits PR2.

#### Tasks

- [ ] **2.1** `lib/pr2-planning.ts` → `createRawMaterialPR2()`, `updateRawMaterialPR2Draft()`, `submitRawMaterialPR2()`.
  - Guard: `canRequestRawMaterials(profile)`.
  - Insert header: `request_type = 'raw_material'`, `pr1_id = null`, `requisitioner_id = profile.id`, `prepared_by_* = profile`.
  - Items: `is_raw_material = true`, `pr1_item_id = null`, `quantity_to_purchase = quantity_requested`.
- [ ] **2.2** RLS policies: Planning INSERT/UPDATE on `pr2_requests` + `pr2_items` where `request_type = 'raw_material'`.
- [ ] **2.3** Extend `submitPR2ForApproval()`:
  - If `pr2.request_type === 'raw_material'` → `PR2_FINAL` (not `PR2_PHASE1`).
- [ ] **2.4** Verify `submitPR2ApprovalAction()` final step for raw material:
  - Procurement notify on `PR2_FINAL` — **already implemented** (no code change unless action URL should point to `/planning/pr2/...`).
  - PR1 status update — **already skipped** when `pr1_id` is null; add test only.
- [ ] **2.5** UI: `app/planning/pr2/new/page.tsx`, `app/planning/pr2/[id]/page.tsx` (or guarded `/pr2/new`).
- [ ] **2.6** Route access: allow Planning dept / Planning Staff to planning routes (`config/route-access.ts`).
- [ ] **2.7** Navigation: add “Raw Material Requests” for Planning (`config/navigation.ts`, module visibility).
- [ ] **2.8** Revision: raw PR2 revision returns to Planning editor (not procurement PR2 edit).

#### Verification

- [ ] Planning user creates PR2-RM-####, submits, appears in `/approvals/pr2`.
- [ ] Dept Head + Ops Manager can approve (same as goods PR2).
- [ ] **Goods PR2 smoke test still passes** (unchanged).
- [ ] Employee cannot access planning create route.

---

### Phase 3 — RFQ from PR2-native lines (Bundle C) — **highest risk**

**Goal:** Spec steps 4–6 for raw material PR2s.

#### Tasks

- [ ] **3.1** `createRfqFromPr2(pr2Id, ...)` in `lib/canvassing.ts`:
  - Guards: `pr2.request_type === 'raw_material'`, `pr2.status === 'approved'`, no existing RFQ for `pr2_id`.
  - Insert `rfq_batches` with `pr2_id`, `pr1_id = null`.
  - Seed quotes matrix from `pr2_items` (not `pr1_items`).
- [ ] **3.2** Refactor `fetchRfqDetail()` / `buildRfqLineItems()` for dual line source.
- [ ] **3.3** Update `saveItemSelection()` / `clearItemSelection()` to accept `pr2_item_id`.
- [ ] **3.4** New `syncPR2ItemsFromRfqSelectionsForRawMaterial()` or extend existing sync to match on `pr2_item_id`.
- [ ] **3.5** RFQ list queue: show raw-material PR2s approved without RFQ (procurement dashboard).
- [ ] **3.6** Auto-filter assign suppliers to `supplier_supply_type = 'raw_material'` when RFQ linked to raw PR2.
- [ ] **3.7** `closeRfq` + RFQ approval: ensure works without PR1 status transitions.
- [ ] **3.8** RLS: procurement/Director quote read policies cover `pr2_item_id` paths.
- [ ] **3.9** Extend `rfq_quote_attachments` with nullable `pr2_item_id` (table currently `pr1_item_id NOT NULL` — `20260618120000`).
- [ ] **3.10** Update `UNIQUE (rfq_id, pr1_item_id)` on selections to allow `(rfq_id, pr2_item_id)` uniqueness for raw path.

#### Verification

- [ ] End-to-end: approved raw PR2 → create RFQ → canvass → close → RFQ approval.
- [ ] **Goods RFQ smoke test unchanged** (still via PR1 `pr2_approved`).
- [ ] Selections sync updates `pr2_items` supplier/price fields.

---

### Phase 4 — PO, send, delivery (Bundle D)

**Goal:** Spec steps 7–12.

#### Tasks

- [ ] **4.1** `generatePOFromPR2()` — allow `raw_material` PR2 with **explicit** guards (today RFQ/sync checks run only when `pr1Header?.request_type === 'goods'`; null `pr1_id` **skips** those guards — must not ship without raw-material equivalents).
- [ ] **4.2** `resolvePORequestType()` — read `pr2.request_type`; treat `raw_material` like `goods` for manual send.
- [ ] **4.3** `sendPOToSupplier()` — allow `goods | raw_material`.
- [ ] **4.4** Delivery: ensure `requisitioner_id` on chain = Planning user from PR2.
- [ ] **4.5** Planning delivery access: module + `/delivery` list includes their raw-material deliveries.
- [ ] **4.6** Delivery detail: show GRN status badge for Planning.

#### Verification

- [ ] Raw material PO approved → manual send → supplier ack → delivery updates.
- [ ] Planning sees delivery; warehouse/procurement still see it.
- [ ] Goods PO send smoke test passes.

---

### Phase 5 — GRN & TSQA hardening (Bundle E)

**Goal:** Spec steps 13–18 alignment.

#### Tasks

- [ ] **5.1** `openGRNForDelivery()`: if raw material delivery, set `requires_qa = true`, `qa_status = 'pending'` on insert; call `evaluateGRNQAStatus()`.
- [ ] **5.2** `closeGRN()`: call `saveGRNProgress()` **before** final QA re-check (fix ordering).
- [ ] **5.3** GRN UI: raw material lines always show QA Required (no optional toggle).
- [ ] **5.4** Print: optional closed-only guard; add TSQA approval lines on print.
- [ ] **5.5** Confirm TSQA RLS treats `request_type = 'raw_material'` as goods for QA purposes (Phase 1 migration).

#### Verification

- [ ] Raw material GRN opens in `pending_qa` without manual save.
- [ ] TSQA approves → warehouse can close.
- [ ] Goods GRN with optional QA checkbox still works.

---

### Phase 6 — Deprecate interim PR1 raw path (Bundle F) — ✅ Done (2026-07-28)

**Goal:** Align with spec “no PR1 for raw materials.”

- [x] **6.1** Hide PR1 raw-mat column entirely for Planning (they use PR2 direct).
- [x] **6.2** Block `is_raw_material` on PR1 for all users (full removal, not just Planning) — `PR1Form.tsx` no longer renders the Raw Mat. column/checkbox for anyone, and `lib/pr1.ts` (`saveDraftPR1`/`submitPR1`) now unconditionally strips/rejects `is_raw_material` on PR1 items via new `sanitizePR1RawMaterialFlags`/`assertNoPR1RawMaterialItems` helpers in `lib/raw-material-access.ts`. The original `canRequestRawMaterials`/`assertRawMaterialRequestAccess`/`sanitizeRawMaterialFlags` functions are untouched and still gate the unrelated PR2-direct Planning flow (`lib/pr2-planning.ts`, `app/planning/pr2/**`). Verified live: no live PR1 items had `is_raw_material = true` at time of removal.
- [x] **6.3** Docs: `docs/Final_Workflow.md` already describes the target end-state (no PR1 for raw materials) and needed no edit; `docs/workflow-versions.md` tracks approval-chain signatory order only and is unaffected (no chain changed). This plan doc's "Already shipped (pre-plan)" note above and the Part 6 tracker are updated instead as the authoritative record.
- [x] **6.4** Admin guide: assign Planning users to PLAN dept — no separate admin guide doc exists in this repo; the requirement is already enforced in code via `canRequestRawMaterials()` (`lib/raw-material-access.ts`), which checks `profile.department === 'planning'` (case-insensitive) or `position === 'Planning Staff'`, so any admin creating a Planning user must set one of those to grant raw-material PR2 access.

---

### Phase 7 — Revision routing & notifications (polish) — ✅ Done (2026-07-28)

**Goal:** Spec §3 approval actions for raw materials.

- [x] **7.1** Raw PR2 revision notifies Planning (not procurement editor). Root cause: `submitPR2ForApproval()` had no ownership guard, and the generic `/pr2/[id]` page (procurement-facing) called it directly — RLS allowed procurement to read/update any `pr2_requests` row including raw material ones, so procurement could submit a raw-material PR2 and become `approval_instances.started_by`, after which revision/rejection notifications (targeted at `started_by`) would go to procurement instead of Planning. Fixed by adding a guard directly in `submitPR2ForApproval()` (`lib/pr2-approvals.ts`): for `request_type === 'raw_material'`, only the PR2's own `requisitioner_id` may submit it. No RLS/notification-routing changes needed since `started_by` is now always correct at the source.
- [x] **7.2** Rejection/revision-request notifications now include the approver's remarks as a reason (previously only the secondary "notify requisitioner if different from submitter" branch included it; the primary notification to the submitter did not).
- [x] **7.3** Approval history (`app/approvals/history/page.tsx`) now renders a `RequestTypeBadge` per row. `lib/approval-history.ts` resolves `request_type` for PR1 (own column), PR2 (own column), and PO (via `po_requests.pr2_id → pr2_requests.request_type`). Verified live for both a raw-material PR2 row and a raw-material PO row.

---

### Phase 8 — UAT & sign-off

See Part 4 checklist.

---

## Part 4 — Regression & UAT checklists

### Goods regression (run after every bundle)

- [ ] PR1 goods create (employee, no raw flag) → submit → approve
- [ ] Warehouse validation → PR2 create → auto-submit
- [ ] PR2 approval (Dept Head → Ops Manager)
- [ ] PR1 status → `pr2_approved`; RFQ create from PR1
- [ ] RFQ close → approval → PO → send → delivery → GRN (optional QA)

### Raw materials UAT (full path)

- [ ] Planning user (PLAN dept) creates PR2 raw material request
- [ ] PR2 approval chain completes; procurement notified
- [ ] RFQ created from PR2 (no PR1 record)
- [ ] Raw supplier assigned; justification if unverified quote
- [ ] RFQ approval (Proc Manager → Director)
- [ ] PO created, approved, manually sent
- [ ] Supplier delivery ack + in-transit update
- [ ] Planning sees delivery status
- [ ] Warehouse GRN → auto QA pending → TSQA approve → close → print

---

## Part 5 — File touch map (by phase)

| Phase | Primary files |
|-------|----------------|
| 1 | `supabase/migrations/*_raw_material_phase1.sql`, `lib/pr2-classification.ts`, `types/pr2.ts`, `lib/pr2.ts` |
| 2 | `lib/pr2-planning.ts`, `lib/pr2-approvals.ts`, `app/planning/**`, `config/route-access.ts`, `config/navigation.ts` |
| 3 | `lib/canvassing.ts`, `lib/pr2-rfq-sync.ts`, `lib/rfq-approvals.ts`, `app/rfq/**`, `components/canvassing/**` |
| 4 | `lib/po.ts`, `lib/po-send.ts`, `lib/delivery.ts`, `app/delivery/**`, `config/navigation.ts` |
| 5 | `lib/grn.ts`, `lib/grn-tsqa.ts`, `app/grn/**`, `app/tsqa/grn/**` |
| 6 | `lib/raw-material-access.ts`, `components/pr1/PR1Form.tsx`, docs |

---

## Part 6 — Progress tracker

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Baseline & decisions | ⬜ Not started |
| 1 | Schema & helpers | ⬜ Not started |
| 2 | Planning PR2 direct | ⬜ Not started |
| 3 | RFQ PR2-native | ⬜ Not started |
| 4 | PO / delivery | ⬜ Not started |
| 5 | GRN / TSQA hardening | ⬜ Not started |
| 6 | Deprecate PR1 raw path | ✅ Done |
| 7 | Revision / notifications | ✅ Done |
| 8 | UAT sign-off | ⬜ Not started |

**Already shipped (pre-plan):**

- [x] Planning dept + position migration (`20260727160000`)
- [x] Planning-only raw flag on PR1 (`lib/raw-material-access.ts`) — interim, deprecated in Phase 6 (see below)
- [x] TSQA post-approve RLS fix (`20260727153000`)
- [x] Director supplier selections read (`20260727150000`)

---

## Part 7 — Open questions

| # | Question | Default if unanswered |
|---|----------|---------------------|
| Q1 | Dedicated `/planning/*` routes vs shared `/pr2/*` with guards? | `/planning/pr2/*` |
| Q2 | Separate workflow code `PR2_RAW_FINAL` vs reuse `PR2_FINAL`? | Reuse `PR2_FINAL` |
| Q3 | Wipe test data before enabling raw PR2-direct in shared env? | No wipe; parallel paths |
| Q4 | Require `supplier_supply_type = raw_material` at RFQ assign? | Yes for raw RFQs |

---

## Appendix A — Live DB audit (verified 2026-07-27)

**Project:** `emddvbocupvufzvhcacz` (linked, `SUPABASE_DB_PASSWORD` required for CLI)

### Schema (confirmed live)

| Table | Column | Nullable | Blocks raw PR2-direct? |
|-------|--------|----------|--------------------------|
| `pr2_requests` | `pr1_id` | **NO** | Yes |
| `pr2_requests` | `rfq_id` | YES | No |
| `pr2_requests` | `request_type` | **column absent** | Yes (must add) |
| `pr2_items` | `pr1_item_id` | YES | No |
| `rfq_batches` | `pr1_id` | **NO** | Yes |
| `rfq_batches` | `pr2_id` | YES | Partial link exists |
| `rfq_batches` | — | `UNIQUE (pr1_id)` | Yes for raw path |
| `supplier_item_selections` | `pr1_item_id` | **NO** | Yes |
| `rfq_item_quotes` | `pr1_item_id` | **NO** | Yes |

### Approval workflows (confirmed live)

| Code | Active | Steps (live) |
|------|--------|--------------|
| `PR2_FINAL` | true | Dept Head → Ops Manager |
| `PR2_PHASE1` | true | Proc Staff → Proc Manager → Director |
| `RFQ_APPROVAL` | true | Proc Manager → Director |
| `PO_APPROVAL` | true | Proc Staff → Proc Manager → Finance Director (final) → Supplier (final) |
| `PR2_PHASE2` | **false** | Legacy — ignore |
| `PR1_APPROVAL` | true | (unchanged) |

Phase 0.5 can be marked complete for workflow/schema baseline.

---

## Appendix B — Related docs

- `docs/Final_Workflow.md` — authoritative spec
- `docs/goods-workflow-alignment-plan.md` — goods implementation (do not conflate scopes)
- `lib/raw-material-access.ts` — interim PR1 gating (Planning-only)

---

## Appendix C — Plan validation report (2026-07-27)

**Verdict:** Plan is **directionally correct and safe to execute** with the corrections applied in this revision. Audit claims match migrations, app code, and live DB.

### Confirmed correct

| Claim | Verified via |
|-------|----------------|
| Spec: Planning → PR2 direct, no PR1/warehouse | `Final_Workflow.md` §5.1 |
| `pr2_requests.pr1_id` NOT NULL | Live DB + `20260424013414` |
| `rfq_batches.pr1_id` NOT NULL + UNIQUE | Live DB |
| `supplier_item_selections.pr1_item_id` NOT NULL | Live DB + canvassing schema |
| Goods PR2 → `PR2_FINAL`; else → `PR2_PHASE1` | `lib/pr2-approvals.ts` 74–83 |
| RFQ requires PR1 + `pr2_approved` for goods | `lib/canvassing.ts` `createRfq` |
| RFQ↔PR2 sync requires matching `pr1_id` | `lib/pr2-rfq-sync.ts` 60–61 |
| GRN QA on raw lines at save, not open | `lib/grn.ts` `saveGRNProgress` 629; `openGRNForDelivery` seeds without QA |
| `closeGRN` QA check before `saveGRNProgress` | `lib/grn.ts` 683–706 |
| Planning dept/position migration | `20260727160000` + live-ready |
| `/pr2` procurement-only | `config/route-access.ts` 83 |
| Interim PR1 raw flag Planning-only | `lib/raw-material-access.ts` |

### Corrections applied to this doc

1. **PO_APPROVAL steps** — live uses Procurement Staff (not Buyer) as step 1.
2. **PR2_PHASE1** — live is 3 steps (Dept Head removed per `20260526120000`).
3. **Phase 1.6** — must map `raw_material` → `'goods'` in helper **or** update all GRN RLS policies.
4. **Phase 2.4** — procurement notify + PR1 skip largely **already coded**; Phase 2 focus is routing + UI.
5. **Phase 3.9–3.10** — `rfq_quote_attachments` and selection uniqueness not in original plan.
6. **Phase 4.1** — `generatePOFromPR2` skips RFQ guards when `pr1_id` is null; raw path needs explicit checks.

### Residual risks (unchanged scope)

- Phase 3 (PR2-native RFQ) remains highest regression risk for Goods canvassing.
- `request_type_for_delivery()` inner JOIN on `pr1` returns NULL without `pr1_id` until Phase 1.6 ships.
- Interim PR1+raw-flag path must stay working until Phase 6 deprecation.
