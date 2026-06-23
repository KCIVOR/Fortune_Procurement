# Workflow Realignment — Implementation Plan

## Overview

This plan covers **workflow order and status alignment only**, based on the
*Procurement Workflow Revision.pdf*. No new features (attachments, department
segregation, bulk import, accreditation, etc.) are included.

Two critical mismatches were found through a live code + database audit:

1. **PR1 approval runs AFTER warehouse** (current) — must run BEFORE (PDF requirement).
2. **PR2 has a two-phase approval chain** (current) — must be collapsed to a single phase (PDF requirement).

---

## Audit Findings

### Finding 1 — PR1 Workflow Order Is Reversed

| | Current System | Required (PDF) |
|---|---|---|
| Step after Submit | `pending_warehouse` → notify Warehouse | `pending_approval` → notify Supervisor |
| Approval trigger | Warehouse creates instance when decision = `insufficient` | Created at PR1 submission |
| Final approval outcome | → `for_canvassing` | → `approved_for_warehouse` |
| Warehouse trigger | First thing after submit | After management approves |
| Warehouse outcome (insufficient) | → `pending_approval` | → `for_canvassing` |
| Warehouse outcome (sufficient) | → `resolved_internal` ✅ | → `resolved_internal` ✅ |

**Root cause in code:** `approval_instance` creation is inside
`lib/warehouse.ts:submitValidationDecision()` — it must move to
`lib/pr1.ts:submitPR1()`.

---

### Finding 2 — PR2 Two-Phase Approval Must Be Collapsed

| | Current System | Required (PDF) |
|---|---|---|
| PR2 submission | → `pending_phase1_approval` | → `pending_approval` |
| Phase 1 final approval | → `phase1_approved`, auto-starts Phase 2 | → `approved` (no Phase 2) |
| Phase 2 | `pending_phase2_approval` → `phase2_approved` | **Removed entirely** |
| PO generation guard | `phase2_approved` | `approved` |

**Root cause in code:** `lib/pr2-approvals.ts:submitPR2ApprovalAction()` calls
`startPhase2()` when Phase 1 completes — this auto-chain must be removed. PR2
goes directly to `approved` after the Director step.

---

### Finding 3 — PR1 Status Constraint Missing Values

Current DB constraint allows:
`draft`, `pending_warehouse`, `pending_approval`, `resolved_internal`, `revision_requested`, `approved`, `for_canvassing`, `canvassing_complete`, `rejected`, `cancelled`

PDF recommended statuses include two values **not in the DB constraint**:
- `approved_for_warehouse` — the state after PR1 management approval (new transition target)
- `completed` — the final state after GRN is closed (future GRN step, added now for correctness)

---

### Finding 4 — PR2 Status Constraint Uses Wrong Values

Current DB constraint: `draft`, `pending_phase1_approval`, `phase1_approved`, `pending_phase2_approval`, `phase2_approved`, `cancelled`

PDF recommended: `draft`, `pending_approval`, `approved`, `revision_requested`, `rejected`

Live PR2 data: **no existing records** (safe to do a full constraint replace).

---

### Finding 5 — PR2_PHASE2 Approval Workflow Active in DB

The `approval_workflows` table has `PR2_PHASE2` with `active = true`. This
workflow must be deactivated. The `PR2_PHASE1` workflow (Procurement Staff →
Procurement Manager → Director) already matches the PDF's single-phase approval
sequence and will be **renamed** to `PR2` conceptually but kept as `PR2_PHASE1`
code to avoid migrating existing approval instances.

> [!NOTE]
> The PR1_APPROVAL workflow steps (Supervisor → Department Head) are already
> correct. The PO_APPROVAL steps are unchanged in this plan. Only the workflow
> *order* and PR2 *phase logic* are being fixed.

---

## Proposed Changes

---

### Database Migration

#### [NEW] `supabase/migrations/<timestamp>_realign_workflow_statuses.sql`

```sql
-- 1. Add missing PR1 statuses to the CHECK constraint
ALTER TABLE pr1_requests DROP CONSTRAINT IF EXISTS pr1_requests_status_check;
ALTER TABLE pr1_requests ADD CONSTRAINT pr1_requests_status_check
  CHECK (status = ANY (ARRAY[
    'draft', 'pending_warehouse', 'pending_approval',
    'approved_for_warehouse', 'resolved_internal', 'revision_requested',
    'for_canvassing', 'canvassing_complete', 'approved',
    'completed', 'rejected', 'cancelled'
  ]));

-- 2. Replace PR2 status CHECK constraint
ALTER TABLE pr2_requests DROP CONSTRAINT IF EXISTS pr2_requests_status_check;
ALTER TABLE pr2_requests ADD CONSTRAINT pr2_requests_status_check
  CHECK (status = ANY (ARRAY[
    'draft', 'pending_approval', 'approved',
    'revision_requested', 'rejected', 'cancelled'
  ]));

-- 3. Deactivate PR2_PHASE2 workflow
UPDATE approval_workflows SET active = false WHERE code = 'PR2_PHASE2';
```

> [!IMPORTANT]
> The old PR1 status values (`pending_warehouse`, `approved`, etc.) are kept in
> the constraint for backward compatibility with any existing records still in
> those states. They are not removed — only new values are added.

---

### `lib/pr1.ts`

#### [MODIFY] `submitPR1` — Move submission target and approval kickoff here

**Change 1:** Status at submission changes from `pending_warehouse` → `pending_approval`.

**Change 2:** After updating the header, create the `PR1_APPROVAL` approval instance
(currently done in `warehouse.ts`). Notify the Supervisor (step 1 approver).

**Change 3:** Remove the warehouse notification block (`notifyByRole('warehouse', ...)`).
Replace it with a call to `notifyApproversForStep` for step 1 of `PR1_APPROVAL`.

```diff
- status: 'pending_warehouse',
+ status: 'pending_approval',
```

```diff
- // notify warehouse
- await notifyByRole('warehouse', { ... });
+ // Create approval instance and notify step-1 approver (Supervisor)
+ const { data: wf } = await db.from('approval_workflows')
+   .select('id').eq('code', 'PR1_APPROVAL').eq('active', true).maybeSingle();
+ if (!wf) throw new Error('PR1_APPROVAL workflow not configured.');
+ const { data: newInst } = await db.from('approval_instances').insert({
+   workflow_id: wf.id, document_type: 'PR1', document_id: pr1Id,
+   current_step: 1, status: 'active', started_by: authUserId, started_at: now,
+ }).select('id').single();
+ if (newInst?.id) {
+   await notifyApproversForStep({
+     workflowId: wf.id, stepOrder: 1, documentId: pr1Id,
+     documentNumber: values.pr1_number.trim(), instanceId: newInst.id,
+   });
+ }
```

#### [MODIFY] Lifecycle derivation — update PR2 approved check

```diff
- const PR2_PHASE2_APPROVED = 'phase2_approved';
+ const PR2_APPROVED = 'approved';
```

```diff
- const allPr2Approved = pr2Statuses.every(s => s === PR2_PHASE2_APPROVED);
+ const allPr2Approved = pr2Statuses.every(s => s === PR2_APPROVED);
```

---

### `lib/warehouse.ts`

This file has the most significant logic changes.

#### [MODIFY] `fetchWarehouseQueue` / `fetchWarehouseQueuePaged` / `fetchWarehouseQueueStatCounts`

Change queue filter from `pending_warehouse` → `approved_for_warehouse`.

```diff
- .eq('status', 'pending_warehouse')
+ .eq('status', 'approved_for_warehouse')
```

This applies to all three query helpers (lines 92, 110, 157).

#### [MODIFY] `submitWarehouseTerminalAction` — change guard

```diff
- .eq('status', 'pending_warehouse')
+ .eq('status', 'approved_for_warehouse')
```

#### [MODIFY] `submitValidationDecision` — Remove approval instance creation, fix outcome statuses

**Change 1:** Change the guard on the PR1 update from `pending_warehouse` →
`approved_for_warehouse`.

```diff
- .eq('status', 'pending_warehouse')
+ .eq('status', 'approved_for_warehouse')
```

**Change 2:** Fix the outcome status mapping. Warehouse no longer routes to
approval — it routes to canvassing or closes internally.

```diff
- // sufficient → resolved_internal, insufficient → pending_approval
- const nextPRStatus = decision === 'sufficient' ? 'resolved_internal' : 'pending_approval';
+ // sufficient → resolved_internal, insufficient → for_canvassing
+ const nextPR1Status = decision === 'sufficient' ? 'resolved_internal' : 'for_canvassing';
```

**Change 3:** Remove the entire `if (decision === 'insufficient')` block that
creates the approval instance (lines 541–589). This block is no longer needed
because the approval instance is now created at PR1 submission time.

**Change 4:** Update notifications. For `insufficient`:
- Notify **procurement** role (`notifyByRole('procurement', ...)`) that PR1 is
  ready for canvassing. This replaces the `notifyApproversForStep` call that
  was inside the removed block.

---

### `lib/approvals.ts`

#### [MODIFY] `submitApprovalAction` — Change PR1 final-step outcome

When the Department Head gives final approval, PR1 should go to
`approved_for_warehouse` (not `for_canvassing`). Warehouse picks up from there.

```diff
- // 2a. Final step approved → instance approved, PR1 → for_canvassing
- .update({ status: 'for_canvassing', updated_at: now })
- .eq('status', 'pending_approval');
+ // 2a. Final step approved → instance approved, PR1 → approved_for_warehouse
+ .update({ status: 'approved_for_warehouse', updated_at: now })
+ .eq('status', 'pending_approval');
```

The notification on final approval should now notify the **warehouse** role
instead of procurement (since warehouse reviews next). Replace:

```diff
- await notifyByRole('procurement', {
-   title: 'PR1 Ready for Canvassing', ...
- });
+ await notifyByRole('warehouse', {
+   title: 'PR1 Approved — Awaiting Warehouse Validation',
+   body: `PR1 ${pr1Row.pr1_number} was approved and requires warehouse validation.`,
+   ...
+ });
```

---

### `lib/pr2-approvals.ts`

#### [MODIFY] `submitPR2ForApproval` — Update status transition

```diff
- .update({ status: 'pending_phase1_approval', updated_at: now })
+ .update({ status: 'pending_approval', updated_at: now })
```

#### [MODIFY] `submitPR2ApprovalAction` — Collapse to single phase

**Change 1:** On final step approval, remove the `if (workflowCode === 'PR2_PHASE1')` branch.
Replace the entire `isFinalStep` block with a direct `approved` transition:

```diff
- if (workflowCode === 'PR2_PHASE1') {
-   await db.from('pr2_requests').update({ status: 'phase1_approved' }).eq('id', pr2Id);
-   const phase2 = await startPhase2(pr2Id, profile, now);
-   // ... phase2 notification ...
- } else {
-   // Phase 2 fully approved
-   await db.from('pr2_requests').update({ status: 'phase2_approved' }).eq('id', pr2Id);
-   // ... notify requisitioner ...
- }
+ // Single-phase: Director approval completes PR2
+ await db.from('pr2_requests').update({ status: 'approved', updated_at: now }).eq('id', pr2Id);
+ // notify requisitioner that PR2 is approved
+ // ... (same notification as old phase2 final) ...
```

**Change 2:** Update audit action label:

```diff
- ? workflowCode === 'PR2_PHASE1' ? 'PR2_PHASE1_APPROVED' : 'PR2_PHASE2_APPROVED'
+ ? 'PR2_APPROVED'
```

**Change 3:** Remove the `startPhase2` private function entirely (lines 609–643).

---

### `lib/po.ts`

#### [MODIFY] PO generation guard — update PR2 status check

```diff
- .eq('status', 'phase2_approved')
+ .eq('status', 'approved')
```

```diff
- if (pr2.status !== 'phase2_approved') throw new Error(...)
+ if (pr2.status !== 'approved') throw new Error(...)
```

---

### `types/pr1.ts`

#### [MODIFY] `PR1Status` union — add new statuses

```diff
 export type PR1Status =
   | 'draft'
   | 'pending_warehouse'
   | 'pending_approval'
+  | 'approved_for_warehouse'
   | 'resolved_internal'
   | 'revision_requested'
   | 'for_canvassing'
   | 'canvassing_complete'
   | 'approved'
   | 'rejected'
+  | 'completed'
   | 'cancelled';
```

#### [MODIFY] `PR1_STATUS_LABELS` — add label entries

```diff
+  approved_for_warehouse: 'Approved — Awaiting Warehouse',
+  completed:              'Completed',
```

---

### `types/pr2.ts`

#### [MODIFY] `PR2Status` union — replace phase statuses

```diff
 export type PR2Status =
-  | 'pending_phase1_approval'
-  | 'phase1_approved'
-  | 'pending_phase2_approval'
-  | 'phase2_approved'
+  | 'pending_approval'
+  | 'approved'
+  | 'revision_requested'
+  | 'rejected'
   | 'draft'
   | 'cancelled';
```

#### [MODIFY] `PR2_STATUS_LABELS` — replace label entries

```diff
-  pending_phase1_approval:  'Pending Phase 1',
-  phase1_approved:          'Phase 1 Approved',
-  pending_phase2_approval:  'Pending Phase 2',
-  phase2_approved:          'Approved',
+  pending_approval:         'Pending Approval',
+  approved:                 'Approved',
+  revision_requested:       'Needs Revision',
+  rejected:                 'Rejected',
```

---

### `lib/status-ui.ts`

#### [MODIFY] PR1 status chip map — add `approved_for_warehouse`

```diff
+  approved_for_warehouse: { label: 'Approved — Awaiting Warehouse', className: 'bg-blue-50 text-blue-700' },
```

#### [MODIFY] PR2 status chip map — replace phase entries

```diff
-  pending_phase1_approval: { label: 'Pending Phase 1', ... },
-  phase1_approved:         { label: 'Phase 1 Approved', ... },
-  pending_phase2_approval: { label: 'Pending Phase 2', ... },
-  phase2_approved:         { label: 'Approved', ... },
+  pending_approval:        { label: 'Pending Approval', className: 'bg-amber-50 text-amber-700' },
+  approved:                { label: 'Approved', className: 'bg-emerald-50 text-emerald-700' },
+  revision_requested:      { label: 'Needs Revision', className: 'bg-orange-50 text-orange-700' },
+  rejected:                { label: 'Rejected', className: 'bg-red-50 text-red-700' },
```

---

### UI Pages — PR2 References

Several pages still reference old phase statuses and must be updated
to use the new `approved` / `pending_approval` values.

#### [MODIFY] `app/pr2/page.tsx` — Status badge map (lines 20–23)

Replace all phase status keys with new values.

#### [MODIFY] `app/pr2/[id]/page.tsx` — Status badge map and conditional renders

- Status badge map (lines 33–36): replace phase keys.
- PO generation button guard (line 408): `phase2_approved` → `approved`
- PO group guard (line 435): `phase2_approved` → `approved`
- Status timeline conditionals (lines 685–712): collapse from 4 phase renders to
  2 renders (`pending_approval`, `approved`).

#### [MODIFY] `app/approvals/page.tsx` (line 352) — Remove Phase 2 label

```diff
-  PR2_PHASE2: 'Phase 2',
```

#### [MODIFY] `app/approvals/pr2/page.tsx` (line 286) — Remove Phase 2 label

```diff
-  PR2_PHASE2: 'Phase 2',
```

#### [MODIFY] `app/approvals/pr2/[id]/page.tsx` (line 530)

```diff
-  detail.pr2_status === 'phase2_approved'
+  detail.pr2_status === 'approved'
```

---

## Workflow Diagrams

### New PR1 Lifecycle

```
Employee Submit
    │
    ▼
pending_approval ──────────────► revision_requested (approver requests)
    │                                │
    │ (Supervisor approves)          └──► pending_approval (re-submit)
    │
    ▼ (Department Head final approval)
approved_for_warehouse
    │
    ▼
Warehouse validates
    │
    ├── sufficient ──► resolved_internal (closed, stock fulfilled)
    │
    └── insufficient ──► for_canvassing
                            │
                            ▼
                     canvassing_complete
                            │
                            ▼
                    (PR2 → PO → GRN)
                            │
                            ▼
                        completed
```

### New PR2 Lifecycle (Single Phase)

```
Procurement generates PR2 (draft)
    │
    ▼ (Procurement Staff submits)
pending_approval
    │
    ├── Step 1: Procurement Staff (Prepared By)
    ├── Step 2: Procurement Manager (Reviewed By)
    └── Step 3: Director (Final Approval)
                    │
                    ▼
                approved ──────────► PO Generation
```

---

## Execution Order

| # | Step | Risk |
|---|---|---|
| 1 | Run DB migration (add PR1 statuses, replace PR2 constraint, deactivate PR2_PHASE2) | Low — additive only |
| 2 | Update `types/pr1.ts` and `types/pr2.ts` | None — TypeScript only |
| 3 | Update `lib/pr1.ts` — submitPR1 (approval kickoff, status change, notification) | High — core submit path |
| 4 | Update `lib/warehouse.ts` — all queue filters + submitValidationDecision | High — core warehouse path |
| 5 | Update `lib/approvals.ts` — final step outcome | High — core approval path |
| 6 | Update `lib/pr2-approvals.ts` — collapse to single phase, remove startPhase2 | High — PR2 approval path |
| 7 | Update `lib/po.ts` — guard status | Medium — PO generation guard |
| 8 | Update `lib/status-ui.ts` | Low — display only |
| 9 | Update UI pages (pr2/page, pr2/[id]/page, approvals pages) | Low — display only |

---

## Verification Plan

### Automated
- TypeScript build: `npm run build` — verifies no type errors on updated status unions.

### Manual (End-to-End)
1. **PR1 Submit path:** Submit a PR1 → confirm status = `pending_approval`, approval instance created, Supervisor notified.
2. **PR1 Approval path:** Supervisor approves → Department Head approves → confirm PR1 status = `approved_for_warehouse`, warehouse notified.
3. **Warehouse path:** Warehouse opens validation → submits sufficient → confirm `resolved_internal`. Submits insufficient → confirm `for_canvassing`, procurement notified.
4. **PR2 single phase:** Generate PR2 → submit for approval → Procurement Staff → Procurement Manager → Director approves → confirm PR2 status = `approved` (no Phase 2 created).
5. **PO generation:** Confirm PO can be generated from an `approved` PR2.

### Out of Scope (deferred)
- `completed` status transition from GRN (no code currently sets PR1 to `completed` — deferred to GRN completion task)
- Service request warehouse bypass logic
- TSQA notice display
