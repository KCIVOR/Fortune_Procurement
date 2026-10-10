# Warehouse Existing Item Code — Fix Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` task by task, with test-driven development and verification checkpoints. Do not delegate without user authorization. Work on main only under the user's existing explicit instruction. This document authorizes no application changes, database writes, deployment, or destructive cleanup. Implementation requires a subsequent instruction.

**Goal:** Warehouse edits the requester’s existing PR1 item's Code field. Saving updates that same item, not an operational override or another item.

**Architecture:** A checked database RPC updates `pr1_items.item_code` and the matching existing `warehouse_validation_items.item_code` in one transaction, retaining an internal audit event. PR1 becomes the current operational source; document snapshots preserve procurement history. The page displays one code and no “requestor versus warehouse” split. No environment switches are introduced.

**Tech Stack:** Existing Next.js/React/TypeScript, Supabase/PostgreSQL RPC/RLS, existing Node/PostgREST/Chromium test harnesses. No new packages.

## 1. Accepted contract and exclusions

- Same PR1 item ID, same validation item ID; only their code values change. No INSERT/upsert/delete of operational items.
- Requester PR1 detail and print display the corrected current code after reload. The old value remains internal audit history, not a second normal Code field.
- Active authenticated warehouse only, Goods/Services, `approved_for_warehouse`, undecided current validation, no current PR2 (including draft). Database checks are authoritative; UI gating is only convenience.
- Preserve existing normalization: surrounding ASCII spaces removed, internal spaces/zeros/case/punctuation retained; null rejected; intentional blank allowed; no uniqueness requirement. Do not invent catalog validation or length limits.
- Save uses expected persisted current code, rejects stale writes, returns persisted values, and makes no changes for no-op. Cancel performs no write.
- Preserve dirty SOH, requested quantity, reasons, item notes and overall notes during save/reload/error.
- New PR2 uses the updated code even if generation began before the save. Existing live/archived PR2, historical RFQ displays and PO snapshots are not silently rewritten.
- No quantity, routing, pricing/VAT, numbering, descriptions, attachment, supplier-selection, approval, notification or general history UI changes. No broad baseline RLS remediation.

## 2. Audited baseline — facts, not future guarantees

Read-only audit on October 10, 2026, project `emddvbocupvufzvhcacz`:

- Deployed feature migration: `20261010034723_warehouse_item_code_corrections.sql`.
- Save RPC currently INSERTs into `warehouse_item_code_corrections`; neither original code column is updated.
- Correction events / PR2 contexts / PR2 snapshots: **0 / 0 / 0**. Validation-to-PR1 code mismatches: **0**. Eligible PR1s with existing validations: **11**; those with existing RFQs: **0**. These are time-bound observations, not migration assumptions.
- Both code columns are non-null text. Both tables have RLS and authenticated table UPDATE privileges; **RLS, not missing SQL privilege, prevents ordinary non-owner warehouse updates to PR1 items**. No noninternal triggers currently exist on either item table.
- PR1 item UPDATE policy is owner-based, without a warehouse-wide policy. Validation item UPDATE is warehouse-scoped but not column-limited.
- General `audit_logs` INSERT permits authenticated clients with `WITH CHECK true`; it cannot establish trusted edit provenance.
- PR1 detail/print reads PR1 items. Validation seeds its own code copy. PR2 generation reads PR1 codes before header insertion. Quote sync preserves stored PR2 code; PO generation copies PR2 code.
- Reset deletes validation children before the parent; unwind archives/deletes PR2, may delete validation children, then changes PR1 status. A new direct updater changes the lock graph.
- PR1-linked RFQ/supplier/substitute readers use PR1 data, with the currently deployed feature overlay applying only proven corrections. Removing it wholesale does not preserve historical codes after direct PR1 edits.

Previous local test passes apply to the override architecture. They are a baseline, **not proof of the direct-edit fix**.

## 3. Surgical file/object allowlist

Paths relative to `C:/Users/Rovick/Desktop/project`:

| Path/object | Permitted change |
| --- | --- |
| One new CLI-generated `supabase/migrations/` file | Follow-up direct-write RPC/read semantics, narrow lock changes and snapshot protection; never edit the deployed migration |
| `app/warehouse/[id]/page.tsx` | One code display/editor; remove split/banner; synchronize local code states only |
| `lib/warehouse-item-code.ts` | Response validation/helper semantics only |
| `lib/warehouse-item-code-data.ts` | Keep authenticated RPC boundary; clarify direct-edit semantics |
| `types/database.ts` | Only directly affected RPC definitions |
| `lib/canvassing.ts` | Exact-document code overlay only if changed RPC behavior cannot be reused unchanged |
| Existing `scripts/test-warehouse-item-code-*.cjs` and `.sql`, `lib/warehouse-item-code.test.ts` | Replace conflicting assertions; add direct-edit/history/concurrency regressions |
| This plan and a feature verification report | Evidence, review and release outcome |

Database scope: existing three feature tables remain retained. Reuse correction events **only as protected audit**, never as the effective-code source. Reuse `update_warehouse_item_code`, `get_warehouse_item_codes`, and exact-RFQ reader interfaces when compatible. New internal helper functions are restricted and fixed-search-path.

Permitted targeted additions to existing reset/unwind function bodies: acquire the same PR1 advisory transaction lock **before any child/archive/workflow writes**, and recheck authorization/lifecycle after acquisition. Preserve the remainder of their business behavior and public signatures. They must be copied from freshly inspected live definitions, not reconstructed from memory.

One narrowly justified new historical-code table is permitted **only if Phase 1 proves unlinked legacy RFQs need it**: `warehouse_item_code_rfq_history(rfq_id uuid, pr1_item_id uuid, item_code text not null, captured_at timestamptz not null default now(), primary key(rfq_id,pr1_item_id))`. It is an immutable document snapshot, not another item or an alternate current code. RLS enabled; no client writes/anonymous reads; access only through the checked exact-RFQ reader. No cascading foreign keys that block current reset/archive behavior. Do not create it merely for convenience if exact existing document snapshots cover all affected lines.

Inspection/regression only: `lib/warehouse.ts`, `lib/pr1.ts`, `lib/pr2-warehouse.ts`, `lib/pr2-rfq-sync.ts`, `lib/po.ts`, PR1/PR2/PO pages/prints, attachments, routing/approvals. Amend this plan before editing another application file. Preserve unrelated dirty manual/audit files and all package/lockfiles. No automatic commits/pushes.

## Phase 1 — Recheck state and prove the replacement design

**October 10 execution checkpoint:** Inspection and isolated experiments completed; the exit gate is NOT passed. See `2026-10-10-warehouse-item-code-direct-edit-phase1.md`. The 22 proof groups include three reproduced safety gaps: owner submitted-code PATCH, warehouse validation-code PATCH, and RFQ relinking overriding immutable history. Before Phase 2, review a narrow amendment for code-only write guards and immutable RFQ snapshot precedence. No production migration or application changes were made during this phase. The checklist below remains the acceptance gate, not a claim that every item passed.

- [ ] Record `git status --short`, `git diff --stat`, HEAD and the exact feature diff; identify user-owned unrelated edits.
- [ ] Read live RPC/reset/unwind bodies, all item/header triggers, policies/grants, constraints and dependencies again. Recheck the three feature counts and code mismatches with one read-only query.
- [ ] Stop transition if correction counts are nonzero or copies mismatch. Produce an exact reconciliation list and request direction; never discard, replay, or overwrite newly saved corrections automatically.
- [ ] Inventory all direct deletion/cascade and code-changing paths involving PR1 and validation items. Record the order of advisory and row locks, including requester item upsert, reset, unwind, direct PATCH, header/status/decision writes and PR1 deletion.
- [ ] Prove a lock protocol in the isolated database with actual live reset/unwind definitions: direct save acquires the PR1 advisory lock, freshly verifies state, conditionally updates PR1 code, updates the existing validation copy, then appends audit in one transaction. It must not lock/update the PR1 header. Reset/unwind acquire the advisory lock before child writes. Any uncovered writer that makes this unsafe blocks implementation until a narrow protocol amendment is reviewed.
- [ ] Verify exact RFQ associations and missing/duplicate PR1-item mappings. Linked live/archived PR2 codes are the historical source; no latest-PR2-by-PR1 inference. For a legacy unlinked RFQ, preserve the code currently visible immediately before the first direct mutation, only for the affected item, under serialization with RFQ creation/link changes. This is preservation at transition time, not a claim to reconstruct an originally issued historical value.
- [ ] If such legacy capture is required, prove RFQ creation/link-change versus direct edit serialization using a narrow internal RFQ trigger and the same PR1 key. Do not change RFQ business behavior. Capture only affected-document code values, never prices or quantities. A missing/ambiguous historical association must fail explicitly rather than borrow current code.
- [ ] Review whether future RFQs can include PR1-linked items absent from their linked PR2. Either document a valid existing immutable source for those lines or require per-RFQ code capture for those exact lines before later edits. Do not assume full PR2 coverage.

**Exit:** Reviewed SQL design, exact lock graph, historical-source rules and passing isolated proof tests. No production writes. This is a real gate; the audit alone cannot certify new locking behavior.

## Phase 2 — Failing regressions and follow-up database migration

**Scope amendment authorized by the user's instruction to proceed after the Phase 1 report:** include code-only mutation guards and immutable RFQ snapshot precedence. A protected, transaction-scoped `warehouse_item_code_write_permits` table may hold only backend/transaction/item identifiers while the checked RPC updates both copies; it stores no codes and is emptied before return. No client permissions or client-set authorization flags. Requester code edits remain available after the existing draft/revision validation reset. Unrelated columns retain existing policies and write behavior. RFQ snapshot capture validates exact live/archive sources and preserves the first stored value across relinking; incompatible associations fail explicitly. Prove these amendments locally before considering the Phase 1 safety gaps closed.

**Phase 2 execution checkpoint:** Local database implementation and amended safeguards passed 33 regression groups, exit 0. See `2026-10-10-warehouse-item-code-direct-edit-phase2.md` for RED/GREEN evidence, exact object review and limits. The Phase 1 three-gap gate is resolved for the tested replacement protocol. Migration `20261010041322_warehouse_item_code_direct_edit_fix.sql` is unpublished; no UI/application changes in this phase. Phase 3 may proceed; full Phase 4 regressions and Phase 5 release remain required. Checkboxes are the original acceptance specification; this checkpoint/report records execution status without implying hosted acceptance.

- [ ] Add native tests against the currently deployed migration first. They must fail because the PR1/validation code remains unchanged after the old save RPC.

```sql
-- Synthetic fixture only, executed with an authenticated warehouse JWT/role.
SELECT * FROM public.update_warehouse_item_code(
  md5('line1')::uuid, '001-ORIGINAL', '0007-FIXED');
DO $$ BEGIN
  IF (SELECT item_code FROM public.pr1_items WHERE id=md5('item1')::uuid)
      IS DISTINCT FROM '0007-FIXED' THEN
    RAISE EXCEPTION 'Existing PR1 code was not updated';
  END IF;
  IF (SELECT item_code FROM public.warehouse_validation_items WHERE id=md5('line1')::uuid)
      IS DISTINCT FROM '0007-FIXED' THEN
    RAISE EXCEPTION 'Existing validation code was not updated';
  END IF;
END $$;
```

- [ ] Capture item counts/IDs and unrelated column values before the save; assert identical afterward. Add forced-error tests after each write to prove both updates and audit roll back together.
- [ ] Discover CLI commands using `supabase migration --help` / `supabase migration new --help`; generate `warehouse_item_code_direct_edit_fix` with the CLI. Do not invent a timestamp or modify migration `20261010034723`.
- [ ] Author the reviewed follow-up SQL in the generated file. Recheck active warehouse identity and current relationships after the PR1 lock. Derive actor identity/name from the database. Normalize and reject null; compare against **current PR1 code**, not latest audit event.
- [ ] Use a conditional existing-row UPDATE and inspect RETURNING/row count; do not INSERT/upsert items. The following is the required mutation shape inside the checked RPC, with IDs obtained through the verified validation relationship:

```sql
UPDATE public.pr1_items AS p
SET item_code = v_new
WHERE p.id = v_pr1_item_id AND p.pr1_id = v_pr1_id
  AND p.item_code IS NOT DISTINCT FROM p_expected_code
RETURNING p.item_code INTO v_saved_code;
IF NOT FOUND THEN
  RAISE EXCEPTION 'Item code changed; reload before retrying' USING ERRCODE='40001';
END IF;
UPDATE public.warehouse_validation_items AS i
SET item_code = v_saved_code
WHERE i.id = p_validation_item_id AND i.validation_id = v_validation_id
  AND i.pr1_item_id = v_pr1_item_id;
IF NOT FOUND THEN
  RAISE EXCEPTION 'Validation item was replaced or removed';
END IF;
```

- [ ] Insert the protected old/new audit event in the same transaction after successful updates. No-op creates no event. Store the actual prior PR1 code; do not interpret an event as an operational override. Keep the existing save result shape if possible: persisted IDs/code and audit metadata. Do not relax protected audit-table writes or rely on client-inserted general logs.
- [ ] Change `get_warehouse_item_codes` to read current PR1/validation state. Existing `original_pr1_code` can be retained as a compatibility field containing current PR1 code; its name must not imply an unchanged requester baseline in the UI. Audit metadata may remain separate internal metadata. Validate copy agreement and fail on inconsistent relationship/state.
- [ ] Replace PR2 code enforcement with authoritative current PR1 code at item INSERT under the same PR1 lock; re-read after waiting. Apply only to the warehouse Goods/Services linked-validation path, not native/planning paths. Do not depend on events/context to establish the current code, and do not trust the browser's pre-header copy. Preserve the existing browser generation sequence.
- [ ] Stop operational use of obsolete correction-context/mapping machinery after the zero-data transition gate. Retain their tables; no DROP/history deletion. Remove/replace only the exact obsolete feature triggers/functions required by the new protocol; list each reverse dependency and compatible RPC consumer in the migration review.
- [ ] Implement exact-RFQ historical code reading from linked live/archive PR2 and any Phase 1-proven legacy snapshot source. Retain active identity, exact supplier assignment, existing staff document access and owner authorization. Return only `(pr1_item_id,item_code)`; empty code stays empty. Never infer association from equal text/timestamps. Do not alter quantities/line selection or grant general archive/history access.
- [ ] Apply only to the isolated database and run role/direct-write/stale/no-op/blank/rollback/history tests. Inspect actual RLS, table/column/sequence privileges, EXECUTE and fixed search paths. No warehouse-wide PR1 UPDATE policy.

**Exit:** Same existing item changes atomically, audit is protected, historical documents stay stable, native/legacy no-edit workflows remain valid. Follow-up SQL is still unpublished until review.

## Phase 3 — One Code field in the warehouse page

**Execution checkpoint:** UI implemented locally. See `2026-10-10-warehouse-item-code-direct-edit-phase3.md`: 23 helper/RPC/consumer/remarks tests and 15 browser tests passed; build, focused ESLint and typecheck passed. Real requester detail/print components show the corrected code with fresh synthetic reads. No hosted database/application deployment. Phase 4 and coordinated Phase 5 release still required.

- [ ] Write browser regressions expecting one code value per line, existing Edit/Save/Cancel controls, no “Requestor code”, no “Warehouse item code”, no explanatory separate-code banner and no environment variables.
- [ ] Update only the existing code cell. Keep the inline editor; do not redesign the table or introduce a history panel. Use a context-appropriate inline error/retry only when a read/save fails, not an always-visible technical banner.
- [ ] After a checked persisted save, update matching code fields in `pr1.items`, `validation.items`, `formValues.items` and checked code state by immutable IDs. Do not call `buildFormValues` again, reopen validation, refetch/reset the entire form, or replace non-code fields.

```ts
setFormValues(current => ({
  ...current,
  items: current.items.map(item => item.id === result.validation_item_id
    ? { ...item, item_code: result.effective_code }
    : item),
}));
```

- [ ] Reload checked codes without comparing against a stale original PR1 code held in React state. Verify validation/item identity and persisted copy agreement instead; merge only code values into local states.
- [ ] Keep pending/dirty workflow guards, expected-current-code conflict detection, ambiguous-save re-verification and no-success-before-persistence. Preserve attempted text on error; cancel performs no RPC. Keep keyboard Enter/Escape behavior and narrow-screen/long-code support.
- [ ] Update only directly affected helper/data comments, response validators and RPC types; remove resolver use that treats audit as an alternate effective code. Do not remove history/procurement readers merely because the current field is now direct.
- [ ] Run browser tests after build, sequentially; use required actual application CSS. Verify requester PR1 detail/print after refresh reflects the persisted update, not a second label.

**Exit:** One Code field, actual existing-row save, dirty form values retained, role/state restrictions unchanged.

## Phase 4 — Full regression and surgical review

**Execution checkpoint:** Local Phase 4 passed: final canonical direct-edit database/JWT/Chromium suite 88 groups, 0 failures; helper/RPC/consumer/remarks 23 tests; editor/requester browser 15 tests; build, typecheck, focused lint and package/diff checks passed. See `2026-10-10-warehouse-item-code-direct-edit-phase4.md` for exact results, harness corrections and limits. The existing live RFQ-to-PR2 FK can reject linked unwind; its atomic failure is preserved, not repaired or falsely certified as success. Migration remains byte-identical and unpublished; no production data changed. Phase 5 coordinated release and authorized-session acceptance remain outstanding.

- [ ] Update old tests asserting “original PR1 unchanged”: they must now assert **same item ID/count, changed code, all unrelated fields unchanged**. Keep negative assertions for unauthorized writes and unchanged native/history behavior.
- [ ] Run two-session cases in both orders with commit and rollback: save vs save, PR2 header, PR2 line insert, internal resolution, reject/revision, requester reset, unwind, requester item upsert and permitted deletion/cascade. Add save against a validation-item update. Report actual waits/conflicts/deadlocks; no timing-only claim of safety.
- [ ] Explicitly reproduce PR2 generation's pre-header stale read: save a newer PR1 code between that read and header commit; inserted PR2 code must be the authoritative newer value. Header-first blocks a later warehouse save.
- [ ] Verify first/second edits, blank/duplicate/long/formatted codes, no-op, network ambiguity, missing/deleted/replaced validation and active-profile changes. Direct warehouse table PATCH of PR1 remains denied.
- [ ] Compare before/after archived RFQ/supplier/substitute codes across unwind and a new validation. Test linked live/archive, unlinked legacy, missing linkage, missing line mapping, native and uncorrected paths. No silent current-code fallback for a protected historical line.
- [ ] Execute actual quote sync and PO generation; assert stored codes and commercial fields remain correct. Existing live/archive PR2 and PO rows are never backfilled by this fix.
- [ ] Run the commands below with exact results recorded. Native runner must apply deployed baseline **then** the new migration. It must remain hardcoded to the isolated target and must never read production credentials.

```powershell
node node_modules/typescript/bin/tsc lib/warehouse-item-code.ts lib/warehouse-item-code.test.ts lib/warehouse-pr2-remarks.ts lib/warehouse-pr2-remarks.test.ts --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck --outDir scratch/warehouse-item-code-tests
node --test scratch/warehouse-item-code-tests/warehouse-item-code.test.js scratch/warehouse-item-code-tests/warehouse-pr2-remarks.test.js scripts/test-warehouse-item-code-data.cjs scripts/test-warehouse-item-code-consumers.cjs
node scripts/test-warehouse-item-code-postgres.cjs
node node_modules/eslint/bin/eslint.js lib/warehouse-item-code.ts lib/warehouse-item-code-data.ts lib/canvassing.ts 'app/warehouse/[id]/page.tsx'
npm run build
node --test scripts/test-warehouse-item-code-editor.cjs
npm run typecheck
git diff --check
git diff --stat
git status --short
git diff --exit-code -- package.json package-lock.json
```

- [ ] Disclose the previously observed project-wide `npm run lint` dependency-detection failure; do not allow its attempted install to change package files. Focused lint is not falsely reported as a clean project-wide lint.
- [ ] Review each modified line against the allowlist. No feature expansion, unrelated cleanup, dependency changes or general security repairs. No merge/push/deploy on a failed gate.

**Exit:** New direct-edit behavior—not the old override design—is verified. No zero-bug guarantee.

## Phase 5 — Coordinated application/database transition and acceptance

**User-authorized reconciliation amendment:** The user's instruction to finish and revert/remove this request's item code cancels the saved `Demo Code` override; it does not delete the request or item. The still-unpublished direct migration may accept only the one audited PR1-2026-0077 event with exact blank code copies, original event values/time/actor and relationships, unchanged eligible lifecycle and no live PR2/RFQ. Any other/additional event or changed prerequisite still refuses installation under the existing table locks. Two protected audit-only columns record cancellation/time without modifying original event fields, actor or code copies. Checked current-code reads exclude cancelled audit metadata. Add failing-then-passing isolated cancellation/atomic-refusal tests and rerun the direct suite before application. No broad preflight bypass, impersonation, item deletion or historical data rewrite is authorized.

**Transition checkpoint:** User selected local-first. Fresh read-only preflight found one saved legacy override (`Demo Code`, event 1) while actual PR1/validation codes remain blank. Installation was stopped before any live write, as required by the nonzero-record gate. See `2026-10-10-warehouse-item-code-direct-edit-phase5.md` for exact affected IDs and the reconciliation decision required. Do not delete the event, silently replay its value or bypass preflight.

- [ ] Present Phase 1–4 evidence before any live write. Obtain implementation/deployment direction; this plan alone is not permission to apply it.
- [ ] Coordinate a short pause on warehouse code editing/affected submissions during transition; do not add feature flags. Recheck counts/mismatches in the same transaction as migration installation, after acquiring locks that prevent old save/header writers from racing the preflight. Refuse installation if legacy feature records now exist; do not erase them to make the gate pass.
- [ ] Apply only the reviewed follow-up migration through Supabase MCP. Preserve the already-deployed migration/history. Align the local filename with the actual server migration version if MCP generates it.
- [ ] Deploy/restart the compatible application in the authorized target and require already-open warehouse tabs to refresh. Do not claim that changing local source deploys the hosted frontend. Retained RPC signatures reduce mixed-version risk but do not make old dual-code React state correct.
- [ ] Reinspect live functions/grants/RLS/triggers and advisors. Perform read-only security smoke checks; do not fabricate production user JWTs or seed production fixtures.
- [ ] User acceptance with authorized sessions: edit the visible item code, Save, refresh warehouse, open requester PR1 and print, confirm the same item/code, then verify ordinary procurement flow on an explicitly authorized test document. Verify unauthorized users and existing history unchanged. Record any unperformed hosted check as outstanding.
- [ ] Rollback is a reviewed forward repair, not returning to the separate-override save RPC. Once direct edits exist, preserve their current values and audit records. Keep historical readers and code-snapshot protections. If a defect threatens consistency, pause affected writes/submission until a compatible fix is available; never delete records, rewrite old documents or drop protections automatically.

**Final acceptance:** Warehouse edits one existing item code; requester/validation agree; new procurement uses it; existing history remains stable; no unrelated field/workflow changes. All remaining gaps must be stated explicitly.

## Plan self-review

- Same-item direct update: Phase 2 conditional UPDATE and Phase 3 state merge.
- One code/no alternate operational source: Phases 2–3; internal audit is not a second item.
- Authorization and surgical scope: Sections 1/3 and Phases 2/4.
- Dirty form preservation and failures: Phase 3.
- Historical documents and stale generation: Phases 1/2/4.
- Changed lock graph: isolated proof gate in Phase 1 plus complete matrix in Phase 4.
- Existing deployed feature and time-varying records: preflight refusal and coordinated transaction in Phase 5.
- No rollout switches, silent historical fallback, destructive automatic cleanup or implied hosted deployment.

This is a five-phase repair plan with a proof gate. It does not claim that new SQL or concurrency behavior has already been implemented or validated.
