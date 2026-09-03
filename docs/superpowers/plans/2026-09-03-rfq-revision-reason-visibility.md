# RFQ Page — Show Director's Revision Reason — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the Director requests revision at the RFQ_APPROVAL step (Phase 2, after RFQ close), show the reason on the Procurement-facing `/rfq/[id]` page — and keep the "View PR2" link reachable — instead of the RFQ silently looking like an ordinary Open RFQ.

**Architecture:** Read-only addition to `app/rfq/[id]/page.tsx`. Add one best-effort secondary fetch (`fetchRfqApprovalDetail`, already used by `/pr2/[id]`) alongside the existing lightweight instance lookup, store it in a new state var, and render (a) a "Revision Requested" banner with the actor + remark, (b) the existing read-only `ApprovalPhaseTimeline` component (same one `/pr2/[id]` already renders) for full sign-off history, and (c) fix the `existingPR2Id` gating so "View PR2" doesn't disappear when the RFQ reopens to `'open'`. No new components, no schema changes, no writes.

**Tech Stack:** Next.js / TypeScript, existing `lib/rfq-approvals.ts` reads, existing `components/approvals/ApprovalPhaseTimeline.tsx`.

**Audit evidence (do not re-litigate — see prior conversation turn):**
- `lib/rfq-approvals.ts:398-408` — on `revision_requested`, sets `approval_instances.status = 'cancelled'` and flips `rfq_batches.status` back to `'open'`. The remark is saved correctly to `approval_actions.remarks`.
- `app/rfq/[id]/page.tsx:29,232` — fetches only `fetchRfqApprovalInstanceForRfq(id)`, which selects `id, status, current_step` only (`lib/rfq-approvals.ts:154-167`). No remarks, no actions.
- `app/rfq/[id]/page.tsx:492-493` — only derives `rfqApprovalApproved` / `rfqApprovalPending`; no branch for `'cancelled'`.
- Because `rfq_batches.status` reverts to `'open'`, `isClosed` (`app/rfq/[id]/page.tsx:276`) becomes `false`, which also hides the "View PR2" button (`app/rfq/[id]/page.tsx:678`, gated on `isClosed && existingPR2Id`) and the status text block (`app/rfq/[id]/page.tsx:661-673`).
- The remark **does** render today, but only on `/pr2/[id]` via `RfqApprovalPanel` (`components/approvals/RfqApprovalPanel.tsx:89-97`) → `ApprovalPhaseTimeline` (`components/approvals/ApprovalPhaseTimeline.tsx:167-169`), which is fed by the fuller `fetchRfqApprovalDetail(instanceId)` (`lib/rfq-approvals.ts:247-340`).

---

## Safety constraints (non-negotiable)

These constrain every phase. If a change violates one, stop and revise the plan.

1. **Do not render `RfqApprovalPanel` on `/rfq/[id]`.** Use `ApprovalPhaseTimeline` directly — it is a pure display component with no action buttons. Who can approve/reject/request-revision, and from where (`/pr2/[id]` only), does not change.
2. **Do not modify `fetchRfqApprovalInstanceForRfq`** (`lib/rfq-approvals.ts:154-167`) — its shape is also consumed by `app/pr2/[id]/page.tsx:231`. Add a *new*, separate call to `fetchRfqApprovalDetail` instead of changing this one.
3. **Do not modify `fetchRfqApprovalDetail`** (`lib/rfq-approvals.ts:247-340`) — reuse as-is. It already returns `steps`, `actions` (with `remarks`), `current_step`, `instance_status`, `department_id`, `preparer`, `rfq_id`, `pr2_id`.
4. **Do not touch `submitRfqApprovalAction`, `RfqApprovalPanel.tsx`, or `app/approvals/rfq/[id]/page.tsx`.** The action-submission path is out of scope for a visibility-only fix.
5. **Do not change the cancel/reopen-to-`'open'` behavior** in `lib/rfq-approvals.ts`. That's intentional (RFQ becomes editable again) — this plan only adds visibility into *why*.
6. **Do not change the shape or removal of the existing `rfqApproval` state.** Other derived flags (`rfqApprovalApproved`, `rfqApprovalPending`) read it today; add a new state (`rfqApprovalDetail`) alongside it, don't repurpose it.
7. **The new fetch must be best-effort and non-blocking.** Gate it on `approval?.id` existing; on failure, set the new state to `null` and swallow the error — never let it throw into the main `.catch` or delay `setLoading(false)`. A legacy/edge-case RFQ with no approval history must still load normally.
8. **Only extend gating conditions additively (OR), never replace `isClosed`.** E.g. `isClosed && existingPR2Id` → `(isClosed || rfqApprovalRevisionRequested) && existingPR2Id`. Every RFQ that reaches this state today via `isClosed` must still reach it.
9. **No DB writes, no migrations, no new API routes.** Pure read + render.
10. **Do not touch canvassing/quotation code** (`lib/canvassing.ts`, quote matrix rendering, the VAT In/Ex/No VAT badges from the prior task) in this pass.
11. **Reuse existing imports where possible.** `RotateCcw` is already imported in `app/rfq/[id]/page.tsx:36` (used by the "Reopen RFQ" button) — reuse it for the new banner icon; do not add a duplicate icon import.
12. **Do not commit unless the user asks.**

---

## Out of scope (explicit)

- Letting the Director act (approve / reject / request revision) from `/rfq/[id]`
- Changing what happens when revision is requested (still reopens RFQ to `'open'`)
- Notifications / email changes
- PR1, PO, GRN pages
- Any change to the Quotation Comparison table or VAT badges

---

## File map

| File | Responsibility |
|------|----------------|
| Modify: `app/rfq/[id]/page.tsx` | Add `rfqApprovalDetail` state + best-effort fetch; derive `rfqApprovalRevisionRequested` + `lastRevisionAction`; render revision banner + read-only timeline card; extend View PR2 / status-text gating |
| Unchanged: `lib/rfq-approvals.ts` | Reuse `fetchRfqApprovalDetail` and `fetchRfqApprovalInstanceForRfq` as-is |
| Unchanged: `components/approvals/ApprovalPhaseTimeline.tsx` | Reuse as-is (already renders steps/actions/remarks) |
| Unchanged: `components/approvals/RfqApprovalPanel.tsx`, `app/pr2/[id]/page.tsx`, `app/approvals/rfq/[id]/page.tsx` | Approval-action path untouched |

---

## Phase 0 — Lock evidence

- [ ] **Step 1: Confirm the RFQ page still only fetches the lightweight instance**

Open `app/rfq/[id]/page.tsx` and verify line ~232 still calls only `fetchRfqApprovalInstanceForRfq(id)` inside the `Promise.all`, and that `rfqApprovalDetail` does not already exist. If it already fetches full detail, stop and re-audit.

---

## Phase 1 — Fetch full approval detail (read-only, best-effort)

### Task 1: Add state + import

**Files:**
- Modify: `app/rfq/[id]/page.tsx`

- [ ] **Step 1: Extend the import**

Replace:
```ts
import { fetchRfqApprovalInstanceForRfq } from '@/lib/rfq-approvals';
```
with:
```ts
import { fetchRfqApprovalInstanceForRfq, fetchRfqApprovalDetail, type RfqApprovalDetail } from '@/lib/rfq-approvals';
```

- [ ] **Step 2: Add new state next to the existing `rfqApproval` state**

After:
```ts
  const [rfqApproval, setRfqApproval] = useState<{
    id: string;
    status: string;
    current_step: number;
  } | null>(null);
```
add:
```ts
  const [rfqApprovalDetail, setRfqApprovalDetail] = useState<RfqApprovalDetail | null>(null);
```

### Task 2: Chain the best-effort fetch inside `load`

**Files:**
- Modify: `app/rfq/[id]/page.tsx`

- [ ] **Step 1: Extend `load`'s `.then` — do not add a 4th entry to `Promise.all`**

Replace:
```ts
      .then(([d, pr2, approval]) => {
        if (!d) { setError('RFQ not found.'); return; }
        setDetail(d);
        setMatrix(buildQuoteMatrix(d));
        setExistingPR2Id(pr2?.id ?? d.rfq.pr2_id ?? null);
        setRfqApproval(approval);
      })
```
with:
```ts
      .then(([d, pr2, approval]) => {
        if (!d) { setError('RFQ not found.'); return; }
        setDetail(d);
        setMatrix(buildQuoteMatrix(d));
        setExistingPR2Id(pr2?.id ?? d.rfq.pr2_id ?? null);
        setRfqApproval(approval);
        if (approval?.id) {
          fetchRfqApprovalDetail(approval.id)
            .then(setRfqApprovalDetail)
            .catch(() => setRfqApprovalDetail(null));
        } else {
          setRfqApprovalDetail(null);
        }
      })
```

Note: deliberately *not* awaited/added into the `Promise.all` — it must not delay `setLoading(false)` or block the main page render (constraint 7).

- [ ] **Step 2: Manual sanity check**

```bash
rg "fetchRfqApprovalInstanceForRfq|fetchRfqApprovalDetail" app/rfq/\[id\]/page.tsx
```

Expected: both calls present; `Promise.all` still has exactly 3 entries.

---

## Phase 2 — Derive flags and render the revision notice

### Task 3: Derived flags

**Files:**
- Modify: `app/rfq/[id]/page.tsx`

- [ ] **Step 1: Add next to the existing derived flags**

After:
```ts
  const rfqApprovalApproved = rfqApproval?.status === 'approved';
  const rfqApprovalPending = rfqApproval?.status === 'active';
```
add:
```ts
  const rfqApprovalRevisionRequested = rfqApprovalDetail?.instance_status === 'cancelled';
  const lastRevisionAction = rfqApprovalDetail?.actions
    .filter(a => a.action === 'revision_requested')
    .slice(-1)[0] ?? null;
```

### Task 4: Revision banner

**Files:**
- Modify: `app/rfq/[id]/page.tsx`

- [ ] **Step 1: Add a new banner alongside the existing guidance banners**

Place it as the first banner in the "Guidance banners" section (before the `isDraft && suppliers.length < 1` banner), so it's visible regardless of which status-specific banner also applies:

```tsx
      {rfqApprovalRevisionRequested && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-md px-5 py-4 mb-6">
          <RotateCcw className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-800">
              Revision requested by {lastRevisionAction?.actor_name_snapshot ?? 'the approver'}
            </p>
            {lastRevisionAction?.remarks && (
              <p className="text-xs text-orange-700 mt-0.5">
                &ldquo;{lastRevisionAction.remarks}&rdquo;
              </p>
            )}
            <p className="text-xs text-orange-700 mt-1">
              This RFQ was reopened for canvassing. Update as needed, then close it again to resubmit for approval.
            </p>
          </div>
        </div>
      )}
```

`RotateCcw` is already imported (used by the "Reopen RFQ" button) — no new import needed.

This banner is self-correcting: once Procurement re-closes the RFQ and a Director acts again, `fetchRfqApprovalInstanceForRfq` returns the *new* (latest) instance, so `rfqApprovalDetail.instance_status` will no longer be `'cancelled'` and the banner disappears on its own.

### Task 5: Read-only approval timeline card

**Files:**
- Modify: `app/rfq/[id]/page.tsx`

- [ ] **Step 1: Import `ApprovalPhaseTimeline`**

Add:
```ts
import ApprovalPhaseTimeline from '@/components/approvals/ApprovalPhaseTimeline';
```

- [ ] **Step 2: Render it, read-only, whenever approval history exists**

Add as its own card in the left column, directly after the existing "PR1 Details" / "PR2 Details" card:

```tsx
          {rfqApprovalDetail && (
            <ApprovalPhaseTimeline
              phaseLabel="Approval"
              phaseSubLabel={`Canvassing sign-off for ${rfq.rfq_number}`}
              steps={rfqApprovalDetail.steps}
              actions={rfqApprovalDetail.actions}
              currentStep={rfqApprovalDetail.current_step}
              instanceStatus={rfqApprovalDetail.instance_status}
              preparer={rfqApprovalDetail.preparer}
            />
          )}
```

No action props are passed — this component only renders approve/reject/revise buttons via `RfqApprovalPanel`, which is a separate component not used here (constraint 1).

- [ ] **Step 3: Visual check**

```bash
npm run build
```

Expected: no type errors. `RfqApprovalDetail`'s `steps`/`actions`/`current_step`/`instance_status`/`preparer` fields match `ApprovalPhaseTimelineProps` exactly (already true for `/pr2/[id]`'s usage of the same component).

---

## Phase 3 — Fix "View PR2" / status-text gating

### Task 6: Extend gating additively

**Files:**
- Modify: `app/rfq/[id]/page.tsx`

- [ ] **Step 1: Status text block**

Replace:
```tsx
            {isClosed && existingPR2Id && (
              <p className="text-xs text-pq-neutral-400 italic mt-1">
                {followsApprovalFlow
                  ? rfqApprovalApproved
                    ? 'RFQ approved — procurement may create PO from the linked PR2.'
                    : rfqApprovalPending
                      ? 'RFQ closed — pending Director approval.'
                      : isPr2Native
                        ? 'Linked PR2 was created directly by Planning.'
                        : 'Linked PR2 was created at warehouse validation.'
                  : 'A PR2 has already been generated from this RFQ — it can no longer be reopened.'}
              </p>
            )}
```
with:
```tsx
            {(isClosed || rfqApprovalRevisionRequested) && existingPR2Id && (
              <p className="text-xs text-pq-neutral-400 italic mt-1">
                {followsApprovalFlow
                  ? rfqApprovalApproved
                    ? 'RFQ approved — procurement may create PO from the linked PR2.'
                    : rfqApprovalRevisionRequested
                      ? 'Director requested revision — see the notice above.'
                      : rfqApprovalPending
                        ? 'RFQ closed — pending Director approval.'
                        : isPr2Native
                          ? 'Linked PR2 was created directly by Planning.'
                          : 'Linked PR2 was created at warehouse validation.'
                  : 'A PR2 has already been generated from this RFQ — it can no longer be reopened.'}
              </p>
            )}
```

- [ ] **Step 2: "View PR2" button**

Replace:
```tsx
            {isClosed && existingPR2Id && (
              <ActionButton
                icon={ClipboardList}
                label="View PR2"
                color="emerald"
                onClick={handleViewPR2}
                disabled={working}
              />
            )}
```
with:
```tsx
            {(isClosed || rfqApprovalRevisionRequested) && existingPR2Id && (
              <ActionButton
                icon={ClipboardList}
                label="View PR2"
                color="emerald"
                onClick={handleViewPR2}
                disabled={working}
              />
            )}
```

- [ ] **Step 3: Confirm no other gate needs the same treatment**

```bash
rg "isClosed && existingPR2Id|isClosed && !followsApprovalFlow" app/rfq/\[id\]/page.tsx
```

Expected: only the two blocks above matched `isClosed && existingPR2Id`; the "Reopen RFQ" button blocks (`isClosed && !followsApprovalFlow && !existingPR2Id` and `isClosed && followsApprovalFlow && !rfqApprovalApproved`) are intentionally left untouched — after a revision request the RFQ is already `'open'`, so `isClosed` is `false` and those buttons correctly stay hidden (there's nothing to "reopen").

---

## Phase 4 — Verify

### Task 7: Static checks

- [ ] **Step 1: Confirm forbidden files were not edited**

```bash
git diff --stat
```

Expected: only `app/rfq/[id]/page.tsx` (and this plan file) appear as changed. Stop if `lib/rfq-approvals.ts`, `components/approvals/RfqApprovalPanel.tsx`, `app/pr2/[id]/page.tsx`, or `app/approvals/rfq/[id]/page.tsx` show up as edits.

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: clean build, no new type errors.

### Task 8: Manual QA

- [ ] **Step 1: Baseline — RFQ with no approval history yet (draft/open)**

Open any draft or open RFQ that hasn't been closed yet. Expected: page loads exactly as before — no new banner, no timeline card, no console errors. (`rfqApproval` is `null` → `rfqApprovalDetail` fetch is skipped entirely.)

- [ ] **Step 2: RFQ closed, pending Director approval**

Close an RFQ that follows the approval flow (Goods/Services/Raw Material). Expected: existing "RFQ closed — pending Director approval." text still shows; new read-only timeline card appears showing Step 1 in progress; no revision banner.

- [ ] **Step 3: Director requests revision (the core fix)**

As Director, open the linked `/pr2/[id]` and click "Request Revision" with a remark, e.g. "Unit prices look inflated vs. last quarter." Then return to `/rfq/[id]` for that RFQ.

Expected:
- RFQ status shows "Open" again (unchanged existing behavior)
- New orange banner: "Revision requested by \<Director name\>" with the quoted remark
- Read-only timeline card shows the revision-requested step with the same remark
- "View PR2" button is visible and works
- Supplier/quote sections below (Quotation Comparison, VAT badges, supplier list) are visually unchanged

- [ ] **Step 4: Confirm Director still can't act from `/rfq/[id]`**

On the same RFQ from Step 3, confirm there are no Approve / Reject / Request Revision buttons anywhere on `/rfq/[id]` — those remain exclusive to `/pr2/[id]` via `RfqApprovalPanel`.

- [ ] **Step 5: Re-close and re-approve, confirm banner clears**

As Procurement, address the remark, close the RFQ again, and have the Director approve it. Return to `/rfq/[id]`. Expected: banner is gone (new instance is `'active'` then `'approved'`, not `'cancelled'`); "RFQ approved — procurement may create PO from the linked PR2." text shows as before.

---

## Rollback

- Revert `app/rfq/[id]/page.tsx` to the pre-change version. No DB/schema changes to undo.

---

## Self-review

| Audit requirement | Task |
|---|---|
| Revision reason (remarks) visible on `/rfq/[id]` | Task 3, 4 |
| Full sign-off history visible, matching `/pr2/[id]` | Task 5 |
| "View PR2" reachable after reopen | Task 6 |
| Director approval actions stay exclusive to `/pr2/[id]` | Constraint 1; QA Step 4 |
| No change to reopen-to-`'open'` behavior | Constraint 5 |
| No change to other RFQ page behavior (supplier list, quote matrix, VAT badges) | Constraint 10; QA Step 3 |
| Existing `rfqApproval`-derived UI unaffected | Constraint 6, 8; QA Step 2, 5 |
