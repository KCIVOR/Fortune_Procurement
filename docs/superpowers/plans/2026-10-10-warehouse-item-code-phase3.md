# Phase 3 — Warehouse item-code editor verification

Implemented locally on main on 2026-10-10. No commit, push, production data change, migration deployment, or rollout configuration change.

## Surgical changes

- `app/warehouse/[id]/page.tsx`: original requestor code plus authoritative warehouse code, small per-line Edit/Save/Cancel interaction, persisted expected-code comparison, conflict/error recovery, and feature-only action guards.
- `lib/warehouse-item-code-data.ts`: current-PR2 existence hint using existing authenticated SELECT privileges; no status filter so visible draft/orphan headers count. RLS may hide headers; this hint is not authorization. The database save RPC independently rejects any current header.
- `scripts/test-warehouse-item-code-editor.cjs`: synthetic real-React/Chromium page tests. No new packages. Uses in-memory TypeScript transpilation, substitutes only data/auth/navigation and unrelated components, and uses real generated application CSS.
- `scripts/test-warehouse-item-code-data.cjs`: PR2-hint query/error regression coverage.
- Feature plan/report only. Previous-phase and unrelated user changes were preserved. No changes to `lib/warehouse.ts`, PR1 displays/prints, quantity/SOH calculations, routing, pricing, numbering, attachments, or generated PR2 sequencing.

## Behavior and boundaries

Code values remain separate from the validation form and seeded workflow snapshots. Code save/reload never rebuilds quantity, SOH, override reason, line notes, or overall notes. Save Progress continues sending the original seeded code, not a client-created correction. The correction RPC is the only code-write path.

Active warehouse users can edit eligible undecided Goods/Services validations at the warehouse stage with no visible current PR2. Admin has read access but no edit control. Completed validations show checked corrected values read-only. Original PR1 remains immutable. One editor is open at a time.

Success is shown only after a matching persisted RPC response. Errors preserve attempted text and require reload before retry. Failed/ambiguous saves also invalidate the local authoritative-code state: cancelling releases the dirty workflow guard, but submission remains blocked until successful reload. Missing/mismatched lines and denied reads never silently fall back to originals. Stock/notes progress and terminal actions remain available after cancellation, while unverified-code submission stays blocked. Dirty or pending edits prevent conflicting writes; a clean, idle editor does not.

## Rollout and rollback

Both build-time switches default off. No environment file was edited.

- `NEXT_PUBLIC_WAREHOUSE_ITEM_CODE_EDITING_ENABLED=true`: enables editing and required readers, only after the full release gate passes.
- `NEXT_PUBLIC_WAREHOUSE_ITEM_CODE_READS_ENABLED=true`: enables readers independently, so editing can be disabled without discarding corrected displays.

After real corrections exist, retain compatible readers when turning editing off. Do not turn both switches off as a rollback strategy. Switches provide release coordination, never database authorization. Deployment still requires Phase 4 downstream compatibility and Phase 5 hosted authorization/UAT/security checks.

## Verification evidence

Tests were written before the initial editor implementation and failed on missing authoritative display/editor/guards. An additional failed-save regression failed because cancellation incorrectly allowed submission before re-verification; the feature was corrected and the test passed. A rollout regression failed when edit disabling also removed readers; independent reader enablement fixed it. A test-harness-only completed-view error was traced to its missing React Fragment export and corrected without modifying production completed-view logic.

Commands and outcomes:

1. Standalone TypeScript compilation of feature helpers/tests and existing warehouse remarks helpers/tests: exit 0.
2. `node --test scratch/warehouse-item-code-tests/warehouse-item-code.test.js scratch/warehouse-item-code-tests/warehouse-pr2-remarks.test.js scripts/test-warehouse-item-code-data.cjs`: 15 passed, 0 failed.
3. `node --test scripts/test-warehouse-item-code-editor.cjs`: 10 browser scenarios, 11 passed node:test results including parent, 0 failed.
4. Focused ESLint on warehouse detail page and item-code data wrapper: exit 0.
5. `npm run typecheck`: exit 0.
6. `npm run build`: exit 0, all 72 static pages generated; existing Browserslist/Supabase dependency/client-rendering warnings remain. Build skips lint by existing config; focused ESLint was run separately. Repository-wide lint baseline remains as documented in Phase 1; not claimed clean.
7. `git diff --check`: exit 0; existing LF/CRLF notices only.

Browser scenarios cover intentional blank, original/effective separation, preserved dirty SOH/quantity/reason/line notes/overall notes, original-code progress payload, stale conflict and explicit reload/retry, cancel without writes, Enter save/Escape cancel, pending-save guards, denied/ambiguous saves, missing/denied initial reads, role/activity/lifecycle/current-PR2 gates, completed read-only state, default-off baseline, Services, duplicate-code ID isolation, formatting, failed reload recovery, and read-preserving editing rollback.

Synthetic screenshots were captured and visually inspected at 1280px and 390px, including long-code and conflict states:

- `scratch/warehouse-item-code-tests/editor-wide.png`
- `scratch/warehouse-item-code-tests/editor-narrow.png`
- `scratch/warehouse-item-code-tests/editor-conflict.png`

The existing table scroll container is retained; long codes wrap without widening the document. These screenshots omit unrelated app-shell components and are not full deployed-app UAT.

## Remaining work

Phase 4: trusted downstream RFQ/supplier/print/export overlays and procurement consistency. Phase 5: full release verification, hosted Auth/browser UAT, and controlled deployment. The feature migration remains undeployed; local passing tests do not assert production readiness or a zero-bug guarantee.
