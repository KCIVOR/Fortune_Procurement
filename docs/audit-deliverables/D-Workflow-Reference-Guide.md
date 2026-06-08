# Document D — Workflow Reference Guide
## Fortune Procurement System

**Source:** `lib/pr1.ts`, `lib/warehouse.ts`, `lib/approvals.ts`, `lib/canvassing.ts`, `lib/pr2.ts`, `lib/pr2-approvals.ts`, `lib/po.ts`, `lib/po-approvals.ts`, `lib/delivery.ts`, `lib/grn.ts`, `lib/accreditation.ts`, `lib/supplier-products.ts`, `lib/rse.ts`, `lib/tsqa.ts`

---

## 1. Procurement Main Chain

### Stage 1: PR1 Creation & Submission

**Actor:** Employee (role `employee`, position `Staff`)

| Step | Action | Screen | DB Updates | Notification |
|------|--------|--------|------------|--------------|
| 1 | Create PR1 | `/pr1/new` | `pr1_requests` (draft), `pr1_items` | — |
| 2 | Add line items | PR1 form | `pr1_items` (item_code, description, UOM, SOH, qty, is_raw_material) | — |
| 3 | Submit PR1 | `/pr1/[id]` | status → `pending_warehouse`, snapshots, `submitted_at` | Warehouse role |
| 4 | Audit | — | `audit_logs`: `PR1_SUBMITTED` | — |

**Validation rules:** At least one item; `date_required` required; `pr1_number` user-entered.

---

### Stage 2: Warehouse Validation

**Actor:** Warehouse Staff / Warehouse Manager

| Step | Action | Screen | DB Updates | Notification |
|------|--------|--------|------------|--------------|
| 1 | Open validation queue | `/warehouse` | — | — |
| 2 | Validate items | `/warehouse/[id]` | `warehouse_validations`, `warehouse_validation_items` (SOH, availability, route, qty split) | — |
| 3a | Submit — sufficient | Same | decision=`sufficient`, PR1 → `resolved_internal` | Requisitioner: fulfilled from stock |
| 3b | Submit — insufficient | Same | decision=`insufficient`, PR1 → `pending_approval`, `approval_instances` (PR1_APPROVAL step 1) | Supervisor (step 1) |

**Per-item routing logic (`lib/warehouse.ts`):**
- `internal`: `internal_fulfilled_qty` = full qty, `procurement_qty` = 0
- `procurement`: `procurement_qty` = full qty, `internal_fulfilled_qty` = 0
- `partial`: split between internal and procurement quantities

**RFQ eligibility:** Only items with `procurement_qty > 0` appear in RFQ line items.

---

### Stage 3: PR1 Approval

**Actor:** Supervisor (step 1) → Department Head (step 2, final)

| Step | Action | Screen | DB Updates | Notification |
|------|--------|--------|------------|--------------|
| 1 | Review PR1 | `/approvals/[id]` | — | — |
| 2 | Approve / Reject / Request Revision | Same | `approval_actions`, `approval_instances` (advance or terminal), `pr1_requests.status` | Next approver or requisitioner |
| 3 | Final approve (Dept Head) | Same | PR1 → `for_canvassing` | Requisitioner + procurement |

**Approval actions:** `approved`, `rejected`, `revision_requested`  
**Revision:** PR1 status → `revision_requested`; employee notified (`action_url` → `/pr1/{id}/edit`). **Gap:** edit/submit code paths currently require `draft` only (`lib/pr1.ts` `submitPR1` `.eq('status', 'draft')`; `app/pr1/[id]/edit` blocks non-draft).

---

### Stage 4: RFQ / Canvassing

**Actor:** Procurement Staff / Buyer / Procurement Manager

| Step | Action | Screen | DB Updates | Notification |
|------|--------|--------|------------|--------------|
| 1 | View awaiting PR1s | `/rfq` | — | — |
| 2 | Create RFQ | `/rfq` | `rfq_batches` (draft), `rfq_number` auto-generated | Audit: `RFQ_CREATED` |
| 3 | Assign suppliers | `/rfq/[id]` → AssignSuppliersModal | `rfq_suppliers` (invited) | — |
| 4 | Issue RFQ | `/rfq/[id]` | status → `open`, `issued_at` | Suppliers (in-app + email via `/api/rfq/send-email`) |
| 5 | Suppliers submit quotes | `/supplier/quotations/[id]` | `rfq_item_quotes`, `rfq_suppliers` → submitted | Procurement (+ requisitioner if alternatives) |
| 6 | Employee reviews substitutes | `/substitutes/[pr1Id]` | `substitute_decisions` | Procurement |
| 7 | Select winning quotes | `/rfq/[id]` | `supplier_item_selections` | — |
| 8 | Close RFQ | `/rfq/[id]` | RFQ → `closed`, PR1 → `canvassing_complete` | Procurement + requisitioner |

**Raw material justification:** If awarding unverified product on raw material line, `JustificationModal` requires `quote_justification`.

**Viber:** Manual share via clipboard on RFQ detail — not automated.

---

### Stage 5: PR2 Generation & Dual-Phase Approval

**Actor:** Procurement (generate/edit) → Approval chain

| Step | Action | Screen | DB Updates | Notification |
|------|--------|--------|------------|--------------|
| 1 | Generate PR2 from closed RFQ | `/rfq/[id]` | `pr2_requests` (draft), `pr2_items` from selections | Requisitioner |
| 2 | Edit PR2 items | `/pr2/[id]` | `pr2_items` (qty, pricing, raw material flag) | — |
| 3 | Submit Phase 1 | `/pr2/[id]` | status → `pending_phase1_approval`, `approval_instances` (PR2_PHASE1) | Procurement Staff (step 1) |
| 4 | Phase 1 approvals | `/approvals/pr2/[id]` | Steps 1-3: Proc Staff → Proc Mgr → Director | Next approver each step |
| 5 | Phase 1 complete | Auto | PR2 → `phase1_approved`, auto `startPhase2` | Buyer (Phase 2 step 1) |
| 6 | Phase 2 approvals | `/approvals/pr2/[id]` | Steps 1-3: Buyer → Proc Mgr → Director | Next approver each step |
| 7 | Phase 2 complete | Auto | PR2 → `phase2_approved` | Requisitioner |

**PR2 Phase 1 steps (verified current):**
1. Procurement Staff — Prepared By
2. Procurement Manager — Reviewed By
3. Director — Approved By (final)

**Reject/revision at any step:** PR2 returns to `draft` for procurement to edit and resubmit.

---

### Stage 6: Purchase Order

**Actor:** Buyer (generate/submit) → Procurement Manager → Finance Director → Supplier

| Step | Action | Screen | DB Updates | Notification |
|------|--------|--------|------------|--------------|
| 1 | View PO candidates | `/po/new` | — | — |
| 2 | Generate PO | `/po/new` | `po_requests` (draft), `po_items`, buyer-entered `po_number` | Audit: `PO_GENERATED` |
| 3 | Review/edit PO | `/po/[id]` | Header fields (delivery address, payment terms, etc.) | — |
| 4 | Submit for approval | `/po/[id]` | status → `for_approval`, `approval_instances` (PO_APPROVAL) | Buyer (step 1) |
| 5 | Internal approvals | `/approvals/po/[id]` | Steps 1-3: Buyer → Proc Mgr → Finance Director | Next approver |
| 6 | PO approved | Auto | status → `approved` | Supplier + requisitioner |
| 7 | Supplier acknowledges | `/supplier/po/[id]` | `po_receipts`, status → `sent`, step 4 action recorded | — |
| 8 | Delivery auto-created | On ack | `deliveries` (pending) | Requisitioner |

---

### Stage 7: Delivery Tracking

**Actors:** Supplier (update status), Procurement (follow-up), Warehouse/Procurement (mark delivered)

| Step | Action | Screen | DB Updates | Notification |
|------|--------|--------|------------|--------------|
| 1 | Supplier updates status | `/supplier/delivery/[id]` | `deliveries.status`, `delivery_status_history` | Requisitioner |
| 2 | Upload DR (in_transit) | Same | `dr_document_path` to `delivery-receipts` bucket | — |
| 3 | Procurement follow-up | `/delivery/[id]` | `delivery_status_history` (note only) | — |
| 4 | Mark delivered | `/delivery/[id]` | status → `delivered` | Requisitioner + warehouse |

**Statuses:** `pending` → `scheduled` → `in_transit` → `delayed` → `delivered`

---

### Stage 8: GRN (Goods Receipt)

**Actor:** Warehouse Staff / Warehouse Manager

| Step | Action | Screen | DB Updates | Notification |
|------|--------|--------|------------|--------------|
| 1 | Open GRN | `/grn` or from delivery detail | `grn_receipts` (open), `grn_items` seeded from PO | Requisitioner |
| 2 | Enter received quantities | `/grn/[id]` | `grn_items.quantity_received`, `quantity_rejected` | — |
| 3 | Save progress | Same | Header fields (DR no, DR date, remarks) | — |
| 4 | Close GRN | Same (confirm dialog) | status → `closed`, `closed_at`, delivery → `delivered` | Requisitioner |

**Partial receipt:** `quantity_received` can be less than `quantity_ordered`; GRN can be closed with partial quantities.

---

## 2. Parallel Compliance Workflows

### Supplier Accreditation

```
Supplier: create draft → upload documents → submit
Procurement: mark under_review → approve | reject | request missing_documents
Supplier: can withdraw (if submitted)
```

**No approval_instances workflow** — procurement makes terminal decisions directly.

| Status Flow | Actor |
|-------------|-------|
| draft → submitted | Supplier |
| submitted → under_review | Procurement |
| under_review → approved/rejected/missing_documents | Procurement |
| any → withdrawn | Supplier |

---

### Product Catalog

```
Supplier: create product → submit for review
Procurement: mark under_review → verify directly OR create RSE for TSQA path
TSQA path: product → pending_tsqa → RSE → passed/failed → product verified/rejected
```

**Fast path (RFQ):** Supplier can create and submit product directly from quotation page.

---

### RSE / TSQA Scientific Evaluation

| Step | Actor | Action | Result |
|------|-------|--------|--------|
| 1 | Procurement | Create RSE from product review page | RSE `created`, product → `pending_tsqa` |
| 2 | Procurement | Optionally assign TSQA reviewer | RSE → `assigned` |
| 3 | TSQA | Self-assign or start review | RSE → `under_review` |
| 4 | TSQA | Submit pass/fail with findings | RSE → `passed`/`failed`, product → `verified`/`rejected` |
| 5 | System | Notify supplier + procurement | In-app notifications |

**TSQA does not approve supplier accreditation** — only product scientific evaluation via RSE.

---

## 3. Substitute Review Workflow

**Trigger:** Supplier submits alternative item quote (`is_alternative = true`)

| Step | Actor | Action | Screen |
|------|-------|--------|--------|
| 1 | System | Flag substitute for review | Notification to employee |
| 2 | Employee | Review alternatives | `/substitutes/[pr1Id]` |
| 3 | Employee | Accept or reject each | Same | `substitute_decisions` |
| 4 | Procurement | Notified of decision | In-app | — |

Procurement can only select accepted substitutes (or non-alternative quotes) when making `supplier_item_selections`.

---

## 4. Database Updates per Workflow Stage

| Stage | Primary Tables Written |
|-------|------------------------|
| PR1 submit | `pr1_requests`, `pr1_items`, `audit_logs` |
| Warehouse validation | `warehouse_validations`, `warehouse_validation_items`, `pr1_requests`, `approval_instances` (if insufficient) |
| PR1 approval | `approval_actions`, `approval_instances`, `pr1_requests` |
| RFQ | `rfq_batches`, `rfq_suppliers`, `rfq_item_quotes`, `supplier_item_selections`, `substitute_decisions` |
| PR2 | `pr2_requests`, `pr2_items`, `approval_instances`, `approval_actions` |
| PO | `po_requests`, `po_items`, `approval_instances`, `approval_actions`, `po_receipts` |
| Delivery | `deliveries`, `delivery_status_history` |
| GRN | `grn_receipts`, `grn_items` |
| Accreditation | `supplier_accreditations`, `supplier_documents` |
| Product/RSE/TSQA | `supplier_products`, `rse_records`, `tsqa_reviews`, `supplier_documents` |

---

## 5. Workflow Inconsistencies (Flagged)

| Issue | Detail |
|-------|--------|
| PR2 Phase 1 steps changed | Dept Head removed; docs predating `20260526120000` are wrong |
| Delivery state machine | No strict transition enforcement in code |
| PO step 4 | Supplier acknowledgment recorded differently from internal approval actions |
| Controlled form versions | Infrastructure tables exist but app does not version forms |
| Accreditation vs PR1 approval | Different approval models (direct status vs workflow engine) |
