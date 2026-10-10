# Phase 1 implementation checkpoint

October 10, 2026. Branch: main, explicitly authorized by user. Current status: Phase 1 database implementation verified locally; NOT deployed to production. The draft checkpoint below is retained as history; the final verification section supersedes its environment/testing limitations.

## Files

- supabase/migrations/20261010023203_warehouse_item_code_corrections.sql (CLI-generated filename).
- scripts/test-warehouse-item-code-integration.cjs.
- Plan execution note and this report. No application code, original migration, dependency, or lockfile changes.

## Candidate behavior

- Three RLS-protected tables: corrections, PR2 context, PR2 item snapshots. Authenticated table reads are admin-only; direct anon/authenticated table and identity-sequence writes are revoked.
- update_warehouse_item_code(uuid,text,text) checks authenticated active warehouse identity, parent/item relationships, goods/services, current warehouse stage, undecided validation, any current PR2, expected effective code, null rejection and ASCII-space normalization. Actor comes from auth.uid()/profiles. It appends history only and never updates original PR1 or seeded validation code.
- get_warehouse_item_codes(uuid) permits active warehouse/admin reads and returns original/effective code plus correction metadata. Correction IDs are returned as text to avoid JavaScript bigint precision loss.
- Internal helpers have fixed empty search paths and no PUBLIC/anon/authenticated EXECUTE. Public RPC EXECUTE is granted only to authenticated, with explicit internal identity checks.
- One deterministic advisory transaction lock per PR1 serializes correction saves against status changes, validation decisions/deletion, PR2 header and corrected-item insert. Non-READ-COMMITTED writes fail rather than claim safe snapshot behavior.
- Header context is recorded only when the current validation has feature history. BEFORE item INSERT resolves corrected code; AFTER INSERT stores mapping in the same transaction. Uncorrected/no-context paths return unchanged. Historical workflow IDs have no cascading/retention-blocking foreign keys; snapshot correction FK references durable history.
- RFQ reader RPC and browser/UI changes remain later phases. Therefore this candidate must not expose correction saving on production before downstream compatibility is ready.

## Checks actually performed

- Supabase MCP read-only live schema query confirmed required UUID/text/boolean columns and missing feature RPCs. No production write or DDL executed for this feature.
- Consulted current Supabase database-function docs for fixed search path, SECURITY DEFINER and explicit EXECUTE revocation. Changelog markdown fetch failed due unsupported web content type; not represented as verified.
- Integration harness initial run failed at its isolated-target guard before making requests; this is an environment failure, NOT a behavioral red test proving the implementation.
- Harness safety-only run: 3 passed, 2 database-dependent tests skipped. Covers production refusal even if allowlisted, unconfigured-target refusal, and explicit local-target acceptance.
- node --check passes. SQL has been source-reviewed, but PostgreSQL compilation/execution has NOT been verified. A TypeScript check does not validate SQL.
- npm run typecheck: exit 0. git diff --check: exit 0. Existing unrelated scripts/build_manual.py change remains untouched.
- Initial behavioral suite covers authorized correction/reload/no-op/stale/blank/null, direct history insertion denial, non-warehouse/inactive save denial, original PR1 preservation. Synthetic fixture IDs and tokens must be supplied explicitly. Additional lifecycle, provenance, reset/archive, rollback and two-session concurrency tests remain required.

## Run commands

Harness safety only (no network):

```powershell
$env:WIC_TEST_SAFETY_ONLY='1'
node --test scripts/test-warehouse-item-code-integration.cjs
```

Isolated integration execution: configure WIC_TEST_URL, WIC_TEST_ALLOWED_HOSTS, WIC_TEST_ANON_KEY and WIC_TEST_FIXTURES; unset WIC_TEST_SAFETY_ONLY. Fixture JSON requires validationId, validationItemId, pr1ItemId, pr1Id, warehouseId, warehouseToken, and deniedTokens (non-warehouse and inactive synthetic users). Do not use real user credentials or production fixtures. Apply candidate only to a disposable schema-compatible test database before running.

## Remaining gate

No isolated database available: Docker engine unavailable and no Supabase development branch. PostgreSQL syntax compilation, authenticated role/lifecycle tests, trigger compatibility and two-session lock/rollback/deadlock tests are unverified. No production apply_migration call was made. Do not mark Phase 1 complete or deploy this candidate until these checks pass.

## Final verification — supersedes draft checkpoint above

The isolated-environment blocker was resolved without Docker, system reinstall, paid cloud branches, or production fixtures. Downloaded official portable PostgreSQL 17.11 from EDB and PostgREST 16.4 from the official PostgREST GitHub release. Both run on loopback only, with disposable synthetic databases under scratch/warehouse-item-code-db/. A feature-specific .gitignore entry excludes these runtime binaries, data and logs; project dependencies/lockfiles are unchanged.

### Reproducible tests

Run node scripts/test-warehouse-item-code-postgres.cjs with the portable runtimes available and the scratch PostgreSQL cluster running on 127.0.0.1:55439, superuser wic_test_owner. Each execution creates a new database named wic_test_<timestamp>; never reads application .env or connects to a production hostname. PostgREST is spawned on 127.0.0.1:55440 with a random temporary JWT secret and stopped by the runner. PostgreSQL cluster is stopped after verification.

Test files: test-warehouse-item-code-fixture.sql, test-warehouse-item-code-archive-fixture.sql, test-warehouse-item-code-behavior.sql, test-warehouse-item-code-archive.sql, test-warehouse-item-code-extra.sql, test-warehouse-item-code-postgres.cjs, and test-warehouse-item-code-jwt.cjs under scripts/.

### Final results

Final native run: exit 0, database wic_test_1791600693685.

- Before migration, actual RPC call rejected with missing-function SQLSTATE 42883; migration then compiled and executed successfully.
- Database-role suite passed: original fallback; normalization/zeros/case/punctuation/internal spaces; reload; no-op; stale expected-code rejection; blank/null; authorization across all six denied identities; anonymous restrictions; direct insert/update/delete/sequence/helper denial; admin-only history; actor provenance; stage/decision/raw-material/current-draft/wrong-parent/missing-item rejection; reset/replacement and rollback.
- Actual existing reset RPC and patched unwind RPC passed, without rewriting their business rules. Both terminal and nonterminal unwind paths preserve corrected archived codes and buyer assignment; context/history/snapshots survive deletion; original routing and validation-retention behavior remain intact.
- Extra suite passed: all three RLS flags, restricted EXECUTE and mapping/context writes; forged seeded PATCH and general audit entry ignored; services; duplicate item codes; initial no-op; stale lifecycle insertion rejection; failed item batch rolls back both items and mappings; legacy and PR2-native paths unchanged.
- Local PostgREST signed-JWT suite passed: warehouse API save/read/no-op/stale/blank; admin/employee/procurement/approver/supplier/inactive denied; anonymous and invalid JWT denied; history RLS and direct-write denial; original PR1 code unchanged. This tests genuine gateway JWT validation and database identity claims, not hosted Supabase Auth sign-in/session issuance.
- 16 two-session boundary cases passed: header/status/decision/reset, both orderings, first-writer commit and rollback. One additional simultaneous-save case passed: exactly one event, stale second writer rejected. No deadlocks/timeouts in tested cases.

### Limits and release separation

Native fixtures model the workflow dependencies and use live-catalog PR2 column names/types, but do not clone every deployed constraint, policy, Auth service, or extension. Full hosted-Supabase/browser UAT and downstream RFQ/UI compatibility remain release gates in later phases. Native PostgreSQL is 17.11 versus audited hosted 17.6. No production feature tables/RPCs/triggers were created; the migration exists locally and was applied only to disposable databases. Phase 1 is complete as a locally verified implementation, not a production release.

Sources: https://www.postgresql.org/download/windows/, https://www.enterprisedb.com/download-postgresql-binaries, https://github.com/PostgREST/postgrest/releases/tag/v16.4.
