# External Vendor (Manual Quote) — Implementation Plan

Lets **Procurement** add an external vendor (e.g. Shopee, Lazada, a walk-in store) to an RFQ
**without a supplier account**, enter quotes on that vendor's behalf in the canvassing matrix, award
them, and carry them through PR2 → PO → GRN **without** the supplier portal (no login, no
acknowledgment, no supplier delivery updates).

This document is the implementation plan derived from the live DB + codebase audit. Read the
**Surgical Principles** first — every phase is written to add a parallel path, never to mutate the
existing supplier path.

---

## Audit Recap (corrected against live schema + code)

The first-pass audit was mostly right, but a deeper read corrected two findings. Both matter for not
breaking things.

### Already compatible — touch nothing

| Area | Why it already works |
|------|----------------------|
| `rfq_suppliers.supplier_id` | Already **nullable**. External slot = row with `supplier_id NULL`. |
| `po_requests.supplier_id` / `po_items` | `supplier_id` nullable; name carried by `supplier_name_snapshot`. |
| `supplier_item_selections` | Awards key off `selected_rfq_supplier_id`, never `supplier_id`. |
| **PR2 generation** (`lib/pr2.ts`) | **Correction:** builds line names from `rfq_suppliers.supplier_name_snapshot` (pr2.ts:205-207), **not** `supplier_id`. External vendors flow through PR2 **with no change**. |
| `unselect_on_quote_change` trigger | Fires on any `rfq_item_quotes` UPDATE incl. procurement-entered. ✅ |
| `deliveries` / `grn_receipts` tables | `deliveries.supplier_id` nullable; GRN links via `delivery_id`. Warehouse-driven. |

### Real blockers

| # | Blocker | Evidence |
|---|---------|----------|
| B1 | No procurement **INSERT** policy on `rfq_item_quotes` — only `"Suppliers can insert own quotes"` (gated `supplier_id = auth.uid()`). Procurement-entered quotes silently fail. | RLS audit |
| B2 | No flag distinguishes an external slot from a registered supplier with a null `supplier_id`. | `rfq_suppliers` columns |
| B3 | `assignSuppliers()` only maps existing profile UUIDs → name. No name-only path. | canvassing.ts:716-733 |
| B4 | **PO grouping collision.** `fetchPOGenerationCandidates()` groups by `rsById[sid].supplier_id` (po.ts:268) and `generatePOFromPR2()` filters by `profileByRfqSid[...] === supplierProfileId` (po.ts:465). For external vendors `supplier_id` is **null**, so *every* external vendor on a PR2 collapses under the `null` key — Shopee + Lazada would merge into one PO. | po.ts:265-282, 452-466 |
| B5 | **Delivery row is created only on supplier acknowledgment.** `acknowledgeSupplierPO()` does `status approved→sent` **and** `createDeliveryForPO()` (po-approvals.ts:847-852). GRN depends on that delivery row. With no supplier to acknowledge, an external PO can **never reach GRN**. | po-approvals.ts:744-852 |
| B6 | Canvassing matrix renders supplier quotes **read-only** for procurement; email/Viber buttons assume a contactable supplier. | rfq/[id]/page.tsx (MatrixRow) |

> **Note on "skip delivery":** GRN is reached *through* a `deliveries` row, so we don't literally skip
> it — we create that row at PO time via procurement action instead of supplier acknowledgment. The
> supplier-facing acknowledgment + delivery-update screens are simply never used.

---

## Surgical Principles (apply to every phase)

1. **Parallel path, never mutation.** Gate every new behavior behind `is_external === true`. The
   registered-supplier code path must be byte-for-byte unaffected when `is_external` is false.
2. **Additive DB only.** New column has `DEFAULT false`; new RLS policies are *additional* `OR`
   branches, never edits to existing policies. No column drops, no type changes, no policy
   replacement.
3. **Null-key safety.** Wherever code groups/filters by `supplier_id`, switch the *key* to
   `supplier_id ?? rfq_supplier_id` (or `selected_rfq_supplier_id`). This is identity-preserving for
   registered suppliers (their `supplier_id` is non-null) and only changes behavior for external rows.
4. **No signature breakage.** Extend functions with **optional** params defaulting to current
   behavior. Existing callers compile and behave unchanged.
5. **Verify per phase.** Each phase ends with `npx tsc --noEmit` + a targeted manual/SQL check before
   the next phase starts. Phases are ordered so the app is never left broken.
6. **Reversible.** Each phase lists its rollback. DB phases ship as their own migration file.

---

## Phase 0 — Types & constants (no behavior change)

**Goal:** introduce the `is_external` field across the type layer so later phases compile.

| File | Change |
|------|--------|
| `types/canvassing.ts` | Add `is_external?: boolean` to the `rfq_suppliers` row type / `CanvassSupplier` and any supplier-quote view type that surfaces a column. |
| `types/po.ts` | Add `is_external?: boolean` to `POGenerationCandidate` (so grouping can carry it through). |

**Do NOT touch:** any runtime logic. Type-only.
**Verify:** `npx tsc --noEmit` clean.
**Rollback:** revert the two type edits.

---

## Phase 1 — Database migration (additive)

**File:** `supabase/migrations/2026XXXXxxxxxx_external_vendor_support.sql`

```sql
-- B2: flag external vendor slots
ALTER TABLE rfq_suppliers
  ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT false;

-- B1: allow procurement to INSERT/UPDATE quotes (for external vendor slots).
-- Additional policies — existing supplier policies are left untouched.
CREATE POLICY "Procurement can insert rfq_item_quotes"
  ON rfq_item_quotes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'procurement'));

CREATE POLICY "Procurement can update rfq_item_quotes"
  ON rfq_item_quotes FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'procurement'));
```

**Surgical guardrails**
- `ADD COLUMN ... DEFAULT false` backfills every existing row to `false` → existing RFQs unchanged.
- New RLS policies are **permissive** and **additive** (Postgres ORs multiple permissive policies).
  Suppliers' existing insert/update rights are not modified.
- The `unselect_on_quote_change` trigger needs no change — it already fires on procurement UPDATEs.

**Verify**
```sql
SELECT is_external, count(*) FROM rfq_suppliers GROUP BY 1;  -- all existing = false
SELECT polname FROM pg_policy WHERE polrelid='rfq_item_quotes'::regclass AND polcmd IN ('a','w');
```
**Rollback:** `DROP POLICY` the two new policies; `ALTER TABLE rfq_suppliers DROP COLUMN is_external;`

---

## Phase 2 — Add external vendor to an RFQ

**Goal:** procurement can create a name-only vendor slot.

### 2a. `lib/canvassing.ts` — new function (don't overload `assignSuppliers`)

Add a **separate** function so the existing one is untouched:

```ts
export async function addExternalVendorToRfq(
  rfqId: string,
  vendorName: string,        // "Shopee", "Lazada", "CDR King — SM North"
): Promise<void> {
  const name = vendorName.trim();
  if (!name) throw new Error('Vendor name is required.');
  const { error } = await db.from('rfq_suppliers').insert({
    rfq_id:                 rfqId,
    supplier_id:            null,
    supplier_name_snapshot: name,
    is_external:            true,
    status:                 'submitted', // procurement enters the quote, so it's not "invited"
    invited_at:             new Date().toISOString(),
  });
  if (error) throw error;
}
```

> `status: 'submitted'` is intentional — there is no invite/response cycle. (Allowed by
> `rfq_suppliers_status_check`: invited|submitted|declined.)

### 2b. `components/canvassing/AssignSuppliersModal.tsx` — additive UI branch

- Add a small **"+ Add external vendor"** affordance: a text input + Add button.
- On add, call `addExternalVendorToRfq`. Existing registered-supplier selection list is left as-is.

**Surgical guardrails:** `assignSuppliers()` signature and body unchanged. Modal's existing list path
unchanged; the external entry is a new sibling section.

**Verify:** add "Shopee" to a draft RFQ → row appears with `is_external=true`, `supplier_id=null`.
**Rollback:** remove the new function + UI block.

---

## Phase 3 — Canvassing matrix: enter & display external quotes

**File:** `app/rfq/[id]/page.tsx` (`MatrixRow` + supplier column header)

### 3a. Inline quote entry (the core)
For a column whose `rfq_supplier.is_external === true` and where no quote exists yet, render an
**inline editable form** (unit price, quoted description, lead time, attachment upload) with a
Save action that:
- calls `submitSupplierQuotation(rfqSupplierId, [draft])` — **reuse the existing function** (works
  under the new procurement INSERT/UPDATE policy). No new write path.

### 3b. Display
- Show an **"External"** badge on the column header for `is_external` rows.
- Quotes render with the existing **`verification_status === 'manual'`** branch (already handled by
  the matrix) → "Manual entry" pill. No catalog/product link is shown.

### 3c. Hide unreachable actions (B6)
- Gate the **email** / **Viber copy** buttons with `!supplier.is_external` (no contact channel).

**Surgical guardrails**
- Editing is **only** rendered when `is_external`. Registered-supplier columns stay read-only exactly
  as today.
- Reuse `submitSupplierQuotation` — do not fork quote-writing logic.
- The award/select flow (`saveItemSelection`) is **unchanged**: external quotes are `'manual'`, and
  the existing justification path already covers them.

**Verify:** enter a price for Shopee → row saves, shows in matrix, can be Selected; editing it after
selection unselects (trigger) and notifies procurement.
**Rollback:** remove the inline-form branch + badge + button gating.

---

## Phase 4 — PO generation: fix the null-key collision (B4)

**File:** `lib/po.ts`

This is the highest-risk change. The fix is a **key swap**, identity-preserving for registered
suppliers.

### 4a. `fetchPOGenerationCandidates()` (po.ts ~265-305)
Replace the grouping key `supplier_id` with a fallback that stays unique per external vendor:

```ts
// before: const profileId = rsById[sid].supplier_id;
const groupKey = rsById[sid].supplier_id ?? `ext:${sid}`;   // sid = rfq_supplier_id
```
- Group, `candidateKey`, and `poByPr2Supplier` map all keyed by `groupKey`.
- `POGenerationCandidate.supplier_id` becomes `rsById[sid].supplier_id` (may be `null`); carry
  `is_external` + `selected_rfq_supplier_ids` (already present) so Phase 4b can re-resolve.

### 4b. `generatePOFromPR2()` (po.ts ~452-487)
The item filter (po.ts:465) must match the **same** key. Change the function to accept the candidate's
**`selected_rfq_supplier_ids`** (the precise winning slots) and filter by membership instead of
`profileByRfqSid[...] === supplierProfileId`:

```ts
const winningSet = new Set(selectedRfqSupplierIds);
const pr2Items = pr2ItemsRaw.filter(i => winningSet.has(i.selected_rfq_supplier_id));
```
- Insert PO header with `supplier_id: supplierProfileId ?? null` and
  `supplier_name_snapshot` from the (already-required) line snapshot.

**Surgical guardrails**
- For registered suppliers `supplier_id` is non-null → `groupKey === supplier_id` → **identical**
  grouping, candidateKeys, and dedup as today.
- Filtering by `selected_rfq_supplier_ids` is *stricter and correct* for both paths (it's the exact
  set the candidate was built from), so registered-supplier POs are unchanged.
- Keep the existing "duplicate PO" guard (po.ts:419) but key it on the candidate, not raw
  `supplier_id` (null would false-match across external vendors otherwise).

**Verify**
- Two external vendors (Shopee + Lazada) on one PR2 → **two distinct** PO candidates, two POs.
- A registered-supplier PR2 → byte-identical candidate set to before (regression check).
**Rollback:** revert po.ts to `supplier_id` keying.

---

## Phase 5 — External PO fulfillment → GRN (B5)

**Goal:** create the `deliveries` row (which GRN needs) without supplier acknowledgment.

**File:** `lib/po-approvals.ts` + a procurement action in the PO detail UI.

`acknowledgeSupplierPO()` (po-approvals.ts:744-852) currently does, as the supplier:
`status approved→sent` **+** `createDeliveryForPO(...)`. Mirror just that side-effect for external POs.

### 5a. New procurement function

```ts
export async function markExternalPOOrdered(
  poId: string,
  profile: UserProfile,
): Promise<void> {
  // guard: PO must be 'approved' AND its supplier_id IS NULL (external)
  // 1. status approved → sent
  // 2. createDeliveryForPO({ ... })  ← same call the supplier path makes
  // 3. audit log 'PO_MARKED_ORDERED_EXTERNAL'
}
```

### 5b. UI
On the PO detail page, for `supplier_id === null` POs in `approved` status, show a procurement-only
**"Mark as Ordered"** button → `markExternalPOOrdered`. (Registered-supplier POs keep the supplier
acknowledgment flow untouched.)

**Surgical guardrails**
- Do **not** modify `acknowledgeSupplierPO` — add a sibling. Reuse `createDeliveryForPO` verbatim so
  the delivery/GRN shape is identical to the supplier path.
- Guard on `supplier_id IS NULL` so this action can never fire on a registered-supplier PO.
- Downstream GRN, warehouse receipt, delivery status history all work unchanged (they key on
  `delivery_id` / `po_id`, not the acknowledgment actor).

**Verify:** approve an external PO → "Mark as Ordered" → delivery row exists → GRN can be created and
closed exactly like a normal PO.
**Rollback:** remove `markExternalPOOrdered` + the button.

---

## Phase 6 — Polish & audit trail

- Audit action `EXTERNAL_VENDOR_QUOTE_ENTERED` written when procurement saves an external quote
  (Phase 3a).
- Optional: a faint "External vendor — quote entered by Procurement" note on PR2/PO approval detail
  so approvers have context (read-only label; no logic).

**Verify:** `npx tsc --noEmit`; full end-to-end smoke (assign → quote → select → PR2 → PO → mark
ordered → GRN).

---

## Phase / Blocker coverage

| Blocker | Resolved in |
|---------|-------------|
| B1 procurement quote RLS | Phase 1 |
| B2 external flag | Phase 0 + 1 |
| B3 name-only assign | Phase 2 |
| B4 PO null-key collision | Phase 4 |
| B5 delivery/GRN without ack | Phase 5 |
| B6 matrix entry + hidden contact buttons | Phase 3 |

## Build order & risk

| Phase | Risk | Why |
|-------|------|-----|
| 0 Types | none | type-only |
| 1 DB | low | additive column + additive policies |
| 2 Assign | low | new function + new UI section |
| 3 Matrix | medium | new editable branch; reuses existing write fn |
| 4 PO gen | **high** | shared grouping code — mitigated by identity-preserving key swap + regression check |
| 5 Fulfillment | medium | sibling of acknowledge; reuses `createDeliveryForPO` |
| 6 Polish | none | labels + audit only |

Ship and verify **one phase at a time**, in order. The app remains shippable after every phase.

---

## Affected Surfaces — Full Inventory

Every page that touches suppliers, quotes, POs, deliveries, or GRN was audited. Grouped by required
action. **Key fact:** nearly all list/detail/print pages render `supplier_name_snapshot` (a stored
string), so they display an external vendor's name correctly **with zero changes**. Only the surfaces
below in groups B and C need work.

### Group A — Verified safe, NO change needed (render snapshot only)

| Surface | Why safe |
|---------|----------|
| `app/pr2/page.tsx`, `app/pr2/[id]/page.tsx` | PR2 lines use `supplier_name_snapshot`. |
| `app/pr2/[id]/print/page.tsx` | Print pulls snapshots. |
| `app/po/page.tsx` | PO list renders `supplier_name_snapshot`. |
| `app/po/[id]/print/page.tsx` | Print uses snapshots; acknowledgment block only renders if a receipt exists. |
| `app/approvals/pr2/page.tsx` + `[id]` | Approval views render snapshots; no supplier link. |
| `app/approvals/po/page.tsx` + `[id]` | Same. |
| `app/approvals/history/page.tsx` | Document-level, no supplier identity. |
| `app/grn/page.tsx`, `app/grn/[id]/page.tsx`, `app/grn/[id]/print/page.tsx` | Render `supplier_name_snapshot`; GRN keys on `delivery_id`. |
| `app/delivery/[id]/page.tsx` | Renders snapshot; keys on delivery row created in Phase 5. |
| `app/po/new/page.tsx` payment-terms prefill (line 146) | `fetchSupplierPaymentTermsBySupplierId(null)` is already wrapped in try/catch with `if (!terms) return` → silently leaves the field blank for manual entry. **Desired behavior**, no change. |

### Group B — Copy / label only (low risk, do in Phase 3 & 6)

| Surface | Change | Phase |
|---------|--------|-------|
| `app/rfq/[id]/page.tsx` — supplier column header | Add **"External"** badge for `is_external` rows. | 3 |
| `app/rfq/[id]/page.tsx` — email / Viber buttons (`formatRfqForViber`, line 277) | Hide for `is_external` (no contact channel). | 3 |
| `app/delivery/page.tsx` — empty-state copy (line 196) | "…once POs are acknowledged by suppliers" → reword to include external POs marked as ordered. | 6 |
| `app/po/[id]/page.tsx` — fulfillment status block (~line 628 "Awaiting action") | For `supplier_id === null`, label the state as "External — awaiting procurement order" instead of awaiting supplier acknowledgment. | 5 |
| PR2/PO/GRN detail (optional) | Faint "External vendor — entered by Procurement" tag for approver context. | 6 |

### Group C — Logic guard needed (medium risk)

| Surface | Issue | Fix | Phase |
|---------|-------|-----|-------|
| `app/rfq/[id]/page.tsx` — "Review product →" link (line 964-966) | Links to `/accreditation/products/{supplier_product_id}`. | **Already null-safe** — gated on `quote.supplier_product_id` which is always null for external. Confirm no regression. | 3 |
| `app/po/new/page.tsx` — candidate preselect match (line 90) | `c.supplier_id === preselectedSupplier` collides on `null`. | Match on `candidateKey` (Phase 4's new key), not raw `supplier_id`. | 4 |
| `app/po/[id]/page.tsx` — acknowledgment / "Mark as Ordered" action | Registered POs wait for supplier ack; external POs have no supplier. | Render procurement **"Mark as Ordered"** button when `supplier_id === null && status==='approved'` (Phase 5b). | 5 |

### Group D — Intentionally excluded (external vendors never reach these)

| Surface | Reason |
|---------|--------|
| `app/supplier/quotations/**` | No login; procurement enters quotes in the matrix instead. |
| `app/supplier/po/**`, `app/supplier/delivery/**` | No portal access; procurement/warehouse drive fulfillment. |
| `app/supplier/products/**`, `app/supplier/accreditation/page.tsx` | External vendors have no catalog or accreditation. |
| `app/accreditation/**` (procurement review) | External vendors are never accredited; they never appear in the review queue. |

### Dashboards / counts

| Surface | Check |
|---------|-------|
| Procurement / admin dashboards | Supplier counts query `profiles` (role = supplier). External vendors are **not** profiles, so counts are unaffected. PO/delivery/GRN counts include external rows naturally (keyed on `po_id`/`delivery_id`). **No change**, but verify the "awaiting acknowledgment" tile copy isn't misleading once external POs exist. |

> The phase bodies above (3, 4, 5, 6) already own each of these items. This inventory exists so the
> reviewer can confirm **no display surface was missed** — every page that renders supplier identity,
> quotes, POs, deliveries, or GRN is accounted for as Safe (A), Copy (B), Guard (C), or Excluded (D).
