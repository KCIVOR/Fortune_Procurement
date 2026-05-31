# UAT Supplement — Raw Materials Classification

**Document Version:** 1.0
**Date:** May 27, 2026
**Companion to:** `UAT_Role_Position_Based.md`

This supplement covers the **raw-material flag** workflow introduced in the
Raw Mats Implementation Plan (`docs/RAW_MATS_IMPLEMENTATION_PLAN.md`). Run
these scenarios after the role-based UAT in the main document to verify the
new flow end-to-end.

---

## Quick Reference

### Concept
- **Raw material** = production input (chemicals, components, etc.) where
  procurement wants verified suppliers and traceable awards.
- **Non-raw material** = office supplies, stationery, generic consumables —
  no verification pressure.

### Where the flag lives
- Set by the requestor on each **PR1 line** during draft.
- Snapshotted onto each **PR2 line** at PR2 generation.
- Carried via join through PO and GRN read surfaces.

### Behaviour matrix
| Item type | Quote state | Award flow |
|---|---|---|
| Raw mats | Verified product | Direct award. |
| Raw mats | Unverified product | **Justification modal (≥20 chars).** |
| Raw mats | Manual entry | **Justification modal (≥20 chars).** |
| Raw mats | Withdrawn product | Blocked. |
| Non-raw-mats | Any of: verified / unverified / manual | Direct award. |
| Non-raw-mats | Withdrawn product | Blocked. |
| Any | Substitute, not yet decided / rejected | Blocked. |
| Any | No-Quote | Blocked. |

---

## Scenario R1 — Employee marks a raw-material line on PR1

**Role:** Employee
**Pre-conditions:** A logged-in employee on `/pr1/new`.

1. Add three line items.
2. On line 2, click the flask-icon checkbox in the **Raw Mat.** column.
3. Save Draft.
4. Reopen the draft.

**Expected:**
- Line 2's flask icon stays active (primary-blue background).
- Lines 1 and 3 stay inactive (neutral grey).
- After Submit, the form is no longer editable; opening the PR1 detail page
  shows the **Type** column with a "Raw Mat." pill on line 2 only.

---

## Scenario R2 — Approval surfaces show the badge

**Role:** Approver (any position)
**Pre-conditions:** PR1 from R1 routed to your step.

1. Open the PR1 from your approval queue.
2. Inspect the items table.

**Expected:**
- Line 2 shows the "Raw Mat." pill in the **Type** column.
- Other lines show an em-dash.
- The badge is read-only (no clickable behaviour).

---

## Scenario R3 — Warehouse validation carries the badge

**Role:** Warehouse Staff
**Pre-conditions:** PR1 from R1 awaiting validation.

1. Open `/warehouse/{pr1_id}`.

**Expected:**
- Line 2 shows the "Raw Mat." pill in the **Type** column.
- Validating SOH does not affect the badge.

---

## Scenario R4 — Supplier sees the badge in RFQ

**Role:** Supplier
**Pre-conditions:** RFQ assigned to the supplier whose PR1 had R1's
classification.

1. Open `/supplier/quotations/{rfqSupplierId}`.

**Expected:**
- Each item header shows the description plus a "Raw Mat." pill on the
  flagged line.

---

## Scenario R5 — Supplier offers verified product (raw mats)

**Role:** Supplier
**Pre-conditions:** R4. The supplier already has a **verified** catalog
product.

1. On the raw-mats line, click "Select Catalog Product" and pick a
   **verified** product.
2. Fill price + lead time.
3. Submit Quotation.

**Expected:**
- The selected-product card shows a green "Verified" pill.
- No raw-mats inline warning is shown.
- Submission succeeds.

---

## Scenario R6 — Supplier offers unverified product (raw mats)

**Role:** Supplier
**Pre-conditions:** R4. The supplier has at least one **submitted /
under_review / pending_tsqa** product.

1. On the raw-mats line, click "Select Catalog Product" and pick a
   **non-verified** product.
2. Fill price + lead time.
3. Submit Quotation.

**Expected:**
- Selected-product card uses amber tone with a "Pending review" / "Under
  review" / "Pending TSQA" status pill.
- Inline warning chip on the line: "This is a raw material line. You may
  submit with a product still pending verification; procurement will see
  the verification status during canvassing and may request justification
  before awarding."
- Submission succeeds.

---

## Scenario R7 — Supplier fills the line manually (raw mats)

**Role:** Supplier
**Pre-conditions:** R4.

1. On the raw-mats line, click the **Manual Entry** tab.
2. Type a description, price, lead time.
3. Submit Quotation.

**Expected:**
- Light-grey info strip explains "Manual entry."
- Inline warning on the line: "This is a raw material line. You may submit
  with a manual entry; procurement will see the verification status during
  canvassing and may request justification before awarding."
- Submission succeeds.

---

## Scenario R8 — Procurement comparison view

**Role:** Procurement
**Pre-conditions:** Multiple suppliers responded to the RFQ from R4 with a
mix of verified, unverified, and manual quotes.

1. Open `/rfq/{rfqId}` once the RFQ is closed.
2. Inspect the comparison table.

**Expected:**
- Each cell with a quote shows a **verification pill**:
  - Green "Verified product" on verified cells.
  - Amber "Unverified product" on unverified cells (loud emphasis on
    raw-mats rows, muted on non-raw-mats rows).
  - Amber "Manual entry" on cells with no product link (loud emphasis on
    raw-mats rows, muted on non-raw-mats rows).
- The "Can Award" indicator below the price reads:
  - "Yes" for verified or non-raw-mats cells.
  - "Yes (with justification)" for raw-mats unverified/manual cells.
  - "No" for withdrawn or unaccepted-substitute cells.

---

## Scenario R9 — Award unverified raw-mats quote (justification modal)

**Role:** Procurement
**Pre-conditions:** R8.

1. Click the amber **"Award (justify)"** button on a raw-mats unverified
   cell.
2. The justification modal opens. Item description, supplier name, and
   verification state are shown at the top.
3. Type a 5-character reason. Try to submit.
4. Type a 25-character reason. Submit.

**Expected:**
- Step 3: "Award with justification" stays disabled; min-length warning
  shown.
- Step 4: Submission succeeds; modal closes; the cell is marked
  **Selected**; "Can Award: Yes (with justification)" sticks.
- DB: `supplier_item_selections.requires_justification = true` and
  `supplier_item_selections.quote_justification` = the typed reason.

---

## Scenario R10 — Award unverified non-raw-mats quote (no modal)

**Role:** Procurement
**Pre-conditions:** R8. There is at least one **non-raw-mats** unverified
cell.

1. Click "Select" on that cell.

**Expected:**
- No modal appears.
- Cell is awarded directly.
- DB: `supplier_item_selections.requires_justification = false` and
  `quote_justification = NULL`.

---

## Scenario R11 — Generate PR2 carries the snapshot

**Role:** Procurement
**Pre-conditions:** RFQ from R8 closed; selections include both R9 and R10.

1. From the RFQ detail, click **Generate PR2**.
2. Open the new PR2.

**Expected:**
- Each PR2 line description cell shows the raw-mats badge for raw-mats
  items.
- Lines awarded via R9 show a small amber **"Award justification: …"**
  panel under the description with the typed reason.
- Lines awarded via R10 show no justification panel.

---

## Scenario R12 — Procurement override on PR2

**Role:** Procurement
**Pre-conditions:** PR2 from R11 in **draft** status.

1. Click **Edit** on the PR2.
2. On a line that was NOT marked raw mats, click the new flask-icon button.
3. On a line that WAS marked raw mats, click the flask-icon button.
4. Cancel out of edit mode.
5. Re-open Edit and confirm the toggles persisted.

**Expected:**
- Each click persists immediately (no Save button needed).
- Header `updated_at` advances.
- An audit log entry is written:
  `audit_logs.action = 'RAW_MATERIAL_FLAG_CHANGED'`,
  `document_type = 'PR2_ITEM'`, payload with previous_value / new_value.
- PR1 source row is **untouched**.

---

## Scenario R13 — Downstream visibility

**Role:** Multiple
**Pre-conditions:** PR2 from R11/R12 progressed through PR2 approval, PO
generation, delivery, and GRN.

1. Open the PO detail page (procurement & supplier views).
2. Open the PO print page.
3. Open the GRN detail and print.

**Expected:**
- Raw-mats badge present on all three surfaces for the right lines.
- Procurement views show the justification panel; the **supplier PO view**
  intentionally hides the justification (procurement-internal note).
- Print pages show `[RAW]` text marker (B/W friendly) and the italic
  "Justification: …" line where applicable.

---

## Scenario R14 — Supplier dashboard banner accuracy

**Role:** Supplier
**Pre-conditions:** Supplier has at least one open RFQ where they offered a
non-verified product on a raw-mats line; and at least one where they
offered a non-verified product on a non-raw-mats line.

1. Open the supplier dashboard.

**Expected:**
- The "RFQs pending product validation" banner counts **only** the raw-mats
  RFQ. The non-raw-mats RFQ does not contribute.
- Banner copy reads (paraphrased): "N open RFQ(s) have a raw-material line
  offered with an unverified product. Procurement may need a written
  justification before awarding — getting your product verified avoids the
  extra step."

---

## Negative / Edge Scenarios

### Scenario R15 — Empty justification rejected
- Repeat R9 but submit an empty or whitespace-only reason → modal stays open
  with min-length warning.

### Scenario R16 — Cancel justification modal
- Repeat R9 but click **Cancel** → modal closes; selection NOT recorded; no
  audit log entry written.

### Scenario R17 — Withdrawn product still blocked
- A supplier links a product, then withdraws it. Procurement attempts to
  award. Result: "Withdrawn" button shown disabled; no modal opens.

### Scenario R18 — Non-procurement user attempts override
- Open PR2 as an employee or approver. Edit mode is gated, so the toggle
  does not appear. Direct API attempt is blocked by the
  `Procurement can update PR2 items` RLS policy.

---

## Acceptance Sign-off

| Scenario | Tester | Status | Notes |
|---|---|---|---|
| R1 — Employee marks raw mats on PR1 | | ☐ Pass / ☐ Fail | |
| R2 — Approval shows badge | | ☐ Pass / ☐ Fail | |
| R3 — Warehouse shows badge | | ☐ Pass / ☐ Fail | |
| R4 — Supplier sees badge | | ☐ Pass / ☐ Fail | |
| R5 — Verified raw-mats quote | | ☐ Pass / ☐ Fail | |
| R6 — Unverified raw-mats quote | | ☐ Pass / ☐ Fail | |
| R7 — Manual raw-mats quote | | ☐ Pass / ☐ Fail | |
| R8 — Comparison view pills | | ☐ Pass / ☐ Fail | |
| R9 — Justification modal (raw mats) | | ☐ Pass / ☐ Fail | |
| R10 — No modal (non-raw-mats) | | ☐ Pass / ☐ Fail | |
| R11 — PR2 snapshot carries through | | ☐ Pass / ☐ Fail | |
| R12 — Procurement override on PR2 | | ☐ Pass / ☐ Fail | |
| R13 — PO/GRN downstream visibility | | ☐ Pass / ☐ Fail | |
| R14 — Dashboard banner re-scoped | | ☐ Pass / ☐ Fail | |
| R15 — Empty justification rejected | | ☐ Pass / ☐ Fail | |
| R16 — Cancel modal behaviour | | ☐ Pass / ☐ Fail | |
| R17 — Withdrawn product blocked | | ☐ Pass / ☐ Fail | |
| R18 — Non-procurement override blocked | | ☐ Pass / ☐ Fail | |
