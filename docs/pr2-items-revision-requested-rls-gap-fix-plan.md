# PR2 line-item RLS gap on `revision_requested` — Implementation Plan

Source: follow-up audit (2026-08-03) triggered by a user report — *"when Planning saves a
draft for a revision-requested request, it doesn't save."* Root cause confirmed by reading
`lib/pr2-planning.ts`, and by querying live RLS policy definitions via `pg_policy` against the
Supabase project (not assumed from migration files alone — the live DB was the source of
truth). Every claim below was verified directly; nothing here is carried over from the
conversational audit write-up without a fresh re-check while writing this document.

**Relationship to `docs/revision-workflow-fixes-plan.md`:** that plan's Phase 5a widened the
`pr2_requests` (header) UPDATE policy from `status = 'draft'` to `status IN ('draft',
'revision_requested')`, and shipped. It did **not** touch `pr2_items` or
`pr2_item_attachments` — this plan finishes that gap. It is a standalone document, not an edit
to the original plan (which documents already-completed work and should not be altered).

---

## Read this before touching any code

### Hard constraints — never do these, in this plan

1. **Never edit a file that isn't named in the current phase's "Files" line.**
2. **Never edit an existing, already-applied migration file** — including
   `supabase/migrations/20260731060000_pr2_revision_requested_rls.sql` (the Phase 5a migration
   this plan follows up on). Every change here is a **new** migration file, applied via the
   project's Supabase MCP `apply_migration` tool, and also saved to disk in
   `supabase/migrations/` — both steps, matching this project's established practice.
3. **Never use `ALTER POLICY`.** Always `DROP POLICY IF EXISTS` followed by `CREATE POLICY`,
   matching every existing migration in this repo (including the Phase 5a migration this plan
   mirrors).
4. **Never touch a policy not explicitly named in Phase 1's steps below.** In particular: do
   not touch `pr2_item_attachments_delete` (no status restriction exists on it today — it is
   not part of this bug), `"Procurement can update PR2 items"`, `"Approvers can read own
   department PR2 items"`, or any `pr2_requests` policy (already correctly widened by Phase 5a;
   out of scope here). If a policy isn't in the table in "Root cause" below, it is out of scope
   for this entire plan, no exceptions.
5. **Never widen the `pr2_items`/`pr2_item_attachments` policies beyond adding
   `'revision_requested'` to the existing `'draft'` check.** Do not also add `'pending_approval'`
   or any other status "while you're in there" — a PR2 actively in front of an approver must
   remain immutable to the requestor. This is a narrow, single-value widening, not a general
   loosening.
6. **Every other clause in the four touched policies must remain character-for-character
   identical to its current live definition.** The only permitted diff, in each of the four
   policy bodies, is changing the status check from `status = 'draft'` to
   `status IN ('draft', 'revision_requested')` (or the equivalent `= ANY (ARRAY[...])` form,
   matching whichever syntax the live policy already uses — do not silently convert `= ANY
   (ARRAY[...])` to `IN (...)` or vice versa, since that's an unrequested stylistic change to a
   clause the plan didn't ask you to touch). The `requisitioner_id = auth.uid()`,
   `request_type IN ('raw_material', 'services')`/`= ANY (ARRAY[...])`, and (for
   `pr2_item_attachments_insert`) `uploaded_by = auth.uid()` clauses are not part of this fix —
   reproduce them exactly as found, do not "clean up" their syntax either.
7. **Verify the exact live policy name and full definition via `pg_policy` immediately before
   writing each `DROP POLICY` statement — do not reuse the names/text quoted in this document
   without re-checking first.** A name mismatch is a silent failure mode with two possible bad
   outcomes: `DROP POLICY IF EXISTS` no-ops (name doesn't match anything), and the subsequent
   `CREATE POLICY` either errors as a duplicate (if by coincidence the name does exist) or
   — more dangerously — succeeds as a **second, separate permissive policy** stacked on top of
   the untouched original. Postgres OR's together multiple permissive policies for the same
   command, so this would silently grant the wider access anyway while leaving the old
   `'draft'`-only policy still present and misleadingly suggesting the restriction is still
   fully enforced everywhere. Applying and then immediately re-querying `pg_policy` (see the
   verification step in Phase 1) is not optional — treat it as part of "done," not a nice-to-have.
8. **Apply all four `DROP POLICY` + `CREATE POLICY` pairs in a single migration (one
   `apply_migration` call), not four separate calls.** A partially-applied migration (e.g. only
   `pr2_items` INSERT/UPDATE widened, DELETE and the attachments policy not yet run because the
   session ended) leaves the write path in a state this plan never intended to produce or test —
   Save Draft would appear to work for edits/adds but a delete attempted in that window would
   still silently no-op. Supabase's `apply_migration` runs its SQL as a single statement batch;
   do not split the four `DROP`/`CREATE` pairs across multiple tool calls.
9. **Do not widen `lib/pr2-planning.ts`'s `deleteDraftRawMaterialPR2` guard** (still
   `'draft'`-only) even though this plan touches the neighboring `pr2_items` DELETE policy.
   Deleting a single line item while addressing revision feedback is in scope for this plan;
   deleting the *entire PR2 draft* is a different operation, intentionally out of scope here,
   matching the parent plan's established position on `pr2_requests`'s own DELETE policy.
10. **Do not re-touch `lib/pr2-approvals.ts`'s `submitPR2ForApproval`.** Its status-transition
    row-count bug was already fixed in a prior session (unrelated symptom — a stuck
    `revision_requested` status after resubmit — different from the silent item-save failure
    this plan addresses). Nothing in this plan requires editing that function; if a change
    there seems necessary to satisfy this plan, that's a misread — stop and ask.
11. **Never add a `CHECK` constraint, drop a column, or change a column's type.** This plan is
    RLS-only (Phase 1) plus one optional, separately-gated app-code hardening (Phase 2).
12. **Do not implement Phase 2 without an explicit "yes, do Phase 2" from the user in that
    session**, even if Phase 1 lands cleanly. It changes application logic (not just RLS) across
    a function with several call sites — bundle-free, same discipline as the parent plan's Phase
    7 gate.
13. **Never run ad-hoc data repair beyond what Phase 3 explicitly describes**, and only after
    Phase 1 is live — repairing a stuck record before the RLS fix ships just lets it get stuck
    again on the next edit.
14. **Read the actual current file/policy definitions before editing — every time, even though
    this plan quotes them.** If what you find doesn't match what's quoted here, stop and report
    the mismatch rather than improvising.
15. **After the migration is applied, run `npx tsc --noEmit -p .` and report the result** even
    though this phase touches no `.ts`/`.tsx` files — confirms nothing else in the working tree
    was accidentally touched.
16. **If Phase 1's post-apply verification (see below) shows anything unexpected — an extra
    policy, a policy that didn't change, or a changed clause beyond the one status check — stop
    immediately and report it instead of attempting to fix it in the same pass.** Diagnosing a
    partially-wrong RLS state by making further changes on top of it is how a small, well-scoped
    fix turns into a bigger mess. Use the rollback procedure (end of Phase 1) if needed.

---

## Root cause (verified against live `pg_policy`)

Four RLS policies still gate on `status = 'draft'` only, never widened to also accept
`'revision_requested'` when Phase 5a widened the sibling `pr2_requests` policy:

| Table | Policy | Command |
|---|---|---|
| `pr2_items` | `Planning can insert raw material PR2 items` | INSERT |
| `pr2_items` | `Planning can update raw material PR2 items` | UPDATE |
| `pr2_items` | `Planning can delete raw material PR2 items` | DELETE |
| `pr2_item_attachments` | `pr2_item_attachments_insert` | INSERT |

**Why this produces a silent failure, not a visible error:** Postgres RLS excludes
non-matching rows from `UPDATE`/`DELETE` without raising an error (0 rows affected, `error` is
`null`). Only `INSERT`'s `WITH CHECK` raises a hard, visible error on violation. Concretely,
while a PR2 is `revision_requested`:

- Editing an **existing** line item → RLS silently blocks the `UPDATE` (0 rows), no error
  surfaces, "Save Draft" appears to succeed. **This is the exact symptom reported.**
- Deleting a line item → same silent no-op.
- Adding a **new** line item, or uploading an attachment → raises a raw, unformatted RLS
  violation error.
- Header fields (Purpose, Date Required, Remarks) → save correctly (Phase 5a already fixed
  `pr2_requests`).

App-layer code is **not** the bug here: `updateRawMaterialPR2Draft`/`syncRawMaterialItems` in
`lib/pr2-planning.ts` already correctly gates on `pr2.status IN ('draft', 'revision_requested')`
before attempting any writes. The gap is purely at the RLS layer.

---

## Phase 1 — Widen the four RLS policies (the actual fix)

**Files:** one new migration file only:
`supabase/migrations/<timestamp>_pr2_items_revision_requested_rls.sql`

**Risk:** low. Strictly widens who can act, by exactly one additional status value, on rows the
requestor already owns (`requisitioner_id = auth.uid()`) and already has header-level edit
access to per Phase 5a. Cannot grant access to another user's PR2, and cannot grant access to a
PR2 in any status beyond the two already-editable ones.

### Steps

1. Read the current live definitions of all four policies via `pg_policy` (do not assume the
   quotes below are still exact — re-verify) before writing the migration.
2. Write and apply one migration that, for each of the four policies, does
   `DROP POLICY IF EXISTS "<exact name>" ON public.<table>;` followed by `CREATE POLICY` with
   the same name and structure, changing only `status = 'draft'` to
   `status IN ('draft', 'revision_requested')`. Concretely:

   ```sql
   -- pr2_items: INSERT
   DROP POLICY IF EXISTS "Planning can insert raw material PR2 items" ON public.pr2_items;
   CREATE POLICY "Planning can insert raw material PR2 items"
     ON public.pr2_items FOR INSERT TO authenticated
     WITH CHECK (
       EXISTS (
         SELECT 1 FROM public.pr2_requests pr2
         WHERE pr2.id = pr2_items.pr2_id
           AND pr2.requisitioner_id = auth.uid()
           AND pr2.request_type IN ('raw_material', 'services')
           AND pr2.status IN ('draft', 'revision_requested')
       )
     );

   -- pr2_items: UPDATE
   DROP POLICY IF EXISTS "Planning can update raw material PR2 items" ON public.pr2_items;
   CREATE POLICY "Planning can update raw material PR2 items"
     ON public.pr2_items FOR UPDATE TO authenticated
     USING (
       EXISTS (
         SELECT 1 FROM public.pr2_requests pr2
         WHERE pr2.id = pr2_items.pr2_id
           AND pr2.requisitioner_id = auth.uid()
           AND pr2.request_type IN ('raw_material', 'services')
           AND pr2.status IN ('draft', 'revision_requested')
       )
     )
     WITH CHECK (
       EXISTS (
         SELECT 1 FROM public.pr2_requests pr2
         WHERE pr2.id = pr2_items.pr2_id
           AND pr2.requisitioner_id = auth.uid()
           AND pr2.request_type IN ('raw_material', 'services')
           AND pr2.status IN ('draft', 'revision_requested')
       )
     );

   -- pr2_items: DELETE
   DROP POLICY IF EXISTS "Planning can delete raw material PR2 items" ON public.pr2_items;
   CREATE POLICY "Planning can delete raw material PR2 items"
     ON public.pr2_items FOR DELETE TO authenticated
     USING (
       EXISTS (
         SELECT 1 FROM public.pr2_requests pr2
         WHERE pr2.id = pr2_items.pr2_id
           AND pr2.requisitioner_id = auth.uid()
           AND pr2.request_type IN ('raw_material', 'services')
           AND pr2.status IN ('draft', 'revision_requested')
       )
     );

   -- pr2_item_attachments: INSERT
   DROP POLICY IF EXISTS "pr2_item_attachments_insert" ON public.pr2_item_attachments;
   CREATE POLICY "pr2_item_attachments_insert"
     ON public.pr2_item_attachments FOR INSERT TO authenticated
     WITH CHECK (
       uploaded_by = auth.uid()
       AND EXISTS (
         SELECT 1 FROM public.pr2_requests pr2
         WHERE pr2.id = pr2_item_attachments.pr2_id
           AND pr2.request_type IN ('raw_material', 'services')
           AND pr2.requisitioner_id = auth.uid()
           AND pr2.status IN ('draft', 'revision_requested')
       )
     );
   ```

   Note on the DELETE policy: this widening is judged in-scope (unlike `pr2_requests`'s own
   DELETE policy, which Phase 5a of the parent plan intentionally left `'draft'`-only). Deleting
   a *line item* while editing a bounced-back request is a normal part of addressing revision
   feedback (e.g. removing a line the approver flagged); it is not the same operation as
   deleting the *entire PR2 draft*, which stays restricted elsewhere and is untouched by this
   plan.
3. Apply via the Supabase MCP `apply_migration` tool as a single call containing all four
   `DROP`/`CREATE` pairs (constraint 8 above), then save the identical SQL as the migration
   file on disk.
4. Run `npx tsc --noEmit -p .` and confirm no errors were introduced (expect none — no `.ts`
   file is touched in this phase).
5. **Post-apply verification (mandatory, not optional — constraint 7 and 16 above):** query
   `pg_policy` for `pr2_items` and `pr2_item_attachments` immediately after applying. Confirm:
   - Exactly the four named policies changed, and each now shows `status IN ('draft',
     'revision_requested')` (or the `= ANY (ARRAY[...])` equivalent) in place of the old
     `status = 'draft'`.
   - No policy count increased beyond the expected four (i.e. no orphaned duplicate from a
     `DROP` that silently no-op'd on a name mismatch — see constraint 7).
   - Every other policy on both tables (`Procurement can update PR2 items`, `Approvers can read
     own department PR2 items`, `Requestors can read own PR2 items`,
     `pr2_item_attachments_delete`, `pr2_item_attachments_select`, etc.) is present and
     byte-identical to its pre-migration definition.
   - If anything here doesn't match, stop and report — do not attempt an in-session fix (see
     constraint 16 and the rollback procedure immediately below).

### Rollback

If Phase 1's verification or testing surfaces a problem, revert with a second migration that
restores the exact original four policy bodies (`status = 'draft'` only, everything else
unchanged) — the same `DROP POLICY IF EXISTS` + `CREATE POLICY` shape, just with the status
clause reverted. Do not use any other rollback mechanism (no manual row-level fixes, no
disabling RLS on the table). Re-verify via `pg_policy` after the rollback migration the same way
as step 5 above, confirming the four policies are back to their original `'draft'`-only text.

### Test

As the Planning demo user (or any raw-material/services PR2 owner):
1. Submit a raw-material PR2, then have an approver (Dept Head) request a revision.
2. On `/planning/pr2/[id]`, edit an **existing** line item's quantity, click **Save Draft**,
   then reload the page. Confirm the new quantity persisted (this is the case that silently
   failed before the fix).
3. Delete a line item, Save Draft, reload — confirm the deletion persisted.
4. Add a **new** line item, Save Draft — confirm no RLS error is thrown and the new item
   appears after reload.
5. Upload a new attachment on an item, confirm no RLS error and the attachment persists.
6. Confirm header-field edits (Purpose, Date Required, Remarks) still work exactly as before
   (regression check — Phase 5a's fix must remain intact).
7. Confirm a PR2 still in `pending_approval` (not `revision_requested`) still **cannot** have
   its items edited by the requestor — the widening must not have leaked into that status.

---

## Phase 2 (optional, separately gated) — Fail loudly instead of silently

**Do not implement without an explicit "yes, do Phase 2" from the user, in this or a later
session, even if Phase 1 lands cleanly.**

**Files:** `lib/pr2-planning.ts` (`syncRawMaterialItems` only)

**Risk:** low, but changes application logic/error surface, not just permissions — kept
separate from Phase 1 per this plan's "one concern per phase" discipline.

**Rationale:** Phase 1 fixes the *current* known gap. But `syncRawMaterialItems` still never
checks how many rows an `UPDATE`/`DELETE` actually affected before treating it as successful
(see the "Why this produces a silent failure" section above). If *any* future RLS policy on
`pr2_items` is narrowed or misconfigured again, the same silent-failure symptom will recur with
no error and no audit trail pointing at the cause. This phase is defense-in-depth, not a fix for
a currently-open bug once Phase 1 lands.

### Steps

1. In `syncRawMaterialItems`, change each per-item `UPDATE` call in the `toUpdate` loop from
   discarding the result to checking it, e.g.:
   ```js
   const { data: updRows, error: updErr } = await db
     .from('pr2_items')
     .update({ ... })
     .eq('id', item.id)
     .select('id');
   if (updErr) throw updErr;
   if (!updRows || updRows.length === 0) {
     throw new Error(`Failed to save changes to item "${item.description}" — it may no longer be editable.`);
   }
   updated.push({ id: item.id!, item_order: item.item_order });
   ```
2. Similarly, for the batch `DELETE` of `idsToDelete`, add `.select('id')` and compare the
   returned row count against `idsToDelete.length`; throw a clear error if they don't match
   (some rows were silently skipped by RLS).
3. Re-read the function fresh before editing — do not assume the code quoted above still
   matches the current file verbatim.

### Test

1. Repeat Phase 1's test steps — confirm identical success-path behavior (this phase should be
   invisible when nothing is actually going wrong).
2. To exercise the new failure path without breaking anything permanently: temporarily verify
   (via `pg_policy`, not by editing a live policy) what the error message would look like if a
   status guard regressed — this can be reasoned about from the code change alone; no live
   policy should be temporarily broken to test this.

---

## Phase 3 (optional, only after Phase 1 is live) — Repair already-stuck data

**Do not run without explicit confirmation for each affected record.** Not a code change —
documented here only because it's a direct consequence of this bug and was requested for the
previous, related incident (`PR2-2026-0011`'s stuck `revision_requested` status, healed
2026-08-03 in the earlier session).

### Steps

1. Query for candidate records: raw-material/services PR2s currently in `revision_requested`
   status. For each, this data-repair phase cannot *recover* silently-lost item edits (the RLS
   block prevented them from ever being written — there is no prior value to restore beyond
   what's already in `pr2_items` today). The only actionable repair is confirming the record's
   current `pr2_items` rows are internally consistent (no orphaned temp-state) — this is a
   verification pass, not a mutation, unless a specific record is found broken.
2. If a specific broken record is found (e.g. an orphaned approval instance, mirroring the
   `PR2-2026-0011` pattern from the prior incident), report it and get explicit confirmation
   before any write, following the same pattern used for that repair: minimal, targeted
   `UPDATE ... WHERE id = '<id>' AND status = '<expected current status>'`, plus an
   `audit_logs` entry documenting the manual correction and its reason.

### Test

N/A — this phase is investigative/corrective on a case-by-case basis, not a deploy.

---

## Explicitly out of scope for this plan

- Any change to `pr2_requests` policies — already correctly widened by the parent plan's Phase
  5a.
- `pr2_item_attachments_delete` — no status restriction exists on it; not part of this bug.
- Any change to goods/services PR2s reached via `pr1_id` (warehouse-originated) — this bug is
  specific to Planning-direct (`pr1_id IS NULL`) raw-material/services PR2s and the RLS
  policies scoped to them.
- Widening any policy to accept `pending_approval` or any status beyond `revision_requested`.
