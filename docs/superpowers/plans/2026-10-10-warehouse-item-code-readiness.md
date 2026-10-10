# Warehouse item-code readiness verification

Verified October 10, 2026. Scope: audit and plan corrections only; no feature implementation or production fixture writes.

## Live database evidence

Project emddvbocupvufzvhcacz, Fortune Procurement. Supabase MCP SQL access works. Earlier unavailable-access wording is obsolete.

- Inspected policies, grants, RLS, constraints, helper definitions, and migration history in the prior live audit; rechecked workflow policies and PR2 constraints during this readiness pass.
- PR2 requests and archive column/type parity passes after the separate buyer-assignment repair. The unwind function includes the four assignment fields in INSERT and SELECT.
- No noninternal triggers were found on inspected PR1, validation, or PR2 workflow tables. This is an inventory result, not proof of a proposed lock protocol.
- Existing policies do not implement active-user/lifecycle checks needed by this feature. Correction RPC must explicitly check profiles.active and warehouse role. Preserve existing policies; do not widen them.
- General audit INSERT permits authenticated clients; it cannot prove correction provenance.
- No existing feature correction/context/snapshot tables exist. PR2 has no validation provenance and no unique pr1_id constraint. Do not infer one-PR2 uniqueness from a browser maybeSingle call.

## Final design decisions

1. Mandatory append-only correction table; no original PR1 or seeded-validation code mutation.
2. Mandatory PR2 context table records validation identity at warehouse-linked header insertion. No cascading workflow foreign keys; retain across reset/archive. Context is written only by enforcement triggers, never by browser claims.
3. Mandatory per-item snapshot mapping records correction ID, validation ID, PR1 item ID, PR2 item ID, PR2 ID, stored code, timestamp. Enforce correction-table reference; no ephemeral workflow foreign keys. Deny direct client writes and enable RLS on all three tables.
4. Do not add a fetch after PR2 header creation. BEFORE item INSERT enforces the authoritative code; AFTER item INSERT records provenance in the same transaction. Both use the same parent PR1 advisory lock and verified header context. Correction cannot change after header commit. Wrong/replaced validation fails for corrected lines.
5. Existing incomplete-draft/retry behavior is pre-existing: header, items, status and approval are separate requests; draft retry submits without rebuilding items. Do not expand this feature into generic orphan recovery. Regression must show no new failure boundary; existing orphan drafts block code edits.
6. RFQ overlays use exact RFQ-to-PR2 association and trusted snapshots, including an explicitly linked archive where authorized. Never select latest PR2 by PR1, infer by code equality, or apply current validation edits to history.
7. Code-reader authorization includes existing staff document access, supplier assignment to the exact RFQ, and owning requestor substitute-document access. An empty correction remains empty; authorization failure must not silently fall back.

## Consumer inventory and surgical edit points

| Source / consumer | Existing source | Feature treatment |
| --- | --- | --- |
| lib/canvassing.ts fetchRfqDetail, PR1 branch around 938 | PR1 items via buildRfqLineItems | Apply exact RFQ correction map after building lines |
| buildQuoteMatrix; RFQ page; CanvassingComparisonPanel; award UI | fetchRfqDetail result | Inherit corrected detail, no separate commercial changes |
| PR2 detail canvassing / RFQ approval | fetchRfqDetail and buildQuoteMatrix | Inherit corrected detail; legacy approvals/rfq route redirects to PR2 |
| fetchSupplierQuoteDetail, PR1 branch around 3438 | PR1 items via buildRfqLineItems | Apply exact assigned-RFQ map; keep supplier ownership check |
| Supplier inbox/list/counts | Header/status summaries | No displayed item codes; no changes |
| fetchSubstituteReviewBundles, around 2512/2561 | PR1 item lookup shared across RFQs | Cache maps by RFQ; overlay inside each quote/RFQ loop, not global PR1 map |
| loadSubstitutesForPr1, around 2789/2836 | PR1 item lookup across RFQs | Same per-RFQ overlay; wrappers and requestor substitute screens inherit |
| createRfq, around 1332 | PR1 code used in temporary line construction | No persisted code copy here; retain quantities and selection logic |
| lib/pr2-warehouse.ts, around 142 | Original PR1 code in inserted item payload | Database insert enforcement sets corrected snapshot; no extra browser fetch |
| PR2-native branches in canvassing | PR2 items | Already snapshot-based; leave unchanged |
| lib/pr2-rfq-sync.ts | Commercial updates matched by PR1 item ID | No code update required; regression checks preservation |
| lib/pr2.ts fetchPR2ForPrint; PR2 detail/approval/print | Live PR2 or archive items | Already snapshot-based; no overlay or reader rewrite |
| lib/po.ts around 644/746; PO detail/print/supplier views | PR2 code copied into PO | Existing propagation; regression only |
| app/api/rfq/send-email/route.ts | Header, purpose, deadline and portal link | Email has no line-item codes; no change |
| PR1 detail/print | Original PR1 items | Must remain original |

Searches covered lib/app/components item_code and pr1_items/pr2_items references, caller references to detail/substitute readers, and RFQ/supplier print/export/email paths. No separate RFQ line-item print/export implementation was identified in these paths. New future consumers must use the same checked detail source.

## Baseline verification

- npm run build: exit 0; generated 72 static pages. Existing warnings: Supabase dynamic dependency/Edge-runtime APIs, outdated Browserslist, optional sharp, client rendering on /po/new and /tsqa/grn. Build intentionally skips lint via existing next.config.js.
- npm run typecheck: rerun after build, exit 0. Initial simultaneous build/typecheck attempt failed because build regenerated .next/types; do not treat that race as a source-code failure. Run sequentially for release.
- CI=1 npm run lint: exit 1, Next reports missing TypeScript/type dependencies despite package.json resolution succeeding. Initial normal lint tried automatic installation; stopped it. Tracked package.json and package-lock.json are unchanged. This environment issue is not fixed by changing feature scope or installing packages.
- Direct ESLint fallback (`node node_modules/eslint/bin/eslint.js app components context hooks lib types --ext .ts,.tsx`): exit 1, 30 existing errors and 26 warnings. Errors include unescaped JSX entities and missing @typescript-eslint/no-explicit-any rule definition in lib/profile.ts. No unrelated lint fixes made. This does not replace the documented npm lint failure.

## Isolated target: verified environment blocker

- Supabase list_branches returned an empty list. Other accessible projects are unrelated and are not authorized test targets.
- No local supabase/config.toml; no psql/postgres executable found.
- Docker CLI 29.7.2 is installed, but engine pipe dockerDesktopLinuxEngine is absent.
- docker desktop start fails because SOFTWARE\\Docker Inc.\\Docker Desktop registry key is missing. Attempted hidden launch of the installed Docker Desktop executable; engine remained unavailable.
- Do not repair system registry, reinstall Docker, create billable cloud branches, or seed production as an implicit audit step. To unblock, repair Docker Desktop or provide an authorized isolated Supabase staging/branch. Use synthetic users/documents only; no production-data clone.

## Honest gate status

Audit, consumer inventory, baseline attempts, and principal plan corrections are completed. Exact migration SQL, its lock/security review and authenticated two-session tests are NOT completed. They require a working isolated database and feature implementation under the plan's Phase 1 gate. Catalog inspection cannot certify absent feature code. No claim of zero regressions or production-release readiness is made.

Only the plan and this report were changed in this pass. Unrelated user changes are preserved; no feature migration deployed.

## Later Phase 1 update

The environment/testing blocker above was subsequently resolved using portable PostgreSQL and PostgREST in an ignored disposable scratch directory. Phase 1 now passes local SQL, role, signed-JWT API, reset/archive, provenance, rollback and two-session tests. See 2026-10-10-warehouse-item-code-phase1.md for exact results and fixture limitations. Migration remains unapplied to production; hosted/browser UAT and downstream compatibility remain release gates. This supersedes the earlier unavailable-isolated-target status for local implementation work.
