# Direct item-code fix — Phase 2 verification

October 10, 2026. Main, HEAD `91fd9f4dbdee028742629c3a35334440e2e3bf78`.

## Result

Database replacement implemented and verified **locally only**. The three Phase 1 gaps have passing local regressions. Ready for Phase 3 UI work, not production release.

New migration, created using Supabase CLI 2.58.5 after command discovery:
`supabase/migrations/20261010041322_warehouse_item_code_direct_edit_fix.sql`.

SHA256: `47AB4B52E7BD435FB6ACE5084DA20E1CA6CFABC4DFE44B3B7A9EE70E184ABB56`.

No hosted writes, application/UI edits, dependencies, commit, push or deployment in this phase. Existing unrelated dirty files were preserved. The original deployed migration was not edited.

## Exact behavior and scope

- Checked active-warehouse RPC updates the same PR1 item and matching validation item atomically. Expected code comes from persisted PR1, never an audit override. IDs/counts and unrelated columns are preserved.
- Both copies must agree before save. Blank is allowed; surrounding ASCII spaces trimmed. Stale values fail. No-op creates no event.
- Existing correction events become protected audit only. Latest audit metadata remains in compatible responses; current code reads come from PR1/validation.
- Two code-only UPDATE triggers reject submitted requester-code PATCH and warehouse validation-code PATCH outside the authorized protocol. Ordinary description and notes UPDATEs retain existing behavior. Requester draft/revision editing works after the existing validation reset.
- A protected transaction capability table contains only backend PID, transaction ID and exact item IDs. Only the checked RPC creates/deletes the permit, in the same transaction. No client grants, client-set authorization settings or warehouse-wide PR1 UPDATE policy.
- RFQ code history captures exact live/archive document values, or the presently visible PR1 value for missing/unlinked lines before mutation. First capture wins across relinking. Invalid/missing/ambiguous sources and removed historical associations fail explicitly. This is document history, not another operational item/code.
- New warehouse Goods/Services PR2 items re-read authoritative current PR1 under the same advisory lock, replacing stale browser input. Native/no-validation and non-Goods/Services PR1 paths remain outside this rewrite.
- Reset/unwind acquire the advisory lock before child writes. Their existing business statements/signatures/ACLs are preserved. Installation verifies exact normalized live body hashes before prepending the lock; changed bodies refuse installation.
- Migration locks participating tables and refuses nonzero old feature data or mismatched copies. No cleanup/backfill of old corrections or historical PR2/PO codes.

## Object/dependency review

Retained tables: corrections, PR2 contexts, PR2 snapshots. No data deletion/drop of those tables.

Replaced checked interfaces: `update_warehouse_item_code`, `get_warehouse_item_codes`, `get_rfq_warehouse_item_code_snapshots`; signatures unchanged. Phase 3 must reconcile old dual-code React state before release.

Existing `wic_pr2_context` still calls replaced `wic_capture_pr2_context`, now serialization only. Existing `wic_pr2_code` still calls replaced `wic_snapshot_pr2_code`, now a current-PR1 INSERT enforcement trigger. Removed only obsolete `wic_pr2_snapshot` AFTER INSERT trigger. No operational reader uses obsolete context/snapshot records after replacement.

New objects: two protected tables, code guards, RFQ capture/serialization helpers and their triggers. New tables have RLS and no anon/authenticated table access. Internal helper EXECUTE is revoked from PUBLIC/anon/authenticated. Feature functions use fixed empty search paths. Existing reset/unwind search paths and baseline authorization are deliberately not broadly refactored.

## Evidence

Runner: `scripts/test-warehouse-item-code-direct-migration.cjs`. Hardcoded disposable `wic_test_*` databases, loopback 127.0.0.1:55439, synthetic users; no application credentials/environment loading.

1. `node scripts/test-warehouse-item-code-direct-migration.cjs --baseline`: four expected failures against the deployed override migration: original PR1 unchanged, submitted owner PATCH allowed, warehouse copy PATCH allowed, RFQ history absent/changed. Runner exit 0 confirms those four expected RED failures, not feature success. Database `wic_test_direct_1791605591618`.
2. Additional regression caught silent history loss when RFQ PR1 association became null; reader fixed, regression passed.
3. Additional regression caught PR2 rewrite extending to non-Goods/Services PR1; trigger scope fixed, regression passed.
4. Final `node scripts/test-warehouse-item-code-direct-migration.cjs`: **33 passed, 0 failed, exit 0**, database `wic_test_direct_1791606095679`.

Coverage: same rows/unrelated fields; first/second/no-op/blank/stale saves; active roles/nulls; draft requester reset; notes/description writes; direct PATCH denial; non-forgeable permits; current-code reads; fresh PR2 codes and native exclusions; forced failure after PR1 write and after both writes; protected RFQ history, exact archives, missing lines and ambiguity; supplier assignment/owner/staff authorization; actual unwind/archive and reset bodies; grants/RLS/search paths; status/header/decision/deletion/reset boundaries in both ordered sessions; RFQ creation in both orders; concurrent save conflict; atomic migration refusal for events, contexts, mismatches and changed function bodies.

Final local database observations: deadlocks 0; remaining permits 0; obsolete contexts 0; obsolete snapshots 0.

`node --check` passed. `git diff --check` passed, with existing CRLF conversion warnings for `.gitignore` and `scripts/build_manual.py`. Package/lockfile diff empty. Tracked diff statistics unchanged from phase start (five pre-existing modified files); this phase adds the migration/runner/report and updates the fix plan only.

Final hosted read-only check: events/contexts/snapshots/mismatches 0/0/0/0; permit table absent, confirming the migration remains unpublished.

## Remaining work and limits

- Phase 3: one Code field and safe code-only React state merges. The displayed old separate-code UI is not fixed yet.
- Phase 4: full application/browser/JWT and workflow regression, full commit/rollback concurrency matrix, existing test adaptation, commercial fields and PO/quote sync checks.
- Phase 5: reviewed coordinated migration/frontend release and authorized hosted acceptance. Do not apply this migration alone to the old UI.
- Local fixture models targeted RLS, not all hosted policies, enum constraints or foreign keys. Hosted PostgreSQL is 17.6; local is 17.11. No hosted JWT impersonation/testing was performed. In particular, live RFQ's non-cascading FK to live PR2 can block baseline unwind with a linked RFQ; this phase does not change or claim to fix that unrelated behavior. Linked-archive reader tests are isolated historical-state tests, not proof that the live FK permits creating such links.
- No zero-bug guarantee. Baseline direct updates to unrelated fields/relationships are not a general RLS remediation target.

## Workflow sources

[Test-driven development](C:/Users/Rovick/.agents/skills/superpowers/test-driven-development/SKILL.md) required demonstrated RED failures before migration implementation. [Supabase](C:/Users/Rovick/.codex/plugins/cache/openai-curated-remote/supabase/1.0.0/skills/supabase/SKILL.md) and Postgres best-practice checks informed restricted grants, RLS, fixed search paths and local verification. Current [database-function documentation](https://supabase.com/docs/guides/database/functions) and [PostgreSQL function security](https://www.postgresql.org/docs/current/perm-functions.html) were consulted. Changelog markdown could not be fetched; the [HTML changelog](https://supabase.com/changelog) and relevant [17.11 release note](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) were reviewed instead. No extension or dependency upgrades were introduced.
