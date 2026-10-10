# Phase 5 — Final verification and release gate

October 10, 2026, Asia/Manila. Local verification completed on main; **production release is not completed**. No migration, push, deployment, environment modification, or production fixture writes occurred in this phase.

## Fresh verification

- Standalone TypeScript compilation of feature helpers/tests and existing remarks tests: exit 0.
- Helper, wrapper, actual consumer/sync/PO and existing remarks tests: 24 passed, 0 failed.
- Integration harness safety-only mode: 3 passed; 2 hosted integration tests explicitly skipped, not counted as passed. The harness refuses the production hostname even when allowlisted, requires an explicit isolated hostname, and uses nominated synthetic fixture IDs. It never loads production .env files. Native tests hardcode loopback ports, generate disposable database names, and use synthetic identity IDs and short-lived randomly signed JWTs without printing credentials.
- Native PostgreSQL runner: exit 0, disposable database `wic_test_1791603235057`. Role/state/direct-write, blank/no-op/stale/retry, goods/services/native/legacy, actual internal reset/unwind/archive, provenance, batch rollback, signed JWT save/read/RFQ authorization, and all 17 two-session concurrency cases passed.
- `npm run build`: exit 0, 72 static pages; existing Browserslist, Supabase dynamic dependency and client-rendering warnings remain.
- `npm run typecheck`, after build: exit 0.
- Focused ESLint on the warehouse page, canvassing, pure helper and data wrapper: exit 0.
- `npm run lint`: baseline Next dependency-detection failure recurred and initiated an unwanted dependency install. The attempt was interrupted; `git diff --exit-code -- package.json package-lock.json` confirmed no package or lockfile changes. No dependency upgrade is included.
- Browser suite, after build and after the test prerequisite adjustment: 11 passed results including parent (10 scenarios), 0 failed.
- `git diff --check`: exit 0, existing LF/CRLF notices only. Scope review preserved unrelated manual/audit files; generator, sync, PO and package files remain unchanged.

The initial browser run overlapped `next build`, which replaces `.next/static/css`. Its narrow-screen assertion failed while the harness silently allowed missing styles. The same application passed after the completed build. The feature-scoped test now requires and snapshots production CSS once at startup rather than silently running unstyled. No application behavior changed in Phase 5. Run build and browser verification sequentially.

## Actual local database catalog

Reinspected the freshly migrated disposable database, not just SQL text:

- All three feature tables have RLS enabled. Anonymous SELECT and authenticated INSERT are denied. The SQL/JWT suite also exercises direct-write and sequence denial.
- Only the three checked RPCs permit authenticated EXECUTE; every feature function denies anonymous EXECUTE, and all internal functions deny authenticated EXECUTE.
- All eight functions have fixed empty search paths. `wic_lock_pr1` is invoker; the remaining seven are checked RPCs or restricted definer trigger helpers.
- All six triggers are enabled: `wic_pr1_status`, `wic_validation_decision`, `wic_validation_delete`, `wic_pr2_context`, `wic_pr2_code`, `wic_pr2_snapshot`.
- Migration SHA256: `8C23DAF1FA84ADCB0E13893FFB46122F1C1FC304BA7D830E2DFD48C5DE336CEE`.

Supabase MCP read-only verification works. Production is PostgreSQL 17.6; no feature table/RFQ reader or existing noninternal triggers on the inspected workflow tables were present. `list_branches` returned an empty list. No authorized hosted isolated target or hosted synthetic Auth fixture sessions were supplied. An unrelated accessible project is not a test target.

Security advisors still report the recorded baseline: 1 RLS-without-policy info, 8 mutable-search-path warnings, 36 anonymous and 36 authenticated executable-definer warnings, and leaked-password protection disabled. These were not expanded or repaired. See [function security guidance](https://supabase.com/docs/guides/database/functions), [executable-definer guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), and [password guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The changelog markdown endpoint was attempted but the web reader rejected its content type; no SDK/API upgrade is involved.

## Controlled release procedure — not executed

1. Use an explicitly authorized hosted staging/branch with synthetic warehouse, procurement, requestor, assigned/unassigned supplier, approver, admin, and inactive accounts. Do not clone personal production data or create production fixtures. Review the complete feature diff; independent reviewer delegation remains subject to the plan's user-authorization constraint.
2. Apply the exact tested migration to that isolated target. Inspect actual RLS/grants/search paths/triggers, then run authenticated hosted API and browser/document UAT: original PR1 remains original; eligible warehouse save/cancel/stale/blank works; dirty non-code fields survive; terminal actions and internal resolution remain valid; PR2/RFQ/supplier/substitute/print/PO codes agree; archive/reset and native/uncorrected history remain unchanged.
3. After hosted UAT passes, apply compatible database objects to the verified production project through migration tooling, before application activation. Recheck migration history, all new grants/functions/triggers and security advisors. Do not use the synthetic test runner against production.
4. Deploy the compatible application with editing off and `NEXT_PUBLIC_WAREHOUSE_ITEM_CODE_READS_ENABLED=true`; verify existing document reads with authorized sessions. These are build-time public flags and require rebuilding/redeploying. Hosting configuration identifies Netlify, but no authorized deployment session/site target was provided here.
5. Only after reader permissions and hosted checks pass, rebuild/deploy with `NEXT_PUBLIC_WAREHOUSE_ITEM_CODE_EDITING_ENABLED=true` while retaining reads. Confirm role/lifecycle gating and observe authorized normal usage; no production fixture creation.

## Compatible rollback and removal dependencies

Rollback editing first: set editing false, keep reads true, rebuild/redeploy the same compatible application. The browser regression exercises read-only corrected-code behavior. Retain the migration, code readers, serialization and snapshot triggers, correction events, context and mappings. Do not restore an old generator/reader that discards existing corrections. If compatibility cannot be retained, stop affected submissions instead of dropping protections.

Exact dependency inventory for a separate, explicitly reviewed removal proposal (not an automatic rollback script):

- `wic_pr1_status` calls `wic_serialize_pr1_status` on PR1 status changes; validation decision/delete triggers call `wic_serialize_validation`.
- `wic_pr2_context` calls `wic_capture_pr2_context`; PR2 item before/after triggers call `wic_snapshot_pr2_code`.
- Trigger helpers and save RPC use `wic_lock_pr1`. Snapshot helper reads context/events and inserts mappings.
- Both checked readers depend on durable events; the RFQ reader additionally depends on context/mappings and linked live/archive documents.
- `warehouse_item_code_pr2_snapshots.correction_id` references correction events. No durable table has a cascading workflow foreign key. Archive/reset deliberately retain these records.
- Browser warehouse state/save wrapper depends on the warehouse RPCs; the four PR1-linked procurement readers depend on the RFQ RPC. Preserve their compatible versions after any correction exists.

No DROP, history deletion, document rewriting, protection removal, or destructive rollback was performed.

## Remaining blocker

Local verification is complete, but hosted Auth/browser/rendered-document UAT and production deployment/activation are unverified. Required next input: the authorized isolated Supabase staging/branch target with synthetic test sessions and a staging/deployment URL. Creating a billable branch, inventing accounts, seeding production, or marking skipped hosted tests successful is outside this phase's safe authority. Phase 5 must remain incomplete until these release gates pass.
