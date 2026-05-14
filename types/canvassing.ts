export type RfqBatchStatus     = 'draft' | 'open' | 'closed' | 'cancelled';
export type RfqSupplierStatus  = 'invited' | 'submitted' | 'declined';
export type SubstituteDecision = 'accepted' | 'rejected';

export interface SubstituteDecisionRow {
  id:                string;
  rfq_item_quote_id: string;
  pr1_id:            string;
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
  pr1_item_id:           string;
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
}

export interface SubstituteReviewBundle {
  pr1: {
    id:                          string;
    pr1_number:                  string;
    purpose:                     string;
    department_name_snapshot:    string;
    requisitioner_id:            string;
  };
  substitutes: SubstituteReviewItem[];
}

// ─── Raw DB rows ──────────────────────────────────────────────────────────────

export interface RfqBatch {
  id:         string;
  pr1_id:     string;
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
  supplier_id:            string;
  supplier_name_snapshot: string;
  status:                 RfqSupplierStatus;
  invited_at:             string;
  responded_at:           string | null;
  created_at:             string;
}

export type RfqQuoteResponseStatus = 'quoted' | 'no_quote';

export interface RfqItemQuote {
  id:                  string;
  rfq_supplier_id:     string;
  pr1_item_id:         string;
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
}

export interface SupplierItemSelection {
  id:                       string;
  rfq_id:                   string;
  pr1_item_id:              string;
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
}

/** Phase 7: catalog product summary keyed by supplier_product_id. */
export interface CatalogProductSummary {
  product_name: string;
  product_code: string | null;
  status:       string;
}

/** Supplier users eligible for RFQ canvassing (procurement), with readiness context. */
export interface CanvassSupplierCandidate {
  id:                        string;
  full_name:                 string;
  email:                     string | null;
  /** Latest `supplier_accreditations.status` by `created_at` DESC, or null if none. */
  accreditation_status:      string | null;
  verified_product_count:    number;
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
  }[];
  suppliers:  RfqSupplier[];
  quotes:     RfqItemQuote[];
  selections: SupplierItemSelection[];
  substituteDecisions: SubstituteDecisionRow[];
  /** All supplier-role profiles; used for canvass modal and assign name snapshots. */
  allSuppliers: CanvassSupplierCandidate[];
  /** Phase 7: map of supplier_product_id → product summary for all linked products. */
  productLookup: Record<string, CatalogProductSummary>;
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
    supplier_product_id:   string | null;
    supplier_product_name: string | null;
    supplier_product_code: string | null;
    supplier_product_status: string | null;
    /** Supplier explicit no-quote vs quoted line (default quoted). */
    response_status:        RfqQuoteResponseStatus;
    no_quote_reason:        string | null;
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
