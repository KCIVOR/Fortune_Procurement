# Document C — Database Dictionary
## Fortune Procurement System

**Source:** 114 files in `supabase/migrations/` (20260423–20260605), `types/database.ts`  
**Tables:** 41 public tables | **Enums:** None (TEXT + CHECK constraints)  
**Type gap:** `types/database.ts` documents 24 of 41 tables

---

## ERD Summary

### User & Governance
```
auth.users ──1:1── profiles
profiles ──N:1── roles, positions, departments
role_position_module_visibility ──N:1── roles, positions
notifications ──N:1── profiles
audit_logs ──N:1── profiles (nullable)
```

### PR1 Chain
```
pr1_requests ──N:1── profiles (requisitioner), departments
pr1_items ──N:1── pr1_requests (CASCADE)
warehouse_validations ──1:1── pr1_requests (UNIQUE pr1_id)
warehouse_validation_items ──N:1── warehouse_validations, pr1_items
approval_instances(document_type='PR1') ──polymorphic── pr1_requests.id
```

### RFQ Chain
```
rfq_batches ──1:1── pr1_requests (UNIQUE pr1_id)
rfq_suppliers ──N:1── rfq_batches
rfq_item_quotes ──N:1── rfq_suppliers, pr1_items
supplier_item_selections ──N:1── rfq_batches, pr1_items, rfq_suppliers
substitute_decisions ──1:1── rfq_item_quotes
```

### PR2 → PO → Delivery → GRN
```
pr2_requests ──N:1── pr1_requests, rfq_batches (UNIQUE rfq_id)
pr2_items ──N:1── pr2_requests, pr1_items, rfq_suppliers
po_requests ──1:1── pr2_requests (UNIQUE pr2_id)
po_items ──N:1── po_requests (CASCADE), pr2_items
po_receipts ──1:1── po_requests (UNIQUE po_id)
deliveries ──1:1── po_requests (UNIQUE po_id)
delivery_status_history ──N:1── deliveries (CASCADE)
grn_receipts ──1:1── deliveries (UNIQUE delivery_id)
grn_items ──N:1── grn_receipts (CASCADE), po_items
```

### Supplier Compliance
```
supplier_accreditations ──N:1── auth.users (supplier_id)
supplier_products ──N:1── auth.users, supplier_accreditations
supplier_documents ──N:1── accreditations, products
rse_records ──N:1── supplier_products
tsqa_reviews ──N:1── rse_records
rfq_item_quotes.supplier_product_id ──N:1── supplier_products
```

### Workflow Engine
```
controlled_form_templates → controlled_form_versions
approval_workflows → approval_steps
approval_workflows → approval_instances → approval_actions
```

---

## Table Reference

### `departments`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| name | text | ✓ | — | Display name |
| code | text | ✓ UNIQUE | — | Short code (FIN, PROC, WH…) |
| active | boolean | ✓ | true | Soft-disable |
| created_at | timestamptz | — | now() | Audit |

### `roles`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| name | text | ✓ UNIQUE | — | employee, warehouse, procurement, approver, supplier, admin, tsqa |
| active | boolean | ✓ | true | Soft-disable |
| created_at | timestamptz | — | now() | Audit |

### `positions`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| title | text | ✓ | — | Position name |
| role_id | uuid | ✓ | — | FK → roles |
| active | boolean | ✓ | true | Soft-disable |
| created_at | timestamptz | — | now() | Audit |

### `profiles`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | — | PK = auth.users.id |
| full_name | text | ✓ | '' | Display name |
| email | text | ✓ | '' | Email snapshot |
| role_id | uuid | — | — | FK → roles |
| position_id | uuid | — | — | FK → positions |
| department_id | uuid | — | — | FK → departments |
| payment_terms | text | — | — | Supplier default payment terms |
| active | boolean | ✓ | true | Soft-deactivate user account; `false` blocks sign-in |
| created_at | timestamptz | — | now() | Audit |

### `role_position_module_visibility`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| role_id | uuid | ✓ | — | FK → roles |
| position_id | uuid | — | — | FK → positions (null = role-wide) |
| module_key | text | ✓ | — | Sidebar module identifier |
| is_visible | boolean | ✓ | true | Show/hide |
| source_role_id | uuid | — | — | Borrowed module source role |
| created_at / updated_at | timestamptz | ✓ | now() | Audit |

### `approval_workflows`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| code | text | ✓ UNIQUE | — | PR1_APPROVAL, PR2_PHASE1, PR2_PHASE2, PO_APPROVAL |
| name | text | ✓ | — | Display name |
| form_template_id | uuid | — | — | FK → controlled_form_templates |
| active | boolean | ✓ | true | Enabled |
| created_at | timestamptz | — | now() | Audit |

### `approval_steps`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| workflow_id | uuid | ✓ | — | FK → approval_workflows |
| step_order | int | ✓ | — | 1-based sequence |
| role_required | text | ✓ | — | Required role name |
| position_required | text | — | — | Required position title |
| action_label | text | ✓ | — | Signer label |
| is_final | boolean | ✓ | false | Completing closes workflow |
| created_at | timestamptz | — | now() | Audit |

### `approval_instances`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| workflow_id | uuid | ✓ | — | FK → approval_workflows |
| document_type | text | ✓ | — | PR1, PR2, PO |
| document_id | uuid | ✓ | — | Polymorphic doc ID |
| current_step | int | ✓ | 1 | Active step |
| status | text | ✓ | 'active' | active, approved, rejected, cancelled |
| started_by | uuid | ✓ | — | FK → profiles |
| started_at | timestamptz | ✓ | now() | Start time |
| completed_at | timestamptz | — | — | Completion time |
| created_at | timestamptz | — | now() | Audit |

### `approval_actions`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| instance_id | uuid | ✓ | — | FK → approval_instances |
| step_order | int | ✓ | — | Step acted on |
| action | text | ✓ | — | approved, rejected, revision_requested |
| actor_id | uuid | ✓ | — | FK → profiles |
| actor_name_snapshot | text | ✓ | — | Signer name at action time |
| actor_position_snapshot | text | ✓ | — | Position snapshot |
| actor_department_snapshot | text | ✓ | — | Department snapshot |
| remarks | text | — | — | Comments |
| acted_at | timestamptz | ✓ | now() | Action timestamp |
| created_at | timestamptz | — | now() | Audit |

### `notifications`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| user_id | uuid | ✓ | — | FK → profiles |
| title | text | ✓ | — | Title |
| body | text | ✓ | '' | Body |
| type | text | ✓ | 'info' | action_required, info, approved, rejected |
| document_type | text | — | — | Linked doc type |
| document_id | uuid | — | — | Linked doc ID |
| action_url | text | — | — | Deep link |
| read | boolean | ✓ | false | Read flag |
| created_at | timestamptz | — | now() | Created |

### `audit_logs`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| actor_id | uuid | — | — | FK → profiles SET NULL |
| action | text | ✓ | — | Action code (e.g. PR1_SUBMITTED) |
| document_type | text | — | — | Doc type |
| document_id | uuid | — | — | Doc ID |
| payload | jsonb | — | — | Action snapshot |
| ip_address | text | — | — | Client IP (never populated in app) |
| created_at | timestamptz | — | now() | Timestamp |

### `pr1_requests`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| pr1_number | text | ✓ | — | User-entered PR1 number |
| requisitioner_id | uuid | ✓ | — | FK → profiles |
| requisitioner_name_snapshot | text | ✓ | '' | Name at submit |
| department_id | uuid | ✓ | — | FK → departments |
| department_name_snapshot | text | ✓ | '' | Dept at submit |
| purpose | text | ✓ | '' | Reason for request |
| date_required | date | ✓ | — | Needed-by date |
| status | text | ✓ | 'draft' | See status enum |
| submitted_at | timestamptz | — | — | Submit time |
| prepared_by_id | uuid | — | — | FK → profiles |
| prepared_by_name_snapshot | text | — | — | Preparer name |
| prepared_by_position_snapshot | text | — | — | Preparer position |
| prepared_at | timestamptz | — | — | Prepare time |
| priority | text | — | 'normal' | normal, medium, high |
| created_at / updated_at | timestamptz | ✓ | now() | Audit |

**Status CHECK:** draft, pending_warehouse, pending_approval, resolved_internal, revision_requested, for_canvassing, canvassing_complete, approved, rejected, cancelled

### `pr1_items`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| pr1_id | uuid | ✓ | — | FK → pr1_requests CASCADE |
| item_order | int | ✓ | 1 | Display order |
| item_code | text | ✓ | '' | Item code |
| description | text | ✓ | '' | Description |
| unit_of_measure | text | ✓ | '' | UOM |
| stock_on_hand | numeric(12,2) | ✓ | 0 | Requestor SOH |
| quantity_requested | numeric(12,2) | ✓ | 1 | Qty requested |
| is_raw_material | boolean | ✓ | false | Raw material flag |
| created_at | timestamptz | ✓ | now() | Created |

### `warehouse_validations`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| pr1_id | uuid | ✓ UNIQUE | — | FK → pr1_requests |
| validator_id | uuid | — | — | FK → profiles |
| validator_name_snapshot | text | ✓ | '' | Validator name |
| validator_position_snapshot | text | ✓ | '' | Validator position |
| decision | text | — | — | sufficient, insufficient |
| notes | text | ✓ | '' | Overall notes |
| validated_at | timestamptz | — | — | Decision time |
| created_at / updated_at | timestamptz | ✓ | now() | Audit |

### `warehouse_validation_items`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| validation_id | uuid | ✓ | — | FK → warehouse_validations CASCADE |
| pr1_item_id | uuid | ✓ | — | FK → pr1_items |
| item_order | int | ✓ | 1 | Display order |
| item_code / description / unit_of_measure | text | ✓ | '' | Snapshots |
| requestor_soh | numeric(12,2) | ✓ | 0 | Requestor SOH |
| validated_soh | numeric(12,2) | — | — | Warehouse-verified SOH |
| quantity_requested | numeric(12,2) | ✓ | 1 | Snapshot qty |
| availability | text | — | — | available, unavailable |
| item_notes | text | ✓ | '' | Per-item notes |
| item_route | text | — | — | internal, procurement, partial |
| internal_fulfilled_qty | numeric(12,2) | ✓ | 0 | Stock fulfillment qty |
| procurement_qty | numeric(12,2) | ✓ | 0 | Procurement routing qty |
| created_at | timestamptz | ✓ | now() | Created |

### `rfq_batches`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| pr1_id | uuid | ✓ UNIQUE | — | Source PR1 |
| rfq_number | text | ✓ UNIQUE | — | RFQ-YYYY-XXXX |
| status | text | ✓ | 'draft' | draft, open, closed, cancelled |
| issued_by | uuid | ✓ | — | Issuer profile |
| issued_at | timestamptz | — | — | Issue time |
| deadline | date | — | — | Quote deadline |
| notes | text | — | — | RFQ notes |
| created_at / updated_at | timestamptz | ✓ | now() | Audit |

### `rfq_suppliers`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| rfq_id | uuid | ✓ | — | FK → rfq_batches |
| supplier_id | uuid | ✓ | — | auth.users ID |
| supplier_name_snapshot | text | ✓ | '' | Supplier name |
| status | text | ✓ | 'invited' | invited, submitted, declined |
| invited_at | timestamptz | ✓ | now() | Invitation time |
| responded_at | timestamptz | — | — | Response time |
| created_at | timestamptz | ✓ | now() | Created |

### `rfq_item_quotes`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| rfq_supplier_id | uuid | ✓ | — | FK → rfq_suppliers |
| pr1_item_id | uuid | ✓ | — | PR1 line |
| quoted_description | text | ✓ | '' | Quoted description |
| is_alternative | boolean | ✓ | false | Substitute flag |
| unit_price | numeric(14,4) | ✓ | 0 | Unit price |
| lead_time_days | integer | ✓ | 0 | Lead time |
| remarks | text | — | — | Line remarks |
| submitted_at | timestamptz | — | — | Submit time |
| supplier_product_id | uuid | — | — | FK → supplier_products |
| response_status | text | ✓ | 'quoted' | quoted, no_quote |
| no_quote_reason | text | — | — | Required when no_quote |
| created_at / updated_at | timestamptz | ✓ | now() | Audit |

### `supplier_item_selections`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| rfq_id | uuid | ✓ | — | FK → rfq_batches |
| pr1_item_id | uuid | ✓ | — | PR1 line |
| selected_rfq_supplier_id | uuid | ✓ | — | FK → rfq_suppliers |
| selected_by | uuid | ✓ | — | Selector user |
| selected_at | timestamptz | ✓ | now() | Selection time |
| selection_notes | text | — | — | Notes |
| quote_justification | text | — | — | Raw-mats justification |
| requires_justification | boolean | ✓ | false | Justification required flag |
| created_at | timestamptz | ✓ | now() | Created |

### `substitute_decisions`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| rfq_item_quote_id | uuid | ✓ UNIQUE | — | FK → rfq_item_quotes |
| pr1_id | uuid | ✓ | — | FK → pr1_requests |
| decision | text | ✓ | — | accepted, rejected |
| decided_by | uuid | ✓ | — | FK → profiles |
| decided_at | timestamptz | ✓ | now() | Decision time |
| notes | text | — | — | Rationale |
| created_at | timestamptz | ✓ | now() | Created |

### `pr2_requests`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| pr2_number | text | ✓ | — | PR2 number |
| pr1_id | uuid | ✓ | — | FK → pr1_requests |
| rfq_id | uuid | ✓ UNIQUE | — | FK → rfq_batches |
| requisitioner_id | uuid | ✓ | — | From PR1 |
| requisitioner_name_snapshot | text | ✓ | '' | Snapshot |
| department_id | uuid | — | — | Dept ID |
| department_name_snapshot | text | ✓ | '' | Snapshot |
| purpose | text | ✓ | '' | Purpose |
| date_required | date | ✓ | — | Required date |
| pr1_number_snapshot / rfq_number_snapshot | text | ✓ | '' | References |
| remarks | text | — | — | Procurement notes |
| status | text | ✓ | 'draft' | See status enum |
| generated_by | uuid | — | — | FK → profiles |
| generated_at | timestamptz | ✓ | now() | Generation time |
| created_at / updated_at | timestamptz | ✓ | now() | Audit |

**Status CHECK:** draft, pending_phase1_approval, phase1_approved, pending_phase2_approval, phase2_approved, cancelled

### `pr2_items`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| pr2_id | uuid | ✓ | — | FK → pr2_requests |
| item_order | int | ✓ | 1 | Display order |
| item_code / description / unit_of_measure | text | ✓ | '' | Item details |
| pr1_item_id | uuid | — | — | FK → pr1_items |
| quantity_requested / qty_on_hand / qty_incoming / quantity_to_purchase | numeric | ✓ | 0 | Quantities |
| selected_rfq_supplier_id | uuid | — | — | FK → rfq_suppliers |
| supplier_name_snapshot | text | ✓ | '' | Winner supplier |
| quoted_description | text | ✓ | '' | Quote description |
| is_alternative | boolean | ✓ | false | Alternative flag |
| unit_price / total_price | numeric | ✓ | 0 | Pricing |
| lead_time_days | int | ✓ | 0 | Lead time |
| is_raw_material | boolean | ✓ | false | From PR1 |
| quote_justification | text | — | — | Justification snapshot |
| remarks | text | — | — | Line remarks |
| created_at | timestamptz | ✓ | now() | Created |

### `po_requests`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| po_number | text | ✓ UNIQUE | — | Buyer-entered PO number |
| pr2_id | uuid | ✓ UNIQUE | — | FK → pr2_requests |
| pr2/pr1/rfq_number_snapshot | text | ✓ | '' | References |
| supplier_name_snapshot | text | ✓ | '' | Supplier name |
| supplier_id | uuid | — | — | FK → auth.users |
| requisitioner_name_snapshot / department_name_snapshot | text | ✓ | '' | Snapshots |
| purpose | text | ✓ | '' | Purpose |
| date_required | date | ✓ | — | Required date |
| po_date | date | ✓ | CURRENT_DATE | PO date |
| delivery_address / warehouse / payment_terms / packing | text | ✓ | '' | PO terms |
| remarks | text | — | — | Notes |
| status | text | ✓ | 'draft' | draft, for_approval, approved, sent, cancelled |
| approval_instance_id | uuid | — | — | Active approval |
| generated_by | uuid | — | — | FK → auth.users |
| generated_at | timestamptz | ✓ | now() | Created by buyer |
| created_at / updated_at | timestamptz | ✓ | now() | Audit |

### `po_items`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| po_id | uuid | ✓ | — | FK → po_requests CASCADE |
| pr2_item_id | uuid | — | — | FK → pr2_items |
| item_order | integer | ✓ | 1 | Display order |
| item_code / description / unit_of_measure | text | ✓ | '' | Item details |
| quantity_to_purchase | numeric(12,2) | ✓ | 0 | Order qty |
| unit_price / total_price | numeric(14,2) | ✓ | 0 | Pricing |
| supplier_name_snapshot | text | ✓ | '' | Per-line supplier |
| remarks | text | — | — | Line notes |
| created_at | timestamptz | ✓ | now() | Created |

### `po_receipts`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| po_id | uuid | ✓ UNIQUE | — | FK → po_requests CASCADE |
| acknowledged_by | uuid | — | — | FK → auth.users |
| acknowledged_by_name | text | ✓ | '' | Acknowledger name |
| commitment_date | date | — | — | Promised delivery date |
| delivery_remarks | text | — | — | Supplier notes |
| acknowledged_at | timestamptz | ✓ | now() | Ack time |
| created_at / updated_at | timestamptz | ✓ | now() | Audit |

### `deliveries`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| po_id | uuid | ✓ UNIQUE | — | FK → po_requests |
| po/pr2/pr1/rfq_number_snapshot | text | ✓ | '' | References |
| supplier_id | uuid | — | — | FK → auth.users |
| supplier_name_snapshot | text | ✓ | '' | Supplier |
| requisitioner_id | uuid | — | — | FK → auth.users |
| requisitioner_name_snapshot | text | ✓ | '' | Employee |
| department_name_snapshot | text | ✓ | '' | Department |
| purpose | text | ✓ | '' | Purpose |
| status | text | ✓ | 'pending' | pending, scheduled, in_transit, delayed, delivered, cancelled |
| commitment_date / scheduled_date / actual_delivery_date | date | — | — | Dates |
| delivery_address / warehouse | text | ✓ | '' | Location |
| grand_total | numeric(14,2) | ✓ | 0 | PO total |
| dr_document_path / dr_document_filename / dr_document_uploaded_at | — | — | — | DR attachment |
| created_at / updated_at | timestamptz | ✓ | now() | Audit |

### `delivery_status_history`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| delivery_id | uuid | ✓ | — | FK → deliveries CASCADE |
| actor_id | uuid | ✓ | — | FK → auth.users |
| actor_name / actor_role | text | ✓ | '' | Actor info |
| status_from / status_to | text | — | — | Status transition |
| note | text | — | — | Free text |
| scheduled_date | date | — | — | Updated schedule |
| created_at | timestamptz | ✓ | now() | Timestamp |

### `grn_receipts`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| grn_number | text | ✓ UNIQUE | generate_grn_number() | GRN-YYYY-XXXX |
| delivery_id | uuid | ✓ UNIQUE | — | FK → deliveries |
| po/pr2/pr1_number_snapshot | text | ✓ | '' | References |
| supplier_name_snapshot / department_name_snapshot | text | ✓ | '' | Snapshots |
| purpose | text | ✓ | '' | Purpose |
| warehouse / delivery_address | text | ✓ | '' | Location |
| dr_no | text | ✓ | '' | Delivery receipt number |
| dr_date | date | — | — | DR date |
| transaction_date | date | ✓ | CURRENT_DATE | GRN date |
| received_by_id | uuid | — | — | FK → auth.users |
| received_by_name_snapshot / received_by_position_snapshot | text | ✓ | '' | Receiver |
| status | text | ✓ | 'open' | open, closed |
| remarks | text | ✓ | '' | Notes |
| created_at / updated_at / closed_at | timestamptz | — | — | Audit |

### `grn_items`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| grn_id | uuid | ✓ | — | FK → grn_receipts CASCADE |
| po_item_id | uuid | — | — | FK → po_items |
| item_order | int | ✓ | 0 | Display order |
| item_code / description / unit_of_measure | text | ✓ | '' | Item details |
| quantity_ordered / quantity_received / quantity_rejected | numeric(14,4) | ✓ | 0 | Quantities |
| unit_price | numeric(14,4) | ✓ | 0 | Price snapshot |
| remarks | text | ✓ | '' | Line notes |
| created_at / updated_at | timestamptz | ✓ | now() | Audit |

### `supplier_accreditations`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| supplier_id | uuid | ✓ | — | FK → auth.users |
| status | text | ✓ | 'draft' | draft, submitted, under_review, missing_documents, approved, rejected, withdrawn |
| submitted_at / reviewed_at / approved_at / rejected_at | timestamptz | — | — | Timestamps |
| reviewed_by | uuid | — | — | FK → auth.users |
| review_notes / missing_documents_note | text | — | — | Reviewer notes |
| created_at / updated_at | timestamptz | ✓ | now() | Audit |

### `supplier_products`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| supplier_id | uuid | ✓ | — | FK → auth.users |
| accreditation_id | uuid | — | — | FK → supplier_accreditations |
| product_name | text | ✓ | — | Product name |
| product_code / category / description / specifications | text | — | — | Product details |
| status | text | ✓ | 'draft' | draft, submitted, under_review, pending_tsqa, verified, rejected, inactive, withdrawn |
| submitted_at / reviewed_at / verified_at / rejected_at | timestamptz | — | — | Timestamps |
| reviewed_by | uuid | — | — | FK → auth.users |
| review_notes | text | — | — | Notes |
| created_at / updated_at | timestamptz | ✓ | now() | Audit |

### `supplier_documents`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| supplier_id | uuid | ✓ | — | FK → auth.users |
| accreditation_id / supplier_product_id | uuid | — | — | Parent entity |
| document_type | text | ✓ | — | Document type key |
| file_name / file_path | text | ✓ | — | Storage reference |
| mime_type | text | — | — | MIME type |
| file_size | bigint | — | — | Size bytes |
| uploaded_by | uuid | ✓ | — | FK → auth.users |
| uploaded_at | timestamptz | ✓ | now() | Upload time |
| expires_at | date | — | — | Expiry |
| status | text | ✓ | 'uploaded' | uploaded, accepted, rejected, expired |
| created_at / updated_at | timestamptz | ✓ | now() | Audit |

### `rse_records`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| rse_number | text | ✓ UNIQUE | generate_rse_number() | RSE-YYYYMM-XXXX |
| supplier_id | uuid | ✓ | — | FK → auth.users |
| accreditation_id | uuid | — | — | FK → supplier_accreditations |
| supplier_product_id | uuid | ✓ | — | FK → supplier_products |
| status | text | ✓ | 'created' | created, assigned, under_review, passed, failed, cancelled |
| created_by / assigned_to | uuid | ✓/— | — | FK → auth.users |
| assigned_at / completed_at | timestamptz | — | — | Timestamps |
| reason / procurement_notes | text | — | — | Notes |
| created_at / updated_at | timestamptz | ✓ | now() | Audit |

### `tsqa_reviews`
| Column | Type | Req | Default | Purpose |
|--------|------|-----|---------|---------|
| id | uuid | ✓ | gen_random_uuid() | PK |
| rse_id | uuid | ✓ | — | FK → rse_records |
| reviewer_id | uuid | ✓ | — | FK → auth.users |
| result | text | — | — | passed, failed |
| remarks / test_findings | text | — | — | Review content |
| reviewed_at | timestamptz | — | — | Review time |
| created_at / updated_at | timestamptz | ✓ | now() | Audit |

### Messaging & Platform Tables

**`conversations`:** user_a_id, user_b_id (ordered pair), last_message_at, last_message_preview  
**`messages`:** conversation_id, sender_id, content, is_deleted, read_at, attachment_count  
**`message_attachments`:** message_id, conversation_id, file_name, file_path, file_size, mime_type, uploaded_by  
**`bug_reports`:** title, description, expected_behavior, error_message, severity, status, reporter_id, ai_prompt  
**`bugtrack_settings`:** notification_email (singleton row)

### Infrastructure Tables (Semi-Orphan)

**`controlled_form_templates`:** code (PR1, PR2, RFQ, PO, GRN), name — seeded, FK-linked, not queried by app  
**`controlled_form_versions`:** template_id, version — seed-only, no app reads

---

## Sequences & Number Formats

| Format | Function | Example |
|--------|----------|---------|
| RFQ-YYYY-XXXX | `generate_rfq_number()` | RFQ-2026-0001 |
| GRN-YYYY-XXXX | `generate_grn_number()` | GRN-2026-0001 |
| RSE-YYYYMM-XXXX | `generate_rse_number()` | RSE-202606-0001 |
| PO-YYYY-XXXX | Buyer-entered (auto-gen dropped) | Manual entry |

---

## Storage Buckets

| Bucket | Purpose | Max Size | Types |
|--------|---------|----------|-------|
| `accreditation-docs` | Supplier docs | 20 MB | PDF, JPG, PNG |
| `delivery-receipts` | DR uploads | 10 MB | PDF, JPG, PNG |
| `message-attachments` | Chat files | 10 MB | Images, PDF, Office |

---

## Orphan / Flagged Tables

| Table | Status |
|-------|--------|
| `controlled_form_versions` | Infrastructure only — no app queries |
| `controlled_form_templates` | Semi-orphan — FK-linked but not directly queried |
| All other 39 tables | Active in `lib/*.ts` and/or `app/**/*.tsx` |
