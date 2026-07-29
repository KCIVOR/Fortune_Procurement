# Goods Workflow Alignment — Surgical Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. **Phase 0 data wipe requires explicit sign-off before running on live DB.**

**Goal:** Align the **Goods** requisition flow with `docs/Final_Workflow.md`. **Phase 0 wipes all existing requisition records** (per locked D1), then implements the final workflow as the **only** Goods path.

**Architecture:** Single-track final workflow (no legacy path after Phase 0 wipe):

`PR1 → Warehouse creates PR2 → PR2 approval → RFQ → RFQ approval → PO → manual Send → Delivery → GRN`

Scoped to `request_type = 'goods'`. Services and Raw Materials are unchanged in this plan.

**Decision status:** D1–D6 locked (2026-07-21). See Decision Log.

**Plan verified & corrected:** 2026-07-21 — see [Verification fixes](#plan-verification-fixes-2026-07-21) below.

**Tech stack:** Next.js App Router, Supabase Postgres (migrations via CLI or MCP `apply_migration`), workflow tables (`approval_workflows`, `approval_steps`, `approval_instances`), core libs under `lib/`.

**Reference spec:** `docs/Final_Workflow.md` (Goods section, steps 1–21).

**Prior related work (already shipped — do not redo):**
- PR1 approval before warehouse (`docs/workflow-realignment-plan.md`)
- PR2 single-phase collapse (`PR2_PHASE2` deactivated in DB)
- Substitute review at RFQ stage (aligned with spec)

---

## How to use this plan

1. **Phase 0** — Wipe all requisition records (D1), add Operations Manager (D2), baseline verification.
2. Implement phases in **deployment bundle order** (below) — not every phase is safe to ship alone.
3. Phases 1–6 implement the final workflow. Phase 7 skipped (D4). Phase 8 removes dead legacy code.
4. Only edit files listed for that phase.
5. Tick checkboxes as you go.

### Deployment bundles (required)

| Bundle | Phases | Why |
| ------ | ------ | --- |
| **A** | 0 | Wipe + Operations Manager — standalone |
| **B** | 1 + 2 + 3 | PR1 statuses + PR2 workflow + warehouse PR2 creation must ship together (avoid dead-end warehouse path) |
| **C** | 4 | RFQ link, approval, PR2 sync from selections |
| **D** | 5 | Manual Send PO |
| **E** | 6 | GRN QA + reopen |
| **F** | 8 | Legacy cleanup + docs |

**Correct build order within bundle B:** Phase 2 (PR2_FINAL workflow) → Phase 3 (warehouse creates PR2 + auto-submit) → Phase 1 Task 1.2 (remove `for_canvassing` for Goods). Phase 1 Task 1.1 (status migration) can land first.

---

## Plan verification fixes (2026-07-21)

Corrections applied after cross-check against live DB schema, RLS, and `generatePOFromPR2()`:

| # | Issue | Fix in plan |
| - | ----- | ----------- |
| 1 | `pr2_requests.rfq_id` NOT NULL | Phase 3 Task 3.1: `ALTER COLUMN rfq_id DROP NOT NULL` |
| 2 | Warehouse cannot INSERT PR2 | Phase 3 Task 3.1: warehouse RLS policies |
| 3 | PO needs supplier data on PR2 lines | Phase 4 Task 4.5: `syncPR2ItemsFromRfqSelections()` |
| 4 | Phase 2/3 order wrong for auto-submit | Swapped: Phase 2 = PR2_FINAL, Phase 3 = warehouse create |
| 5 | Phase 1 alone breaks warehouse path | Bundle B: deploy Phases 1+2+3 together |
| 6 | Wipe missing `rfq_quote_attachments` | Phase 0 Task 0.3 |
| 7 | RFQ link one-way only | Phase 4 Task 4.3: bidirectional PR2 ↔ RFQ |
| 8 | PO approval missing procurement notify | Phase 5 Task 5.2: notify procurement on Finance Director approval |
| 9 | Operations Manager SQL | Phase 0: `NOT EXISTS` only (no `ON CONFLICT` on roles) |

---

## Part 0 — Frozen evidence (verified audit; do not re-invent)

Source: code audit + live Supabase project `emddvbocupvufzvhcacz` (2026-07-21).

### E1. Approved Goods sequence (`Final_Workflow.md`)

| Order | Document | Trigger (who starts next stage) |
| ----- | -------- | ------------------------------- |
| 1 | PR1 | **Requestor** creates |
| 2 | PR1 approval | **Supervisor** → **Department Head** |
| 3 | Warehouse validation | **Warehouse** validates; on insufficient stock **Warehouse creates PR2** (Prepared By) |
| 4 | PR2 approval | **Department Head** certifies → **Operations Manager** approves → system notifies **Procurement** |
| 5 | RFQ / canvassing | **Procurement Staff** creates RFQ, canvasses, records quotes |
| 6 | RFQ approval | **Procurement Manager** reviews → **Director** approves → notifies **Procurement Staff** (PO may be created) |
| 7 | PO | **Procurement Staff** creates → **Procurement Manager** → **Finance Director** approves → notifies **Procurement Staff** (PO ready to send) |
| 8 | Send PO | **Procurement Staff** manually sends (not automatic) |
| 9 | Delivery | **Supplier** acknowledges + updates progress |
| 10 | GRN | **Warehouse** receives, creates GRN (GRN #, DR #, INV #, DR date), optional per-item QA flag → **TSQA** if flagged → **Warehouse** closes + prints |

### E2. Current Goods sequence (implemented)

| Order | Document | Trigger (who starts next stage) |
| ----- | -------- | ------------------------------- |
| 1 | PR1 | **Requestor** |
| 2 | PR1 approval | **Supervisor** → **Department Head** → `approved_for_warehouse` |
| 3 | Warehouse validation | **Warehouse** → `for_canvassing` (does **not** create PR2) |
| 4 | RFQ | **Procurement Staff** when PR1 = `for_canvassing` |
| 5 | RFQ close | **Procurement Staff** via `closeRfq()` — **no approval workflow** |
| 6 | PR2 | **Procurement Staff** via `generatePR2FromRfq()` after RFQ closed |
| 7 | PR2 approval | **Procurement Staff** → **Procurement Manager** → **Director** (`PR2_PHASE1`) |
| 8 | PO | **Procurement Staff** via `generatePOFromPR2()` when PR2 = `approved` |
| 9 | PO approval | **Procurement Staff** → **Procurement Manager** → **Finance Director** (`PO_APPROVAL`) |
| 10 | PO sent | **Supplier** ack (`acknowledgeSupplierPO`) or **Procurement** `markExternalPOOrdered` — **no manual Send PO for portal suppliers**; supplier notified on Finance Director approval |
| 11 | Delivery + GRN | Same roles as spec except: **no INV #**, **no optional GRN QA**, **Procurement cannot reopen goods GRN** (RLS) |

### E3. Live DB — active approval workflows

| Code | Steps (verified) | Active |
| ---- | ---------------- | ------ |
| `PR1_APPROVAL` | Supervisor → Department Head | yes |
| `PR2_PHASE1` | Procurement Staff → Procurement Manager → Director | yes |
| `PR2_PHASE2` | (Procurement chain) | **no** |
| `PO_APPROVAL` | Procurement Staff → Procurement Manager → Finance Director → Supplier Representative | yes |
| `RFQ_APPROVAL` | — | **does not exist** |

### E4. Live DB — positions (active)

`Authorized Personnel`, `Buyer`, `Department Head`, `Director`, `Finance Director`, `Procurement Manager`, `Procurement Staff`, `Staff`, `Supervisor`, `Supplier Representative`, `System Administrator`, `TSQA Staff`, `Warehouse Manager`, `Warehouse Staff`

**Not present:** `Operations Manager` (required by `Final_Workflow.md` PR2 step 6).

**Also documented elsewhere but not in Final_Workflow:** `ODM` appears in `docs/workflow-versions.md` (Engineering variant only). **Do not conflate with Operations Manager until client confirms.**

### E5. Live DB — in-flight counts at audit time (2026-07-21)

**Note:** D1 = wipe all records. Counts below are **pre-wipe archive only**.

| status | count |
| ------ | ----- |
| `canvassing_complete` | 13 |
| `for_canvassing` | 5 |
| `revision_requested` | 3 |
| `pending_approval` | 3 |
| `approved` | 2 |
| `rejected` | 1 |

Also at audit time: PR2 18, RFQ 25, PO 19 — **all deleted in Phase 0 Task 0.3**.

### E6. Key code entry points (verified paths)

| Concern | File | Function |
| ------- | ---- | -------- |
| PR1 submit + approval instance | `lib/pr1.ts` | `submitPR1()` |
| PR1 approval actions | `lib/approvals.ts` | `submitApprovalAction()` |
| Warehouse validation | `lib/warehouse.ts` | `submitValidationDecision()` |
| RFQ create | `lib/canvassing.ts` | `createRfq()` — gated on PR1 `for_canvassing` / `canvassing_complete` |
| RFQ close | `lib/canvassing.ts` | `closeRfq()` |
| PR2 from RFQ (legacy) | `lib/pr2.ts` | `generatePR2FromRfq()` |
| PR2 approval | `lib/pr2-approvals.ts` | `submitPR2ForApproval()`, `submitPR2ApprovalAction()` |
| PO from PR2 | `lib/po.ts` | `generatePOFromPR2()` — guard: PR2 `approved` |
| PO approval + supplier notify | `lib/po-approvals.ts` | `submitPOApprovalAction()` |
| Supplier ack → sent | `lib/po-approvals.ts` | `acknowledgeSupplierPO()` |
| GRN close | `lib/grn.ts` | `closeGRN()` — no QA guard |
| GRN reopen | `lib/grn.ts` | `reopenGRN()` |

### E7. Schema facts relevant to alignment

| Table | Fact |
| ----- | ---- |
| `pr1_requests` | Has `request_type`; **no** workflow-track column today |
| `rfq_batches` | FK `pr1_id` only — **no** `pr2_id` yet |
| `pr2_requests` | **`rfq_id` NOT NULL** today (`20260424013414_pr2_schema.sql`) — must become nullable for PR2-before-RFQ |
| `pr2_requests` | INSERT RLS is **procurement-only**; warehouse has SELECT only |
| `pr2_items` | Supplier/quote columns default empty — populated after RFQ via sync (Phase 4) |
| `grn_receipts` | Has `dr_no`, `dr_date`; **no** `inv_no` |
| `grn_items` | **no** QA flag / QA status columns |
| `grn_receipts.status` | CHECK: `open` \| `closed` only → add `pending_qa` per D5 |
| `rfq_quote_attachments` | FK to `pr1_items`, `rfq_batches` — include in Phase 0 wipe |

### E8. Already aligned (no change unless regression found)

- PR1 approval chain (Supervisor → Department Head)
- PR1 three actions: Approve / Reject / Request Revision
- Warehouse qty override + mandatory remark
- PO internal approval roles (Procurement Staff → Procurement Manager → Finance Director)
- Supplier acknowledgment + delivery tracking
- Substitute item review (Requestor **or** Procurement; locked on RFQ close)
- Warehouse GRN create, per-line receive/reject, close, print

---

## Part 1 — Locked decisions (2026-07-21)

### D1 — In-flight records ✅ **Remove all requisition records**

**Choice:** Delete **all** existing request/workflow records (Goods, Services, and any other PR1-linked chains) before implementing the new Goods flow.

**Implications:**
- No dual-track model needed — **D3 is not applicable** (see below).
- Phase 0 includes an ordered data-wipe migration (requisition chain only).
- **Out of wipe scope** unless client says otherwise: `profiles`, `suppliers`, `supplier_products`, accreditation/RSE, system config, workflow definitions.

### D2 — Operations Manager ✅ **New position**

**Choice:** Add `Operations Manager` as a new row in `positions` and a new value in `AppPosition`. Role: `approver` (same pattern as Department Head / Director).

### D3 — When new Goods PR1s use the final track ✅ **N/A (superseded by D1)**

With all records removed, every new Goods PR1 uses the **final workflow only**. No `goods_workflow_track` column, feature flag, or cutover date is required.

### D4 — Revision same-stage ✅ **Keep restart at step 1**

**Choice:** Resubmit after revision creates a new approval instance at step 1 (current behavior). **Phase 7 skipped.** Document as intentional deviation from `Final_Workflow.md` §3.

### D5 — GRN Pending during QA ✅ **New DB status**

**Choice:** Add `pending_qa` to `grn_receipts.status` CHECK constraint. GRN transitions to `pending_qa` when any flagged item awaits TSQA; cannot close until resolved.

### D6 — Procurement reopen Goods GRN ✅ **Yes**

**Choice:** Procurement may reopen closed **Goods** GRNs (RLS policy update required).

---

## Part 2 — Surgical principles (non-negotiable)

1. **Wipe first:** Phase 0 data deletion completes before any workflow logic changes ship.
2. **Goods scope fence:** Logic changes apply to `request_type = 'goods'` only. Do not alter Services or Raw Materials entry points in this plan.
3. **Replace, don’t parallel:** After Phase 0, remove legacy code paths (`generatePR2FromRfq`, `for_canvassing` as canvassing gate, `PR2_PHASE1` for Goods) in Phase 8 — do not maintain dual paths.
4. **Additive schema during build:** New columns and workflows first; destructive code removal last (Phase 8).
5. **One phase = one verifiable outcome:** End-to-end smoke test on a fresh Goods PR1 after each phase.
6. **Secondary decisions** (delivery timing, external vendors) — see Decision Log; implement with recommended defaults if still unlocked at phase start.
7. **PR2-before-RFQ data model:** Warehouse PR2 has line items only (no supplier/price). After RFQ canvassing, **sync selections onto existing PR2** before PO generation — do not use `generatePR2FromRfq()` for Goods.

---

## Phase 0 — Data wipe + Operations Manager + baseline

**Outcome:** All requisition records deleted; `Operations Manager` position exists; pre-wipe counts archived.

### Task 0.1: Decisions ✅ DONE

- [x] D1–D6 locked (2026-07-21)
- [ ] Assign at least one user to **Operations Manager** position after Task 0.4

### Task 0.2: Archive counts before wipe ✅ DONE (2026-07-21)

- [x] Pre-wipe counts recorded (see Decision Log)

### Task 0.3: Migration — wipe all requisition records

**Files:**
- Create: `supabase/migrations/<timestamp>_wipe_requisition_workflow_data.sql`

**Wipe scope (D1):** All rows in the procurement requisition chain. **Do not delete** `profiles`, `suppliers`, `supplier_products`, accreditation tables, or `approval_workflows` / `approval_steps` definitions.

Delete in **FK-safe order** (children first):

```sql
-- 1. Leaf / history (children before parents)
DELETE FROM grn_items;
DELETE FROM grn_receipts;
DELETE FROM delivery_status_history;
DELETE FROM deliveries;
DELETE FROM po_items;
DELETE FROM po_receipts;
DELETE FROM po_requests;
DELETE FROM pr2_items;
DELETE FROM pr2_requests;
DELETE FROM rfq_quote_attachments;
DELETE FROM substitute_decisions;
DELETE FROM supplier_item_selections;
DELETE FROM rfq_item_quotes;
DELETE FROM rfq_suppliers;
DELETE FROM rfq_batches;
DELETE FROM warehouse_validation_items;
DELETE FROM warehouse_validations;
DELETE FROM pr1_attachments;
DELETE FROM pr1_items;
DELETE FROM pr1_requests;

-- 2. Approval instances for wiped documents
DELETE FROM approval_actions
WHERE instance_id IN (
  SELECT id FROM approval_instances
  WHERE document_type IN ('PR1', 'PR2', 'PO', 'RFQ')
);
DELETE FROM approval_instances
WHERE document_type IN ('PR1', 'PR2', 'PO', 'RFQ');

-- 3. Orphan cleanup (optional but recommended)
DELETE FROM audit_logs
WHERE document_type IN ('PR1', 'PR2', 'PO', 'RFQ', 'GRN');

DELETE FROM notifications
WHERE document_type IN ('pr1', 'pr2', 'po', 'rfq', 'delivery', 'grn');
```

**FK note:** `pr2_items` references `rfq_item_quotes` — delete `pr2_items` before RFQ quote tables (order above is correct). `pr2_requests.rfq_id` → `rfq_batches` — delete `pr2_requests` before `rfq_batches` (order above is correct).

- [x] Migration reviewed and applied to live (`20260721143000_wipe_requisition_workflow_data.sql`)
- [x] Post-wipe verify: all requisition tables → **0**

### Task 0.4: Migration — add Operations Manager position (D2)

**Files:**
- Create: `supabase/migrations/<timestamp>_add_operations_manager_position.sql`

```sql
-- Role 'approver' already exists — use NOT EXISTS (roles.name may lack UNIQUE)
INSERT INTO positions (title, role_id, active)
SELECT 'Operations Manager', r.id, true
FROM roles r
WHERE r.name = 'approver'
  AND NOT EXISTS (SELECT 1 FROM positions WHERE title = 'Operations Manager');
```

**Files:**
- Modify: `types/auth.ts` — add `'Operations Manager'` to `AppPosition`

- [x] Position exists in DB (`Operations Manager`, active)
- [x] `types/auth.ts` updated with `Operations Manager`
- [ ] Assign at least one test user to Operations Manager (admin UI)

### Phase 0 verification

- [x] All requisition tables empty
- [x] Suppliers, profiles, accreditation data intact
- [x] Operations Manager position visible in admin user management
- [ ] At least one user assigned Operations Manager role

---

## Phase 1 — PR1 status foundation (Goods final flow)

**Outcome:** New PR1 statuses support PR2-before-RFQ.

**Deploy:** Bundle B — ship with Phases 2 + 3. Task 1.2 must not go live without Phase 3.

### Task 1.1: Migration — PR1 statuses for new sequence

**Files:**
- Create: `supabase/migrations/<timestamp>_pr1_statuses_final_goods_flow.sql`

| Status | When set |
| ------ | -------- |
| `pr2_pending_approval` | Warehouse created PR2; PR2 approval in progress |
| `pr2_approved` | PR2 final approval done; ready for RFQ |

Extend `pr1_requests_status_check` to include new values. Keep legacy values (`for_canvassing`, `canvassing_complete`) in constraint until Phase 8 cleanup.

- [x] Migration applied
- [x] `types/pr1.ts` updated with new statuses + labels

### Task 1.2: Remove `for_canvassing` transition from warehouse (Goods)

**Files:**
- Modify: `lib/warehouse.ts` → `submitValidationDecision()`

For `request_type === 'goods'` + insufficient:
- **Do not** set `for_canvassing`
- Call `createPR2FromWarehouseValidation()` (Phase 3) instead

For `request_type === 'services'`: **unchanged** (Services code not rewritten in this plan).

> ⚠️ **Do not deploy this task until Phase 3 Task 3.2 is ready** — otherwise warehouse insufficient becomes a dead end.

- [x] Goods insufficient → PR2 creation (not `for_canvassing`)
- [x] Services warehouse path untouched

### Phase 1 verification

- [x] DB accepts new PR1 status values
- [x] Verified as part of Bundle B end-to-end test

---

## Phase 2 — PR2 approval workflow (Goods)

**Outcome:** `PR2_FINAL` workflow: Dept Head (Certified By) → Operations Manager (Approved By).

**Prerequisite:** Phase 0 Task 0.4 (Operations Manager position).

**Deploy:** Bundle B — must complete **before** Phase 3 Task 3.4 (auto-submit approval).

### Task 2.1: Migration — `PR2_FINAL` workflow

**Files:**
- Create: `supabase/migrations/<timestamp>_pr2_final_workflow.sql`

```sql
INSERT INTO approval_workflows (code, name, active)
VALUES ('PR2_FINAL', 'PR2 Approval Routing (Goods)', true);

-- Step 1: approver / Department Head / Certified By / is_final = false
-- Step 2: approver / Operations Manager / Approved By / is_final = true
```

- [x] `PR2_FINAL` seeded with both steps

### Task 2.2: Route Goods PR2 approval to `PR2_FINAL`

**Files:**
- Modify: `lib/pr2-approvals.ts`

For Goods (`request_type === 'goods'` on linked PR1):
- `submitPR2ForApproval()` → workflow code `PR2_FINAL` (not `PR2_PHASE1`)
- On final approval: `pr2_requests.status = 'approved'`, PR1 → `pr2_approved`
- Notify **procurement** role: ready for supplier canvassing (spec step 6)

- [x] Goods PR2 uses `PR2_FINAL`
- [x] Final approval notifies procurement for RFQ (not PO)

### Task 2.3: Approval UI

**Files:**
- Modify: `app/approvals/pr2/[id]/page.tsx`

- [x] Shows Certified By / Approved By labels from workflow steps

### Phase 2 verification

- [x] `PR2_FINAL` workflow exists in DB with correct steps
- [ ] Manual test: submit PR2 for approval uses `PR2_FINAL` (after Phase 3 creates a PR2)

---

## Phase 3 — Warehouse creates PR2 (Goods)

**Outcome:** Warehouse insufficient → creates PR2 (Prepared By) → auto-starts PR2 approval.

**Prerequisite:** Phase 2 complete (`PR2_FINAL` must exist before auto-submit).

**Deploy:** Bundle B — ship with Phases 1 + 2.

### Task 3.1: Migration — PR2 schema + warehouse RLS

**Files:**
- Create: `supabase/migrations/<timestamp>_pr2_warehouse_create_goods.sql`

```sql
-- 1. PR2 can exist before RFQ (verified: rfq_id is NOT NULL today)
ALTER TABLE pr2_requests ALTER COLUMN rfq_id DROP NOT NULL;

-- 2. Warehouse provenance (Prepared By)
ALTER TABLE pr2_requests
  ADD COLUMN IF NOT EXISTS prepared_by_id uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS prepared_by_name_snapshot text,
  ADD COLUMN IF NOT EXISTS prepared_by_position_snapshot text,
  ADD COLUMN IF NOT EXISTS prepared_at timestamptz;

-- 3. Warehouse INSERT on pr2_requests (Goods — via PR1 request_type check in app;
--    RLS: warehouse role may INSERT when linked PR1 is goods + approved_for_warehouse)
CREATE POLICY "warehouse_insert_pr2_requests_goods"
  ON pr2_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      JOIN pr1_requests pr1 ON pr1.id = pr2_requests.pr1_id
      WHERE p.id = auth.uid()
        AND r.name = 'warehouse'
        AND pr1.request_type = 'goods'
    )
  );

-- 4. Warehouse INSERT/UPDATE on pr2_items for their created PR2
CREATE POLICY "warehouse_insert_pr2_items_goods"
  ON pr2_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      JOIN pr2_requests pr2 ON pr2.id = pr2_items.pr2_id
      JOIN pr1_requests pr1 ON pr1.id = pr2.pr1_id
      WHERE p.id = auth.uid()
        AND r.name = 'warehouse'
        AND pr1.request_type = 'goods'
    )
  );
```

- [x] `rfq_id` nullable
- [x] Warehouse can INSERT PR2 header + items for Goods PR1s

### Task 3.2: Create PR2 from warehouse validation

**Files:**
- Create: `lib/pr2-warehouse.ts`
- Modify: `lib/warehouse.ts` → `submitValidationDecision()`

```typescript
// lib/pr2-warehouse.ts — Goods only
export async function createPR2FromWarehouseValidation(
  pr1Id: string,
  validationId: string,
  profile: UserProfile,
): Promise<string> {
  // 1. Idempotency: one PR2 per PR1 for goods
  // 2. pr2_items from warehouse_validation_items where procurement_qty > 0
  //    (item metadata from pr1_items; supplier/price fields left empty — filled in Phase 4 sync)
  // 3. prepared_by_* = warehouse profile; rfq_id = NULL; rfq_number_snapshot = ''
  // 4. pr2.status = 'draft' initially, then auto-submit (Task 3.4)
  // 5. PR1.status → 'pr2_pending_approval'
}
```

- [x] `createPR2FromWarehouseValidation` implemented
- [x] Called from `submitValidationDecision` for Goods + insufficient
- [x] Goods sufficient → `resolved_internal` (unchanged)

### Task 3.3: Warehouse UI

**Files:**
- Modify: `app/warehouse/[id]/page.tsx`

- [x] Link to created PR2 after validation submit

### Task 3.4: Auto-start PR2 approval on create

Per spec §5.2: PR2 enters approval immediately upon warehouse creation.

**Files:**
- Modify: `lib/pr2-warehouse.ts` — after insert, call `submitPR2ForApproval(pr2Id, profile)`

**Requires Phase 2 complete** (`PR2_FINAL` workflow in DB).

- [x] Approval instance created at warehouse submit time
- [x] PR2 status → `pending_approval`

### Phase 3 verification (Bundle B)

- [ ] Goods PR1 → approval → warehouse insufficient → PR2 created (Prepared By = warehouse)
- [ ] PR1 status = `pr2_pending_approval`
- [ ] PR2 approval instance active on `PR2_FINAL` step 1

---

## Phase 4 — RFQ linked to PR2 + RFQ approval + PR2 sync

**Outcome:** RFQ requires approved PR2; selections sync to PR2 before PO; Director approval gates PO.

**Deploy:** Bundle C — standalone after Bundle B verified.

### Task 4.1: Migration — `rfq_batches.pr2_id`

**Files:**
- Create: `supabase/migrations/<timestamp>_rfq_pr2_link.sql`

```sql
ALTER TABLE rfq_batches
  ADD COLUMN IF NOT EXISTS pr2_id uuid REFERENCES pr2_requests(id);
```

### Task 4.2: Workflow `RFQ_APPROVAL`

**Files:**
- Create: `supabase/migrations/<timestamp>_rfq_approval_workflow.sql`

- Step 1: procurement / Procurement Manager / Reviewed By
- Step 2: approver / Director / Approved By (final)

### Task 4.3: RFQ create — bidirectional PR2 link (Goods)

**Files:**
- Modify: `lib/canvassing.ts` → `createRfq()`

Goods guards:
1. PR1 `request_type = 'goods'`
2. PR2 for PR1 exists with `status = 'approved'`
3. PR1 `status = 'pr2_approved'`

On create, set **both**:
- `rfq_batches.pr2_id = pr2.id`
- `pr2_requests.rfq_id = rfq.id` and `rfq_number_snapshot = rfq.rfq_number`

Remove Goods dependency on `for_canvassing` / `canvassing_complete`.

- [x] RFQ linked to PR2 in both directions

### Task 4.4: RFQ approval (replace bare `closeRfq` for Goods)

**Files:**
- Create: `lib/rfq-approvals.ts`
- Modify: `lib/canvassing.ts`

Goods: RFQ close triggers/submits `RFQ_APPROVAL`; Director final step notifies Procurement Staff that PO may be created (spec step 9).

### Task 4.5: Sync PR2 items from RFQ selections (Goods)

**Replaces** `generatePR2FromRfq()` for Goods. Required because warehouse PR2 lines have no supplier/price until canvassing completes.

**Files:**
- Create: `lib/pr2-rfq-sync.ts` → `syncPR2ItemsFromRfqSelections(pr2Id, rfqId, profile)`

Logic (mirror winning-selection paths from `lib/pr2.ts` → `generatePR2FromRfq`):
1. Read `supplier_item_selections` for `rfqId`
2. Update existing `pr2_items` rows (match by `pr1_item_id`) with:
   - `selected_rfq_supplier_id`, `supplier_name_snapshot`, `unit_price`, `total_price`, `quoted_description`, `is_alternative`, `rfq_item_quote_id`, etc.
3. Call before RFQ approval submission or as part of `closeRfq` / submit-for-approval for Goods

- [x] After canvassing, PR2 items contain winning supplier + price data
- [x] `generatePOFromPR2()` can run without empty supplier fields

### Task 4.6: PO create gate (Goods)

**Files:**
- Modify: `lib/po.ts` → `generatePOFromPR2()`

Goods guards:
1. PR2 `status = 'approved'`
2. RFQ approval instance `approved` (not only PR2 approved)
3. PR2 items synced (Task 4.5) — at least one line with `selected_rfq_supplier_id`

### Phase 4 verification

- [x] Cannot create RFQ before PR2 approved (Goods guards in `createRfq`)
- [x] RFQ create sets bidirectional PR2 ↔ RFQ link
- [x] After canvassing + sync, PR2 lines have supplier/price (`syncPR2ItemsFromRfqSelections`)
- [x] Cannot create PO before RFQ Director approval (`generatePOFromPR2` + candidate filter)
- [ ] Substitute lock on RFQ close still works (manual test)

---

## Phase 5 — Manual Send PO (Goods)

**Outcome:** Finance Director approval does not notify supplier; Procurement manually sends.

### Task 5.1: Migration — send audit columns

**Files:**
- Create: `supabase/migrations/<timestamp>_po_send_audit.sql`

```sql
ALTER TABLE po_requests
  ADD COLUMN IF NOT EXISTS sent_by_id uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;
```

### Task 5.2: `sendPOToSupplier` + procurement notify on PO approval

**Files:**
- Create: `lib/po-send.ts` → `sendPOToSupplier(poId, profile)`
- Modify: `lib/po-approvals.ts`:
  - **Goods only:** remove supplier notification from Finance Director approval (move to Send)
  - **Goods only:** on Finance Director approval, notify **procurement** “PO ready to send to supplier” (spec step 12)
- Modify: `app/po/[id]/page.tsx` — “Send PO to Supplier” when `approved` + Goods

`sendPOToSupplier` behavior (portal suppliers):
1. Guard: PO `approved`, procurement role, linked PR1 is Goods
2. Record `sent_by_id` / `sent_at`
3. Notify supplier (moved from approval step)
4. Do **not** set PO `sent` — that remains supplier ack (spec step 14)

### Task 5.3: External vendors (still open — see Decision Log)

- [ ] Portal supplier: notify on Send; ack → `sent` + delivery row
- [ ] External vendor: confirm whether `markExternalPOOrdered` replaces Send or both apply

### Phase 5 verification

- [x] Goods PO: Finance Director approval → procurement notified (not supplier)
- [x] Goods PO: supplier notified only after Procurement sends
- [x] Supplier ack flow still works after send (status stays `approved` until ack; goods ack requires `sent_at`)

---

## Phase 6 — GRN: INV #, optional QA, `pending_qa`, procurement reopen

**Outcome:** Matches spec steps 17–21 (D5, D6 locked).

### Task 6.1: Migration — INV + QA + `pending_qa` status (D5)

**Files:**
- Create: `supabase/migrations/<timestamp>_grn_inv_and_qa.sql`

```sql
ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS inv_no text;

ALTER TABLE grn_receipts DROP CONSTRAINT IF EXISTS grn_receipts_status_check;
ALTER TABLE grn_receipts ADD CONSTRAINT grn_receipts_status_check
  CHECK (status IN ('open', 'pending_qa', 'closed'));

ALTER TABLE grn_items
  ADD COLUMN IF NOT EXISTS requires_qa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qa_status text CHECK (qa_status IS NULL OR qa_status IN ('pending', 'approved')),
  ADD COLUMN IF NOT EXISTS qa_approved_by_id uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS qa_approved_at timestamptz;
```

### Task 6.2: Warehouse UI — INV # + QA flag

**Files:**
- Modify: `types/grn.ts`, `app/grn/[id]/page.tsx`

### Task 6.3: TSQA GRN queue (new module)

**Files:**
- Create: `lib/grn-tsqa.ts`, `app/tsqa/grn/page.tsx`
- Modify: `config/navigation.ts` — TSQA GRN link

Separate from accreditation RSE (`lib/tsqa.ts`).

### Task 6.4: Status transition + close guard

**Files:**
- Modify: `lib/grn.ts`

- Flagging item → GRN `pending_qa` if any item `requires_qa && qa_status = 'pending'`
- TSQA approves item → re-evaluate; all clear → GRN back to `open`
- `closeGRN()` blocked while `pending_qa` or any unresolved QA item

### Task 6.5: Procurement reopen Goods GRN (D6)

**Files:**
- Create: `supabase/migrations/<timestamp>_grn_procurement_reopen_goods.sql`

Allow procurement UPDATE on goods GRNs (reopen closed → `open` or `pending_qa` as appropriate).

### Phase 6 verification

- [x] INV # saved on GRN
- [x] Flagged item → `pending_qa` → TSQA approve → close allowed
- [x] Procurement can reopen closed Goods GRN

---

## Phase 7 — Revision same-stage ⏭️ SKIPPED

**Reason (D4):** Keep restart at step 1. No implementation. Document in `docs/workflow-versions.md` as known deviation from `Final_Workflow.md` §3.

---

## Phase 8 — Remove legacy Goods code + documentation

**Outcome:** Dead paths removed; docs updated.

### Task 8.1: Remove legacy Goods code paths

**Files to modify/remove references:**

| Legacy path | Action |
| ----------- | ------ |
| `lib/pr2.ts` → `generatePR2FromRfq()` | Remove for Goods; keep only if Services still uses it |
| `lib/pr2-rfq-sync.ts` | **Keep** — replaces generate-from-RFQ for Goods |
| `lib/warehouse.ts` → `for_canvassing` transition | Remove for Goods |
| `lib/canvassing.ts` → PR1 `for_canvassing` gate | Remove for Goods |
| `lib/pr2-approvals.ts` → `PR2_PHASE1` for Goods | Remove — use `PR2_FINAL` only |
| PR1 statuses `for_canvassing`, `canvassing_complete` | Remove from Goods UI/lifecycle; DB constraint cleanup optional |

- [x] No Goods code path reaches RFQ before PR2
- [x] `PR2_PHASE1` remains active for **Services only** (not deactivated — Services dependency)

### Task 8.2: Update docs

- [x] `docs/workflow-versions.md` — Version 7 (Final_Workflow Goods)
- [x] `docs/audit-deliverables/H-Status-Workflow-Matrix.md`

### Task 8.3: Full Goods regression (single track)

| # | Step | Expected trigger |
| - | ---- | ---------------- |
| 1 | PR1 submit | Requestor |
| 2 | PR1 approval | Supervisor → Dept Head |
| 3 | Warehouse insufficient | Warehouse creates PR2 |
| 4 | PR2 approval | Dept Head → Operations Manager |
| 5 | RFQ | Procurement Staff |
| 6 | RFQ approval + sync PR2 | Proc Manager → Director; sync selections to PR2 |
| 7 | PO | Procurement Staff (from synced PR2) |
| 8 | PO approval | Proc Staff → Proc Mgr → Finance Director → **notify Procurement (ready to send)** |
| 9 | Send PO | Procurement Staff (manual) → notify supplier |
| 10 | Delivery | Supplier |
| 11 | GRN + optional QA | Warehouse → TSQA if flagged → close |

---

## Decision Log

| ID | Decision | Choice | Date | By |
| -- | -------- | ------ | ---- | -- |
| D1 | In-flight records | **Remove all requisition records** | 2026-07-21 | Client |
| D2 | Operations Manager | **New position** | 2026-07-21 | Client |
| D3 | New PR1 track switch | **N/A — single final track after wipe** | 2026-07-21 | Client |
| D4 | Revision same-stage | **Keep restart at step 1** (Phase 7 skipped) | 2026-07-21 | Client |
| D5 | GRN Pending semantics | **New DB status `pending_qa`** | 2026-07-21 | Client |
| D6 | Procurement reopen goods GRN | **Yes** | 2026-07-21 | Client |
| — | PR1 status after warehouse PR2 | **`pr2_pending_approval`** (recommended default) | 2026-07-21 | Plan default |
| — | PR2 auto-submit on warehouse create | **Yes** (spec step 5.2) | 2026-07-21 | Plan default |
| — | PO send: delivery row timing | _UNLOCKED_ | | |
| — | External vendor Send PO | _UNLOCKED_ | | |

### Pre-wipe counts (archived 2026-07-21 before Task 0.3)

| Table | Count |
| ----- | ----- |
| pr1_requests | 32 |
| pr2_requests | 18 |
| rfq_batches | 25 |
| po_requests | 19 |
| deliveries | 14 |
| grn_receipts | 14 |
| approval_instances | 60 |
| rfq_quote_attachments | 22 |

---

## Remaining questions (optional — before Phase 5)

1. **Delivery record timing** — Create `deliveries` row on **Send PO** or on **supplier ack**?
2. **External vendors** — Keep `markExternalPOOrdered` as the send action, or unify under `sendPOToSupplier`?

---

## Files index (by phase)

| Phase | Create | Modify |
| ----- | ------ | ------ |
| 0 | `*_wipe_requisition_workflow_data.sql`, `*_add_operations_manager_position.sql` | `types/auth.ts` |
| 1 | `*_pr1_statuses_final_goods_flow.sql` | `types/pr1.ts`, `lib/warehouse.ts` |
| 2 | `*_pr2_final_workflow.sql` | `lib/pr2-approvals.ts`, `app/approvals/pr2/[id]/page.tsx` |
| 3 | `*_pr2_warehouse_create_goods.sql`, `lib/pr2-warehouse.ts` | `lib/warehouse.ts`, `app/warehouse/[id]/page.tsx` |
| 4 | `*_rfq_pr2_link.sql`, `*_rfq_approval_workflow.sql`, `lib/rfq-approvals.ts`, `lib/pr2-rfq-sync.ts` | `lib/canvassing.ts`, `lib/po.ts` |
| 5 | `*_po_send_audit.sql`, `lib/po-send.ts` | `lib/po-approvals.ts`, `app/po/[id]/page.tsx` |
| 6 | `*_grn_inv_and_qa.sql`, `*_grn_procurement_reopen_goods.sql`, `lib/grn-tsqa.ts`, `app/tsqa/grn/*` | `types/grn.ts`, `lib/grn.ts`, `app/grn/[id]/page.tsx` |
| 7 | — | _Skipped_ |
| 8 | — | Remove legacy Goods paths; `docs/workflow-versions.md` |

**Explicitly out of scope for this plan:**
- Raw Materials workflow (`Final_Workflow.md` part 2)
- Services workflow realignment (`Final_Workflow.md` part 3) — Services records are **wiped** by D1 but Services **code paths** are not rewritten here
- Substitute workflow changes (already aligned)
- Engineering ODM variant (`docs/workflow-versions.md` V6)
