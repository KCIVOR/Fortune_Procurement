import type { PR1Attachment } from '@/types/pr1';

export type POStatus = 'draft' | 'revision_requested' | 'for_approval' | 'approved' | 'sent' | 'cancelled' | 'rejected';

export const PO_STATUS_LABELS: Record<POStatus, string> = {
  draft:        'Draft',
  revision_requested: 'Needs Revision',
  for_approval: 'For Approval',
  approved:     'Approved',
  sent:         'Sent to Supplier',
  cancelled:    'Cancelled',
  rejected:     'Rejected',
};

export interface PORequest {
  id: string;
  po_number: string;
  pr2_id: string;
  pr2_number_snapshot: string;
  pr1_number_snapshot: string;
  rfq_number_snapshot: string;
  request_type:        'goods' | 'services' | 'raw_material';
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
  department_id: string | null;
  status: POStatus;
  generated_by: string | null;
  generated_at: string;
  created_at: string;
  updated_at: string;
  /** Rev #9: resolved from pr1_requests.priority via ID-based join at read time. */
  pr1_priority?: string;
  /** Rev #9: resolved po -> pr2 -> pr1 via ID-based join; needed to edit priority from the PO detail page. */
  pr1_id?: string | null;
  /** Phase 5 (Goods): procurement manual send audit — supplier notified at send, not approval. */
  sent_by_id?: string | null;
  sent_at?: string | null;
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
  /** Rev #1 (VAT): snapshotted from the PR2 line at PO generation time; null when not VAT-registered. */
  vat_type?: 'vat_inclusive' | 'vat_exclusive' | null;
  vat_rate_applied?: number | null;
  supplier_name_snapshot: string;
  remarks: string | null;
  /** Phase 9 (Compliance docs): set by Procurement/Buyer — supplier must upload a cert for this line once a GRN exists. */
  requires_compliance_doc: boolean;
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
  /**
   * Read-only, forwarded from `pr2_items.pr1_remarks_snapshot` via join —
   * the requestor's original PR1 line remarks. Distinct from this row's own
   * `remarks` (buyer-entered).
   */
  pr1_remarks_snapshot?: string | null;
  /**
   * Read-only, forwarded from `pr2_items.pr1_quantity_requested_snapshot` via
   * join — the original PR1 ask. Differs from `quantity_to_purchase` only
   * when warehouse overrode the line during validation.
   */
  pr1_quantity_requested_snapshot?: number | null;
  /** Read-only, forwarded from `pr2_items.quantity_override_reason_snapshot`. */
  quantity_override_reason_snapshot?: string | null;
  /** Read-only, forwarded from `pr2_items.quantity_overridden_by_name_snapshot`. */
  quantity_overridden_by_name_snapshot?: string | null;
  /** FK to the winning rfq_item_quotes row, forwarded from pr2_items via join. */
  rfq_item_quote_id?: string | null;
  /** Supplier quote attachments loaded at read time via rfq_item_quote_id. */
  quote_attachments?: import('./canvassing').RfqQuoteAttachment[];
  /** Requestor PR1 item attachments, forwarded via pr1_item_id at read time. */
  attachments?: PR1Attachment[];
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
  /** Supplier user id (profiles.id / auth user). Null for external vendors. */
  supplier_id: string | null;
  supplier_name_snapshot: string;
  /** True when this candidate is an external vendor (no supplier account). */
  is_external?: boolean;
  selected_rfq_supplier_ids: string[];
  item_count: number;
  grand_total: number;
  has_po: boolean;
  existing_po_id: string | null;
}

/** Fallback defaults — dynamic options are now served from system_dropdown_options table. */
export const WAREHOUSE_OPTIONS_DEFAULTS = [
  'Main Warehouse',
  'Warehouse A',
  'Warehouse B',
  'Cold Storage',
  'Hazmat Storage',
  'Off-Site Warehouse',
  'Other',
] as const;

/** Fallback defaults — dynamic options are now served from system_dropdown_options table. */
export const PAYMENT_TERMS_OPTIONS_DEFAULTS = [
  '15 days net',
  '30 days net',
  '45 days net',
  '60 days net',
  'COD (Cash on Delivery)',
  'Advance Payment',
  'Letter of Credit',
  'Other',
] as const;

export const PO_OTHER_OPTION = 'Other';

/** Map a stored value back to dropdown + custom field when editing or pre-filling. */
export function resolvePOOptionSelection(
  stored: string,
  options: readonly string[],
): { sel: string; custom: string } {
  if (!stored) return { sel: '', custom: '' };
  if ((options as readonly string[]).includes(stored) && stored !== PO_OTHER_OPTION) {
    return { sel: stored, custom: '' };
  }
  return { sel: PO_OTHER_OPTION, custom: stored };
}

// ─── Approval queue / detail ──────────────────────────────────────────────────

export interface POApprovalQueueRow {
  po_id:                      string;
  po_number:                  string;
  supplier_name_snapshot:     string;
  department_name_snapshot:   string;
  department_id:              string | null;
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
  request_type?:              'goods' | 'services' | 'raw_material';
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
  supplier_id:                 string | null;
  supplier_name_snapshot:      string;
  requisitioner_name_snapshot: string;
  department_name_snapshot:    string;
  department_id:               string | null;
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
  request_type?:               'goods' | 'services' | 'raw_material';
  /** Rev #9: needed to edit priority from the approval detail page. */
  pr1_id?:                     string | null;
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
