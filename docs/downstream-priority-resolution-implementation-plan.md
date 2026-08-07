# PO / Delivery / GRN Priority Resolution — Implementation Plan

## Goal
Fix a priority-resolution gap confirmed in 4 functions across 3 files (PO, Delivery, GRN), all sharing the identical root cause already fixed once for PR2 earlier: each one resolves priority by chaining **only** back to `pr1_requests.priority`, with no awareness that a Planning-native Raw Material/Services request has **no PR1 at all**. Since `pr2_requests.priority` is already correctly populated for these requests (fixed in the earlier PR2 priority session), the fix everywhere is the same: read `pr2.priority` and prefer it, falling back to the PR1 join only when it's genuinely absent — using the same `resolvePR2Priority()` helper already built and proven for PR2 itself.

Confirmed live: **11 of 21 POs (52%)** are Raw Material/Services requests with no PR1, so this is a present-day, high-frequency gap, not a rare edge case.

Two visibly different symptoms of the same bug:
- `lib/po-approvals.ts` has no fallback default at all → priority renders **blank**.
- `lib/po.ts`, `lib/delivery.ts`, `lib/grn.ts` default to `'normal'` when the PR1 chain is empty → priority silently shows **"Normal" even when the real value is High/Medium** — a quieter, more dangerous version of the same bug.

---

## 🚨 READ THIS BEFORE TOUCHING ANY CODE (RULES FOR AI) 🚨
1. **STRICT SURGICAL EDITS:** Each phase names exact functions in exact files. Do not touch any function not named in the phase you're on, even in the same file.
2. **NO UNRELATED REFACTORING:** Do not clean up imports, reformat code, or rename variables outside the exact scope of the task.
3. **REUSE, DO NOT REIMPLEMENT `resolvePR2Priority()`.** It already exists in `lib/pr2-classification.ts` (built during the earlier PR2 priority fix) and is proven correct. Every phase in this plan calls it — none of them re-derive the fallback logic inline. Do not modify `resolvePR2Priority()` itself; if its signature doesn't fit a call site, adapt the call site, not the helper.
4. **DO NOT TOUCH THE PRIORITY *FILTER* (search-by-priority-dropdown) LOGIC.** Each of these files also has a separate "priority pre-filter" block (walks `pr1_requests.priority` forward through the FK chain to build a list of matching PO/delivery/GRN ids for the Priority dropdown filter). This has the *same* underlying blind spot — it also won't match Raw Material rows on a priority filter — but it's a distinct piece of logic from the *display* bug that was actually audited and asked about here. **Leave it untouched.** It's called out again in the Gaps section below; fix it only if separately asked.
5. **DO NOT TOUCH `request_type` RESOLUTION**, even where it sits right next to the priority code you're editing (e.g. `lib/grn.ts`'s `request_type` resolution has a similar-looking but separate gap — noted in Gaps below, explicitly out of scope here).
6. **NO DATABASE MIGRATIONS.** `pr2_requests.priority` already exists and is already correctly populated — this is a pure application-code read-path fix.
7. **Preserve existing `?? 'normal'` / blank-vs-default behavior exactly as each file already has it**, except for making the *source* of the value correct. Don't standardize the four files to identically handle the "no priority at all" case as part of this plan — that's a separate, smaller follow-up if wanted (see Gaps).

---

## Phase 1: `lib/po-approvals.ts` — the exact bug reported (Director's `/approvals/po`)
**Files:** `lib/po-approvals.ts`

1. `fetchPOApprovalQueue()` (~line 159-186): the `pr2_requests` select at line 160 currently selects `'id, pr1_id, request_type'`. Add `priority`: `'id, pr1_id, request_type, priority'`.
2. Import `resolvePR2Priority` from `@/lib/pr2-classification` at the top of the file (add to existing import if `resolvePR2RequestType` is already imported there, otherwise add a new import line).
3. Replace the priority computation at lines 184-186:
   ```ts
   const pr1Id       = po.pr2_id && pr2Map[po.pr2_id]?.pr1_id ? pr2Map[po.pr2_id].pr1_id : undefined;
   const pr1Priority = pr1Id ? pr1PriorityMap[pr1Id] : undefined;
   ```
   with:
   ```ts
   const pr2Row       = po.pr2_id ? pr2Map[po.pr2_id] : undefined;
   const pr1Id        = pr2Row?.pr1_id ?? undefined;
   const pr1Priority  = pr2Row
     ? resolvePR2Priority(pr2Row, pr1Id ? { priority: pr1PriorityMap[pr1Id] as 'normal' | 'medium' | 'high' } : null)
     : undefined;
   ```
4. `fetchPOApprovalDetail()` (~line 250-270): the inline `pr2_requests` select at line 254-258 currently selects `'pr1_id, request_type'`. Add `priority`.
5. Replace the priority computation at lines 250-269 (the `let pr1Priority` block) with a call to `resolvePR2Priority(pr2Data, pr1Data ? { priority: pr1Data.priority } : null)` once `pr2Data`/`pr1Data` are fetched, preserving the existing `if (po.pr2_id) { ... }` guard structure.

## Phase 2: `lib/po.ts` — procurement-facing `/po` list and detail
**Files:** `lib/po.ts`

1. `listPOsWithCount()` (~line 36-132): the `pr2_requests` select at line 102 currently selects `'id, pr1_id, request_type'`. Add `priority`.
2. Replace the priority-map construction at lines 107-109 and 113-115 (`priorityByPr1Id` / `priorityByPr2Id`) so `priorityByPr2Id` is built via `resolvePR2Priority(pr2Row, pr1Id ? { priority: priorityByPr1Id[pr1Id] } : null)` per PR2 row, instead of purely `priorityByPr1Id[p.pr1_id] ?? 'normal'`.
3. `resolvePR2RequestType` is already imported in this file — add `resolvePR2Priority` to the same import line rather than a new one.
4. `fetchPOById()` (~line 188-227): the inline `pr2_requests` select at line 210 currently selects `'pr1_id, request_type'`. Add `priority`.
5. Replace the `let pr1_priority = 'normal'; if (pr2Res.data?.pr1_id) { ... }` block (lines 214-218) with a call to `resolvePR2Priority(pr2Res.data, pr1Data ? { priority: pr1Data.priority } : null)`, keeping the existing conditional fetch of `pr1Data` only when `pr2Res.data?.pr1_id` is present (no need to fetch PR1 at all when there's no PR1 to fetch).

## Phase 3: `lib/delivery.ts` — `/delivery` list
**Files:** `lib/delivery.ts`

1. `fetchDeliveryQueuePaged()` (~line 106-225): the `pr2_requests` select at line 193 currently selects `'id, pr1_id, request_type'`. Add `priority`.
2. Replace the per-row priority assignment at line 217 (`(d as any).priority = pr2?.pr1_id ? (pr1PriorityById[pr2.pr1_id] ?? 'normal') : 'normal';`) with `(d as any).priority = pr2 ? resolvePR2Priority(pr2, pr2.pr1_id ? { priority: pr1PriorityById[pr2.pr1_id] as 'normal' | 'medium' | 'high' } : null) : 'normal';`.
3. Add the `resolvePR2Priority` import from `@/lib/pr2-classification` (this file doesn't currently import anything from that module — new import line).
4. Do not touch `fetchDeliveryQueue()` (the unpaged variant, ~line 95-103) — it doesn't resolve priority at all today and is out of scope.

## Phase 4: `lib/grn.ts` — `/grn` list
**Files:** `lib/grn.ts`

1. `fetchGRNQueuePaged()` (~line 171-291): the `pr2_requests` select at line 254 currently selects `'id, pr1_id'`. Add `priority`.
2. Replace the per-delivery priority assignment at line 279 (`priorityByDeliveryId[d.id] = pr1Id ? (pr1PriorityById[pr1Id] ?? 'normal') : 'normal';`) with a call to `resolvePR2Priority(pr2Row, pr1Id ? { priority: pr1PriorityById[pr1Id] } : null)`, where `pr2Row` is looked up the same way `pr1Id` already is (via the existing `pr1IdByPr2Id`/`pr2IdByPoId` maps — you'll need the actual PR2 row, not just its `pr1_id`, so build a `pr2ById` map alongside the existing ones at lines 268-273, mirroring how `pr1IdByPr2Id` is already built there).
3. Add the `resolvePR2Priority` import from `@/lib/pr2-classification` (new import line — this file doesn't currently import from that module).
4. Leave the `request_type` resolution in this same function (lines 262-264, 277-278, 286) completely untouched — it has a separate, unaudited gap noted below in Gaps, not part of this plan.

## Phase 5: Verification
1. `npx tsc --noEmit` — must be clean.
2. `npm run build` — must complete with no errors.
3. Re-run the audit's live check for PO-2026-0021 (`pr1_id: NULL, pr2.priority: "medium"`) — confirm it now resolves to `"medium"` through each changed function's logic (trace by hand or spot-check via SQL that the join/fallback shape matches).
4. Spot-check at least one Raw-Material-origin row for Delivery and GRN similarly, to confirm the same fix pattern resolves correctly there too.
5. `git diff --stat` — confirm only `lib/po-approvals.ts`, `lib/po.ts`, `lib/delivery.ts`, `lib/grn.ts` changed, and that `lib/pr2-classification.ts` (`resolvePR2Priority` itself) has zero diff.
6. Confirm the priority *pre-filter* logic (search-by-priority-dropdown blocks) in all four files is byte-for-byte unchanged — this plan only touches display resolution, per guardrail #4.

---

## Gaps (found during audit prep, explicitly NOT part of this plan)
1. **Priority filter dropdowns** in `/po`, `/approvals/po`, `/delivery`, `/grn` all pre-filter by walking `pr1_requests.priority` forward through the FK chain — same blind spot as the display bug, meaning "filter by High priority" would also miss Raw-Material-origin rows. Not fixed here (guardrail #4) — flag if you want it addressed too.
2. **`lib/grn.ts`'s `request_type` resolution** (lines 262-264, 277-278, 286) also only reads `request_type` via the PR1 join, never `pr2.request_type` directly — meaning a Raw Material GRN's Type badge likely always shows "Goods" instead of "Raw Material." This is the same *class* of bug (PR1-only resolution ignoring Planning-native PR2s) but on a different field, found incidentally while tracing the priority code. Not fixed here — separate issue, would need its own confirmation pass.
