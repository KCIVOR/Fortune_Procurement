# Revision/Rejection Workflow — Implementation Plan

Source: full audit of every reject/revision-request path across PR1, PR2, RFQ, PO, and
Accreditation documents (2026-07-30). This plan implements the 8 findings from that audit.
Every claim below was verified by reading the current code/schema directly — nothing here
is carried over from the audit write-up without a fresh check, because status enums and RLS
policies have drifted from what a first read would suggest (see "Corrections to the audit"
below).

**Ground rule for every phase:** minimal diff, one concern per phase, each phase independently
deployable and testable before starting the next. Later phases assume earlier phases have
landed. Phases are ordered lowest-risk/most-isolated → highest-risk/most-invasive.

---

## Read this before touching any code

This section governs everything below it. If anything later in this document seems to
conflict with a rule here, **stop and ask the user** — don't guess which one wins.

### Hard constraints — never do these, in any phase

1. **Never edit a file that isn't named in the current phase's "Files" line.** If you think a
   fix requires touching something not listed, stop and ask instead of doing it. Do not "also
   fix" something you notice while you're in a file.
2. **Never touch `lib/approvals.ts` or `lib/warehouse.ts`'s `submitWarehouseTerminalAction`.**
   These are PR1's reject/revision code — confirmed correct in the audit, and used as the
   reference pattern the other fixes copy from. Nothing in this plan asks you to change them.
   If a phase's instructions seem to imply changing PR1 behavior, that's a misread — stop.
3. **Never touch `PR2_PHASE1` code** (the legacy Procurement Staff → Procurement Manager →
   Director workflow branch in `lib/pr2-approvals.ts`). Confirmed dead for new submissions.
   Not in scope for any phase here.
4. **Never rename an existing function, variable, export, database column, or file.** Every
   phase is additive or narrowly corrective — if a rename feels like it would make the code
   cleaner, don't do it. That's out of scope no matter how small it looks.
5. **Never refactor, reformat, or "clean up" code you're not specifically instructed to
   change**, including code directly adjacent to your edit. No reflowing unrelated lines, no
   reordering imports, no touching comments that aren't factually wrong because of *this*
   specific change.
6. **Never edit an existing, already-applied migration file.** Every schema/RLS/RPC change is
   a **new** migration file, applied via the project's Supabase MCP tool. Never use `ALTER
   POLICY` — always `DROP POLICY IF EXISTS` followed by `CREATE POLICY`, matching every
   existing migration in this repo.
7. **Never add a `CHECK` constraint, drop a column, drop a table, or change a column's type.**
   Every phase in this plan was specifically designed to avoid needing this (see "Corrections
   to the original audit" below) — if you find yourself thinking one is necessary, that means
   you've misunderstood the phase. Stop and ask.
8. **Never touch RLS policies not explicitly named in the current phase.** Do not "tighten" or
   "simplify" a policy you happen to read while working. Do not touch storage bucket policies —
   none of this plan involves file uploads.
9. **Never write a raw `DELETE` or destructive SQL statement outside of Phase 7's one specified
   RPC.** No ad-hoc data cleanup, no "let me just remove this stale row while I'm here."
10. **Never modify shared/reusable UI components** (anything under `components/shared/`,
    `components/ui/`) unless a phase explicitly names that exact file. If a status chip or
    label looks like it needs a new color, check `lib/status-ui.ts` and the specific page's own
    local status map first — those are almost always the right place, not the shared
    component.
11. **Never commit, push, or run any git command beyond what you're already doing in your
    normal edit/save flow.** No `git commit`, no `git push`, unless the user explicitly asks in
    that exact turn.
12. **Never touch `.env`, secrets, dependency versions (`package.json`), or CI/deployment
    config.** Nothing in this plan needs any of that.
13. **Never do Phase 7 without a fresh, explicit "yes, do Phase 7" from the user in that
    session**, even if earlier phases went smoothly. It contains a hard delete (confirmed
    intentional by the user) and a new `SECURITY DEFINER` function — the single highest-risk
    change in this plan. Do not bundle it with any other phase.

### General rules for implementing each phase

1. **Read the actual current file before editing it — every time, even if this plan quotes the
   exact code.** Line numbers and quoted snippets in this document were correct when written,
   but the file may have changed since. If what you read doesn't match what this plan
   describes, **stop and report the mismatch** — do not improvise a fix to make it match, and
   do not silently proceed with a guess about which version is right.
2. **Do one phase per session/turn, in order.** Do not start a phase whose number is higher
   than the last one you completed and had confirmed working. Do not skip ahead because a
   later phase looks easy.
3. **After finishing a phase's file changes, run `npx tsc --noEmit -p .` and report the result
   before considering the phase done.** A phase with type errors is not finished.
4. **Do not mark a phase complete without running through its own "Test" section** at the end
   of that phase's write-up. If you cannot actually run the app to test (no browser/DB access
   in this session), say so explicitly and describe what still needs manual verification —
   do not claim it works without having checked.
5. **If a phase's plan references a table, column, RLS policy, or function that you cannot
   find when you look for it, stop and report exactly what you searched for and what you
   found instead.** Do not assume it was renamed and guess the new name. Do not create it
   fresh unless the phase explicitly says to create it.
6. **Every new migration file must use `DROP ... IF EXISTS` before `CREATE`** (for policies,
   functions) so it's safe to re-run, matching the existing convention in `supabase/migrations/`.
   Apply it with the project's Supabase MCP `apply_migration` tool, not by hand-editing the
   database, and also save the same SQL as the migration file on disk — both steps, every time,
   per this project's established practice.
7. **Keep the diff for each phase as small as the phase description allows.** If your diff
   touches more lines than the phase's numbered steps describe, re-read the steps — you've
   probably done more than asked.
8. **When two phases touch the same function** (Phase 5 and Phase 7 both edit
   `submitPR2ApprovalAction` in `lib/pr2-approvals.ts`), implement them in the plan's numbered
   order and re-read the function fresh before starting the second phase's edit — do not
   assume you remember its exact current state from when you edited it earlier in the same
   session.
9. **If you are ever unsure whether something is "in scope" for the current phase, treat it as
   out of scope and ask**, rather than including it to be thorough. Under-scoping is
   recoverable (do it next turn); over-scoping is how unrelated things break.

---

## Corrections to the original audit (verified 2026-07-30, do not re-assume)

These change the shape of the plan versus what a first pass would suggest:

1. **`PR2Status` already includes `'revision_requested'`** (`types/pr2.ts:4-10`), with a label
   ("Needs Revision", `types/pr2.ts:16`), a DB `CHECK` constraint that already permits it
   (`pr2_requests_status_check` — confirmed live via `pg_get_constraintdef`), and working
   color-coded consumers in `lib/status-ui.ts:50`, `app/pr2/page.tsx:24`, and
   `app/planning/pr2/page.tsx:29`. **This status has been fully wired end-to-end for a while —
   the only bug is that `lib/pr2-approvals.ts`'s revision branch writes `'draft'` instead of
   `'revision_requested'`.** No schema migration and no new UI/label work is needed for PR2.
2. **`po_requests.status` has no `CHECK` constraint at all** (confirmed: `pg_constraint` query
   returns zero rows for `contype='c'` on `po_requests`). Adding `'revision_requested'` to
   `POStatus` needs a TypeScript type change and new label/color entries, but **no SQL
   migration**.
3. **One real RLS blocker exists for the PR2 fix**: `"Planning can update own draft raw
   material PR2 requests"` (current definition in
   `supabase/migrations/20260729181630_planning_pr2_requests_services.sql:36-47`) has
   `USING (... AND status = 'draft')` — hard-coded to `'draft'` only. If we start writing
   `'revision_requested'` without updating this policy, Planning users lose the ability to
   edit/resubmit a bounced-back raw-material/services PR2 at the RLS layer, even though the
   app-layer `canEdit` would otherwise allow it. **This must be migrated in lockstep with the
   write-path change (Phase 5), not after.**
4. **`pr2_items.pr2_id` FK is `ON DELETE NO ACTION`** (confirmed via `pg_constraint`,
   `confdeltype = 'a'`), not `CASCADE`. Phase 7's hard delete must delete `pr2_items` rows
   before deleting the `pr2_requests` row, or the delete will fail with a foreign-key
   violation. (`lib/pr2-planning.ts`'s existing `deleteDraftRawMaterialPR2` already does this
   in the correct order — reuse that ordering.)
5. **RFQ's existing notification code already has `rfq.pr2_id` in scope**
   (`lib/rfq-approvals.ts:368-372`, the same local `rfq` variable used by the reject/revision
   branch), not just `rfq.pr1_id`. The approved-branch notification (lines 446-463) only
   follows `pr1_id`, silently skipping PR2-native (raw-material) RFQs. Phase 3's fix must
   resolve the requisitioner via **either** `pr1_id` **or** `pr2_id`, mirroring the dual-path
   pattern already used in `lib/po-approvals.ts` for the same problem — otherwise it repeats
   the exact bug it's fixing, just for a different request type.
6. **Accreditation document rows don't carry `supplier_id` in the fetch** inside
   `verifyAccreditationDocument`, `rejectAccreditationDocument`, and
   `requestAccreditationDocumentRevision` (`lib/accreditation-documents.ts:339`, presumably
   similar at `:339`-equivalent in the other two — confirmed for `verifyAccreditationDocument`
   and `requestAccreditationDocumentRevision` directly). The `select()` needs `supplier_id`
   added before a notification can be sent.

---

## Phase 1 — Zero-risk PO fixes (Bugs #5 and #3-for-PO)

**Files:** `app/approvals/po/[id]/page.tsx`, `lib/po-approvals.ts`

**Risk:** none — one is a copy change, the other removes a condition that currently suppresses
a notification (strictly additive, cannot break an existing working path).

1. `app/approvals/po/[id]/page.tsx:583` — fix the confirmation dialog copy. Currently:
   `'Rejected — PO returned to draft'`. The actual code (`lib/po-approvals.ts:459-461`) sets a
   terminal `'rejected'` status that can never be resubmitted. Change the copy to something
   like `'Rejected — PO cannot be resubmitted'`.
2. `lib/po-approvals.ts:603` — the block that additionally notifies the original PR1/PR2
   requisitioner is gated `if (action === 'rejected' && ...)`. Remove the `action ===
   'rejected' &&` clause so it also fires for `revision_requested`. Update the notification
   `title`/`body` to not hard-code "Rejected" — branch the copy on `action` the same way the
   `started_by` notification just above it already does (lines 580-596 already have this
   `action === 'rejected' ? ... : ...` pattern to copy).

**Test:** trigger a PO revision-request from `/approvals/po/[id]` as an approver on a PO whose
requisitioner differs from the submitter; confirm both the submitter and the requisitioner get
a notification, and confirm the reject confirmation dialog now shows correct copy.

---

## Phase 2 — Accreditation document notifications (Bug #4)

**File:** `lib/accreditation-documents.ts`

**Risk:** low — additive only, no status/permission logic changes.

1. Add `supplier_id` to the `select()` calls in `verifyAccreditationDocument` (~line 339),
   `rejectAccreditationDocument`, and `requestAccreditationDocumentRevision` (~line 523) — the
   row is already fetched in each function, this just widens the projection.
2. After each function's successful update (i.e., right after the existing `audit_logs`
   insert, inside the same best-effort `try`), add a `createNotification` call targeting
   `(row as any).supplier_id`, mirroring the pattern already used correctly in
   `lib/accreditation.ts`'s `requestMissingDocuments`/`rejectAccreditation`. Use distinct
   titles per function (e.g. "Document Verified", "Document Rejected", "Document Needs
   Revision") and `action_url: '/supplier/accreditation'`.
3. Scope note: the audit's explicit ask was reject/revision-request notification parity —
   `verifyAccreditationDocument` (the positive/approve path) notifying the supplier too is a
   reasonable bonus in the same pass since it's the same missing mechanism, but flag it
   separately in the PR/commit so it can be dropped if you'd rather keep this phase to
   reject/revision only.

**Test:** as Procurement, verify/reject/request-revision on a supplier's accreditation
document; confirm the supplier receives a notification each time, with the correct title and
linking to `/supplier/accreditation`.

---

## Phase 3 — RFQ notifications (Bug #1)

**File:** `lib/rfq-approvals.ts`

**Risk:** low-medium — additive notification, but needs the dual `pr1_id`/`pr2_id` resolution
called out in correction #5 above to actually be correct for both goods/services and
raw-material RFQs.

1. In the `else` branch handling `rejected`/`revision_requested` (~lines 486-510), after the
   existing `started_by` notification, add a second lookup: if `rfq.pr1_id` is set, fetch
   `pr1_requests.requisitioner_id`; else if `rfq.pr2_id` is set, fetch
   `pr2_requests.requisitioner_id`. Send a `createNotification` to that id (guard: only if it
   differs from `started_by`, matching the dedupe pattern already used in
   `lib/pr2-approvals.ts:732` and `lib/po-approvals.ts`), for **both** `rejected` and
   `revision_requested`.
2. Do not change `rfq_batches.status` or its `CHECK` constraint (still `draft/open/closed/
   cancelled`, no schema change) — this phase is notification-only, matching the "don't force
   a schema change for a cosmetic gain" reasoning already used in the audit. If a requestor
   needs to *see* the state later (not required by the 8 items, out of scope here), that would
   read `approval_instances.status` directly rather than `rfq_batches.status`.

**Test:** close an RFQ tied to a goods/services PR1, then reject/revision-request it as the
approver; confirm the PR1 requisitioner is notified in both cases. Repeat for a PR2-native
(raw material) RFQ tied via `pr2_id` with no `pr1_id`, confirming the fallback resolution
works.

---

## Phase 4 — PR2 ownership-guard gap for Planning-direct services (Bug #7)

**Files:** `lib/pr2-approvals.ts`, `app/pr2/[id]/page.tsx`

**Risk:** medium — closes an access-control gap; verify it doesn't lock out a legitimate flow
that currently (accidentally) works.

1. `lib/pr2-approvals.ts:71-73` — the guard currently reads:
   ```
   if (pr2.request_type === 'raw_material' && pr2.requisitioner_id !== profile.id) throw ...
   ```
   Broaden to also cover Planning-direct `services` (i.e. any PR2 with `pr1_id === null`,
   which is exactly the set `submitRawMaterialPR2` already independently guards):
   ```
   if (pr2.pr1_id === null && pr2.requisitioner_id !== profile.id) throw ...
   ```
   This is a strict superset of the current check (raw_material always has `pr1_id === null`),
   so it cannot regress the raw_material case — only closes the services gap.
2. `app/pr2/[id]/page.tsx` — scope the page to warehouse-originated PR2s only. Confirm (read
   the current `fetchPR2ById`/query in `lib/pr2.ts` first) whether it's cleaner to filter at
   fetch time (`pr1_id IS NOT NULL`) or at the `canEdit` check
   (`isProcurement && pr2?.status === 'draft' && pr2?.pr1_id !== null`). Prefer the `canEdit`
   guard — it's a one-line addition, versus changing a shared fetch function that may have
   other callers. **Read `lib/pr2.ts`'s `fetchPR2ById` and confirm no other caller depends on
   its current unscoped behavior before touching it** — do not assume this function is only
   used by this page.

**Test:** as a Planning user, create a draft services PR2 directly (no PR1). As a Procurement
user, navigate to `/pr2/{that id}` and confirm the edit/submit controls no longer appear (or,
if you kept the generic page reachable, confirm `submitPR2ForApproval` now throws for a
non-owning Procurement caller). Confirm the Planning user can still submit their own
Planning-direct services PR2 via `/planning/pr2/[id]` without regression.

---

## Phase 5 — PR2 literal `revision_requested` status (Bug #6, PR2 half) + Bug #3-for-PR2

**Files:** `lib/pr2-approvals.ts`, `lib/pr2-planning.ts`, `app/planning/pr2/[id]/page.tsx`,
one new migration for the RLS policy.

**Risk:** medium. Sequenced in two sub-phases specifically to avoid a broken intermediate
state — **do not skip the ordering.**

### 5a — Widen every reader first (safe, no-op deploy)

Nothing in the database currently produces `'revision_requested'` for a PR2, so widening
readers to also accept it changes nothing observable yet. This can be deployed alone and
verified inert before 5b.

1. `lib/pr2-approvals.ts:63` — `submitPR2ForApproval`'s guard:
   ```
   if (pr2.status !== 'draft') throw ...
   ```
   → accept both:
   ```
   if (pr2.status !== 'draft' && pr2.status !== 'revision_requested') throw ...
   ```
2. `lib/pr2-planning.ts:331` (`updateRawMaterialPR2Draft`) — same widening:
   `if (pr2.status !== 'draft') throw ...` → accept `'revision_requested'` too. **Do not**
   widen `lib/pr2-planning.ts:368` (`deleteDraftRawMaterialPR2`'s draft-only guard) — a
   bounced-back PR2 with a real approval history should not be silently deletable the same way
   a never-submitted draft is; leave delete restricted to `'draft'` only.
3. `app/planning/pr2/[id]/page.tsx:143-146`:
   ```js
   const isDraft = pr2?.status === 'draft';
   const canEdit = isOwner && isDraft;
   const wasRevisionRequested = isDraft && approvalDetail?.phase1_instance_status === 'cancelled';
   ```
   Change to:
   ```js
   const isDraft = pr2?.status === 'draft';
   const isRevisionRequested = pr2?.status === 'revision_requested';
   const canEdit = isOwner && (isDraft || isRevisionRequested);
   const wasRevisionRequested = isRevisionRequested; // now a direct status read, not a derived join
   ```
   Read the rest of this file first to confirm nothing else branches on `isDraft` alone in a
   way that should now also include `isRevisionRequested` (e.g. a "Delete draft" button should
   likely stay `isDraft`-only, matching the intentional restriction in item 2 above) — **do not
   assume `isDraft` should just be redefined to include both; check each of its use sites
   individually.**
4. New migration: update `"Planning can update own draft raw material PR2 requests"` RLS
   policy (`supabase/migrations/20260729181630_planning_pr2_requests_services.sql:36-47`) —
   `DROP POLICY IF EXISTS` + `CREATE POLICY` with `USING (... AND status IN ('draft',
   'revision_requested'))`. Keep the `WITH CHECK` clause exactly as-is (it doesn't restrict by
   status today, no change needed there).

**Test after 5a alone:** confirm the app behaves identically to before — nothing should be
observably different yet, since nothing writes `'revision_requested'` until 5b. This is the
checkpoint to catch a mistake before it's live.

### 5b — Flip the writer

5. `lib/pr2-approvals.ts` — locate the reject/revision branch (currently ~line 599-609):
   ```js
   } else {
     // revision_requested — same as rejected: back to draft
     await db.from('approval_instances').update({ status: 'cancelled', completed_at: now }).eq('id', instanceId);
     await db.from('pr2_requests').update({ status: 'draft', updated_at: now }).eq('id', pr2Id);
   }
   ```
   Change the `pr2_requests` update to `status: 'revision_requested'` instead of `'draft'`.
   **This branch will be further specialized in Phase 7** (to skip this entirely for
   `pr1_id`-linked PR2s in favor of the unwind flow) — that's fine, this phase's change is
   still correct and complete on its own for the `raw_material`/Planning-direct-`services`
   case, and Phase 7 layers on top of it rather than conflicting with it.
6. Same reject/revision function, apply Bug #3's fix here too (mirroring Phase 1's PO fix):
   the extra requisitioner notification at ~line 728 is currently gated
   `action === 'rejected' && ...` — remove that gate so it also fires on
   `revision_requested`. (For `raw_material`, `started_by === requisitioner_id` always, so
   this specific notification is a no-op duplicate for that case — but Planning-direct
   `services` reached via the Phase 4 guard fix could theoretically differ, so keep this
   generic rather than special-casing it away.)

**Test after 5b:** as Planning, submit a raw-material PR2. As Dept Head, request a revision.
Confirm: (a) `pr2_requests.status` is literally `'revision_requested'`, not `'draft'`; (b) the
Planning list page and the linked-record chip both show "Needs Revision" distinctly (no code
change needed there per correction #1 — just confirm it actually renders now that the value is
real); (c) the Planning requisitioner can still open and resubmit it; (d) repeat for `rejected`
and confirm it's still terminal.

---

## Phase 6 — PO literal `revision_requested` status (Bug #6, PO half)

**Files:** `types/po.ts`, `lib/po-approvals.ts`, `lib/po.ts`, `app/po/page.tsx`,
`app/po/[id]/page.tsx`, `lib/status-ui.ts`.

**Risk:** medium — more surface area than PR2's half, because (per correction #2) none of the
label/color/list-filter plumbing exists yet for PO. Same two-sub-phase discipline as Phase 5.

### 6a — Add the type/labels and widen every reader first

1. `types/po.ts:3` — extend `POStatus` to include `'revision_requested'`, and add a label to
   `PO_STATUS_LABELS` (`'Needs Revision'`, matching PR2's exact wording for consistency).
2. `lib/status-ui.ts` — add a `revision_requested` entry to `DOCUMENT_STATUS_UI.PO` (currently
   missing entirely, per correction #2), matching the styling already used for PR2's entry
   (`bg-orange-50 text-orange-700`).
3. `app/po/page.tsx` — add a `revision_requested` entry to whatever local status-style map
   exists there (check current contents first — do not assume its shape matches
   `app/pr2/page.tsx`'s `STATUS_STYLES` object without reading it). Then **replace, don't
   duplicate**, the existing derived-join workaround: `lib/po.ts`'s `fetchRevisionDraftPOIds`
   (~lines 117-137) currently reconstructs "needs revision" from
   `approval_instances.status='cancelled'` JOINed with `po_requests.status='draft'`. Once the
   literal status exists, change its second predicate from `status = 'draft'` to
   `status = 'revision_requested'` — a one-line change that keeps the existing "Needs Revision"
   filter option in `app/po/page.tsx` working via the same function, no filter-UI changes
   needed.
4. `lib/po-approvals.ts:60` — `submitPOForApproval`'s guard: widen
   `if (po.status !== 'draft') throw ...` to accept `'revision_requested'` too.
5. `app/po/[id]/page.tsx:176` — widen `canEdit` similarly:
   `po?.status === 'draft' && profile?.role === 'procurement'` →
   `(po?.status === 'draft' || po?.status === 'revision_requested') && profile?.role === 'procurement'`.
6. `app/po/[id]/page.tsx:750-766` (the "Revision Requested" banner) — currently keys off
   `po.status === 'draft' && approvalDetail?.instance_status === 'cancelled'`. Once the literal
   status exists this can simplify to `po.status === 'revision_requested'`, but **check
   whether `approvalDetail.actions.find(a => a.action === 'revision_requested')` is still
   needed for the remarks/actor display** (it likely still is, to show *who* requested it and
   *why* — the literal status alone doesn't carry that). Keep that lookup, just simplify the
   outer condition.
7. `app/po/[id]/page.tsx:769` (the "Ready for Approval" banner, `po.status === 'draft' &&
   !approvalDetail && profile?.position === 'Buyer'`) — leave as-is; a PO with an approval
   history sent back for revision is a different state than "never submitted," and the current
   condition already correctly excludes it via `!approvalDetail`. Verify this stays true (a
   revision-requested PO does have an `approvalDetail` from its prior cycle) rather than
   assuming it.

**Test after 6a alone:** confirm no observable change — nothing writes the new status yet.

### 6b — Flip the writer

8. `lib/po-approvals.ts:462-472` — change the revision branch's
   `po_requests.status = 'draft'` update to `status = 'revision_requested'`.

**Test after 6b:** submit a PO, request a revision as an approver. Confirm: (a) literal status
is `'revision_requested'`; (b) `/po` list's "Needs Revision" filter still finds it (now via the
one-line-changed join); (c) the PO detail page still shows the revision banner with correct
remarks/actor; (d) Procurement can still edit and resubmit it; (e) a plain never-submitted
draft PO is still distinguishable from a bounced-back one everywhere it matters.

---

## Phase 7 — PR2 goods/services: unwind to Warehouse instead of handing to Procurement (Bug #2)

**Files:** one new migration (a new `SECURITY DEFINER` RPC), `lib/pr2-approvals.ts` (the same
reject/revision function touched in Phase 5).

**Verified (2026-07-30, corrects an earlier version of this plan):** neither "reuse the
existing `reset_warehouse_validation_on_pr1_resubmit` RPC" nor "skip the RPC and delete
directly from the client" work here. Checked `pg_policy` directly: there are **zero DELETE
policies** on `warehouse_validations`, `warehouse_validation_items`, `pr2_requests`, or
`pr2_items` that would permit an approver (Dept Head/Operations Manager) to delete these rows
under RLS — the only DELETE policies on `pr2_requests`/`pr2_items` are scoped to Planning
deleting their own raw-material drafts. Plain client-side `.delete()` calls from
`lib/pr2-approvals.ts` would fail outright. The existing RPC only works because it's
`SECURITY DEFINER` (bypasses RLS, runs with elevated privilege) with its own internal
authorization check — and that check requires `auth.uid()` to be the PR1's requisitioner,
which is wrong for an approver calling it. **The fix is a new `SECURITY DEFINER` RPC with a
correct authorization check for this caller, not a workaround that avoids the RPC pattern.**
This also has a correctness benefit beyond just working: one atomic SQL function means all the
deletes and the PR1 status update either all happen or none do — there's no window for the
kind of partial-failure state that caused the original bug this whole audit started from.

**Risk:** highest in this plan — hard deletes, cross-table resets, and a genuine behavior
change (the PR2 record disappears rather than persisting with a status badge). Do this last,
after Phases 1-6 are deployed and stable, and confirm the hard-delete decision (already
confirmed by you) is still what you want before landing it.

**Scope boundary, confirmed from the workflow spec:** `PR2_FINAL` is Dept Head → Operations
Manager only — Procurement is never a step in this chain (per `docs/Final_Workflow.md`,
Procurement is notified only *after* final approval). So this applies to **every**
reject/revision at the `PR2_FINAL` stage for a `pr1_id`-linked PR2 (goods, or services routed
through warehouse) — there's no "first cycle only" nuance to encode; if a PR2 is rejected or
sent back for revision by Dept Head/Ops Manager, Procurement has by definition never touched
it yet.

### Steps

1. `lib/pr2-approvals.ts`'s reject/revision handler is `submitPR2ApprovalAction`
   (`lib/pr2-approvals.ts:512`). **Verified: this function never pre-fetches the `pr2_requests`
   row as a whole** — each branch does its own narrow `select()` as needed (e.g. the existing
   notification block at line 704 selects only `pr2_number, requisitioner_id, request_type`).
   `pr1_id` is not fetched anywhere in this function today. Add one `select('pr1_id')` (or
   widen an existing nearby select, e.g. line 704's, to include it) at the top of the
   `rejected`/`else` handling, before the current status-update statements — this determines
   the branch. If `pr1_id IS NOT NULL` (warehouse-originated goods/services), branch into the
   new unwind path instead of the existing draft/rejected-status-write path. If `pr1_id IS
   NULL` (raw_material or Planning-direct services), fall through to the Phase 5 behavior
   unchanged.
2. **New migration — `unwind_pr2_to_warehouse(p_pr1_id uuid, p_terminal boolean)`**, a single
   `SECURITY DEFINER` function that does the entire operation atomically:
   ```sql
   CREATE OR REPLACE FUNCTION public.unwind_pr2_to_warehouse(p_pr1_id uuid, p_terminal boolean)
   RETURNS void
   LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public
   AS $$
   DECLARE
     v_pr2_id uuid;
   BEGIN
     -- Authorization: caller must be an approver, and this PR1 must actually be
     -- at the state this operation expects. Coarse-grained (role only, not
     -- position/department-precise) — matching the same rigor level as the
     -- existing reset_warehouse_validation_on_pr1_resubmit RPC, not a stricter
     -- model. Fine-grained step/position eligibility is already checked
     -- client-side by canActOnPR2Step before this is ever reached.
     IF NOT EXISTS (
       SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
       WHERE p.id = auth.uid() AND r.name = 'approver'
     ) THEN
       RAISE EXCEPTION 'Not authorized to unwind this PR2.';
     END IF;

     IF NOT EXISTS (
       SELECT 1 FROM public.pr1_requests
       WHERE id = p_pr1_id AND status = 'pr2_pending_approval'
     ) THEN
       RAISE EXCEPTION 'PR1 is not awaiting PR2 approval.';
     END IF;

     SELECT id INTO v_pr2_id FROM public.pr2_requests WHERE pr1_id = p_pr1_id;

     IF v_pr2_id IS NOT NULL THEN
       DELETE FROM public.pr2_items WHERE pr2_id = v_pr2_id;
       DELETE FROM public.pr2_requests WHERE id = v_pr2_id;
     END IF;

     -- Terminal (rejected): leave warehouse_validations alone — nothing more
     -- will happen with this PR1, no reason to erase the validator's record
     -- of what they did. Non-terminal (revision requested): clear it so
     -- Warehouse gets a genuinely clean slate to re-validate against.
     IF NOT p_terminal THEN
       DELETE FROM public.warehouse_validation_items
       WHERE validation_id IN (
         SELECT id FROM public.warehouse_validations WHERE pr1_id = p_pr1_id
       );
       DELETE FROM public.warehouse_validations WHERE pr1_id = p_pr1_id;
     END IF;

     UPDATE public.pr1_requests
     SET status = CASE WHEN p_terminal THEN 'rejected' ELSE 'approved_for_warehouse' END,
         updated_at = now()
     WHERE id = p_pr1_id;
   END;
   $$;

   GRANT EXECUTE ON FUNCTION public.unwind_pr2_to_warehouse(uuid, boolean) TO authenticated;
   ```
3. `lib/pr2-approvals.ts` — in the `pr1_id IS NOT NULL` branch identified in step 1, call this
   one RPC instead of the previous multi-step approach:
   ```js
   await db.rpc('unwind_pr2_to_warehouse', { p_pr1_id: pr1Id, p_terminal: action === 'rejected' });
   ```
   Still set `approval_instances.status` as before (`'cancelled'` for revision-requested,
   `'rejected'` for rejected) — the RPC only owns the PR2/PR1/warehouse-validation side, not
   the approval instance itself.
   - **Revision requested**: after the RPC call, send
     `notifyByRole('warehouse', { type: 'action_required', ... }, { dedupeUnreadForDocument: true })`
     with the approver's remarks, `document_type: 'pr1'`, `document_id: pr1Id`,
     `action_url: /warehouse/{pr1Id}`.
   - **Rejected (terminal)**: after the RPC call, notify the original PR1 requisitioner
     directly (reuse the existing pattern from `lib/approvals.ts`'s PR1 rejection notification)
     so they see it in `/pr1/[id]`, since this is now a terminal outcome for their original
     request, not just an internal PR2 hiccup.
4. Audit logging: keep the existing `audit_logs` insert for `PR2_APPROVAL_REJECTED`/
   `PR2_APPROVAL_REVISION_REQUESTED`, but since the PR2 row itself will be gone, also insert a
   parallel `audit_logs` entry against `document_type: 'PR1'` / `document_id: pr1Id` (the PR2
   audit row becomes orphaned/unreadable once its document is deleted from most UI, since
   `RelatedRecords` and similar surfaces resolve by fetching the live row — check whether
   `app/pr1/[id]/page.tsx`'s audit/history view resolves by `document_id` alone and would still
   render an orphaned PR2 audit entry correctly, or whether a PR1-side entry is needed for it
   to be visible at all. **Verify this by reading how audit history is rendered before assuming
   either way.**

**Test:** validate a goods PR1 as insufficient (creates PR2 via warehouse), submit through
PR2_FINAL, and as Dept Head request a revision. Confirm: (a) the PR2 record and its items are
gone; (b) PR1 status is back to `approved_for_warehouse` and reappears in the Warehouse Queue;
(c) `warehouse_validations`/`warehouse_validation_items` for that PR1 are gone (validator has a
clean slate, not stale data); (d) Warehouse receives an actionable notification with the Dept
Head's remarks; (e) re-validating produces a fresh PR2 correctly. Then repeat with **reject**
instead of revision and confirm PR1 lands on `rejected` (terminal) and the requisitioner is
notified. Also explicitly test a **raw_material** PR2 revision/reject in the same session to
confirm Phase 5's behavior is untouched by this phase's branch.

---

## Explicitly out of scope for this plan

- Bug #8 (PR1) — no change; it's the reference implementation these fixes are modeled on.
- Changing `rfq_batches.status` to carry a literal rejected/revision value (Phase 3 deliberately
  avoids this — notification-only fix).
- Any change to `verifyAccreditationDocument`'s notification being *required* rather than a
  bonus (Phase 2, item 3) — confirm before implementing if you want it in or out.
- Any changes to `PR2_PHASE1` (confirmed dead code for new submissions in the audit) — not
  touched by any phase here.
