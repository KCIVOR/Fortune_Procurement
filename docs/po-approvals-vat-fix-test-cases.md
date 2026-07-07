# Test Cases — PO Approval / Supplier PO VAT Breakdown Fix

Fixes the bug where `/approvals/po/[id]` and `/supplier/po/[id]` only showed "Grand Total"
(no Subtotal/VAT split) even when the PO had VAT-registered lines, because
`fetchPOApprovalDetail()` in `lib/po-approvals.ts` was silently dropping `vat_type`/
`vat_rate_applied` when mapping DB rows into the approval detail object.

---

## T1 — Regression check on the exact PO that surfaced the bug

1. Log in as procurement/approver.
2. Open `http://localhost:3000/approvals/po/40dcc46d-83cc-4166-bae6-decb93430174` (PO-2026-0020).
3. **Expect:** header summary now shows `Subtotal: ₱4,026.79 · VAT: ₱483.21 · Grand Total: ₱4,510.00` (previously showed only `Grand Total: ₱4,510.00`).
4. Scroll to the table footer — **expect** separate Subtotal / VAT / Grand Total rows above the items table footer, matching the numbers from `/po/40dcc46d-83cc-4166-bae6-decb93430174` and `/approvals/pr2/2d214827-6265-4ef2-84da-9786d1f17509`.
5. Log in as the awarded supplier (Ace Supply Corp) and open `http://localhost:3000/supplier/po/40dcc46d-83cc-4166-bae6-decb93430174`.
6. **Expect:** same Subtotal/VAT/Total breakdown as step 3–4.

## T2 — Cross-page consistency (all four PO/PR2 views must agree)

For the same PO, compare these four pages side by side:
- `/po/[id]` (procurement detail)
- `/approvals/po/[id]` (approver view)
- `/supplier/po/[id]` (supplier view)
- `/approvals/pr2/[id]` (the PR2 this PO was generated from)

**Expect:** identical Subtotal, VAT, and Grand Total figures on all four — since they all read the same snapshotted `vat_type`/`vat_rate_applied` per line, none should ever disagree.

## T3 — Non-VAT PO still shows plain Grand Total (no false positives)

1. Find or generate a PO whose lines are all from non-VAT-registered suppliers (or generate one with `vat_type = null` on every `po_items` row).
2. Open `/approvals/po/[id]` and `/supplier/po/[id]` for that PO.
3. **Expect:** plain "Grand Total" only — no Subtotal/VAT rows — since `vatBreakdown.vatAmount` should compute to exactly `0` for an all-non-VAT PO. (This confirms the fix didn't overcorrect into showing a VAT row unconditionally.)

## T4 — New PO generated after the fix (not just the pre-existing test data)

1. Run a fresh RFQ → award → PR2 → PO cycle where the winning supplier is VAT-registered and quotes VAT-Exclusive (or Inclusive).
2. Once the PO is generated, check `/po/[id]`, `/approvals/po/[id]`, and `/supplier/po/[id]` (after each approval step unlocks it).
3. **Expect:** all three show the same Subtotal/VAT/Total breakdown from the moment the PO is generated — no need to wait for full approval or manual DB correction.

## T5 — Sanity: raw DB values still match what's displayed

Run this query for any PO you're testing and compare against the UI:

```sql
select id, description, unit_price, total_price, vat_type, vat_rate_applied
from po_items
where po_id = '<the PO id>';
```

**Expect:** `total_price` per line matches what's shown in each page's items table, and manually recomputing `Subtotal = total_price / (1 + vat_rate_applied/100)` (for `vat_inclusive`) or `Subtotal = unit_price * quantity_to_purchase` (for `vat_exclusive`) matches the displayed Subtotal.

---

## Quick pass/fail checklist

- [ ] T1 — PO-2026-0020 shows the breakdown on approvals/po and supplier/po (previously broken)
- [ ] T2 — all four pages agree on the same PO's numbers
- [ ] T3 — an all-non-VAT PO shows plain Grand Total on both pages, no stray VAT row
- [ ] T4 — a brand-new PO generated post-fix shows the breakdown immediately, no manual DB fix needed
- [ ] T5 — displayed numbers match raw `po_items` values
