# VAT Handling — Manual Test Cases (Rev #1)

Test with the system VAT rate at the seeded default of **12%** unless a case says otherwise.
You'll need at least: 1 admin/procurement account, 2 supplier accounts (one VAT-registered, one not), and one PR1 you can push through canvassing → RFQ → PR2 → PO.

---

## Setup

### T0 — Set the system VAT rate
1. Log in as admin → `/admin/settings`.
2. Confirm a new **VAT Rate** card appears (next to Expiry Settings) showing `12`.
3. Change it to `12` (or leave as-is) and click **Save VAT Rate**.
4. **Expect:** success message; value persists after refresh.

### T1 — Toggle a supplier's VAT registration
1. As admin or procurement, go to `/suppliers` → open **Supplier A**.
2. Confirm a **VAT Registration** card appears (below Payment Terms) with **VAT-able** / **Non-VAT** buttons, defaulting to **Non-VAT**.
3. Click **VAT-able** → **Save VAT Status**.
4. **Expect:** success message; refresh the page and confirm it still shows VAT-able.
5. Leave **Supplier B** as **Non-VAT** (default, no action needed).

---

## Quotation submission

### T2 — Supplier's own quotation form (VAT-registered supplier)
1. Create/open an RFQ that invites **Supplier A** (VAT-able) and **Supplier B** (Non-VAT).
2. Log in as **Supplier A** → open the quotation form for this RFQ.
3. **Expect:** each priced line shows a **VAT-Inclusive / VAT-Exclusive** toggle (not present for no-quote lines).
4. Enter a unit price, select **VAT-Exclusive**.
5. **Expect:** live preview shows `Subtotal: ₱X · VAT: ₱Y (12%) · Total: ₱X+Y` where `Y = X × 0.12`.
6. Switch the same line to **VAT-Inclusive**.
7. **Expect:** preview recalculates so the **quoted unit price × qty stays the Total**, and Subtotal is backed out (`Subtotal = Total / 1.12`).
8. Try submitting a priced line with no VAT-IN/EX selected.
9. **Expect:** blocked with an error asking you to select VAT-Inclusive or VAT-Exclusive.
10. Select VAT-Exclusive (or Inclusive) on all priced lines and submit successfully.

### T3 — Supplier's own quotation form (Non-VAT supplier)
1. Log in as **Supplier B** (Non-VAT) → open the quotation form for the same RFQ.
2. **Expect:** no VAT-IN/EX toggle appears anywhere on the form.
3. Enter prices and submit.
4. **Expect:** submission succeeds with no VAT-related validation prompts; preview just shows a plain Total.

### T4 — Procurement's external-vendor manual quote entry
1. As procurement, open the RFQ detail page → add/select an **external vendor** (no supplier account) invited to the RFQ.
2. Click **Enter quote** for a line.
3. If the external vendor lookup resolves to a VAT-registered supplier profile, confirm the VAT-IN/EX toggle appears; for a plain external vendor (no profile), confirm it does **not** appear.
4. Enter a price + lead time, save.
5. **Expect:** saves successfully; reopening **Edit quote** shows the previously selected VAT type still applied (if applicable).

### T5 — RFQ comparison matrix reflects VAT-aware totals
1. As procurement, open the RFQ's quote comparison view for the item(s) quoted in T2–T4.
2. **Expect:** the "Total" shown per quote cell matches the VAT-aware total (not a plain `unit_price × qty`) — e.g. Supplier A's VAT-Exclusive line total should be ~12% higher than `unit_price × qty`.

---

## PR2 generation

### T6 — Award and generate PR2 with mixed VAT lines
1. Close the RFQ, award at least one line to **Supplier A** (VAT) and one to **Supplier B** (Non-VAT) (or an external vendor from T4).
2. Generate the PR2.
3. Open `/pr2/[id]`.
4. **Expect:**
   - Each row's line total reflects VAT math for VAT-registered awards, plain price×qty for non-VAT awards.
   - The bottom summary shows **Subtotal / VAT / Total** (not just "Grand Total") since at least one line has VAT.
   - If you temporarily test with *all* lines non-VAT, the summary should collapse back to a plain "Grand Total" (no VAT row).

### T7 — Edit PR2 quantity, confirm VAT recomputes
1. On the same PR2 (status `draft`), click **Edit**.
2. Change `quantity_to_purchase` on the VAT-registered line.
3. **Expect:** the row's total updates immediately, still applying VAT at the snapshotted rate/type (not reverting to plain price×qty).
4. Save changes.
5. Reopen the PR2 and confirm the saved total matches what was shown before saving.

### T8 — PR2 approval detail shows the same breakdown
1. Submit the PR2 for approval.
2. As an approver, open `/approvals/pr2/[id]`.
3. **Expect:** same Subtotal/VAT/Total breakdown as the PR2 detail page, both in the header summary and the table footer.

---

## PO generation

### T9 — Generate PO, confirm VAT snapshot carries over
1. Approve the PR2 fully, generate a PO for the VAT-registered supplier's awarded lines.
2. Open `/po/[id]`.
3. **Expect:** the grand-total card and table footer show Subtotal/VAT/Total, matching the PR2's line-level VAT snapshot (same rate/type, not re-looked-up from current system settings).
4. **Regression check:** change the system VAT rate in `/admin/settings` (e.g. to 10%) *after* this PO was generated, then reload `/po/[id]`.
5. **Expect:** this PO's totals stay at the original 12% — they must not shift with the new rate. (Restore the rate to 12% afterward.)

### T10 — PO approvals + supplier PO view + print
1. As an approver, open `/approvals/po/[id]` → confirm the same Subtotal/VAT/Total breakdown appears (summary line + table footer).
2. Approve fully. As the awarded supplier, open `/supplier/po/[id]` → confirm the same breakdown.
3. Open the PO's print view (`/po/[id]/print`) → confirm the printed table shows Subtotal/VAT/Total rows above Grand Total when VAT applies, and a plain Grand Total when it doesn't.

### T11 — Non-VAT-only PO has no VAT clutter
1. Generate a separate PO consisting entirely of non-VAT-registered supplier lines.
2. **Expect:** every display surface (PO detail, approvals, supplier view, print) shows a plain Grand Total with no Subtotal/VAT rows.

---

## Access control

### T12 — Non-admin/procurement cannot toggle VAT status or rate
1. Log in as a non-admin/procurement role (e.g. requisitioner or supplier).
2. Attempt to hit `PATCH /api/admin/users/<id>/vat-status` or update `/admin/settings` directly (or just confirm the UI doesn't expose these controls to that role).
3. **Expect:** UI hides these controls for unauthorized roles; direct API calls return 401/403.

---

## Quick pass/fail checklist

- [ ] T0 admin VAT rate save/persist
- [ ] T1 supplier VAT toggle save/persist
- [ ] T2 VAT-registered supplier sees toggle, math correct both ways, validation blocks missing selection
- [ ] T3 non-VAT supplier sees no toggle
- [ ] T4 external vendor VAT toggle conditional on profile, edit preserves selection
- [ ] T5 RFQ matrix totals are VAT-aware
- [ ] T6 PR2 generation snapshots VAT correctly, breakdown shown only when applicable
- [ ] T7 PR2 qty edit keeps VAT math correct
- [ ] T8 PR2 approval detail matches PR2 detail
- [ ] T9 PO snapshot carries over and doesn't drift with later rate changes
- [ ] T10 PO approvals/supplier/print all consistent
- [ ] T11 all-non-VAT PO has no VAT clutter
- [ ] T12 access control holds
