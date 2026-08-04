# PO Revision-Requested Save Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make procurement Save Changes persist header field edits (including remarks) when a PO is in `revision_requested`, without changing draft save, resubmit, approval, or RLS behavior.

**Architecture:** One-line status-filter mismatch. The detail page already allows edit for `draft | revision_requested`, and `submitPOForApproval` already accepts both. Only `updatePODraft` still filters `.eq('status', 'draft')`, so PostgREST updates 0 rows and returns no error. Align that filter with the existing PR1 pattern (`.in('status', ['draft', 'revision_requested'])`) and fail loudly if zero rows match.

**Tech Stack:** Next.js App Router, Supabase JS client (`lib/po.ts` → `po_requests`), existing PO detail page at `app/po/[id]/page.tsx`.

**Audit evidence (do not re-litigate):**
- UI gate already correct: `canEdit = (status === 'draft' || status === 'revision_requested') && role === 'procurement'` in `app/po/[id]/page.tsx:176`
- Writer already correct: revision action sets `po_requests.status = 'revision_requested'` in `lib/po-approvals.ts`
- Resubmit already correct: `submitPOForApproval` accepts `draft | revision_requested` in `lib/po-approvals.ts:60`
- Broken writer: `updatePODraft` in `lib/po.ts:842-852` filters `.eq('status', 'draft')` only
- Silent failure: Supabase returns `{ error: null }` on 0-row UPDATE; `handleSave` exits edit mode and `load()` shows stale remarks
- Established peer pattern: `saveDraftPR1` already uses `.in('status', ['draft', 'revision_requested'])` in `lib/pr1.ts:844`
- RLS not the blocker: `Procurement or Buyer can update POs` has no status predicate (`supabase/migrations/20260521140000_po_rls_buyer_position.sql`)

---

## Safety constraints (non-negotiable)

These constrain every task. If a change violates one, stop and revise.

1. **Do not change status on save.** `updatePODraft` must continue updating only the six header fields + `updated_at`. It must never set `status`, clear `approval_instance_id`, or touch line items.
2. **Do not widen beyond editable statuses.** Allowed statuses for this update are exactly `draft` and `revision_requested` — the same set as `canEdit` and `submitPOForApproval`. Do not include `for_approval`, `approved`, `sent`, `rejected`, or any other status.
3. **Do not touch UI gates.** Leave `canEdit`, Edit/Save/Cancel buttons, and the revision banner in `app/po/[id]/page.tsx` alone — they are already correct.
4. **Do not touch approval/resubmit logic.** Leave `lib/po-approvals.ts` (`submitPOForApproval`, revision/reject/approve branches) unchanged.
5. **Do not change RLS / migrations.** No schema or policy work is required for this bug.
6. **Do not refactor `updatePODraft` callers or rename the function.** Keep the signature and call site (`handleSave` → `updatePODraft(po.id, editForm)`).
7. **Draft happy path stays byte-stable in intent.** A PO with `status = 'draft'` must still save the same fields the same way.
8. **Out of scope:** item-level edits, compliance toggles, priority updates, print view, supplier PO views, PR2/PR1 revision paths.

---

## File map

| File | Responsibility |
|------|----------------|
| `lib/po.ts` (`updatePODraft` only) | Widen status filter; detect 0-row update and throw |
| *(manual QA only)* `app/po/[id]/page.tsx` | No code change — verify Save still works via existing `handleSave` |

No new files. No migrations. No UI changes.

---

### Task 1: Widen `updatePODraft` status filter + fail on zero rows

**Files:**
- Modify: `lib/po.ts:842-852`

- [ ] **Step 1: Confirm current broken implementation**

Open `lib/po.ts` and verify `updatePODraft` still looks like this (if it already differs, stop and re-audit):

```ts
export async function updatePODraft(
  poId: string,
  values: { po_date: string; delivery_address: string; warehouse: string; payment_terms: string; packing: string; remarks: string }
): Promise<void> {
  const { error } = await db
    .from('po_requests')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', poId)
    .eq('status', 'draft');
  if (error) throw error;
}
```

- [ ] **Step 2: Apply the minimal fix**

Replace the function body so it:
1. Matches PR1's editable-status set via `.in('status', ['draft', 'revision_requested'])`
2. Returns the updated row id via `.select('id').maybeSingle()` so a 0-row match cannot look like success
3. Still only writes the provided header fields + `updated_at` (no status mutation)

```ts
export async function updatePODraft(
  poId: string,
  values: { po_date: string; delivery_address: string; warehouse: string; payment_terms: string; packing: string; remarks: string }
): Promise<void> {
  const { data, error } = await db
    .from('po_requests')
    .update({ ...values, updated_at: new Date().toISOString() })
    .eq('id', poId)
    .in('status', ['draft', 'revision_requested'])
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error('PO could not be updated. It may no longer be editable.');
  }
}
```

**Why `.select('id').maybeSingle()` is included:** before this fix, 0-row updates were silent. Keeping a throw here preserves that defense if status later drifts again, without changing the draft/revision happy path (both return a row).

**Do not:**
- Call `.eq('status', 'draft').or(...)` with a different shape — use `.in(...)` to match `lib/pr1.ts:844`
- Reset status to `draft` on save
- Add a pre-fetch status check in the page
- Change `handleSave` error messaging (it already surfaces `err.message`)

- [ ] **Step 3: Static sanity check**

Confirm no other call sites of `updatePODraft` exist besides `app/po/[id]/page.tsx`:

```bash
rg "updatePODraft" -g "*.ts" -g "*.tsx"
```

Expected: definition in `lib/po.ts`, import + call in `app/po/[id]/page.tsx` only.

- [ ] **Step 4: Commit**

```bash
git add lib/po.ts
git commit -m "$(cat <<'EOF'
fix: allow PO draft save while revision_requested

updatePODraft only matched status=draft, so revision-requested
header edits (e.g. remarks) silently updated zero rows.
EOF
)"
```

---

### Task 2: Manual verification (required before claiming fixed)

**Files:**
- None (runtime QA against local/dev Supabase)

There is no existing unit-test harness for `lib/po.ts` in this repo. Do not invent a test framework for this one-line fix. Verify with the real UI path.

- [ ] **Step 1: Draft regression (must still work)**

1. As procurement/Buyer, open a PO with `status = 'draft'` that was never submitted (or is still a plain draft).
2. Click **Edit PO**, change remarks (and optionally payment terms).
3. Click **Save Changes**.
4. Confirm edit mode closes, no error toast/banner, and the new remarks persist after refresh.

- [ ] **Step 2: Revision-requested fix (the bug)**

1. Submit a PO for approval; as an approver, **Request Revision** with remarks.
2. Confirm PO detail shows status Needs Revision / `revision_requested` and the revision banner.
3. As procurement, click **Edit PO**, change the PO remarks field (header remarks — not the approver's revision note).
4. Click **Save Changes**.
5. Confirm:
   - No error banner
   - Edit mode closes
   - New remarks remain visible immediately
   - Hard refresh still shows the new remarks
   - PO status remains `revision_requested` (not silently flipped to `draft` or `for_approval`)

- [ ] **Step 3: Resubmit still works (adjacent path, do not modify code)**

1. On the same revision-requested PO, click the existing submit-for-approval action.
2. Confirm it moves to `for_approval` and creates a new approval instance (existing `submitPOForApproval` behavior — untouched by this plan).

- [ ] **Step 4: Negative path (optional but recommended)**

If you can temporarily call `updatePODraft` against a `for_approval` or `approved` PO id in the browser console / a one-off script, expect the new error:
`PO could not be updated. It may no longer be editable.`
Do not leave any temporary console hooks in the codebase.

---

## Self-review checklist

| Requirement | Task |
|-------------|------|
| Persist remarks (and other header fields) on `revision_requested` | Task 1 |
| Keep draft save working | Task 1 + Task 2 Step 1 |
| Do not mutate status on save | Task 1 safety note / code |
| Do not change UI / approvals / RLS | Safety constraints + file map |
| Avoid silent 0-row success | Task 1 `.select` + throw |
| Match existing PR1 editable-status pattern | Task 1 `.in('status', [...])` |

**Placeholder scan:** none — exact code, commands, and QA steps included.

**Type consistency:** `updatePODraft` signature unchanged; `values` fields unchanged; only the query filter and return handling change.

---

## Out-of-scope reminders

- Do not "also fix" PR2 item RLS or substitute review in this change.
- Do not rewrite `docs/revision-workflow-fixes-plan.md` Phase 6 (historical plan); this plan is the surgical follow-up for the missed `updatePODraft` guard.
- Do not add item editing to the PO revision path unless separately requested.
