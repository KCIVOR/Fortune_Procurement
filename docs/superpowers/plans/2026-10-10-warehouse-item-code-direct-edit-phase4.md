# Warehouse existing item code — Phase 4 verification

Date: October 10, 2026. Branch: main, HEAD `91fd9f4dbdee028742629c3a35334440e2e3bf78`.

## Scope and status

Local regression/review phase complete. No application changes, migration edits, hosted writes, deployment, commits or pushes in this phase. Final integrated database run passed 88 groups with 0 failures; hosted acceptance remains Phase 5.

The canonical `test-warehouse-item-code-postgres.cjs` now executes the direct-edit suite, applying the deployed predecessor and then the unpublished fix to a newly created disposable loopback database. The old runner/SQL assertions remain explicitly labeled historical override baseline, not current acceptance. The optional isolated integration contract now expects the same PR1 item and validation copy to change.

Only feature tests, this report and the plan checkpoint were edited during this phase. Existing unrelated manual, audit, `.agents`, backup and scratch work was preserved. Package files are unchanged.

## Verification evidence

| Check | Observed result |
| --- | --- |
| Canonical native runner `--baseline` | Four intended failures, exit 0 for the RED detector: original code unchanged, two bypasses, mutable RFQ history. Disposable DB `wic_test_direct_1791607352476`. |
| Expanded direct native/JWT/Chromium suite | 87 groups passed, 0 failed, exit 0, DB `wic_test_direct_1791607379285`. |
| Supplemental direct edges SQL on that DB | Exit 0; null new code rejected, old validation ID rejected after replacement, new ID edits the same PR1 item, permitted post-reset PR1 cascade succeeds. Both test transactions rolled back. |
| Final integrated canonical run | 88 passed, 0 failed, exit 0; explicit marker/release barrier and supplemental edges included. DB `wic_test_direct_1791607745986`. |
| TypeScript helper compilation | Exit 0 with the plan's exact compilation command. |
| Combined helper/RPC/consumer/remarks tests | 23 passed, 0 failed. Rerun after adding commercial-field assertions. |
| Focused ESLint on helper/data/canvassing/warehouse page | Exit 0. |
| `npm run build` | Exit 0. Existing warnings: outdated Browserslist data, Supabase Realtime dynamic dependency, client rendering for `/po/new` and `/tsqa/grn`. Build skips lint, so focused lint was executed separately. |
| Real editor/requester component browser tests | 15 passed, 0 failed, using the completed build's actual CSS. |
| `npm run typecheck` | Exit 0. |
| Integration target safety-only run | 3 passed; 2 external-target tests explicitly skipped. Not represented as a full external integration pass. |
| `git diff --check` | Exit 0; existing CRLF notices for `.gitignore` and `scripts/build_manual.py`. |
| Package/lockfile diff | Empty, exit 0. |

Project-wide `npm run lint` is **not** certified: the previously observed dependency-detection/attempted-install problem remains outside scope. No dependency installation or unrelated lint repairs were performed.

## Database and concurrency coverage

- Same PR1/validation item IDs and counts; all non-code JSON fields identical after a direct edit. Blank, formatted, duplicate and 12,000-character codes retain the accepted text contract. No-op creates no event; stale code conflicts.
- Forced copy-write and audit failures roll back both code copies, history capture and permits. Protected permits/history/internal helpers retain RLS, restricted privileges and fixed search paths; no client-set authorization shortcut.
- Actual signed JWTs against disposable local PostgREST exercise save/read/no-op/stale/blank, denied identities, anonymous/invalid tokens, protected audit and direct PR1/validation PATCH behavior. No real user tokens or production credentials.
- Two-session tests explicitly observe `wait_event_type='Lock'` and `pg_blocking_pids`, not merely elapsed time. The final harness keeps the first transaction open behind an explicit completion marker until the observer releases it; it does not depend on a short `pg_sleep`. Both orders and first-writer commit/rollback cover PR2 header, internal resolution, rejection, revision, requester reset, validation cascade/delete, validation child delete, non-code notes, requester upsert, and save/save conflict/rollback.
- PR2-line and actual unwind cases start with an existing PR2, so editing is already ineligible. Boundary-first tests observe blocking and authoritative rejection after either commit or rollback. Save-first tests assert rejection and no code/audit mutation; a failed RPC's subtransaction does not retain its advisory lock. These are not falsely described as two simultaneously eligible successful operations.
- Active warehouse identity is rechecked after waiting on the document lock. Requester reset followed by an actual existing-row `INSERT ... ON CONFLICT DO UPDATE` remains allowed. A stale submitted-owner upsert cannot overwrite a newly saved warehouse code; ordinary description and notes writes remain supported.
- Real Chromium issues signed requests to local PostgreSQL/PostgREST in the critical order: read old PR1 code, complete warehouse edit, commit PR2 header, send stale PR2 line. Persisted PR2 uses the fresh PR1 code while quantity, description and prices remain unchanged. This is a browser/API/database sequence test, not a claim that the entire production approval UI was exercised.
- Exact RFQ snapshots preserve blank/live/archive/unlinked/missing-line cases; missing or ambiguous associations fail. Assignment/owner/staff checks and native no-overlay paths are exercised. An unlinked RFQ remains unchanged across actual unwind, new validation and a second direct edit; archived PR2 code remains stable.
- Actual quote-sync and PO-generation functions run with synthetic transport. Stored code and PO quantity/unit price/total/description assertions pass; reader comparisons preserve non-code fields and attachments. VAT calculations remain outside this feature and use the existing harness stub, not a new tax correctness certification.
- Completed native run reports zero deadlocks, zero leaked permits and zero obsolete operational contexts/snapshots.

## Confirmed baseline limitation — not changed

Read-only MCP inspection confirms live `rfq_batches_pr2_id_fkey` references **live** `pr2_requests(id)` without cascading action. Actual unwind attempts to delete that PR2, so an RFQ still linked to it can cause SQLSTATE `23503`. The local test reinstates this exact constraint and proves unwind fails atomically: live PR2 remains, no partial archive survives.

This is pre-existing behavior, not repaired or bypassed here. Synthetic archived-association reader cases prove code-source validation, **not** that the live FK permits linking directly to an archived-only header. No claim is made that RFQ-linked unwind now succeeds. Broadening that workflow requires a separate approved scope.

## Read-only hosted recheck

Project `emddvbocupvufzvhcacz`: correction events/context/snapshots **0 / 0 / 0**, PR1/validation code mismatches **0**, direct-fix permit table absent. The fix is **not installed**.

Live reset/unwind body hashes still match migration preflight:

- Reset: `cc84b293d02a3763e0be4ce6001de4f0`.
- Unwind: `d0bc08cd589a9255c84c50987306d809`.

These observations are time-bound. Phase 5 must repeat the zero-data checks under installation locks; they are not deployment authorization.

Migration SHA256 remains `47AB4B52E7BD435FB6ACE5084DA20E1CA6CFABC4DFE44B3B7A9EE70E184ABB56`.

## Surgical review and remaining boundary

Reviewed production diff: warehouse page's code editor/state merges/workflow guards only; helper/data response validation; exact-document code overlays in four canvassing readers; directly affected RPC types. No routing, approvals, quantity computation, pricing, notifications, attachment storage or package changes were added. Existing `.gitignore` and manual edits were not modified here. The migration remains byte-identical to Phase 2.

Local fixtures use verified relevant columns, constraints and live function bodies but are not a complete hosted schema/RLS clone. Zero observed deadlocks covers the tested normal request boundaries, not every hypothetical multi-statement transaction written by a privileged external client. No independent reviewer/subagent was used, per the no-delegation constraint.

Phase 5 remains: explicit coordinated release direction, installation-time preflight, migration plus compatible frontend release/refresh, live security inspection/advisors and acceptance using authorized real sessions/documents. Local passing tests do not claim hosted acceptance or a zero-bug guarantee.

Skills used: executing-plans, verification-before-completion, Supabase and Supabase PostgreSQL best practices. They constrained this phase to evidence-backed local verification, observed lock ordering and read-only hosted inspection; no production remediation was inferred.

Systematic debugging was also used for harness failures. An early assertion omitted the actual removed-child error text and was corrected without weakening the expected failure. A run begun before its browser fixture's PR2 grant was added failed with `42501`; a fresh complete run passed. A subsequent timed-lock rerun failed to observe one wait; inspection of DB `wic_test_direct_1791607542067` showed the expected rolled-back code, committed rejection, no audit event and zero deadlocks. The timed hold was replaced with an explicit transaction-release barrier and completion marker. The first integrated edges run also exposed a psql-only directive incompatible with the query runner; the redundant directive was removed (the runner already sets ON_ERROR_STOP). None of these harness adjustments changed application or migration code.
