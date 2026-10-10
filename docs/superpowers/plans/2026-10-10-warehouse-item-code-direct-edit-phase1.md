# Direct item-code fix — Phase 1 evidence

Date: October 10, 2026. Branch: main. HEAD: `91fd9f4dbdee028742629c3a35334440e2e3bf78`.

## Outcome

Phase 1 inspection and isolated experiments are finished. The design safety gate is **not passed**. Three reproduced gaps require a narrowly reviewed amendment before production implementation. No hosted database writes, production migration, application changes, commit or push were performed in this phase.

## Fresh read-only live inspection

Project: `emddvbocupvufzvhcacz`. Existing migration: `20261010034723_warehouse_item_code_corrections.sql`.

- Correction events, contexts and snapshots: 0 / 0 / 0. PR1/validation code mismatches: 0. No data reconciliation was necessary at inspection time; recheck before release.
- Existing owner PR1-item UPDATE policy checks ownership, not editable status. Existing warehouse validation-item UPDATE policy is not column-limited.
- PR1 items, validation items and RFQ batches have no noninternal triggers. Existing feature triggers serialize PR1 status, validation decisions/deletion, PR2 header creation and PR2 item snapshots.
- RFQs permit procurement-role association updates. One PR1-linked RFQ exists. No duplicate live PR2 `(pr2_id, pr1_item_id)` groups were found.
- RFQ has a foreign key to live PR2 without cascading deletion. The isolated fixture does not reproduce that constraint; archive-with-linked-RFQ success is therefore not established here.
- Checked feature RPCs require authenticated access; anonymous execution and client execution of internal helpers remain denied.

## Writer and lock inventory

| Path | Observed behavior / direct-edit consequence |
| --- | --- |
| Proposed save | PR1 advisory lock → fresh state/expected-code checks → conditional existing PR1-item UPDATE → existing validation-item UPDATE → protected audit. No PR1-header row lock/write. |
| PR1 status / validation decision or deletion | Existing row mutation reaches an advisory-lock trigger. Save must avoid acquiring the header row afterward. |
| Requester reset | Live function deletes validation children then header. Candidate proof prepends advisory lock before checks/writes. |
| Approval unwind | Live function archives/deletes PR2, optionally deletes validation, then updates PR1. Candidate proof prepends advisory lock before checks/writes. |
| Requester item synchronization | `lib/pr1.ts` resets validation in draft/revision, deletes missing items, changes order and upserts full item fields including code. Direct API owner UPDATE bypasses UI lifecycle checks. |
| Warehouse progress/submit | `lib/warehouse.ts` writes quantity/SOH/notes/reasons, not code. Direct API validation UPDATE can nevertheless write code. |
| PR2 generation | Browser reads PR1 codes before inserting header. Candidate item trigger locks/re-reads current code to defeat stale browser input. Production eligibility scope still needs implementation review. |
| RFQ creation/link changes | Candidate trigger serializes PR1 keys (old/new keys sorted for changes). Existing API permits relinking, so snapshot source precedence must also be protected. |
| PR1 draft deletion | Existing owner draft/revision checks; item/parent deletion and non-cascading validation FK can interact. This phase does not certify every baseline deletion/cascade. |

Historical readers can include PR1 lines absent from the linked PR2: `buildRfqLineItems` also includes legacy referenced lines. Exact live/archive PR2 mapping alone is insufficient for those lines and unlinked legacy RFQs. A protected per-RFQ code snapshot is justified; it is not an operational item or second current Code field.

## Isolated evidence

Command: `node scripts/test-warehouse-item-code-direct-proof.cjs`.

Exit: 0. Disposable local database: `wic_test_1791605141703`, loopback PostgreSQL port 55439. 22 proof groups completed, including three deliberate gap reproductions. A PASS for a gap means the unsafe baseline behavior was reproduced, **not** that the design is safe.

Test-only files:

- `scripts/test-warehouse-item-code-direct-live-functions.sql`: fresh live reset/unwind definitions, with SQL terminators added.
- `scripts/test-warehouse-item-code-direct-proof.sql`: experimental direct-save and history protocol, not a migration or production API.
- `scripts/test-warehouse-item-code-direct-proof.cjs`: disposable fixture runner; patches advisory-lock acquisition into actual live reset/unwind definitions locally only.

Successful experimental checks: same item IDs/counts; both code copies updated; blank/normalization/no-op/stale handling; transaction rollback; rejected identities/roles; actual reset/unwind bodies; stale PR2 input; exact archive and missing-line history behavior; two ordered sessions for status/header/decision/deletion/reset boundaries; RFQ creation in both orders; simultaneous saves with one winner.

Reproduced failures:

1. After direct save, requester API UPDATE changes submitted PR1 code to `OWNER-BYPASS` while validation remains `DIRECT`.
2. Warehouse API UPDATE changes validation code to `COPY-BYPASS` while PR1 stays `001-ORIGINAL`.
3. RFQ association change makes the experimental PR2-first reader return `OTHER-DOCUMENT-CODE` despite an existing immutable `001-ORIGINAL` RFQ snapshot.

Limits: synthetic local auth and targeted UPDATE RLS, not a full live schema/RLS clone or hosted JWT end-to-end verification. The experiment is not production-ready SQL. Commit/rollback permutations and all workflow/browser regressions remain later-phase work.

## Required narrow amendment — pending review

- Guard only item-code mutations: requester edits remain allowed in the already editable draft/revision lifecycle; warehouse direct editing must go through the checked active-warehouse RPC. Preserve ordinary non-code item and validation updates.
- Protect validation-code copying from direct client PATCH. Prove a trusted server-side authorization mechanism; do not trust client-set flags or widen warehouse PR1 UPDATE permissions.
- Preserve immutable RFQ code snapshot priority across link changes, with exact association validation and explicit missing/ambiguous-source errors. Capture exact source before association changes where necessary.

These changes are consistency safeguards for this feature, not permission to remediate unrelated RLS. Review/amend the implementation plan before authoring the follow-up migration. The existing deployed override feature remains untouched until the coordinated replacement.
