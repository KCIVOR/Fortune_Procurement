# Warehouse Item Code Editing Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task by task. Phase 0 blocks implementation until live verification passes. Do not delegate without user authorization. Revising this plan does not authorize implementation.

**Goal:** Allow warehouse staff to correct a submitted PR1 item code during active validation, preserve the original PR1, and propagate the correction consistently through procurement.

**Architecture:** Preserve original PR1 and existing validation snapshot codes. Store authoritative changes in a dedicated append-only correction table through a narrowly checked RPC. Snapshot corrections into new PR2 lines and overlay only proven feature corrections in associated RFQ readers.

**Tech Stack:** Next.js 13, React, TypeScript, Supabase/PostgreSQL RLS, SQL migrations, existing Node test conventions.

## Revision and evidence

Latest user-directed amendment (October 10, 2026): remove both rollout environment switches and apply the feature directly to the existing connected Supabase project. This supersedes earlier default-off/staging-first rollout instructions, but not role/lifecycle authorization, original-code preservation, surgical scope, or the prohibition on production test fixtures. The feature migration was applied through MCP as version `20261010034723`; the local migration filename and native runner were aligned with that deployed version. Warehouse code loading and exact-RFQ readers are always active; warehouse editing still requires active warehouse identity, eligible lifecycle, and no current PR2. Hosted user acceptance remains unverified, not silently counted as passed. See the activation report.

Revised October 10, 2026 after plan validation. Supersedes the original design. Baseline inspected: main, 91fd9f4. Project: emddvbocupvufzvhcacz (Fortune Procurement). Recheck before implementation.

Live SQL access is restored and verified on October 10, 2026. Policies, grants, constraints, functions, and migration history were inspected. No existing noninternal triggers were found on the inspected workflow tables. PR2/archive buyer-assignment drift was repaired separately and column/type parity verified. These catalog checks are not authenticated warehouse write tests. See the companion readiness report for results and remaining execution gates.

This document is a phased design, not executable migration SQL. Phase 0 must finalize exact SQL and prove compatibility before application implementation.

| Identified risk | Correction |
| --- | --- |
| Requestor cannot read admin-only audit logs | Defer requestor history screen; preserve audit SELECT rules |
| Authenticated users can fabricate general audit entries | Dedicated correction store denies client writes; general audit entries never establish provenance |
| Locks unspecified across direct PATCH, RPC, and submit | Code RPC writes only the new table; lifecycle writers share a per-PR1 transaction advisory lock |
| Broad PR2 guard could change old workflows | Guard modifies only the code of lines with proven feature corrections; otherwise returns the insert unchanged |
| Blanket RFQ overlay changes historical outputs | Overlay only corrected linked lines with trusted provenance; all other readers retain existing behavior |
| Pure helper imports browser client | Separate pure helper and database wrapper files from the outset |

## Product contract and scope

- Include Goods/Services PR1s routed to warehouse. Exclude Planning-direct PR2 and raw-material workflows.
- Require authenticated active warehouse role, PR1 status approved_for_warehouse, undecided validation, and no current PR2 header. Admin route bypass grants no edit authority.
- Preserve original PR1 code and seeded validation snapshot. Display “Requestor code” plus an effective “Warehouse item code.”
- Use a small Edit code / Save code / Cancel interaction. This is the proposed save behavior supporting this feature, not a redesign of Save Progress. Disable conflicting actions only while a code edit is dirty/pending.
- Normalize surrounding ASCII spaces consistently with PostgreSQL btrim; preserve zeros, case, punctuation, and internal spaces. Reject null. Permit intentional empty correction. No new uniqueness rule or arbitrary length restriction.
- No-op saves create no event. Effective code is latest trusted correction for current validation/item, otherwise original PR1 code. Empty correction never triggers fallback.
- A current PR2, including an orphan draft, blocks edits. Do not repair orphan documents or rewrite existing PR2s during retry.
- Reset/unwind retains existing behavior. New validation ID starts clean; durable records retain previous corrections.
- Original PR1 display/print stays original. New PR2, associated RFQ, and PO use procurement snapshots.
- Requestor history UI, notifications, mandatory reasons, bulk editing, code generation, catalog lookup, and historical backfills are deferred.

## Surgical constraints

1. No warehouse UPDATE grant on original PR1 items; no mutation of submitted PR1 codes.
2. No changes to quantities, SOH, routing, descriptions, prices/VAT, approvals, numbering, attachments, or supplier selections.
3. Match immutable item IDs, never codes, descriptions, or row order.
4. No general audit-log policy changes or reliance on client-inserted audit events.
5. No columns added to PR2/live archive tables; preserve archive parity and existing unwind inserts.
6. No package/lockfile changes, broad refactors, unrelated security remediation, cleanup, deletion, or historical backfill.
7. Privileged helpers require explicit identity/authorization checks, fixed search paths, schema-qualified objects, and restricted EXECUTE. No service secrets in browser code.
8. No global/table-wide lock or lock spanning browser requests. Use one PR1 and one database transaction.
9. Client flags, custom session settings, supplied actor IDs, or trigger depth cannot prove trusted origin.
10. Preserve unrelated user files. Any additional object/file requires documented feature dependency and plan amendment.

## Allowlist

Paths are relative to C:/Users/Rovick/Desktop/project.

| File/object | Responsibility |
| --- | --- |
| One CLI-generated supabase/migrations/ file | Correction table, mandatory provenance mapping, RLS/grants, checked RPCs, narrow serialization/snapshot triggers |
| lib/warehouse-item-code.ts (new) | Dependency-free effective-code/normalization helpers |
| lib/warehouse-item-code-data.ts (new) | Authenticated RPC wrappers |
| lib/warehouse-item-code.test.ts (new) | Pure behavior tests |
| types/warehouse.ts; affected portions of types/database.ts | Feature types only |
| app/warehouse/[id]/page.tsx | Inline editor and pending-state coordination |
| lib/pr2-warehouse.ts | Preserve existing generation sequence; no extra fetch after header creation |
| lib/canvassing.ts; types/canvassing.ts if needed | Corrected-line overlays only |
| scripts/test-warehouse-item-code-integration.cjs (new) | Isolated behavioral/security tests |
| scripts/test-warehouse-item-code-postgres.cjs; scripts/test-warehouse-item-code-jwt.cjs; scripts/test-warehouse-item-code-*.sql (new) | Native disposable PostgreSQL/JWT test runner, synthetic schema and regressions |
| .gitignore (one feature-specific entry) | Exclude downloaded test runtimes and disposable clusters under scratch/warehouse-item-code-db/ |
| This plan and feature verification report | Gate evidence and results |

Permitted new database tables: warehouse_item_code_corrections, warehouse_item_code_pr2_context, warehouse_item_code_pr2_snapshots. Permitted database trigger targets: correction store, PR1 status transitions, validation decision transitions/deletion, PR2 header INSERT, and PR2 item INSERT. Inventory existing triggers; never replace their definitions.

Inspection/regression only: lib/warehouse.ts, lib/pr2-rfq-sync.ts, lib/po.ts, PR1 screens/print, routes/middleware, reset/unwind, general audit policies, supplier readers. Amend the allowlist before editing another direct consumer.

## Phase 0 — Live audit and exact database design

**Gate: No implementation based on presumed deployed permissions or unproved locking behavior.**

- [x] Restore authenticated read-only SQL access to the existing project; do not create/rebind projects.
- [ ] Inspect pg_policies, RLS flags, table/column/inherited privileges, constraints, trigger definitions and bodies, function EXECUTE grants, and migration versions for PR1, validation, PR2, profiles/roles, and audit objects.
- [ ] Inspect is_role, can_read_pr1, can_read_warehouse_validation, reset_warehouse_validation_on_pr1_resubmit, unwind_pr2_to_warehouse, and is_supplier_assigned_to_pr2.
- [ ] Confirm active-user semantics and every trigger's lock graph. Record exact deployed object names and sanitized definitions.
- [x] Inventory PR1-linked readers and their downstream display/approval/print/email consumers. See companion readiness report. Requestor substitute views must retain existing document-scoped access.
- [x] Record baseline npm run typecheck, npm run lint, npm run build outcomes without unrelated fixes. See companion readiness report; lint has a baseline environment failure.
- [ ] Resolve public-client authentication setup separately before UAT. Confirm an authorized isolated write-test target; never create production fixtures.
- [ ] Finalize exact migration SQL, RPC types/grants, advisory-lock key function, transition trigger conditions, and provenance mapping before migration authoring.
- [ ] If existing triggers acquire conflicting locks, revise this protocol with evidence; do not claim concurrency safety from the design alone.

Read-only discovery commands:

```powershell
rg -n 'item_code|buildRfqLineItems|pr1_items|pr2_items' lib app components types
git status --short
git rev-parse HEAD
```

```sql
select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname='public'
and tablename in ('pr1_requests','pr1_items','warehouse_validations',
'warehouse_validation_items','pr2_requests','pr2_items','audit_logs')
order by tablename,cmd,policyname;

select c.relname,pg_get_triggerdef(t.oid),pg_get_functiondef(t.tgfoid)
from pg_trigger t join pg_class c on c.oid=t.tgrelid
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and not t.tgisinternal
and c.relname in ('pr1_requests','warehouse_validations',
'warehouse_validation_items','pr2_requests','pr2_items');

select version,name from supabase_migrations.schema_migrations order by version;
```

**Exit:** Verified permissions, exact consumer inventory, reviewed SQL, isolated test target, and a concrete provenance/lock design.

## Phase 1 — Trusted correction storage and enforcement

October 10 execution update: user explicitly authorized working on main. Phase 1 implementation is verified locally using portable PostgreSQL 17.11 and PostgREST 16.4 with signed synthetic JWTs, database roles, actual reset/unwind functions, and 17 two-session concurrency cases. Migration is NOT deployed to production. Native fixtures are not a complete hosted-Supabase schema clone; hosted Auth/browser UAT remains a release check. See 2026-10-10-warehouse-item-code-phase1.md.

- [x] Discover supabase migration new --help; run supabase migration new warehouse_item_code_corrections. Use generated filename; do not edit old migrations.
- [x] Create warehouse_item_code_corrections: identity bigint primary key; PR1/validation/validation-item/PR1-item UUID references as durable event IDs; original_pr1_code, previous_code, new_code; database-derived actor_id/name snapshot; created_at. Require code strings and relationship IDs. Index (validation_id,pr1_item_id,id desc) and (pr1_id,id desc).
- [x] Do not add cascading foreign keys to ephemeral workflow rows or retention constraints that block existing reset/deletion. Validate relationships when writing.
- [x] Enable RLS; revoke direct table/sequence writes from PUBLIC, anon, authenticated. Permit authenticated SELECT through admin-only RLS. No direct client INSERT/UPDATE/DELETE. General audit log is not authoritative and needs no feature entry.
- [x] Define SECURITY DEFINER update_warehouse_item_code(p_validation_item_id uuid,p_expected_code text,p_new_code text). Return persisted validation/item IDs, effective_code, correction_id, changed_at, and changed_by_name.
- [x] Restrict EXECUTE to authenticated; explicitly validate active warehouse identity. Fixed search path/schema-qualified SQL. Privilege elevation only enables checked writes to the new client-inaccessible store, never broad workflow updates.
- [x] Resolve parent PR1, take its advisory transaction lock, then re-read eligibility and relationships in fresh READ COMMITTED statements. Reject stale/missing/replaced validation, wrong ownership, null, non-warehouse stage, decided validation, or any current PR2.
- [x] Compare expected effective code, normalize new code, return persisted state for no-op, otherwise append exactly one event. RPC does not UPDATE or row-lock PR1/validation/items.
- [x] Define checked get_warehouse_item_codes(p_validation_id uuid) for active warehouse/admin read access. Return current effective values/metadata for the existing validation only. Permission failures are errors, not successful empty maps.

### Exact transaction protocol to prove

Use the same deterministic signed-bigint key derived from a fixed feature namespace plus PR1 UUID in every participating function; pg_advisory_xact_lock only. Hash collisions may serialize unrelated requests but cannot grant access.

1. Code RPC acquires advisory lock, rechecks state, and appends correction. It does not acquire workflow-row locks or write those rows.
2. BEFORE ROW PR1 status-change and validation decision-change triggers acquire the same lock when eligibility can change. Those writers may already hold their own row lock; code RPC must not wait on that row lock. Post-lock state checks use fresh SQL snapshots.
3. Validation DELETE acquires that lock, serializing reset against new corrections. History remains; new validation IDs do not inherit events.
4. PR2-header BEFORE INSERT with a PR1 link acquires the same lock. Header commit prevents subsequent edits; header rollback restores eligibility. The lock ends with the database request, not after later browser calls.
5. PR2-item BEFORE INSERT overrides only item_code when an authoritative correction matches that parent PR1 and current validation/item. No correction means return NEW unchanged; no validation is required for uncorrected legacy insert paths. PR2-native rows return immediately.
6. Read enforcement must see all relevant PR2 headers regardless of caller RLS. Use a tightly checked enforcement helper, not a broad client SELECT grant.
7. Prove both orders for code-save versus header creation, full-internal resolution, reject/revision, and reset. Test waits, rollback, stale snapshots, and deadlocks in two independent database sessions.
8. Do not rewrite quantity locking, multi-request submission atomicity, or orphan recovery. If this protocol requires such changes to be safe, pause dependent work and amend the plan.

**Security tests:** active warehouse allowed; every other save role/inactive user denied; direct correction-store writes/sequence use denied; forged audit-log events ignored; seeded validation PATCH cannot establish a correction; stale/no-op/blank behavior correct; deleted/wrong validation rejected; existing PR2 denied; concurrent boundary behavior ordered; rollback leaves no event; reset/unwind and unchanged old clients still work.

**Gate:** Passed locally: signed JWT API and restricted database-role tests, plus two-session concurrency. This is neither a source-regex nor service-role-only check. Hosted Supabase Auth/browser UAT remains in Phase 5; no production deployment implied.

## Phase 2 — Helpers and data wrappers

- [x] Keep pure resolver in lib/warehouse-item-code.ts; only checked RPC/database output supplies correction data:

```ts
export function resolveWarehouseItemCode(
  originalCode: string,
  correction: { new_code: string } | null,
): string {
  return correction === null ? originalCode : correction.new_code;
}
```

- [x] Test original fallback, intentional blank, formatting/zeros, per-item isolation, and latest-event selection.
- [x] Place browser imports only in lib/warehouse-item-code-data.ts. Throw on denied/error/missing persisted responses; never claim success from attempted input.
- [x] Compile/run tests without new packages:

```powershell
node node_modules/typescript/bin/tsc lib/warehouse-item-code.ts lib/warehouse-item-code.test.ts --module commonjs --target es2020 --moduleResolution node --esModuleInterop --skipLibCheck --outDir scratch/warehouse-item-code-tests
node --test scratch/warehouse-item-code-tests/warehouse-item-code.test.js
```

**Gate:** Blank/formatting semantics pass; pure tests need no browser credentials.

Phase 2 completed locally on 2026-10-10. Added feature-scoped `scripts/test-warehouse-item-code-data.cjs` to the test allowlist to verify the RPC boundary without credentials; it transpiles the wrapper in memory and mocks only its transport. Four pure tests and three RPC-boundary tests pass, as does `npm run typecheck`. See `2026-10-10-warehouse-item-code-phase2.md`. No UI or live database changes in this phase.

## Phase 3 — Warehouse editor only

Execution scope clarification: add `scripts/test-warehouse-item-code-editor.cjs` for real React/browser tests of the existing page using synthetic data and mocked network boundaries, with no new packages. Build-time `NEXT_PUBLIC_WAREHOUSE_ITEM_CODE_EDITING_ENABLED=true` enables the editor and its required readers; `NEXT_PUBLIC_WAREHOUSE_ITEM_CODE_READS_ENABLED=true` enables readers independently. Both default off to preserve the existing page until database/downstream release gates pass. Rollback disables editing while retaining reads; never disable corrected-code readers after real corrections exist. These are rollout switches, not database authorization. Current-PR2 UI checks use existing authenticated SELECT privileges; the save RPC remains authoritative against every header regardless of caller RLS. No grant expansion.

- [x] Load authoritative effective values alongside existing validation. Show original PR1 code separately. Do not silently submit stale codes if correction loading fails.
- [x] Save with expected persisted effective code; cancel makes no request. Update only correction/editor fields on response, preserving dirty SOH/quantity/notes.
- [x] Gate controls by role/lifecycle/current PR2. Disable conflicting actions only during dirty/pending edit; release guards after save/error/cancel.
- [x] Show success only after persisted response. On conflict preserve attempted text, explain stale state, and reload before retry.
- [x] Completed warehouse views display corrected code read-only through checked read RPC. No requestor history section or new general history screen.
- [x] Verify keyboard/narrow viewport/long code/error/save/reload/cancel behavior; no table redesign.

**Gate:** Editor works with no extra role privileges or loss of other form inputs.

Phase 3 passed local verification on 2026-10-10: 10 synthetic browser scenarios (11 node:test results including the parent), 15 helper/RPC/existing-remarks tests, focused ESLint, typecheck, and production build. Browser tests render the actual page with real React/Chromium and application CSS, substituting authentication/data and unrelated shell components. This is not hosted Auth/browser UAT. Failed/ambiguous saves release the pending guard but retain the dirty guard until cancel; cancelling releases dirty guards while submission still requires a successful persisted-code reload. See `2026-10-10-warehouse-item-code-phase3.md`. Rollout switches remain default off; no production migration or UI release occurred.

## Phase 4 — Proven procurement snapshots

Execution scope: complete the still-unpublished, CLI-generated feature migration with the checked RFQ read RPC; no production DDL in this phase. Add `scripts/test-warehouse-item-code-rfq.sql` and `scripts/test-warehouse-item-code-consumers.cjs` to the feature test allowlist. Reuse the independent reader rollout switch from Phase 3 (editing implies reading); default off preserves baseline until release. RFQ read authorization must match audited RFQ role/ownership/assignment policies and, for staff, existing PR1 document access. Admin has no blanket RFQ SELECT policy in the inspected catalog; do not invent an admin bypass. The RPC returns only two code fields, not general history or commercial data.

- [x] Keep the browser PR2 generation sequence unchanged: do not add a code-fetch request after header INSERT. The PR2 item BEFORE INSERT trigger obtains the effective correction from the authoritative store and sets NEW.item_code. A paired AFTER INSERT trigger writes provenance in the same item-insert transaction. If either trigger fails, the item batch rolls back. No new browser-fetch failure boundary is introduced. Existing multi-request orphan behavior remains an explicitly documented baseline issue, not feature repair scope.
- [x] Create mandatory warehouse_item_code_pr2_snapshots mapping with primary key pr2_item_id, required pr2_id, pr1_item_id, validation_id, correction_id, item_code, and created_at. correction_id references the durable correction table; workflow IDs are historical UUID values without cascading or retention-blocking foreign keys. Deny direct client writes. BEFORE INSERT resolves correction under the PR1 advisory lock; AFTER INSERT independently verifies the resolved correction and writes mapping atomically. Never infer association from equal code text or timestamps alone. Reject corrected-line insertion when the PR2 belongs to a different current validation lifecycle; persist header-to-validation association in a dedicated warehouse_item_code_pr2_context table at header INSERT (pr2_id primary key, pr1_id, validation_id). This context is mandatory only for feature-corrected documents; do not change uncorrected legacy inserts. Preserve context and mappings on archive/reset.
- [x] Define get_rfq_warehouse_item_code_snapshots(p_rfq_id uuid) returning only corrected (pr1_item_id,item_code) for that exact RFQ's linked PR2 and trusted mapping. Validate active identity and RFQ/PR2/PR1 relationships. Suppliers require assignment to that exact RFQ; staff require existing document/role access; the owning requestor may read codes for their existing substitute-review document. This is not a new history screen. Use rfq_batches.pr2_id as the association, never an arbitrary current PR2 with the same PR1. For archived linked PR2, require matching archive header and retained context/mapping. Restrict EXECUTE and expose no commercial/general-history fields.
- [x] Overlay only returned corrected lines in every inventoried PR1-linked reader. No map entry preserves current reader value; returned empty code stays empty. No blanket historical PR2 overlay.
- [x] Denied reads produce errors, not silent original-code fallbacks. PR2-native paths, quantities, attachments, pricing, and selection remain unchanged.
- [x] Verify quote sync preserves PR2 code and PO inherits it. No commercial-sync/PO edits expected.
- [x] Check archived PR2 retains stored code; mapping/history survives without influencing new validation IDs.

**Gate:** Corrected warehouse/PR2/RFQ/supplier/print/export/PO agree; original PR1 and all uncorrected historical outputs remain unchanged.

Phase 4 completed locally on 2026-10-10. Six helper tests, four wrapper tests, seven actual-consumer/sync/PO tests and seven existing warehouse-remarks tests pass (24 total); the editor suite passes 11 results including its parent. Native PostgreSQL SQL/JWT tests and all 17 concurrency cases pass. Build, typecheck, focused ESLint, and diff checks pass. Live read-only catalog verification still shows no feature correction table or RFQ reader deployed. Full hosted Auth/browser UAT and release remain Phase 5 gates. See `2026-10-10-warehouse-item-code-phase4.md`.

## Phase 5 — Verification and release

- [x] Isolated integration harness refuses production writes, uses explicit target allowlist/fixture IDs, and prints no credentials.
- [x] Run role/state/direct-write matrix, both-order concurrency tests, internal resolution, terminal actions, duplicate/blank codes, goods/services/PR2-native, reset/unwind, retries, and old-client no-correction paths. Local synthetic evidence only; hosted UAT remains outstanding.
- [x] Run npm run typecheck, npm run lint, npm run build and focused tests. Disclose baseline failures; fix only feature-induced failures.
- [x] Reinspect grants/functions/triggers and relevant security advisors. Check git diff --check, git diff --stat, git status --short against the allowlist. Actual feature catalog inspected locally; live catalog/advisors inspected read-only. Postdeployment inspection remains required.
- [ ] Deploy compatible database objects first; keep editor unavailable until consumers/read permissions pass. Old clients' unrelated writes must remain valid.
- [x] Rollback editing first while retaining correction records/mappings/snapshots and compatible readers/guards. Never restore a generator that discards recorded corrections; temporarily disable affected submission if compatibility cannot be retained. Procedure documented and read-only rollback behavior tested locally; no deployed rollback performed.
- [x] No destructive history removal, document rewriting, or protection removal during automatic rollback. Record exact new objects and reverse dependencies for separately reviewed removal.

Phase 5 local checks completed October 10, 2026; release remains incomplete. See `2026-10-10-warehouse-item-code-phase5.md` for fresh evidence, the CSS-prerequisite test adjustment, compatible rollout/rollback, and missing hosted target/Auth/browser UAT. No feature migration or application deployment was performed. Production fixture writes and billable branch creation remain prohibited without further authority.

**Release gate:** Live authorization, unforgeable provenance, boundary/concurrency behavior, unchanged-workflow regression, procurement consistency, and restricted diff are proven. No zero-bug guarantee replaces test evidence.

## Required report and unresolved gates

Report exact live definitions/grants, finalized SQL/object names, consumer inventory, checked-reader authorization, transaction/deadlock outcomes, provenance mapping, commands/results, screenshots, baseline failures, and rollback compatibility.

Live catalog access and existing-trigger inventory are verified. Provenance storage is mandatory and the extra post-header code fetch is removed. Phase 1 SQL now compiles and passes isolated signed-JWT/database-role, actual reset/archive, provenance, and concurrency tests. Production release remains gated on downstream consumer compatibility and hosted/browser UAT; Phase 2 may proceed.

Creating/revising this document completes the current request only. Application/database implementation requires a subsequent instruction.
