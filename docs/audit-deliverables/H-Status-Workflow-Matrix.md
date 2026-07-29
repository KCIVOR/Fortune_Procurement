# Document H — Status & Workflow Matrix
## Fortune Procurement System

**Source:** `types/*.ts`, `supabase/migrations/`, `lib/*.ts` workflow modules

---

## 1. Master Status Reference

### PR1 (`pr1_requests.status`)

| Status | Label | Variant | Who Can Set | Next States |
|--------|-------|---------|-------------|-------------|
| `draft` | Draft | draft | Employee (create/edit) | `pending_warehouse` (submit) |
| `pending_warehouse` | Pending Warehouse | pending | System (on submit) | `resolved_internal`, `approved_for_warehouse` |
| `approved_for_warehouse` | Approved for Warehouse | approved | PR1 approvers | Warehouse queue |
| `pending_approval` | Pending Approval | in_review | Legacy | `rejected`, `revision_requested` |
| `resolved_internal` | Resolved Internally | validated | Warehouse (sufficient) | Terminal |
| `revision_requested` | Revision Requested | in_review | Approver | Resubmit → `pending_warehouse` |
| `pr2_pending_approval` | PR2 Pending Approval | in_review | Warehouse (Goods/Services insufficient) | `pr2_approved`, `rejected` |
| `pr2_approved` | PR2 Approved | approved | PR2_FINAL final approve (Goods/Services) | RFQ canvassing |
| `for_canvassing` | For Canvassing | approved | Legacy/historical (pre-alignment) | `canvassing_complete` |
| `canvassing_complete` | Canvassing Complete | approved | Legacy/historical (pre-alignment) | Terminal |
| `approved` | Approved | approved | Legacy/fallback | — |
| `rejected` | Rejected | rejected | Approver | Terminal |
| `cancelled` | Cancelled | cancelled | Employee (draft delete) | Terminal |

**Priority values:** `normal`, `medium`, `high` — updatable by procurement/approver (`lib/pr1.ts`)

---

### Warehouse Validation (`warehouse_validations.decision`)

| Decision | Meaning | PR1 Result |
|----------|---------|------------|
| `sufficient` | All items fulfillable from stock | PR1 → `resolved_internal` |
| `insufficient` | Some/all items need procurement | PR1 → `pending_approval` + PR1_APPROVAL instance |

**Per-item routing (`warehouse_validation_items.item_route`):**

| Route | Meaning |
|-------|---------|
| `internal` | Fulfilled from warehouse stock |
| `procurement` | Routed to procurement/canvassing |
| `partial` | Split: partial internal + partial procurement |

---

### RFQ (`rfq_batches.status`)

| Status | Meaning | Transitions |
|--------|---------|-------------|
| `draft` | Created, not issued | → `open` (issue) |
| `open` | Active, suppliers invited | → `closed` (close) |
| `closed` | Canvassing complete | Terminal |
| `cancelled` | Cancelled | Terminal |

**RFQ supplier status (`rfq_suppliers.status`):** `invited` → `submitted` | `declined`

**Quote response (`rfq_item_quotes.response_status`):** `quoted` | `no_quote`

---

### PR2 (`pr2_requests.status`)

| Status | Meaning | Trigger |
|--------|---------|---------|
| `draft` | Generated, editable | Warehouse creates PR2 (Goods/Services) or Planning-direct entry (Services / Raw Material) |
| `pending_approval` | Submitted for approval | `submitPR2ForApproval` |
| `approved` | Fully approved | Final approver (`PR2_FINAL` or `PR2_PHASE1`) |
| `rejected` | Rejected | Approver reject |
| `cancelled` | Cancelled | — |

**Workflow codes:** PR1-sourced Goods and Services → `PR2_FINAL` (Dept Head → Operations Manager). Planning-direct Services / Raw Material → `PR2_PHASE1`.

---

### PO (`po_requests.status`)

| Status | Meaning | Trigger |
|--------|---------|---------|
| `draft` | Generated from approved PR2 | `generatePOFromPR2` |
| `for_approval` | Submitted for approval | `submitPOForApproval` |
| `approved` | Finance Director approved | Step 3 final approve |
| `sent` | Supplier acknowledged | `acknowledgeSupplierPO` (after manual Send for Goods/Services) |
| `cancelled` | Cancelled | — |

---

### Delivery (`deliveries.status`)

| Status | Meaning |
|--------|---------|
| `pending` | Created on PO acknowledgment |
| `scheduled` | Supplier set delivery date |
| `in_transit` | Supplier marked in transit (requires DR upload) |
| `delayed` | Supplier marked delayed |
| `delivered` | Delivered (supplier, procurement, or warehouse) |
| `cancelled` | Cancelled |

---

### GRN (`grn_receipts.status`)

| Status | Meaning |
|--------|---------|
| `open` | GRN opened for receiving (Warehouse owned for Goods, Procurement owned for Services) |
| `pending_qa` | Awaiting TSQA approval on flagged item(s) (Goods or Services) |
| `closed` | All items received and QA resolved; GRN finalized |

---

### Supplier Accreditation (`supplier_accreditations.status`)

| Status | Meaning |
|--------|---------|
| `draft` | Supplier editing |
| `submitted` | Awaiting procurement review |
| `under_review` | Procurement reviewing |
| `missing_documents` | Procurement requested more docs |
| `approved` | Approved |
| `rejected` | Rejected |
| `withdrawn` | Supplier withdrew |

---

### Supplier Product (`supplier_products.status`)

| Status | Meaning |
|--------|---------|
| `draft` | Supplier editing |
| `submitted` | Awaiting review |
| `under_review` | Procurement reviewing |
| `pending_tsqa` | RSE created, awaiting TSQA |
| `verified` | Approved (direct or via TSQA pass) |
| `rejected` | Rejected |
| `inactive` | Deactivated |
| `withdrawn` | Supplier withdrew |

---

### RSE (`rse_records.status`)

| Status | Meaning |
|--------|---------|
| `created` | RSE created by procurement |
| `assigned` | Assigned to TSQA reviewer |
| `under_review` | TSQA actively reviewing |
| `passed` | TSQA passed |
| `failed` | TSQA failed |
| `cancelled` | Cancelled |

---

### Approval Instance (`approval_instances.status`)

| Status | Meaning |
|--------|---------|
| `active` | Workflow in progress |
| `approved` | All steps approved |
| `rejected` | Rejected at a step |
| `cancelled` | Cancelled (e.g., revision requested) |

**Approval action types (`approval_actions.action`):** `approved`, `rejected`, `revision_requested`

---

### Bug Reports (`bug_reports.status`)

| Status | Meaning |
|--------|---------|
| `open` | Newly reported |
| `in_progress` | Admin working on it |
| `resolved` | Fixed |
| `closed` | Closed |

---

## 2. End-to-End State Transition Map

### Goods & Services (PR1-Sourced — Aligned Flow)

```
draft → pending_warehouse → approved_for_warehouse
         ├─ sufficient → resolved_internal
         └─ insufficient → pr2_pending_approval → pr2_approved (PR2_FINAL: Dept Head → Ops Mgr)
                → RFQ (open → closed + RFQ_APPROVAL) → PO → approved (Fin Dir)
                → manual Send (Goods & Services) → supplier ack → sent
                → delivery → GRN open ⇄ pending_qa (TSQA) → closed
```

### Services & Raw Material (Planning-Direct PR2)

```
draft → pending_approval → approved (PR2_PHASE1: Procurement Staff → Mgr → Director)
         → RFQ (open → closed + RFQ_APPROVAL) → PO → approved (Fin Dir)
         → manual Send → supplier ack → sent
         → delivery → GRN open (Procurement owned for Services) ⇄ pending_qa → closed
```

*(Legacy dual-phase PR2 diagram removed — `PR2_PHASE2` is not active.)*

---

## 3. Workflow Step Matrix

### PR1_APPROVAL

| Step | Role | Position | On Approve | On Reject | On Revision |
|------|------|----------|------------|-----------|-------------|
| 1 | approver | Supervisor | Advance to step 2 | PR1 rejected | PR1 revision_requested |
| 2 | approver | Department Head | PR1 → for_canvassing | PR1 rejected | PR1 revision_requested |

### PR2_PHASE1

| Step | Role | Position | On Approve | On Reject | On Revision |
|------|------|----------|------------|-----------|-------------|
| 1 | procurement | Procurement Staff | Advance to step 2 | PR2 → draft | PR2 → draft |
| 2 | procurement | Procurement Manager | Advance to step 3 | PR2 → draft | PR2 → draft |
| 3 | approver | Director | PR2 → phase1_approved, auto Phase 2 | PR2 → draft | PR2 → draft |

### PR2_PHASE2

| Step | Role | Position | On Approve | On Reject | On Revision |
|------|------|----------|------------|-----------|-------------|
| 1 | procurement | Buyer | Advance to step 2 | PR2 → draft | PR2 → draft |
| 2 | procurement | Procurement Manager | Advance to step 3 | PR2 → draft | PR2 → draft |
| 3 | approver | Director | PR2 → phase2_approved | PR2 → draft | PR2 → draft |

### PO_APPROVAL

| Step | Role | Position | On Approve | On Reject | On Revision |
|------|------|----------|------------|-----------|-------------|
| 1 | procurement | Buyer | Advance to step 2 | PO → draft | PO → draft |
| 2 | procurement | Procurement Manager | Advance to step 3 | PO → draft | PO → draft |
| 3 | approver | Finance Director | PO → approved | PO → draft | PO → draft |
| 4 | supplier | Supplier Representative | PO → sent (acknowledgment) | — | — |

---

## 4. Non-Workflow Status Machines

### Substitute Review

| State | Meaning |
|-------|---------|
| Pending decision | Alternative quote exists, no `substitute_decisions` row |
| `accepted` | Employee accepted substitute |
| `rejected` | Employee rejected substitute |

### Accreditation / Product / RSE / TSQA

These use direct status updates (not `approval_instances`):

```
Accreditation: draft → submitted → under_review → approved|rejected|missing_documents|withdrawn
Product:       draft → submitted → under_review → verified|rejected|pending_tsqa|withdrawn
RSE:           created → assigned → under_review → passed|failed|cancelled
TSQA result:   (tsqa_reviews.result) passed|failed → updates RSE + product status
```

---

## 5. Employee Lifecycle Display (Derived)

Source: `lib/pr1.ts` → `deriveEmployeeLifecycleSummary()`

| Condition | Display Label |
|-----------|---------------|
| All POs have closed GRN | Completed (GRN Closed) |
| Some GRNs closed | Partial GRN |
| Delivery in progress | Delivery In Progress |
| PO issued | PO Issued |
| PR2 phase2 approved | PR2 Approved |
| Canvassing complete | Canvassing Complete |
| For canvassing | For Canvassing |
| Pending approval | Pending Approval |
| Pending warehouse | Pending Warehouse |
| Resolved internally | Fulfilled from Stock |

---

## 6. Status Mismatches & Flags

| Issue | Detail |
|-------|--------|
| PR2 Phase 1 documentation drift | Older docs list 4 steps with Dept Head; code has 3 steps |
| PO status no DB CHECK | `po_requests.status` values documented but no CHECK constraint in migrations |
| Delivery state machine loose | No strict enforced transition order in code |
| `approved` PR1 status | Exists in enum but primary terminal path uses `canvassing_complete` |
| `document_type` casing | Audit uses mixed case (`PR1` vs `pr1`, `SUPPLIER_PRODUCT` vs `supplier_product`) |
| `types/database.ts` incomplete | 17 tables/status fields not in generated types |
