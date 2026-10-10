# Phase 4 — Trusted procurement item-code snapshots

Completed locally on main, October 10, 2026 (Asia/Manila). No commit, push, environment change, production migration, or feature activation.

## Scope delivered

The still-unpublished CLI-generated feature migration `20261010023203_warehouse_item_code_corrections.sql` now includes `get_rfq_warehouse_item_code_snapshots(p_rfq_id uuid)`. Its only returned fields are `pr1_item_id` and `item_code`. The existing Phase 1 context/mapping tables, serialization triggers, and before/after item-insert enforcement remain in place without changing the browser PR2 generation sequence.

The RPC resolves only `rfq_batches.pr2_id`. It checks the exact linked live header or, only when absent, the matching archive header; verifies PR1 identity, retained validation context, event identity, and stored item snapshot; and rejects inconsistent or missing corrected-line mappings. It never selects the latest PR2 or current warehouse code to fill historical documents. Native and old unlinked RFQs return no correction rows. Intentionally blank codes remain blank.

Authorization requires an active database profile, not browser-supplied actor data:

- Suppliers always need assignment to the exact RFQ, even if a supplier identity also appears as the PR1 requisitioner.
- Warehouse/procurement/approver staff need the existing RFQ role access plus `can_read_pr1` for PR1-linked documents.
- Non-supplier owning requestors may read their existing document's code fields.
- No blanket admin bypass was invented: the inspected RFQ catalog has no blanket admin SELECT policy. An admin who is genuinely the owning requestor follows the existing ownership path.
- Anonymous execution is revoked; authenticated EXECUTE is granted. The SECURITY DEFINER function has an empty fixed search path and schema-qualified relations. Its elevation reads protected provenance and an explicitly linked archive only; no general history/commercial fields or table-write grants are exposed.

This follows the [Supabase function security guidance](https://supabase.com/docs/guides/database/functions). The existing PR2 snapshot index on `(pr2_id, pr1_item_id)` and primary-key joins support the bounded document lookup; no unrelated indexes were added.

## Application changes

`lib/canvassing.ts` adds only two feature imports and four narrow reader integrations:

1. `fetchRfqDetail`: overlay after existing line construction; quote matrix and downstream approval/display consumers inherit it.
2. `fetchSupplierQuoteDetail`: keep supplier ownership check; overlay only its assigned RFQ's lines.
3. `fetchSubstituteReviewBundles`: one code map per RFQ; overlay inside the quote loop, not the shared PR1 lookup.
4. `loadSubstitutesForPr1`: same per-RFQ isolation for the single-request substitute view.

`lib/warehouse-item-code.ts` adds pure checked-map/overlay helpers. `lib/warehouse-item-code-data.ts` adds the authenticated read wrapper. `types/database.ts` adds the RPC signature. Existing reader rollout switches are reused: reads default off; editing implies reading; independent reads can remain enabled when editing is rolled back.

No edits to `lib/pr2-warehouse.ts`, `lib/pr2-rfq-sync.ts`, `lib/po.ts`, `lib/pr2.ts`, PR1 pages/prints, pricing, quantities, attachments, approvals, numbering, native PR2 paths, or dependencies. `git diff --exit-code` verified the listed existing library files and package/lockfiles remain unchanged. Unrelated user files, including existing manual work, were preserved.

## Verification

Tests were added before the missing RPC/helper and consumer integrations. Initial failures showed missing helper exports, the missing database RPC, original codes still appearing in consumers, and errors not propagating. They pass with the implementation.

An extra security regression demonstrated that an unassigned supplier who was also recorded as requisitioner could enter the ownership branch. The authorization expression was narrowed so the ownership/staff branches exclude supplier identity. The regression and signed-JWT role matrix pass after this correction. All of this occurred only in disposable local databases.

Final checks:

- Standalone helper/test TypeScript compilation: exit 0.
- Focused helper/wrapper/consumer/existing-remarks tests: **24 passed, 0 failed**.
- Actual warehouse-page React/Chromium tests: **11 passed results**, including parent (10 scenarios), 0 failed.
- `node scripts/test-warehouse-item-code-postgres.cjs`: exit 0, final disposable database `wic_test_1791602904189`. Includes existing role/lifecycle/provenance/batch tests, actual reset/unwind functions, signed-JWT correction and RFQ readers, and **17 two-session concurrency cases**.
- Focused ESLint on canvassing and feature helper/data files: exit 0.
- `npm run build`: exit 0, all 72 static pages generated. Existing Browserslist/Supabase/client-rendering warnings remain; build skips lint by existing configuration, so focused ESLint was run separately.
- `npm run typecheck`, run separately after build: exit 0.
- `git diff --check`: exit 0; existing LF/CRLF notices only.

SQL and JWT coverage includes exact-assigned supplier access, other/anonymous/invalid-token/inactive denial, owner access, staff document restrictions, admin denial, blank snapshots, old unlinked and linked uncorrected RFQs, PR2-native paths, wrong PR1 association, tampered live/archive codes and context, missing mappings, and old archived RFQ isolation from a newly corrected validation lifecycle.

Consumer tests execute the actual functions with synthetic in-memory query transport. They verify the RFQ/comparison matrix, supplier and both substitute loaders; two different RFQ corrections for the same PR1 item; blank/no-map behavior; denied/malformed response propagation; preserved quantities, quote prices, attachments and original PR1; native paths with no correction calls; and default-off rollout. Actual existing quote-sync and PO-generation functions are executed to verify code preservation/inheritance. Approval/VAT services are substituted in that focused propagation test; this is not full commercial workflow UAT.

Inspection reconfirmed that PR2 live/archive print sources and PO/supplier-PO sources already use stored item codes. No independent RFQ line-code print/export/email source requiring changes was found in the inventoried paths; RFQ email contains header/link information, not line codes. Full rendered production-document UAT remains in Phase 5.

## Live database and baseline findings

Read-only Supabase MCP calls rechecked RFQ/supplier/archive policies, existing access-helper definitions, and relevant columns. A final query returned NULL for both `public.warehouse_item_code_corrections` and `public.get_rfq_warehouse_item_code_snapshots(uuid)`: **the feature is not deployed**.

The live security advisor still reports unrelated baseline findings; this phase did not change their objects or permissions:

- 1 RLS-without-policy info finding on `smtp_settings`: [guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- 8 existing mutable-search-path warnings: [guidance](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
- 36 existing anonymous-executable SECURITY DEFINER findings: [guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
- 36 authenticated-executable SECURITY DEFINER findings: [guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Leaked-password protection warning: [guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Those are live baseline notices, not verification of the unpublished migration. Phase 5 must inspect new deployed grants/functions and review advisors in context. No broad baseline security remediation was undertaken.

## Remaining gate

Phase 5: final release review, hosted Auth/browser/document UAT, production object/grant verification, and controlled deployment/activation with compatible rollback. Local fixture `can_read_pr1` models the document-access boundary rather than cloning the full production policy graph. Passing local tests do not establish hosted production readiness or guarantee zero regressions.
