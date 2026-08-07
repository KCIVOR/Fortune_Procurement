# Print Templates Bug Fix — Implementation Plan

## Goal
Fix three bugs found during a full audit of the five printable form templates (PR1, PR2, PO, GRN, Planning PR2):

1. **Wrong print template for Raw Material/Services PR2s** — the Print buttons on the procurement PR2 detail page and the PR2 approval detail page always link to the Goods/Services canvass-slip template, even for Planning-native raw material/services PR2s, which have their own correctly-tailored template that never gets used from those two entry points.
2. **Archived PR2s can't be printed** — `fetchPR2ById()` only queries the live `pr2_requests` table. A PR2 that was unwound back to Warehouse (rejected/revision-requested after creation) is moved to `pr2_requests_archive` and deleted from the live table, so both PR2 print pages show "PR2 not found" for it — even though the on-screen approval detail view can already show archived PR2s correctly. 8 such rows exist live today.
3. **PO print page has no "not found" state** — unlike every other print page, it never distinguishes "still loading" from "loaded but got nothing back," so an invalid/deleted/RLS-denied PO id hangs on "Preparing print view..." forever with no way out.

Full findings are in the audit conversation that preceded this plan; this document exists so the fix can be implemented (or resumed) without re-deriving that context.

---

## 🚨 READ THIS BEFORE TOUCHING ANY CODE (RULES FOR AI) 🚨
1. **STRICT SURGICAL EDITS:** Implement ONLY what is described in the phase you're on. Do not touch any file that isn't named in that phase.
2. **NO UNRELATED REFACTORING:** Do not clean up imports, reformat code, or rename variables outside the exact scope of the task.
3. **DO NOT MODIFY `fetchPR2ById()`.** It has 6 call sites, including the two *editable* PR2 detail pages (`app/pr2/[id]/page.tsx`, `app/planning/pr2/[id]/page.tsx`). Adding archive-fallback there risks those edit pages silently loading frozen archived data and trying to save against a row that no longer exists. Bug #2's fix is a **new, separate function** (`fetchPR2ForPrint`) that only the two print pages call. `fetchPR2ById` itself must be byte-for-byte unchanged when this plan is done.
4. **NO DATABASE MIGRATIONS.** All three bugs are fixable in application code only. If you find yourself wanting to alter a table or RLS policy, stop — that means you've misunderstood the bug.
5. **NO CHANGES to either print template's rendering/layout.** Bug #1 is a routing fix (which URL a button points to), not a template-content fix. Do not edit the JSX inside `app/pr2/[id]/print/page.tsx` or `app/planning/pr2/[id]/print/page.tsx` beyond what Phase 3 explicitly says (swapping which fetch function is called).

---

## Phase 1: Bug #3 — PO print stuck-loading state
**Files:** `app/po/[id]/print/page.tsx`

1. Add an `error` state variable, mirroring the pattern already used in `app/grn/[id]/print/page.tsx`.
2. Currently (around line 156):
   ```tsx
   if (loading || !po) {
     return (
       <div className="flex items-center justify-center min-h-screen">
         <p className="text-sm text-pq-neutral-500">Preparing print view...</p>
       </div>
     );
   }
   ```
3. Split into two checks — one for still-loading, one for loaded-but-empty:
   ```tsx
   if (loading) {
     return (
       <div className="flex items-center justify-center min-h-screen">
         <p className="text-sm text-pq-neutral-500">Preparing print view...</p>
       </div>
     );
   }

   if (error || !po) {
     return (
       <div className="flex items-center justify-center min-h-screen">
         <p className="text-sm text-pq-neutral-500">{error || 'PO not found.'}</p>
       </div>
     );
   }
   ```
4. No other line in this file changes. Data-fetching logic (`fetchPOById`, `fetchPOApprovalDetailByPOId`) is untouched.

## Phase 2: Bug #1 — Wrong print template for Raw Material/Services PR2s
**Files:** `lib/pr2-classification.ts`, `app/pr2/[id]/page.tsx`, `app/approvals/pr2/[id]/page.tsx`

1. Add a new helper to `lib/pr2-classification.ts`, next to `resolvePR2RequestType` / `resolvePR2Priority` (do not modify those two functions):
   ```ts
   /**
    * Raw Material and Services PR2s (Planning-native) print on their own
    * simpler template — the Goods/Services canvass-slip template renders
    * Supplier/RFQ/pricing columns that don't apply to them.
    */
   export function getPr2PrintUrl(
     pr2Id: string,
     requestType: 'goods' | 'services' | 'raw_material' | undefined | null
   ): string {
     return requestType === 'raw_material' || requestType === 'services'
       ? `/planning/pr2/${pr2Id}/print`
       : `/pr2/${pr2Id}/print`;
   }
   ```
2. In `app/pr2/[id]/page.tsx` (around line 511-512), replace:
   ```tsx
   <DetailPrintButton
     href={`/pr2/${pr2.id}/print`}
   ```
   with:
   ```tsx
   <DetailPrintButton
     href={getPr2PrintUrl(pr2.id, pr2.request_type)}
   ```
   Add the import: `import { getPr2PrintUrl } from '@/lib/pr2-classification';`
3. In `app/approvals/pr2/[id]/page.tsx` (around line 249-250), replace:
   ```tsx
   <DetailPrintButton
     href={`/pr2/${detail.pr2_id}/print`}
   ```
   with:
   ```tsx
   <DetailPrintButton
     href={getPr2PrintUrl(detail.pr2_id, detail.request_type)}
   ```
   Add the same import.
4. Do not touch any other `DetailPrintButton` usage (PR1, Planning PR2's own print button, PO, GRN) — they already point at the correct single template each.

## Phase 3: Bug #2 — Archived PR2s can't be printed
**Files:** `lib/pr2.ts`, `app/pr2/[id]/print/page.tsx`, `app/planning/pr2/[id]/print/page.tsx`

1. In `lib/pr2.ts`, add a new function `fetchPR2ForPrint(id: string): Promise<PR2WithItems | null>`, placed directly after `fetchPR2ById`. Do not modify `fetchPR2ById` itself.
2. `fetchPR2ForPrint` first attempts the exact same `pr2_requests` lookup `fetchPR2ById` does. If a row is found, behave identically to `fetchPR2ById` (same items fetch from `pr2_items`, same attachment/VAT/priority/request_type resolution).
3. If the `pr2_requests` lookup returns null (no error), fall back:
   - Query `pr2_requests_archive` for the same `id`.
   - If found, fetch items from `pr2_items_archive` instead of `pr2_items` (same `pr2_id` filter, same `item_order` ordering).
   - Reuse the exact same attachment-fetching, VAT, `resolvePR2RequestType`, and `resolvePR2Priority` logic already in `fetchPR2ById` — do not duplicate or reimplement it differently for the archive path.
   - This mirrors the proven pattern already in `lib/pr2-approvals.ts`'s `fetchPR2ApprovalDetail()` (archive fallback + `pr2_items_archive` item swap) — use that as the reference implementation, don't invent a new shape.
4. If neither table has the row, return `null` (same as `fetchPR2ById` today).
5. Update the two print pages to call `fetchPR2ForPrint` instead of `fetchPR2ById`:
   - `app/pr2/[id]/print/page.tsx` (currently `fetchPR2ById(id as string)`)
   - `app/planning/pr2/[id]/print/page.tsx` (currently `fetchPR2ById(id)`)
6. Every other caller of `fetchPR2ById` (`app/pr2/[id]/page.tsx`, `app/planning/pr2/[id]/page.tsx`) is untouched and continues calling `fetchPR2ById` exactly as before.

## Phase 4: Verification
1. `npx tsc --noEmit` — must be clean.
2. `npm run build` — must complete with no errors.
3. SQL check: run the new archive-fallback query shape directly against one of the live archived PR2 rows in `pr2_requests_archive` (8 exist as of this writing) to confirm it resolves before trusting it in the app.
4. `git diff --stat` — confirm only the files named in Phases 1-3 changed, nothing in unrelated approval/warehouse/canvassing/RLS logic.
5. Dev-server boot check (no test credentials available for a full authenticated click-through — verify via `tsc`/build/SQL per standing practice, not a live browser walkthrough).
