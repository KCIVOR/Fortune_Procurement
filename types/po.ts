export type POStatus = 'draft' | 'for_approval' | 'approved' | 'sent' | 'cancelled';

export const PO_STATUS_LABELS: Record<POStatus, string> = {
  draft:        'Draft',
  for_approval: 'For Approval',
  approved:     'Approved',
  sent:         'Sent to Supplier',
  cancelled:    'Cancelled',
};

export interface PORequest {
  id: string;
  po_number: string;
  pr2_id: string;
  pr2_number_snapshot: string;
  pr1_number_snapshot: string;
  rfq_number_snapshot: string;
  supplier_name_snapshot: string;
  supplier_id: string | null;
  requisitioner_name_snapshot: string;
  department_name_snapshot: string;
  purpose: string;
  date_required: string;
  po_date: string;
  delivery_address: string;
  warehouse: string;
  payment_terms: string;
  packing: string;
  remarks: string | null;
  status: POStatus;
  generated_by: string | null;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

export interface POItem {
  id: string;
  po_id: string;
  pr2_item_id: string | null;
  item_order: number;
  item_code: string;
  description: string;
  unit_of_measure: string;
  quantity_to_purchase: number;
  unit_price: number;
  total_price: number;
  supplier_name_snapshot: string;
  remarks: string | null;
  /**
   * Phase 9 (Raw Mats): forwarded from `pr2_items.is_raw_material` via join.
   * Optional because legacy `select('*')` queries that don't perform the join
   * still compile; specific surfaces (PO detail, print, approvals, supplier
   * PO) widen their query to populate it.
   */
  is_raw_material?: boolean;
  /**
   * Phase 9 (Raw Mats): forwarded from `pr2_items.quote_justification` via
   * join. Only ever populated when the upstream selection required one
   * (raw-mats line awarded against unverified or manual quote).
   */
  quote_justification?: string | null;
  created_at: string;
}

export interface POWithItems extends PORequest {
  items: POItem[];
}

export interface POFormValues {
  po_number: string;
  po_date: string;
  delivery_address: string;
  warehouse: string;
  payment_terms: string;
  packing: string;
  remarks: string;
}

/** One selectable row on /po/new: a supplier group within an approved PR2. */
export interface POGenerationCandidate {
  candidateKey: string;
  pr2_id: string;
  pr2_number: string;
  purpose: string;
  department_name_snapshot: string;
  requisitioner_name_snapshot: string;
  date_required: string;
  /** Supplier user id (profiles.id / auth user). */
  supplier_id: string;
  supplier_name_snapshot: string;
  selected_rfq_supplier_ids: string[];
  item_count: number;
  grand_total: number;
  has_po: boolean;
  existing_po_id: string | null;
}

export const WAREHOUSE_OPTIONS = [
  'Main Warehouse',
  'Warehouse A',
  'Warehouse B',
  'Cold Storage',
  'Hazmat Storage',
  'Off-Site Warehouse',
] as const;

export const PAYMENT_TERMS_OPTIONS = [
  '15 days net',
  '30 days net',
  '45 days net',
  '60 days net',
  'COD (Cash on Delivery)',
  'Advance Payment',
  'Letter of Credit',
] as const;

// ─── Approval queue / detail ──────────────────────────────────────────────────

export interface POApprovalQueueRow {
  po_id:                      string;
  po_number:                  string;
  supplier_name_snapshot:     string;
  department_name_snapshot:   string;
  purpose:                    string;
  date_required:              string;
  po_status:                  string;
  instance_id:                string;
  current_step:               number;
  instance_status:            string;
  started_at:                 string;
  step_role_required:         string;
  step_position_required:     string;
  step_action_label:          string;
  step_is_final:              boolean;
  pr1_priority?:              'normal' | 'medium' | 'high';
}

export interface POApprovalStep {
  step_order:        number;
  role_required:     string;
  position_required: string;
  action_label:      string;
  is_final:          boolean;
}

export interface POApprovalAction {
  id:                        string;
  instance_id:               string;
  step_order:                number;
  action:                    'approved' | 'rejected' | 'revision_requested';
  actor_id:                  string;
  actor_name_snapshot:       string;
  actor_position_snapshot:   string;
  actor_department_snapshot: string;
  remarks:                   string | null;
  acted_at:                  string;
}

export interface POApprovalDetail {
  po_id:                       string;
  po_number:                   string;
  pr2_number_snapshot:         string;
  pr1_number_snapshot:         string;
  rfq_number_snapshot:         string;
  supplier_name_snapshot:      string;
  requisitioner_name_snapshot: string;
  department_name_snapshot:    string;
  purpose:                     string;
  date_required:               string;
  po_date:                     string;
  warehouse:                   string;
  delivery_address:            string;
  payment_terms:               string;
  packing:                     string;
  remarks:                     string | null;
  po_status:                   string;
  pr1_priority?:               'normal' | 'medium' | 'high';
  items:                       POItem[];
  instance_id:                 string;
  current_step:                number;
  instance_status:             string;
  started_at:                  string;
  steps:                       POApprovalStep[];
  actions:                     POApprovalAction[];
  receipt:                     POReceipt | null;
}

// ─── Supplier receipt ─────────────────────────────────────────────────────────

export interface POReceipt {
  id:                   string;
  po_id:                string;
  acknowledged_by:      string | null;
  acknowledged_by_name: string;
  commitment_date:      string | null;
  delivery_remarks:     string | null;
  acknowledged_at:      string;
}

// ─── Supplier PO view ─────────────────────────────────────────────────────────

export interface SupplierPORow {
  po_id:                  string;
  po_number:              string;
  purpose:                string;
  date_required:          string;
  po_date:                string;
  warehouse:              string;
  payment_terms:          string;
  po_status:              string;
  receipt:                POReceipt | null;
}
