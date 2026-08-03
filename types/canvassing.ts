import type { PR1Attachment } from './pr1';

export interface RfqQuoteAttachment {
  id:                string;
  rfq_id:            string;
  rfq_supplier_id:   string;
  rfq_item_quote_id: string;
  pr1_item_id:       string | null;
  /** Phase 3 (Raw Mats): set instead of pr1_item_id for PR2-native lines. */
  pr2_item_id?:      string | null;
  uploaded_by:       string;
  storage_path:      string;
  file_name:         string;
  file_size:         number | null;
  mime_type:         string | null;
  created_at:        string;
}

export type RfqBatchStatus     = 'draft' | 'open' | 'closed' | 'cancelled';
export type RfqSupplierStatus  = 'invited' | 'submitted' | 'declined';
export type SubstituteDecision = 'accepted' | 'rejected';

export interface SubstituteDecisionRow {
  id:                string;
  rfq_item_quote_id: string;
  /** Set for PR1-originated RFQs; null for PR2-native. */
  pr1_id:            string | null;
  /** Set for PR2-native RFQs; null for PR1-originated. */
  pr2_id?:           string | null;
  decision:          SubstituteDecision;
  decided_by:        string;
  decided_at:        string;
  notes:             string | null;
  created_at:        string;
}

export interface SubstituteReviewItem {
  quote_id:              string;
  rfq_id:                string;
  rfq_number:            string;
  rfq_supplier_id:       string;
  supplier_name:         string;
  /** PR1 line id when source is PR1; null for PR2-native. */
  pr1_item_id:           string | null;
  /** PR2 line id when source is PR2-native; null for PR1. */
  pr2_item_id?:          string | null;
  item_order:            number;
  item_code:             string;
  original_description:  string;
  original_quantity:     number;
  unit_of_measure:       string;
  quoted_description:    string;
  unit_price:            number;
  lead_time_days:        number;
  remarks:               string | null;
  submitted_at:          string | null;
  decision:              SubstituteDecision | null;
  decided_at:            string | null;
  decision_notes:        string | null;
  /** Role of whoever recorded `decision` — 'employee' (requestor) or 'procurement'. Null if undecided. */
  decided_by_role:       string | null;
  /** Supplier-uploaded attachments for this substitute quote line. */
  attachments:           RfqQuoteAttachment[];
  rfq_status:            RfqBatchStatus;
  /** True if procurement has already awarded this PR1 line item in this RFQ. */
  is_awarded:            boolean;
}

export interface SubstituteReviewBundle {
  /** Which parent document this bundle belongs to. */
  source: 'pr1' | 'pr2';
  /**
   * Display header. For source='pr1' this is the real PR1.
   * For source='pr2', fields are mapped: id=pr2.id, pr1_number=pr2.pr2_number.
   * Keeping this shape avoids rewriting every index/detail consumer.
   */
  pr1: {
    id:                          string;
    pr1_number:                  string;
    purpose:                     string;
    department_name_snapshot:    string;
    requisitioner_id:            string;
    requisitioner_name_snapshot: string;
    priority?:                   string;
  };
  substitutes: SubstituteReviewItem[];
}

// ─── Raw DB rows ──────────────────────────────────────────────────────────────

export interface RfqBatch {
  id:         string;
  pr1_id:     string | null;
  pr2_id?:    string | null;
  rfq_number: string;
  status:     RfqBatchStatus;
  issued_by:  string;
  issued_at:  string | null;
  deadline:   string | null;
  notes:      string | null;
  created_at: string;
  updated_at: string;
}

export interface RfqSupplier {
  id:                     string;
  rfq_id:                 string;
  /** Null for external vendors (no supplier account) — see `is_external`. */
  supplier_id:            string | null;
  supplier_name_snapshot: string;
  status:                 RfqSupplierStatus;
  /**
   * External vendor (e.g. Shopee, Lazada) added by Procurement with no supplier
   * account. Procurement enters the quote on their behalf; they never log in.
   */
  is_external?:           boolean;
  invited_at:             string;
  responded_at:           string | null;
  created_at:             string;
  /** Rev #1 (VAT): resolved from the linked supplier profile at read time; false for external vendors. */
  is_vat_registered?:     boolean;
}

export type RfqQuoteResponseStatus = 'quoted' | 'no_quote';

export interface RfqItemQuote {
  id:                  string;
  rfq_supplier_id:     string;
  pr1_item_id:         string | null;
  /** Phase 3 (Raw Mats): set instead of pr1_item_id for PR2-native lines. */
  pr2_item_id?:        string | null;
  quoted_description:  string;
  is_alternative:      boolean;
  unit_price:          number;
  lead_time_days:      number;
  remarks:             string | null;
  submitted_at:        string | null;
  created_at:          string;
  updated_at:          string;
  /** Phase 7: nullable link to supplier's verified catalog product. */
  supplier_product_id: string | null;
  /** Explicit line response; omitted/null treated as quoted for legacy rows. */
  response_status?:     RfqQuoteResponseStatus;
  no_quote_reason?:    string | null;
  /** Supplier-uploaded attachments for this quote line. Loaded at read time. */
  attachments?:         RfqQuoteAttachment[];
  /** Rev #1: set by the supplier per line; only meaningful when they're VAT-registered. */
  vat_type?:            'vat_inclusive' | 'vat_exclusive' | null;
}

export interface SupplierItemSelection {
  id:                       string;
  rfq_id:                   string;
  pr1_item_id:              string | null;
  /** Phase 3 (Raw Mats): set instead of pr1_item_id for PR2-native lines. */
  pr2_item_id?:             string | null;
  selected_rfq_supplier_id: string;
  selected_by:              string;
  selected_at:              string;
  selection_notes:          string | null;
  created_at:               string;
}

// ─── Composite view types ─────────────────────────────────────────────────────

export interface CanvassingQueueRow {
  pr1_id:                      string;
  pr1_number:                  string;
  requisitioner_name_snapshot: string;
  department_name_snapshot:    string;
  purpose:                     string;
  priority:                    string | null;
  date_required:               string;
  submitted_at:                string | null;
  rfq_id:                      string | null;  // null = no RFQ created yet
  rfq_number:                  string | null;
  rfq_status:                  RfqBatchStatus | null;
  request_type:                'goods' | 'services';
  assigned_buyer_id:            string | null;
  assigned_buyer_name_snapshot: string | null;
}

/** Phase 3 (Raw Mats): PR2-native canvassing queue row — no PR1, no warehouse step, no buyer/priority fields. */
export interface RawMaterialCanvassingQueueRow {
  pr2_id:                      string;
  pr2_number:                  string;
  request_type:                'raw_material' | 'services';
  requisitioner_name_snapshot: string;
  department_name_snapshot:    string;
  purpose:                     string;
  priority?:                   string | null;
  date_required:               string;
  rfq_id:                      string | null;
  rfq_number:                  string | null;
  rfq_status:                  RfqBatchStatus | null;
}

/** Phase 7: catalog product summary keyed by supplier_product_id. */
export interface CatalogProductSummary {
  product_name: string;
  product_code: string | null;
  status:       string;
  item_type:    'goods' | 'services';
}

/** Supplier users eligible for RFQ canvassing (procurement), with readiness context. */
export interface CanvassSupplierCandidate {
  id:                        string;
  full_name:                 string;
  email:                     string | null;
  /** Exclusive supply classification from `profiles.supplier_supply_type`. */
  supplier_supply_type:      'raw_material' | 'normal' | 'service' | null;
  /** Latest `supplier_accreditations.status` by `created_at` DESC, or null if none. */
  accreditation_status:      string | null;
  /** Total verified (goods + services). Used for readiness checks. */
  verified_product_count:    number;
  verified_goods_count:      number;
  verified_service_count:    number;
  pending_product_count:     number;
  rejected_product_count:    number;
  withdrawn_product_count:   number;
}

export interface RfqDetailView {
  rfq:        RfqBatch;
  pr1: {
    id:                          string;
    pr1_number:                  string;
    requisitioner_name_snapshot: string;
    department_name_snapshot:    string;
    purpose:                     string;
    date_required:               string;
    request_type:                'goods' | 'services' | 'raw_material';
  };
  items: {
    id:                 string;
    item_order:         number;
    item_code:          string;
    description:        string;
    unit_of_measure:    string;
    /** RFQ / procurement quantity (from warehouse `procurement_qty` when validated). */
    quantity_requested: number;
    /** Original PR1 requested quantity; set when warehouse validation applies and differs. */
    pr1_quantity_requested?: number;
    /**
     * Phase 1 (Raw Mats): forwarded from `pr1_items.is_raw_material`.
     * Optional here because the upstream query is widened in Phase 6;
     * legacy callers that don't select the column still compile.
     */
    is_raw_material?:   boolean;
    /** Forwarded from `pr1_items.remarks` — the requestor's note on this line. */
    remarks?:           string | null;
    attachments?:       PR1Attachment[];
  }[];
  suppliers:  RfqSupplier[];
  quotes:     RfqItemQuote[];
  selections: SupplierItemSelection[];
  substituteDecisions: SubstituteDecisionRow[];
  /** All supplier-role profiles; used for canvass modal and assign name snapshots. */
  allSuppliers: CanvassSupplierCandidate[];
  /** Phase 7: map of supplier_product_id → product summary for all linked products. */
  productLookup: Record<string, CatalogProductSummary>;
  /** Rev #1 (VAT): system VAT rate at read time, used to compute per-quote totals in the matrix. */
  vatRate: number;
}

// Per-item quotation row used in comparison matrix
export interface QuoteMatrixRow {
  item: {
    id:                 string;
    item_order:         number;
    item_code:          string;
    description:        string;
    unit_of_measure:    string;
    quantity_requested: number;
    pr1_quantity_requested?: number;
    /**
     * Phase 1 (Raw Mats): forwarded from `RfqDetailView.items[].is_raw_material`.
     * Optional for the same compatibility reasons; populated once Phase 6
     * widens the canvassing query.
     */
    is_raw_material?:   boolean;
    /** Forwarded from `RfqDetailView.items[].remarks`. */
    remarks?:           string | null;
    attachments?:       PR1Attachment[];
  };
  quotes: {
    rfq_supplier_id:       string;
    quote_id:              string | null;
    supplier_name:         string;
    quoted_description:    string;
    is_alternative:        boolean;
    unit_price:            number;
    lead_time_days:        number;
    remarks:               string | null;
    total_price:           number;
    is_selected:           boolean;
    substitute_decision:   SubstituteDecision | null;
    /** Phase 7: linked catalog product — null for old or unlinked quotes. */
    supplier_product_id:        string | null;
    supplier_product_name:      string | null;
    supplier_product_code:      string | null;
    supplier_product_status:    string | null;
    supplier_product_item_type: 'goods' | 'services' | null;
    /**
     * Phase 6 (Raw Mats): coarse-grained verification state for the cell pill.
     * - `verified`   → linked product status = 'verified'
     * - `unverified` → linked product exists but is in-flight or rejected
     * - `manual`     → no linked product (supplier filled the line manually)
     * Optional for backward compatibility with any legacy callers.
     */
    verification_status?:   'verified' | 'unverified' | 'manual';
    /** Supplier explicit no-quote vs quoted line (default quoted). */
    response_status:        RfqQuoteResponseStatus;
    no_quote_reason:        string | null;
    /** Supplier-uploaded attachments for this quote cell. */
    attachments:            RfqQuoteAttachment[];
    /** Rev #1: set by the supplier per line; only meaningful when they're VAT-registered. */
    vat_type?:               'vat_inclusive' | 'vat_exclusive' | null;
  }[];
  selected_rfq_supplier_id: string | null;
}

// Supplier-side view of their RFQ assignment
export interface SupplierRfqInboxRow {
  rfq_supplier_id:        string;
  rfq_id:                 string;
  rfq_number:             string;
  rfq_status:             RfqBatchStatus;
  rfq_deadline:           string | null;
  supplier_status:        RfqSupplierStatus;
  pr1_number:             string;
  department_name:        string;
  purpose:                string;
  item_count:             number;
  quotes_submitted:       number;
}
