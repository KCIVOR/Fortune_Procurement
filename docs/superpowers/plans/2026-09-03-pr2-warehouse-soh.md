# PR2 Warehouse SOH Copy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show warehouse-verified stock on hand on goods/services PR2 (detail, approval, print) by copying `warehouse_validation_items.validated_soh` into `pr2_items.qty_on_hand`, including existing documents such as `PR2-2026-2404`.

**Architecture:** Keep the existing warehouse-remarks overlay. Add a pure SOH merge next to it, copy `validated_soh` at PR2 create, and overlay the same value at read time so already-created PR2s do not need to be recreated. A later optional SQL backfill persists the number onto live and archive rows for print-after-unwind.

**Tech Stack:** Next.js / TypeScript helpers (`lib/warehouse-pr2-remarks.ts`, `lib/pr2-warehouse.ts`, `lib/pr2.ts`), existing `npx tsx --test` tests. No schema migration required for Phases 1–3.

**Audit evidence (do not re-litigate):**
- `PR2-2026-2404` stores `qty_on_hand = 0` on all three lines
- Warehouse validation for the same PR1 stored `validated_soh` **3 / 0 / 2**
- `createPR2FromWarehouseValidation` hardcodes `qty_on_hand: 0` and `qty_incoming: 0` (`lib/pr2-warehouse.ts`)
- UI comment on `app/pr2/[id]/page.tsx` says SOH is set by warehouse validation
- Warehouse submit already requires verified SOH (`lib/warehouse.ts` `submitValidationDecision`)
- RFQ sync does not write `qty_on_hand`
- `savePR2Items` does not edit SOH; procurement only edits To Buy / remarks

---

## Safety constraints (non-negotiable)

These constrain every phase. If a change violates one, stop and revise the plan.

1. **Copy SOH only.** Do not change `quantity_requested`, `quantity_to_purchase`, `procurement_qty`, override reasons, prices, or To Buy math. Do not recompute To Buy from SOH.
2. **Do not touch `qty_incoming`.** Warehouse has no in-transit field. Leave it `0`.
3. **Do not change warehouse entry.** Leave `lib/warehouse.ts` and `app/warehouse/[id]/page.tsx` alone. SOH is already collected there.
4. **Do not change raw-material PR2 create.** Leave `lib/pr2-planning.ts` (`qty_on_hand: 0`) alone. Those documents have no warehouse validation.
5. **Do not edit PR1 / RFQ / PO / GRN / delivery approval writers.** No changes to `lib/approvals.ts`, `lib/rfq-approvals.ts`, `lib/po-approvals.ts`, `lib/grn.ts`.
6. **Do not change the unwind RPC or archive schema.** Named-column insert already includes `qty_on_hand`; copying a real number through is enough.
7. **Do not add UI columns or restyle the SOH cell.** The table already renders `item.qty_on_hand`. After the merge, the number changes; the markup does not.
8. **A warehouse SOH of `0` is valid.** Do not treat stored `0` as “missing” and invent a fallback from requestor SOH (`pr1_items.stock_on_hand`). Overlay only `validated_soh` when that column is present.
9. **Do not start letting procurement edit SOH.** Leave `savePR2Items` writing only To Buy / remarks / VAT totals.
10. **Do not commit unless the user asks.**

---

## Out of scope (explicit)

- In-transit / `qty_incoming` (no warehouse source)
- Recalculating To Buy when SOH is shown
- ₱0.00 prices on pre-RFQ PR2s
- Related Records “Purchase Memo” label (already changed)
- Healing other documents’ statuses

---

## File map

| File | Responsibility |
|------|----------------|
| Modify: `lib/warehouse-pr2-remarks.ts` | Optional `validatedSoh` on the line remark; `applyWarehouseSohToPr2Item`; merge applies SOH |
| Modify: `lib/warehouse-pr2-remarks.test.ts` | SOH unit tests; existing remark tests must stay green |
| Modify: `lib/pr2.ts` `fetchWarehouseRemarksForPr1` | Select and map `validated_soh` |
| Modify: `lib/pr2-warehouse.ts` | Select `validated_soh`; write it to `qty_on_hand` at create |
| Unchanged: `app/pr2/[id]/page.tsx`, `app/approvals/pr2/[id]/page.tsx`, print | Already display `qty_on_hand` |
| Optional later: one-off SQL backfill | Persist overlay onto existing live/archive rows |

`fetchPR2ById`, `fetchPR2ForPrint`, and `fetchPR2ApprovalDetail` already call `mergeWarehouseRemarksIntoPr2Items`. They pick up SOH once merge applies it. Do not add a second warehouse fetch.

---

## Phase 0 — Lock evidence

- [x] **Step 1: Confirm the create path still hardcodes 0**

Open `lib/pr2-warehouse.ts` and verify the item insert still contains `qty_on_hand: 0`. If it already copies `validated_soh`, stop and re-audit.

- [x] **Step 2: Confirm this document’s mismatch (optional live check)**

```sql
SELECT i.item_order, i.qty_on_hand, wvi.validated_soh
FROM pr2_items i
JOIN pr2_requests r ON r.id = i.pr2_id
JOIN warehouse_validations wv ON wv.pr1_id = r.pr1_id
JOIN warehouse_validation_items wvi ON wvi.validation_id = wv.id AND wvi.pr1_item_id = i.pr1_item_id
WHERE r.pr2_number = 'PR2-2026-2404'
ORDER BY i.item_order;
```

Expected: `qty_on_hand` 0/0/0 vs `validated_soh` 3/0/2.

---

## Phase 1 — Pure SOH merge (TDD)

Reuse `lib/warehouse-pr2-remarks.ts` so read paths do not grow a second query. Keep remark behavior byte-stable.

### Task 1: Failing SOH tests

**Files:**
- Modify: `lib/warehouse-pr2-remarks.test.ts`

- [x] **Step 1: Add these tests (do not implement the helper yet)**

Existing three remark tests stay as they are. They pass a remark object without `validatedSoh`; that field must remain optional.

Append:

```ts
import { applyWarehouseSohToPr2Item } from './warehouse-pr2-remarks';

test('copies warehouse verified SOH onto a PR2 line that stored 0', () => {
  const merged = applyWarehouseSohToPr2Item({ qty_on_hand: 0 }, { validatedSoh: 3 });
  assert.equal(merged.qty_on_hand, 3);
});

test('keeps warehouse SOH of 0 (zero stock is valid)', () => {
  const merged = applyWarehouseSohToPr2Item({ qty_on_hand: 9 }, { validatedSoh: 0 });
  assert.equal(merged.qty_on_hand, 0);
});

test('keeps stored SOH when warehouse has no verified value', () => {
  const merged = applyWarehouseSohToPr2Item({ qty_on_hand: 4 }, { validatedSoh: null });
  assert.equal(merged.qty_on_hand, 4);
});

test('keeps stored SOH when there is no warehouse line', () => {
  const merged = applyWarehouseSohToPr2Item({ qty_on_hand: 4 }, null);
  assert.equal(merged.qty_on_hand, 4);
});
```

- [x] **Step 2: Run tests and confirm the new ones fail**

```bash
npx --yes tsx --test lib/warehouse-pr2-remarks.test.ts
```

Expected: original 3 remark tests still pass; new SOH tests fail (`applyWarehouseSohToPr2Item` missing or returning stored 0).

### Task 2: Implement the helper and fold it into merge

**Files:**
- Modify: `lib/warehouse-pr2-remarks.ts`

- [x] **Step 1: Extend the line remark type**

```ts
export type WarehouseLineRemark = {
  overrideReason: string | null;
  overriddenByName: string | null;
  itemNotes: string | null;
  validatedSoh?: number | null;
};
```

- [x] **Step 2: Add `applyWarehouseSohToPr2Item`**

```ts
export function applyWarehouseSohToPr2Item(
  item: { qty_on_hand?: number | null },
  remark: { validatedSoh?: number | null } | null,
): { qty_on_hand: number } {
  const soh = remark?.validatedSoh;
  if (soh === null || soh === undefined || !Number.isFinite(Number(soh))) {
    return { qty_on_hand: Number(item.qty_on_hand) || 0 };
  }
  return { qty_on_hand: Number(soh) };
}
```

`validatedSoh: 0` must take the `Number.isFinite` branch and return `0`.

- [x] **Step 3: Apply SOH inside `mergeWarehouseRemarksIntoPr2Items`**

Current merge only spreads remark snapshots. Change it to:

```ts
export function mergeWarehouseRemarksIntoPr2Items<
  T extends {
    pr1_item_id?: string | null;
    quantity_override_reason_snapshot?: string | null;
    quantity_overridden_by_name_snapshot?: string | null;
    qty_on_hand?: number | null;
  },
>(items: T[], remarks: WarehouseRemarksForPr1): Array<T & { warehouse_item_notes: string | null; qty_on_hand: number }> {
  return items.map((item) => {
    const remark = item.pr1_item_id ? remarks.byPr1ItemId[item.pr1_item_id] ?? null : null;
    return {
      ...item,
      ...applyWarehouseRemarksToPr2Item(item, remark),
      ...applyWarehouseSohToPr2Item(item, remark),
    };
  });
}
```

- [x] **Step 4: Re-run tests**

```bash
npx --yes tsx --test lib/warehouse-pr2-remarks.test.ts
```

Expected: 7 pass, 0 fail.

---

## Phase 2 — Write path (new PR2s)

### Task 3: Copy `validated_soh` at warehouse PR2 create

**Files:**
- Modify: `lib/pr2-warehouse.ts`

- [x] **Step 1: Add `validated_soh` to the validation-item select**

Replace:

```ts
.select('pr1_item_id, procurement_qty, quantity_requested, quantity_override_reason, quantity_overridden_by_name_snapshot')
```

with:

```ts
.select('pr1_item_id, procurement_qty, quantity_requested, quantity_override_reason, quantity_overridden_by_name_snapshot, validated_soh')
```

- [x] **Step 2: Write SOH from that row**

In the `itemRows` mapper, replace `qty_on_hand: 0` with:

```ts
qty_on_hand: applyWarehouseSohToPr2Item(
  { qty_on_hand: 0 },
  { validatedSoh: line.validated_soh == null ? null : Number(line.validated_soh) },
).qty_on_hand,
```

Import `applyWarehouseSohToPr2Item` from `@/lib/warehouse-pr2-remarks`.

Leave `qty_incoming: 0`. Leave `quantity_to_purchase` as procurement qty.

If `createPR2FromWarehouseValidation` hits the existing-PR2 early return, do not update old lines here. Phase 3 overlay covers those.

- [x] **Step 3: Static check**

```bash
rg "qty_on_hand:\\s+0" -g "*.ts"
```

Expected: `lib/pr2-planning.ts` still has the raw-material `0`. `lib/pr2-warehouse.ts` no longer hardcodes `0` for `qty_on_hand`.

---

## Phase 3 — Read path (existing PR2s, including 2404)

`fetchWarehouseRemarksForPr1` already runs from `fetchPR2ById`, `fetchPR2ForPrint`, and `fetchPR2ApprovalDetail`. Teach it `validated_soh`.

### Task 4: Load `validated_soh` in the existing fetch

**Files:**
- Modify: `lib/pr2.ts` (`fetchWarehouseRemarksForPr1` only)

- [x] **Step 1: Extend the item select and mapped object**

Replace the items select with:

```ts
.select('pr1_item_id, quantity_override_reason, quantity_overridden_by_name_snapshot, item_notes, validated_soh')
```

Add to each `byPr1ItemId` entry:

```ts
validatedSoh: row.validated_soh == null ? null : Number(row.validated_soh),
```

If `Number(...)` is not finite, store `null`.

Do not change the function name or call sites.

- [x] **Step 2: Confirm merge is already used**

```bash
rg "mergeWarehouseRemarksIntoPr2Items" -g "*.ts"
```

Expected: `lib/pr2.ts` (by-id + print) and `lib/pr2-approvals.ts`. No extra wiring.

---

## Phase 4 — Verify

### Task 5: Tests + static diff

- [x] **Step 1: Re-run helper tests**

```bash
npx --yes tsx --test lib/warehouse-pr2-remarks.test.ts
```

Expected: 7 pass.

- [x] **Step 2: Confirm forbidden files were not edited**

```bash
git diff --stat
```

Stop if `lib/warehouse.ts`, `lib/pr2-planning.ts`, `lib/po-approvals.ts`, `lib/rfq-approvals.ts`, or unwind migrations appear as *new* edits from this work.

### Task 6: Manual QA

- [ ] **Step 1: Existing document (read overlay)**

Refresh `/pr2/fc0104a1-ede9-4ad7-8c1e-95cca0d851c6` (`PR2-2026-2404`) as procurement.

Expected SOH: **3 / 0 / 2**. Req. and To Buy stay **2 / 10 / 13**. In-Transit stays **0**.

Also open the matching `/approvals/pr2/{instanceId}` if still reachable and the print page. Same SOH.

- [ ] **Step 2: New warehouse PR2 (write path)**

After warehouse submits a *new* goods/services validation that creates a PR2, that PR2’s `pr2_items.qty_on_hand` in the database must equal `validated_soh` (not only the overlay).

```sql
SELECT i.qty_on_hand, wvi.validated_soh
FROM pr2_items i
JOIN pr2_requests r ON r.id = i.pr2_id
JOIN warehouse_validations wv ON wv.pr1_id = r.pr1_id
JOIN warehouse_validation_items wvi
  ON wvi.validation_id = wv.id AND wvi.pr1_item_id = i.pr1_item_id
WHERE r.id = '<new-pr2-id>';
```

Expected: columns equal, including zeros.

- [ ] **Step 3: Raw-material sanity**

Open a planning PR2 with no `pr1_id`. SOH stays 0. Do not invent warehouse SOH.

---

## Phase 5 — Optional persist backfill (separate, only if asked)

Read overlay fixes the live UI while warehouse validation still exists. After a later unwind, validation rows are deleted and an archived PR2 created *before* Phase 2 would still print SOH 0.

Only then run (not as part of Phases 1–4):

```sql
UPDATE pr2_items i
SET qty_on_hand = wvi.validated_soh
FROM warehouse_validation_items wvi
JOIN warehouse_validations wv ON wv.id = wvi.validation_id
JOIN pr2_requests r ON r.id = i.pr2_id AND r.pr1_id = wv.pr1_id
WHERE i.pr1_item_id = wvi.pr1_item_id
  AND wvi.validated_soh IS NOT NULL;

UPDATE pr2_items_archive i
SET qty_on_hand = wvi.validated_soh
FROM warehouse_validation_items wvi
JOIN warehouse_validations wv ON wv.id = wvi.validation_id
JOIN pr2_requests_archive r ON r.id = i.pr2_id AND r.pr1_id = wv.pr1_id
WHERE i.pr1_item_id = wvi.pr1_item_id
  AND wvi.validated_soh IS NOT NULL;
```

Do **not** put this in a repo migration unless the user asks. It is a one-off data heal.

---

## Rollback

- Revert the three TypeScript files. No DDL to undo for Phases 1–4.
- If Phase 5 ran, restore `qty_on_hand` only from a backup or known previous values. Do not blanket-zero live rows.

---

## Self-review

| Audit requirement | Task |
|---|---|
| New warehouse PR2s store real SOH | Phase 2 |
| `PR2-2026-2404` shows 3 / 0 / 2 without recreate | Phase 3 |
| Warehouse `0` stays `0` | Phase 1 tests |
| To Buy / Req. / prices unchanged | Constraints 1, 7; Phase 4 QA |
| Raw-material PR2 unchanged | Constraint 4; Phase 4 Step 3 |
| In-transit unchanged | Constraint 2 |
| Approval + print pick up the same number | Existing merge call sites |
