# RFQ Queue — Pagination & Filter Fixes — Implementation Plan

## Goal
Fix two confirmed bugs on the `/rfq` (Canvassing Queue) page, found and diagnosed in the audit conversation that preceded this plan:

1. **Filters bleed across tabs.** The search box, Department, Assigned, and Priority filters are shared state across all three tabs ("Awaiting RFQ," "RFQ Issued," "Planning Direct"), but switching tabs never resets them. A search term typed while looking at one tab silently keeps filtering a different tab after you switch — producing exactly the reported symptom: the "Awaiting RFQ" tab badge correctly shows "1" (from an unfiltered count query), while the table below shows "No matching PR1s" / 0 items, because a stale search term from elsewhere is still applied and doesn't match that one row.
2. **"Planning Direct" tab has no working filters and no pagination at all.** Its data-loading function (`fetchRawMaterialCanvassingQueue`) takes no parameters, ignores every filter, fetches the entire unbounded result set once on mount, and never re-fetches. 10 rows currently exist in this queue live — this is a present-day gap, not a hypothetical one.

Confirmed via grep: `fetchRawMaterialCanvassingQueue` and `fetchCanvassingQueueCounts` are each called from exactly one place outside their own definitions — `app/rfq/page.tsx`. Changing their signatures is fully contained to the two files touched in this plan; no other caller exists to break.

---

## 🚨 READ THIS BEFORE TOUCHING ANY CODE (RULES FOR AI) 🚨
1. **STRICT SURGICAL EDITS:** Implement ONLY what is described in the phase you're on. Do not touch any file that isn't named in that phase.
2. **NO UNRELATED REFACTORING:** Do not clean up imports, reformat code, or rename variables outside the exact scope of the task.
3. **DO NOT MODIFY `fetchCanvassingQueuePaged`, `fetchCanvassingQueue`, `CANVASSING_QUEUE_OR_FILTER`, or `isLegacyGoodsCanvassingStatus`.** These power the "Awaiting RFQ" / "RFQ Issued" tabs (PR1-based) and are confirmed working correctly — this plan only touches the raw-material (Planning Direct) query path and the shared page-level filter-reset logic. The minor "approximate total count" note found in `fetchCanvassingQueuePaged` during the audit is a separate, smaller issue and is explicitly OUT OF SCOPE for this plan.
4. **DO NOT CHANGE `components/shared/PaginationControls.tsx` or `components/shared/FilterBar.tsx`.** Both are shared components used elsewhere in the app. All changes needed are in how `app/rfq/page.tsx` calls/configures them, not in the components themselves.
5. **NO DATABASE MIGRATIONS.** Every field needed for Planning Direct's search (PR2 number, purpose, department, requester name) already exists on `pr2_requests` and is already selected by `fetchRawMaterialCanvassingQueue` today. This is an application-code-only fix.
6. **Preserve the "Assigned" filter's existing behavior for "Awaiting RFQ" and "RFQ Issued.")** Phase 3 only hides that one filter control when the Planning Direct tab is active — it must keep working exactly as it does today for the other two tabs.

---

## Phase 1: Stop filters from bleeding across tabs
**Files:** `app/rfq/page.tsx`

1. Locate `handleViewChange` (~line 187-191):
   ```tsx
   const handleViewChange = (next: 'awaiting' | 'issued' | 'raw_material') => {
     if (next === view) return;
     setView(next);
     setCurrentPage(1);
   };
   ```
2. Extend it to also reset every filter, so each tab always starts from a clean, matching state:
   ```tsx
   const handleViewChange = (next: 'awaiting' | 'issued' | 'raw_material') => {
     if (next === view) return;
     setView(next);
     setCurrentPage(1);
     setSearch('');
     setAppliedSearch('');
     setSelectedDept('all');
     setAssignedFilter('all');
     setSelectedPriority('all');
   };
   ```
3. No other line in this function or file changes in this phase.

## Phase 2: Give Planning Direct real search + department + priority filtering, and pagination
**Files:** `lib/canvassing.ts`, `app/rfq/page.tsx`

### 2a. `lib/canvassing.ts` — extend `fetchRawMaterialCanvassingQueue`
1. Current signature (~line 622): `export async function fetchRawMaterialCanvassingQueue(): Promise<RawMaterialCanvassingQueueRow[]>`.
2. Change to accept the same shape of options `fetchCanvassingQueuePaged` already uses, and return a paged result:
   ```ts
   export async function fetchRawMaterialCanvassingQueue(options: {
     limit: number;
     offset: number;
     search?: string;
     departmentId?: string;
     priorityFilter?: string;
   }): Promise<{ rows: RawMaterialCanvassingQueueRow[]; total_count: number }>
   ```
3. Add filtering to the existing `pr2_requests` query (currently `.in('request_type', [...]).is('pr1_id', null).eq('status', 'approved').order(...)`, ~lines 624-630 and the legacy-fallback branch ~lines 633-639):
   - `search`: match against `pr2_number`, `purpose`, `department_name_snapshot`, `requisitioner_name_snapshot` (the same fields `fetchCanvassingQueuePaged` searches, minus RFQ number — RFQ number matching there depends on a separate `rfq_batches` join keyed by `pr1_id`, which raw-material PR2s don't have; RFQ number search for this tab is out of scope for this plan since it would need a different join strategy).
   - `departmentId`: `.eq('department_id', departmentId)` — **check first whether `pr2_requests` has a `department_id` column available on the already-selected shape; if the current `.select(...)` list doesn't include it, add it to the select list.**
   - `priorityFilter`: `.eq('priority', priorityFilter)` when not `'all'`.
   - Apply `.range(offset, offset + limit - 1)` for pagination on the data query, and run a second `.select('id', { count: 'exact', head: true })` query (with the same filters) for `total_count`, mirroring the two-query pattern already used in `fetchCanvassingQueuePaged` (~lines 386-391).
4. Keep the existing legacy-fallback branch (the `pr2Err.code === '42703'` retry without `priority` in the select list) working the same way, just with the new filters/pagination applied to both the primary and fallback query paths.
5. The `rfq_batches` join and row-mapping logic (~lines 652-679) stays as-is, just operating on the now-filtered/paginated `pr2s` array instead of the full set.

### 2b. `lib/canvassing.ts` — extend `fetchCanvassingQueueCounts`
1. The tab badge for "Planning Direct" needs a true, unfiltered total once `rawRows` no longer holds the full list (see 2c). Add a `planningDirect` count to this function's return value (~line 577-611), computed the same simple way the other counts are — e.g. a `count: 'exact', head: true` query against `pr2_requests` with the same `request_type in (raw_material, services) AND pr1_id IS NULL AND status = 'approved'` filter already used in `fetchRawMaterialCanvassingQueue`.
2. Update the return type to `{ awaiting: number; active: number; complete: number; issued: number; planningDirect: number }`.

### 2c. `app/rfq/page.tsx` — wire it up
1. Update the `counts` state type to include `planningDirect: number`.
2. Add `rawTotalCount` state (mirroring `totalCount`) to hold the paginated result's total.
3. Update `loadRaw()` (~lines 169-176) to call the new `fetchRawMaterialCanvassingQueue` signature, passing `limit: rowsPerPage`, `offset: (currentPage - 1) * rowsPerPage`, `search: appliedSearch.trim() || undefined`, `departmentId: canFilterByDept && selectedDept !== 'all' ? selectedDept : undefined`, `priorityFilter: selectedPriority`, and set both `rawRows` (from `result.rows`) and `rawTotalCount` (from `result.total_count`).
4. Update the `useEffect` at ~lines 181-183 (currently empty-dependency, mount-only) so that:
   - It still fires once on mount to populate the tab badge/initial state.
   - It also re-fires when `view === 'raw_material'` and `currentPage`, `appliedSearch`, `selectedDept`, `selectedPriority` change — mirroring the existing `useEffect` for `load()` at ~lines 164-167, but scoped so it only issues the *filtered* fetch when the tab is actually active (to avoid an unnecessary fetch storm on every keystroke-driven state change while the user is looking at a different tab).
5. Change the tab badge at ~line 425 from `count={rawRows.length}` to `count={counts?.planningDirect}`, matching how the other two tab badges already read from `counts`.
6. Remove the `view !== 'raw_material' &&` exclusion on the `<PaginationControls>` block (~line 561), and make it use `rawTotalCount` when `view === 'raw_material'` and `totalCount` otherwise (e.g. a small `const displayedTotalCount = view === 'raw_material' ? rawTotalCount : totalCount;` and use that for both `totalCount` and `totalPages` props passed into `<PaginationControls>`).
7. Update the empty-state text branch (~lines 435-441, currently hardcoded "No Planning-direct requests ready" regardless of search) to show a "no results match your search" variant when `appliedSearch.trim()` is set, mirroring the pattern already used for the Awaiting/Issued empty state (~lines 516-529).

## Phase 3: Hide the "Assigned" filter on the Planning Direct tab
**Files:** `app/rfq/page.tsx`

1. In the `filters` array (~lines 290-347), the `rfq-assigned` entry is currently always included.
2. Make its inclusion conditional on `view !== 'raw_material'`, the same way the Department filter is already conditionally spread in based on `canFilterByDept` (~line 315).
3. Do not remove or alter the `assignedFilter` state itself, or its handling in `fetchCanvassingQueuePaged` — it must keep working unchanged for "Awaiting RFQ" and "RFQ Issued."

## Phase 4: Verification
1. `npx tsc --noEmit` — must be clean.
2. `npm run build` — must complete with no errors.
3. Re-run the audit's live-data checks: confirm "Awaiting RFQ" still resolves to 1 row with no filters applied, and confirm the Planning Direct paginated/filtered query returns the correct subset against the 10 live rows for at least one search term and one priority filter.
4. `git diff --stat` — confirm only `app/rfq/page.tsx` and `lib/canvassing.ts` changed, and that the diff inside `lib/canvassing.ts` is scoped to `fetchRawMaterialCanvassingQueue` and `fetchCanvassingQueueCounts` only — nothing in `fetchCanvassingQueuePaged`, `fetchCanvassingQueue`, or any unrelated export in that file.
5. Manually re-check that switching tabs after typing a search term on one tab no longer carries that term into another tab (Phase 1's fix), and that the Awaiting/Issued tabs' own search/filter/pagination behavior is unchanged from before this plan.
