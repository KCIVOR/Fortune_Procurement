# Direct item-code fix — Phase 5 transition checkpoint

October 10, 2026. User authorized the next phase and selected **local first**, not hosted frontend deployment.

Status: **stopped before migration installation; reconciliation direction required**.

Read-only Supabase MCP preflight for `emddvbocupvufzvhcacz` now reports events/context/snapshots **1 / 0 / 0**, code-copy mismatches **0**, direct-fix permit table absent. Reset/unwind hashes remain the reviewed values. Migration SHA256 remains `47AB4B52E7BD435FB6ACE5084DA20E1CA6CFABC4DFE44B3B7A9EE70E184ABB56`.

The zero-event installation prerequisite no longer holds. No migration application was attempted, no production rows were updated/deleted, and no frontend release was performed.

## Exact reconciliation candidate

- Audit event ID: `1`, created `2026-10-10 04:47:45.345796+00`.
- PR1 ID: `c478789a-f15a-4eb4-a748-4893f56b8852`.
- PR1 item ID: `b4b62471-b700-405f-9ce1-faff2ac0d087`.
- Validation ID: `ea39fa33-7ea1-49c6-aa71-5ffd485e1166`.
- Validation item ID: `5323cf29-cb77-497b-8c07-d99303d9aab0`.
- Original/previous code: empty string. Saved override: `Demo Code`.
- Current actual PR1 and validation code: both empty string.
- State: Goods, approved_for_warehouse, undecided, no current PR2 and no PR1-linked RFQ at inspection time.

The approved migration intentionally refuses any existing override records. Automatically discarding the saved value, replaying it into existing items, deleting the audit event, or weakening preflight is not authorized by the plan. Obtain the user's decision about this saved value before designing/testing a narrow reconciliation amendment. Preserve its audit record regardless; do not delete it to satisfy the old zero-data gate.

After direction, revalidate exact relationships, lifecycle, document associations and codes under transition locks. Any reconciliation and compatible installation require a reviewed atomic protocol and isolated regression proof; this report does not authorize an ad hoc production UPDATE.

Local-first frontend startup/refresh and authorized-user acceptance remain outstanding. A hosted frontend deployment is not requested. Editing/submission pause has not been explicitly confirmed.

Execution, Supabase and verification skills enforced the stop-on-nonzero-record transition gate. This is a changed live prerequisite, not a claim that the Phase 4 local tests failed.

## Completed after explicit cancellation authorization

The user subsequently authorized reverting/removing the saved request item code and finishing the transition. Applied Supabase migration `20261010050255_warehouse_item_code_direct_edit_fix` successfully on October 10, 2026. The exact reviewed event was cancelled with protected audit metadata (`cancelled_override_keep_current`); original event fields, request and item remain intact. The migration refuses changed/additional candidates and downstream associations atomically.

Verified live: PR1-2026-0077 has blank actual PR1 and validation codes. All 98 PR1 item rows and 22 validation item rows have identical before/after aggregate hashes (`9b7039e0ba287bb840e2ae79612e9cdd`, `5e0ebcacd20c8e8f9425b5e99a9180d9`). No operational item data was rewritten by this transition.

Final isolated PostgreSQL checks: 88 passed, 0 failed; cancellation checks: 7 groups passed, including six atomic refusals. Helper/consumer/remarks tests: 23 passed; typecheck passed. The additional editor-suite rerun did not execute because the running development build had no production CSS; Phase 4's previous 15 passing browser tests remain historical evidence, not a fresh rerun. No rebuild was forced over the user's running development server.

Verified using the actual signed-in warehouse user on localhost: Reload item codes clears the red invalid-response error, displays `(blank)`, enables Edit code, and opens the same-item blank input. Cancel closes it without saving any production test value. Screenshot: `scratch/warehouse-item-code-reverted.png`. No request submission, rejection, quantity edit, hosted frontend deployment, commit or push was performed. Supabase and test-first verification skills guided the narrowly gated reconciliation and regression checks. User acceptance of a real new code remains a manual follow-up; production was not temporarily edited for testing.
