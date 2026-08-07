# End-to-End AI Testing Journey — Fortune Procurement System

**Purpose:** a literal, click-by-click script with concrete mock data that an AI browser agent can execute against a running dev server to exercise the full procurement lifecycle, then report bugs and recommendations. Every step has an ID, an action, data to type, and an **Expect:** line. Where behavior doesn't match **Expect:**, log a finding using the format in [§7](#7-how-to-log-a-finding) and keep going — don't stop the run.

This was built by reading the live workflow code (`lib/pr2-warehouse.ts`, `lib/pr2-approvals.ts`, `lib/price-visibility.ts`), not just the design docs — two discrepancies between `docs/Final_Workflow.md` / `docs/UAT-Fortune-Procurement-System.md` and actual code are called out inline as things worth flagging if observed behavior disagrees with this script (see §0.4).

---

## 0. Setup

### 0.1 Start the app

```bash
npm run dev
```

Base URL: `http://localhost:3000`. All paths below are relative to that.

### 0.2 Accounts — use the Dev Quick Login panel

On `/login`, expand **"Dev Quick Login"** and click the role tile to sign in instantly (no typing required). Fallback manual credentials if the panel is ever unavailable: any email below + password `Fortune2026!`.

| Email | Role tile | Used for |
|---|---|---|
| employee@fortune.com | Employee | PR1 requestor |
| supervisor@fortune.com | Supervisor | PR1 step 1 |
| dept.head@fortune.com | Dept. Head | PR1 step 2 (final) · PR2 Certified By (step 1) |
| warehouse@fortune.com | Warehouse | SOH validation, PR2 creation, GRN, receiving |
| planning@fortune.com | Planning | Raw Material / Services PR2 direct entry |
| planning.head@fortune.com | Planning Head | (reserve — use if Planning's own approvals route here) |
| procurement@fortune.com | Procurement | RFQ prep, PO prep, product/accreditation review |
| proc.manager@fortune.com | Proc. Mgr | RFQ review, PO review |
| director@fortune.com | Director | RFQ final approval |
| operations.manager@fortune.com | Ops Manager | PR2 Approved By (step 2, final) |
| finance.director@fortune.com | Finance Dir. | PO final approval |
| supplier@fortune.com | Supplier 1 | Higher-price competing quote |
| supplier2@fortune.com | Supplier 2 | Winning quote (awarded) |
| supplier3@fortune.com | Supplier 3 | (reserve — used in Journey D) |
| ubeeeyk@gmail.com | TSQA | Raw Material QA inspection |
| admin@fortune.com | Admin | (only if something needs unblocking) |

**Switching identity mid-journey:** open the profile menu → Sign Out → back at `/login`, click the next role's tile. Do this every time the script says "Log in as X."

### 0.3 Mock data dictionary

Reuse these exact strings throughout so every screen you visit later can be cross-referenced back to this run. Prefix everything with `AITEST-` so these records are easy to find and clean up afterward.

| Field | Journey A (Goods) | Journey B (Raw Material) |
|---|---|---|
| PR1/PR2 purpose | `AITEST-A — Office Printer Toner Replenishment` | n/a (no PR1) |
| PR2 purpose (RM) | n/a | `AITEST-B — Raw Material Direct Restock` |
| Item description | `HP 12A Black Toner Cartridge` | `Industrial PVA Glue` |
| UOM | Box | Drum |
| Requested qty | 25 | 10 |
| Warehouse verified SOH | 5 (→ Insufficient) | n/a (no SOH step) |
| Priority | High | High |
| Date required | 2026-08-20 | 2026-08-25 |
| RFQ deadline | 2026-08-12 | 2026-08-14 |
| Supplier 1 (supplier@fortune.com) quote | ₱850.00/box, 5-day lead time | ₱2,200.00/drum, 6-day lead time |
| Supplier 2 (supplier2@fortune.com) quote | ₱790.00/box, 7-day lead time — **award this one** | ₱1,950.00/drum, 5-day lead time — **award this one** |
| PO number (manual) | `AITEST-PO-A01` | `AITEST-PO-B01` |
| GRN number | `AITEST-GRN-A01` | `AITEST-GRN-B01` |
| DR number | `AITEST-DR-A01` | `AITEST-DR-B01` |
| INV number | `AITEST-INV-A01` | `AITEST-INV-B01` |

### 0.4 Two things this script deliberately checks against stale docs

While researching this script, `docs/UAT-Fortune-Procurement-System.md` and `docs/Final_Workflow.md` were found to disagree with the current code in two places. This script follows the **code**. If what you observe in the browser instead matches the old docs, that itself is worth a finding (either the code changed behind the docs, or there's a regression):

1. **PR2 has one approval phase, not two.** Code (`lib/pr2-approvals.ts`) resolves every PR2 — Goods, Raw Material, or Services, whether it came from a PR1 or was created directly by Planning — to a single `PR2_FINAL` workflow: **Department Head (Certified By) → Operations Manager (Approved By, final)**. The UAT doc's "Phase 1 (3 steps: Procurement Staff/Manager/Director) then Phase 2 (3 steps)" description matches a `PR2_PHASE1` workflow that the code comments say is now dead/unreachable. **Expect 2 steps, Dept Head then Ops Manager, for every PR2 in this script.** If you instead see a 3-step Procurement-Staff/Manager/Director round (with or without a second round after it), log it as a discrepancy — either the docs are stale (harmless) or `PR2_PHASE1` is unexpectedly still reachable (a real bug).
2. **For Goods/Services PR1s, the PR2 is created by Warehouse *before* RFQ, not generated *from* an awarded RFQ.** Code has `createPR2FromWarehouseValidation()` in `lib/pr2-warehouse.ts`, and `docs/Final_Workflow.md` §5.1–5.2 describes Warehouse creating the PR2 immediately after SOH validation, which then goes through its own approval, and only *then* does Procurement create the RFQ. The UAT doc's D.3 ("Generate PR2 from awarded RFQ") describes the opposite order. This script follows `Final_Workflow.md`'s order: **PR1 → PR1 approval → Warehouse validates & creates PR2 → PR2 approval → RFQ → RFQ approval → PO.**

---

## 1. Journey A — Goods, full lifecycle (PR1 origin, insufficient stock)

**Role chain:** Employee → Supervisor → Dept. Head → Warehouse → Dept. Head → Ops Manager → Procurement → Supplier 1 & 2 → Procurement → Proc. Mgr → Director → Procurement → Proc. Mgr → Finance Director → Procurement → Supplier 2 → Warehouse → Employee.

### 1.1 Employee creates and submits PR1

| Step | Action | Expect |
|---|---|---|
| A1 | Log in as **employee@fortune.com**. Go to `/dashboard`. | KPI cards render; counts reflect this employee's own PR1s only. |
| A2 | Go to `/pr1` → click **New PR1**. | Create form loads at `/pr1/new`; Requisitioner/Department/Date are prefilled read-only. |
| A3 | Purpose: select from dropdown or choose **Other** → type `AITEST-A — Office Printer Toner Replenishment`. Date Required: `2026-08-20`. | Values captured. |
| A4 | Add one item row. Description: `HP 12A Black Toner Cartridge`. UOM: `Box`. Req. Qty: `25`. Leave "Raw Mat." unchecked (this is a Goods request). | Row added; totals update. |
| A5 | Click **Submit** (not Save Draft). | Status → **Pending Warehouse Validation**... but wait — check whether it instead reads "Pending Supervisor Review" or similar *before* warehouse. **Expect:** per §0.4 point 2, PR1 approval (Supervisor → Dept Head) happens **before** Warehouse validation, so the status right after submit should indicate it's awaiting Supervisor, not Warehouse. If it jumps straight to a warehouse-facing status, log a finding — that would mean SOH validation is happening before PR1 approval, contradicting `Final_Workflow.md` §5.1. |
| A6 | Note the generated PR1 number (e.g. `PR1-2026-xxxx`) for cross-reference in later steps. | — |

### 1.2 PR1 approval (2 steps)

| Step | Action | Expect |
|---|---|---|
| A7 | Log in as **supervisor@fortune.com**. Go to `/approvals` (PR1 tab) or `/approvals/pr1`. Open the AITEST-A record. | Requestor, purpose, items shown; approval timeline stepper shows Supervisor as active step. |
| A8 | Click **Approve** (no remarks needed). | Advances to Dept Head's step. |
| A9 | Log in as **dept.head@fortune.com**. Open the same PR1 in the approval queue. | Timeline shows Dept Head as the active (final) PR1 step. |
| A10 | Click **Approve**. | PR1 fully approved for its own workflow; status moves toward Warehouse validation. |

### 1.3 Warehouse validates stock and creates PR2

| Step | Action | Expect |
|---|---|---|
| A11 | Log in as **warehouse@fortune.com**. Go to `/warehouse`. | AITEST-A PR1 appears in the pending-validation queue. |
| A12 | Click **Validate**. Enter Verified SOH = `5` for the toner line (less than the requested 25). Add a note, e.g. `Only 5 boxes on hand.` | Outcome dynamically shows **Insufficient**. |
| A13 | Click **Submit Validation** (not Save Progress). | Line routed to Procurement; a PR2 record is created and linked to this PR1 (Warehouse recorded as **Prepared By**). Note the new PR2 number. |
| A14 | Check `/warehouse/history`. | A validation entry exists for this PR1 with validator = Warehouse and outcome = Insufficient. |

### 1.4 PR2 approval (single phase, 2 steps)

| Step | Action | Expect |
|---|---|---|
| A15 | Log in as **dept.head@fortune.com**. Go to `/approvals/pr2`. Open the AITEST-A PR2. | Header shows the linked PR1 number; items grid shows the toner line; timeline shows Dept Head (Certified By) as active. Priority badge should read **High** (carried from the PR1) — note this for comparison against Journey B/E. |
| A16 | Click **Approve**. | Advances to Ops Manager. |
| A17 | Log in as **operations.manager@fortune.com**. Open the same PR2 in `/approvals/pr2`. | Ops Manager step active (final). |
| A18 | Click **Approve**. | PR2 fully approved. Procurement notified it's ready for canvassing. **Per §0.4 point 1: this should be a 2-step process total (A15–A18). If a third approval round appears afterward, log the discrepancy.** |

### 1.5 RFQ — canvassing and award

| Step | Action | Expect |
|---|---|---|
| A19 | Log in as **procurement@fortune.com**. Go to `/rfq`. | AITEST-A PR2's PR1 appears in the **"Awaiting RFQ"** tab. |
| A20 | Click into it, create the RFQ. Set deadline `2026-08-12`. | RFQ created with an RFQ number; item carried over from the PR1 (`HP 12A Black Toner Cartridge`, 25 Box). |
| A21 | Assign suppliers: check both **Supplier 1** (supplier@fortune.com) and **Supplier 2** (supplier2@fortune.com). Click **Assign**. | Both added to the RFQ; RFQ status → Sent/Active; suppliers notified. |
| A22 | Log in as **supplier@fortune.com**. Go to RFQ inbox, open the AITEST-A RFQ. Enter Unit Price `₱850.00`, Lead Time `5` days. Submit quotation. | Quote saved, visible to procurement. |
| A23 | Log in as **supplier2@fortune.com**. Same RFQ. Enter Unit Price `₱790.00`, Lead Time `7` days. Submit quotation. | Quote saved. |
| A24 | Log in as **procurement@fortune.com**. Open the RFQ comparison matrix. | Both quotes shown side-by-side on the toner line: ₱850.00 vs ₱790.00. |
| A25 | Award the line to **Supplier 2** (₱790.00 — the lower price). | Line shows Supplier 2 as awarded. |
| A26 | Click **Close RFQ**. | RFQ status → Closed; no further bids accepted. |

### 1.6 RFQ approval

| Step | Action | Expect |
|---|---|---|
| A27 | Log in as **proc.manager@fortune.com**. Go to `/approvals/rfq` (or the RFQ tab in `/approvals`). Open AITEST-A. | Canvassing results shown, including the award. |
| A28 | Click **Approve**. | Advances to Director. |
| A29 | Log in as **director@fortune.com**. Open the same RFQ approval. | Director step active (final). |
| A30 | Click **Approve**. | RFQ fully approved. Procurement notified the PO may now be created. |

### 1.7 Purchase Order

| Step | Action | Expect |
|---|---|---|
| A31 | Log in as **procurement@fortune.com**. Go to `/po/new` (or generate from the approved PR2/RFQ). | PO prefilled: Supplier 2, 25 × Box HP 12A Toner @ ₱790.00 = **₱19,750.00**. |
| A32 | Enter custom PO number `AITEST-PO-A01`. Set payment terms (dropdown). Set delivery address. Add remark `AI E2E test run`. | Saved on the PO. |
| A33 | Click **Submit for Approval** (not Save Draft). | Status → For Approval; routed to Proc. Mgr. |
| A34 | Log in as **proc.manager@fortune.com**. Go to `/approvals/po`, open AITEST-PO-A01. | PO detail shows payment terms, delivery address, items, grand total ₱19,750.00. |
| A35 | Click **Approve**. | Advances to Finance Director. |
| A36 | Log in as **finance.director@fortune.com**. Open the same PO. | Finance Director step active (final). |
| A37 | Click **Approve**. | PO → Approved. **Note whether it auto-transitions to "Sent" or stays "Approved" pending a manual send** — `Final_Workflow.md` step 13 says the send is a deliberate separate manual action, not automatic. |
| A38 | Log in as **procurement@fortune.com**. Open AITEST-PO-A01. Click **Send PO to Supplier**. | Status → Sent to Supplier; Supplier 2 notified. If this button doesn't exist and the PO auto-sent at A37, log that as a discrepancy against the documented manual-send requirement. |

### 1.8 Supplier acknowledgment and delivery

| Step | Action | Expect |
|---|---|---|
| A39 | Log in as **supplier2@fortune.com**. Go to Supplier PO inbox, open AITEST-PO-A01. | Status: Pending Acknowledgment. |
| A40 | Click **Acknowledge**. Set commitment date `2026-08-19`. Add remark `Confirmed, will ship on schedule.` | PO → Acknowledged; a delivery record is created. |
| A41 | Go to Deliveries, open the new delivery. Update status to **In Transit**. | Status updates; timeline log entry added. |
| A42 | Update status to **Delivered**. Set actual delivery date `2026-08-19`. Upload a placeholder DR file and invoice file (any small PDF/image works — if no upload is available, note that as a blocker for this step and continue). | Files attached; update logged. |
| A43 | Log in as **employee@fortune.com**. Go to `/delivery`, open the AITEST-A delivery. | Delivered status visible in real time; pricing shown as **"Price hidden"** (employee has no commercial-pricing visibility). |

### 1.9 Receiving and GRN

| Step | Action | Expect |
|---|---|---|
| A44 | Log in as **warehouse@fortune.com**. Go to `/grn`. Open the GRN created against the delivered PO. | GRN detail shows ordered (25) vs received vs rejected. Cost columns show **"Price hidden"** (Warehouse has no commercial-pricing visibility). |
| A45 | Manually record GRN No. `AITEST-GRN-A01`, DR No. `AITEST-DR-A01`, INV No. `AITEST-INV-A01`, DR Date `2026-08-19`. | Fields saved. |
| A46 | Record received quantity = 25 (full acceptance, no discrepancy). | Quantity saved. |
| A47 | Click **Close GRN**. | GRN → Closed; PR1 progresses toward "Completed (GRN Closed)." |
| A48 | **Verify checkpoint — print/border fix.** Click **Print GRN**. | ✅ *Print bug check:* the items table's blank filler rows at the bottom must have the **same column count** as the header/real rows even though prices are hidden for Warehouse — no visual border misalignment. ✅ The **"Inspected By / Checked By / Noted By"** boxes must show either a bound name/date or the word **"Pending"** — never permanently blank `&nbsp;`. |
| A49 | Log in as **employee@fortune.com**. Open the AITEST-A PR1. | Status: **Completed (GRN Closed)**. |

### 1.10 Additional print/price checkpoints for Journey A

| Step | Action | Expect |
|---|---|---|
| A50 | Log in as **procurement@fortune.com** (has commercial-pricing visibility). Open `/po/{AITEST-PO-A01 id}/print`. | Prices visible; items table renders with correctly aligned columns (this is the "prices visible" control case — compare against A48's "prices hidden" case). |
| A51 | Open `/pr2/{AITEST-A PR2 id}/print`. | Renders the standard Goods/Services canvass-slip PR2 template (correct for this PR1-originated Goods request). |

---

## 2. Journey B — Raw Material, Planning-direct entry (no PR1)

This is the exact scenario the priority-resolution fix targets: a PR2 with **no `pr1_id`**, where `pr2.priority` must be read directly rather than falling through a PR1 join that doesn't exist. Confirmed live before the fix: 11 of 21 POs (52%) are in this no-PR1 state.

**Role chain:** Planning → Dept. Head → Ops Manager → Procurement → Supplier 1 & 2 → Procurement → Proc. Mgr → Director → Procurement → Proc. Mgr → Finance Director → Procurement → Supplier 2 → Warehouse → TSQA → Warehouse.

| Step | Action | Expect |
|---|---|---|
| B1 | Log in as **planning@fortune.com**. Go to `/planning/pr2` (or wherever the direct PR2 creation entry point is). Create a new PR2. | Form loads; no PR1 reference required. |
| B2 | Classify as **Raw Material**. Purpose: `AITEST-B — Raw Material Direct Restock`. Date required: `2026-08-25`. **If a Priority field is present on this form, set it to High.** If no Priority field exists here at all, log that as a finding — it's the root cause the priority-resolution fix depends on (`pr2.priority` must be populated at creation). | Priority captured (or its absence logged). |
| B3 | Add item: `Industrial PVA Glue`, UOM `Drum`, Qty `10`. Submit. | PR2 created directly, status pending approval. Recorded as **Prepared By: Planning**. |
| B4 | Log in as **dept.head@fortune.com**. Go to `/approvals/pr2`, open AITEST-B. | 2-step `PR2_FINAL` workflow (per §0.4): Dept Head active first. Priority badge should read **High**, not blank, not silently "Normal." |
| B5 | Click **Approve**. | Advances to Ops Manager. |
| B6 | Log in as **operations.manager@fortune.com**. Approve. | PR2 fully approved. Procurement notified, ready for canvassing. |
| B7 | Log in as **procurement@fortune.com**. Go to `/rfq` → **"Planning Direct"** tab. | ✅ *RFQ-queue fix check:* AITEST-B appears here (not "Awaiting RFQ", since it has no PR1). Note the row count/badge shown on the tab. |
| B8 | ✅ *RFQ-queue fix check — filter bleed.* While still on **"Awaiting RFQ"** tab (switch to it first), type a search term that matches nothing on that tab, e.g. `zzz-no-match`. Do **not** clear it. Now switch to the **"Planning Direct"** tab. | AITEST-B (and any other Planning Direct rows) should still be visible/searchable independently. If the tab instead shows "No matching PR1s" / 0 rows because the stale `zzz-no-match` search term carried over, that's the confirmed filter-bleed bug — log it even though the fix is supposedly in place, to confirm it's actually resolved. |
| B9 | ✅ *RFQ-queue fix check — Planning Direct filters/pagination.* Clear the search box. On the **Planning Direct** tab, apply a Department filter and a Priority filter (High). | Results should actually change/refetch. If the list stays exactly the same regardless of filter changes, log it — that matches the pre-fix bug where `fetchRawMaterialCanvassingQueue` ignored all parameters. If more than one page of results exists, confirm pagination controls work (not just a full unbounded dump). |
| B10 | Create the RFQ for AITEST-B, deadline `2026-08-14`, assign Supplier 1 and Supplier 2. | RFQ created and sent. |
| B11 | Log in as **supplier@fortune.com**: quote ₱2,200.00/drum, 6-day lead time. Submit. | Quote saved. |
| B12 | Log in as **supplier2@fortune.com**: quote ₱1,950.00/drum, 5-day lead time. Submit. | Quote saved. |
| B13 | Log in as **procurement@fortune.com**. Award Supplier 2 (₱1,950.00). Close RFQ. | Award recorded. |
| B14 | Log in as **proc.manager@fortune.com** → approve RFQ. Log in as **director@fortune.com** → approve RFQ (final). | RFQ fully approved. |
| B15 | Log in as **procurement@fortune.com**. Create PO `AITEST-PO-B01`: 10 × Drum @ ₱1,950.00 = **₱19,500.00**. Submit for approval. | PO created and routed. |
| B16 | ✅ *Priority-resolution fix check.* Before approving, open the PO detail and the PO approval queue view. | Priority should display **High**. Previously: `lib/po-approvals.ts` had no fallback at all → **blank**; `lib/po.ts` defaulted to `'normal'` → silently showed **"Normal"** instead of High. Either symptom = bug still present. |
| B17 | Log in as **proc.manager@fortune.com** → approve. Log in as **finance.director@fortune.com** → approve (final). | PO approved. |
| B18 | Log in as **procurement@fortune.com** → **Send PO to Supplier**. | Sent. |
| B19 | Log in as **supplier2@fortune.com** → acknowledge with commitment date `2026-08-24`. Update delivery to In Transit, then Delivered, upload DR/invoice placeholders. | Delivery record created and updated. |
| B20 | ✅ *Priority-resolution fix check.* Log in as **warehouse@fortune.com** (or whichever role tracks delivery) and open the AITEST-B delivery detail/list. | Priority should display **High**, not blank/Normal. This is `lib/delivery.ts`'s fallback path. |
| B21 | Warehouse receives the delivery, creates GRN `AITEST-GRN-B01` (DR `AITEST-DR-B01`, INV `AITEST-INV-B01`, DR date `2026-08-24`). Record received qty = 10. | GRN created, Open. |
| B22 | ✅ *Priority-resolution fix check.* On the GRN detail/list. | Priority should display **High**, not blank/Normal. This is `lib/grn.ts`'s fallback path. |
| B23 | Flag the Glue line as **Raw Material / For QA Approval** (mandatory for all RM items per `Final_Workflow.md` §5.5 step 15). | Item routed to TSQA. |
| B24 | Log in as **ubeeeyk@gmail.com** (TSQA). Go to `/tsqa/rse`, self-assign, Start Review, enter findings, submit **Passed** verdict. | RSE → Passed. Item marked Approved on the GRN. |
| B25 | Log in as **warehouse@fortune.com**. Close the GRN. | GRN → Closed (only possible now that the QA-flagged item is resolved — try closing *before* B24 as a negative check: it should be blocked while the item is still pending QA). |
| B26 | ✅ *Print-template-routing fix check.* Print the AITEST-B PR2 from **both** entry points: the procurement PR2 detail page (`/pr2/{id}/print`) and the PR2 approval detail page (`/approvals/pr2/{id}` → print). | Both must render the **Raw Material–tailored PR2 template**, not the Goods/Services canvass-slip template. Compare visually against A51's Goods template — they should look different (RM template, per the implementation plan, is "correctly-tailored" and distinct). |
| B27 | ✅ *Print fix check.* Print `AITEST-GRN-B01`. | Same border-alignment and signature-box checks as A48. |

---

## 3. Journey C — Services (brief)

Two entry points exist: End User via PR1, or Planning direct (same rule as Raw Material). Key divergence: **Procurement**, not Warehouse, receives and GRNs the completed service; no TSQA step applies (unless the service requires compliance docs, e.g. calibration).

| Step | Action | Expect |
|---|---|---|
| C1 | Log in as **planning@fortune.com**. Create a PR2 direct-entry, classify **Services**. Purpose: `AITEST-C — Machine Calibration Service`. Item: `Annual Boiler Calibration`, Qty 1. | Created, Prepared By: Planning. |
| C2 | Run through PR2 approval (Dept Head → Ops Manager, per §0.4), RFQ (assign a supplier, quote, award, close, approve), and PO (create, approve 3 steps, send) exactly as in Journey B, substituting a service-appropriate unit price (e.g. ₱15,000.00). | Same 2-step PR2 approval; same PO flow. |
| C3 | Log in as **supplier@fortune.com** (or whichever supplier was awarded). Acknowledge PO. | Delivery record created. |
| C4 | Log in as **warehouse@fortune.com**. Receive the delivery. | Warehouse receives it, per `Final_Workflow.md` §5.7 step 16. |
| C5 | As Warehouse, review the service and click **Forward** to send it to Procurement for GRN. | Service routed to Procurement. |
| C6 | Log in as **procurement@fortune.com**. Complete the GRN for the service (GRN number `AITEST-GRN-C01`). | Procurement — not Warehouse — prepares this GRN, unlike Journeys A/B. |
| C7 | If the service is calibration-type: log in as the assigned **supplier**, go to the Supplier Dashboard's Documentation/Certification page, upload a placeholder Certificate of Calibration. | Document uploaded. |
| C8 | Back as Procurement, attempt to close the GRN **before** the compliance doc is uploaded (test this on a second calibration-type service if you want a clean negative case), then again after upload. | Procurement should not finalize receipt without the required compliance doc present — verify this is actually enforced, not just documented. |
| C9 | Close the GRN. Print it. | Closed; print renders. No TSQA step should have appeared anywhere in this journey. |

---

## 4. Journey D — Substitute item review (branches off RFQ)

| Step | Action | Expect |
|---|---|---|
| D1 | During Journey A's or B's supplier-quote step, log in as **supplier3@fortune.com** on a *different* RFQ (or repeat a small standalone PR1/RFQ) and, instead of quoting the requested item, propose an alternative — e.g. quote "HP 12A-compatible Generic Toner" against the "HP 12A Black Toner Cartridge" line, with a remark explaining the substitution. | Line flagged as an alternative/substitute. |
| D2 | Log in as **employee@fortune.com**. Go to `/substitutes`. | KPI counters + a card for this substitute; price shown as **"Price hidden."** |
| D3 | Open the card. | Side-by-side: "You requested" (HP 12A) vs "Supplier is offering" (Generic Toner). |
| D4 | Click **Accept**, add a note. | Decision = Accepted, saved immediately; substitute becomes eligible for award. |
| D5 | Log in as **procurement@fortune.com**. Confirm the substitute is awardable in the RFQ comparison matrix, and award it. | Substitute carried forward into PR2/PO downstream. |
| D6 | Repeat D1–D3 on a second line, but click **Reject** instead. | System sources the originally requested item; substitute not awardable. |
| D7 | Close the RFQ. Return to `/substitutes` as Employee. | Both decisions now locked — attempt to change one and confirm it's blocked (per `Final_Workflow.md` §5.1 step 6, decisions lock once the RFQ/quotation is closed). |

---

## 5. Journey E — Targeted regression pass for the 4 pending fixes

Journeys A–D already exercise most of this inline (marked with ✅ above). This section fills the remaining gaps that don't occur naturally in a straight-line lifecycle: an **archived PR2** and an **invalid PO id**.

### 5.1 Archived PR2 print

| Step | Action | Expect |
|---|---|---|
| E1 | Create a small throwaway Goods PR1 (`AITEST-ARCHIVE-01`, any item), push it through PR1 approval and Warehouse validation so a PR2 is created, exactly like A1–A13. | PR2 created and pending approval. |
| E2 | Log in as **dept.head@fortune.com**, open the PR2 in `/approvals/pr2`, click **Reject** (or **Request Revision**) with remarks `AI test — forcing archive path`. | Per `docs/print-templates-implementation-plan.md`: a PR2 rejected/revision-requested *after* creation is "unwound back to Warehouse" — moved from `pr2_requests` into `pr2_requests_archive` and deleted from the live table. Confirm this actually happens (e.g. it disappears from the live PR2 list). |
| E3 | Log in as **procurement@fortune.com**. Open `/pr2/{archived id}/print`. | Before the fix: "PR2 not found," because `fetchPR2ById()` only queried the live table. **Expect the fix:** the archived PR2 prints correctly. |
| E4 | Open `/approvals/pr2/{archived id}` (the approval detail view) and print from there too. | Same expectation — must not say "not found." (The on-screen approval detail view already handled archived PR2s correctly per the implementation plan; this step confirms the print path now matches it.) |

### 5.2 PO print — invalid/missing id

| Step | Action | Expect |
|---|---|---|
| E5 | Log in as **procurement@fortune.com**. Navigate directly to `/po/00000000-0000-0000-0000-000000000000/print` (a syntactically valid but non-existent UUID). | Before the fix: hangs forever on "Preparing print view..." with no way out, because the page never distinguished "still loading" from "loaded but got nothing." **Expect the fix:** a clear "PO not found" (or equivalent) state appears instead of an infinite spinner. |
| E6 | Try a PO id that exists but that this logged-in role shouldn't have RLS access to, if one is easy to construct (e.g. a PO belonging to a different, non-awarded supplier's org if testing from a supplier login). | Same "not found"/access-denied state, not an infinite hang. |

### 5.3 Fix-verification matrix

| Fix (from the 4 pending implementation plans) | Verified by steps |
|---|---|
| `downstream-priority-resolution` — PO/Delivery/GRN priority for no-PR1 RM/Services requests | B4, B16, B20, B22 |
| `grn-po-print-fixes` — table border alignment + signature boxes | A48, A50, B27 |
| `print-templates` — RM/Services PR2 template routing, archived PR2 print, PO print not-found state | B26, E1–E4, E5–E6 |
| `rfq-queue-pagination-filters` — tab filter isolation, Planning Direct filters/pagination | B7, B8, B9 |

---

## 6. Also worth a pass (not part of the 4 pending fixes, but cheap to check while you're already there)

- **A5 / §0.4 point 2 order check** — confirm PR1 approval genuinely happens before Warehouse SOH validation, not after.
- **A18 / B6 / §0.4 point 1** — confirm PR2 is a single 2-step approval everywhere, not the legacy 3-step round.
- **A37/A38** — confirm PO send-to-supplier is a real separate manual action, not automatic on final approval.
- Negative access control while you have all these accounts logged in anyway: e.g. try **employee@fortune.com** on `/rfq`, `/po`, `/pr2` (should be blocked); try **warehouse@fortune.com** on `/admin` (should be blocked). Cheap to add since you're already cycling through every role.

---

## 7. How to log a finding

For every place where **Expect:** didn't match what happened, record:

```
ID:        <step id, e.g. B16>
URL:       <exact path>
Role:      <which dev account was logged in>
Expected:  <copy the Expect: line>
Actual:    <what you actually saw — exact text/values/state>
Severity:  Blocker | Major | Minor | Cosmetic
Repro:     <minimal steps to reproduce, referencing earlier step IDs for setup>
Screenshot: <attach if visual>
```

Group findings by the fix area in §5.3 where relevant, so it's immediately clear whether a given pending fix actually resolved its bug or not. For anything severity Blocker/Major, also consider filing it through the app's own **Bug Tracker** (`/bugtrack` — Section I.3 of `docs/UAT-Fortune-Procurement-System.md`) as a live dogfood check of that module, in addition to the written report.

End the run with a short summary: total steps executed, findings by severity, and — separately — explicit pass/fail against each of the 4 rows in the fix-verification matrix (§5.3), since that's the primary reason this run exists.
