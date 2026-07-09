import type { PR1Attachment } from './pr1';
import type { RfqQuoteAttachment } from './canvassing';

export type PR2Status =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'revision_requested'
  | 'rejected'
  | 'cancelled';

export const PR2_STATUS_LABELS: Record<PR2Status, string> = {
  draft:              'Draft',
  pending_approval:   'Pending Approval',
  approved:           'Approved',
  revision_requested: 'Needs Revision',
  rejected:           'Rejected',
  cancelled:          'Cancelled',
};

export interface PR2Request {
  id:                          string;
  pr2_number:                  string;
  pr1_id:                      string;
  rfq_id:                      string;
  requisitioner_id:            string;
  requisitioner_name_snapshot: string;
  department_id:               string | null;
  department_name_snapshot:    string;
  purpose:                     string;
  date_required:               string;
  pr1_number_snapshot:         string;
  rfq_number_snapshot:         string;
  request_type:                'goods' | 'services';
  remarks:                     string | null;
  status:                      PR2Status;
  generated_by:                string | null;
  generated_at:                string;
  created_at:                  string;
  updated_at:                  string;
  /** Rev #9: resolved from pr1_requests.priority via ID-based join at read time. */
  pr1_priority?:               string;
}

export interface PR2Item {
  id:                      string;
  pr2_id:                  string;
  item_order:              number;
  item_code:               string;
  description:             string;
  unit_of_measure:         string;
  pr1_item_id:             string | null;
  quantity_requested:      number;
  qty_on_hand:             number;
  qty_incoming:            number;
  quantity_to_purchase:    number;
  selected_rfq_supplier_id: string | null;
  supplier_name_snapshot:  string;
  quoted_description:      string;
  is_alternative:          boolean;
  unit_price:              number;
  lead_time_days:          number;
  total_price:             number;
  /** Rev #1 (VAT): snapshotted at PR2 generation time; null when the winning quote's supplier is not VAT-registered. */
  vat_type?:               'vat_inclusive' | 'vat_exclusive' | null;
  /** Rev #1 (VAT): system VAT rate at the time this line was generated; null alongside a null vat_type. */
  vat_rate_applied?:       number | null;
  remarks:                 string | null;
  /**
   * Phase 1 (Raw Mats): snapshot of pr1_items.is_raw_material at PR2
   * creation. Procurement may override on this row only — PR1 stays
   * unchanged. DB column is NOT NULL DEFAULT false, so always present.
   */
  is_raw_material:         boolean;
  /**
   * Phase 1 (Raw Mats): free-form justification captured when procurement
   * awarded an unverified or manual-entry quote on a raw-mats line.
   * NULL when not required (verified product OR non-raw-mats line).
   */
  quote_justification:     string | null;
  /**
   * Read-only snapshot of pr1_items.remarks at PR2 generation time.
   * Distinct from this row's own `remarks` (procurement's selection notes) —
   * never edited on PR2; PR1 remains the source of truth.
   */
  pr1_remarks_snapshot?:   string | null;
  /**
   * Read-only snapshot of the original pr1_items.quantity_requested at PR2
   * generation time — differs from `quantity_requested` above only when
   * warehouse overrode the line during validation.
   */
  pr1_quantity_requested_snapshot?:      number | null;
  /** Read-only, forwarded from warehouse_validation_items.quantity_override_reason. */
  quantity_override_reason_snapshot?:    string | null;
  /** Read-only, forwarded from warehouse_validation_items.quantity_overridden_by_name_snapshot. */
  quantity_overridden_by_name_snapshot?: string | null;
  /** FK back to the winning rfq_item_quotes row. Null for manually-created PR2s. */
  rfq_item_quote_id?:      string | null;
  created_at:              string;
  /** PR1 item attachments (requisitioner). Loaded at read time via pr1_item_id. */
  attachments?:            PR1Attachment[];
  /** Supplier quote attachments. Loaded at read time via rfq_item_quote_id. */
  quote_attachments?:      RfqQuoteAttachment[];
}

export interface PR2WithItems extends PR2Request {
  items: PR2Item[];
}

// Draft used when generating or editing PR2 items
export interface PR2ItemDraft {
  pr1_item_id:             string | null;
  item_order:              number;
  item_code:               string;
  description:             string;
  unit_of_measure:         string;
  quantity_requested:      number;
  qty_on_hand:             number;
  qty_incoming:            number;
  quantity_to_purchase:    number;
  selected_rfq_supplier_id: string | null;
  supplier_name_snapshot:  string;
  quoted_description:      string;
  is_alternative:          boolean;
  unit_price:              number;
  lead_time_days:          number;
  total_price:             number;
  /** Rev #1 (VAT): carried through from the PR2 item row so edits can recompute total_price without losing the VAT snapshot. */
  vat_type?:               'vat_inclusive' | 'vat_exclusive' | null;
  vat_rate_applied?:       number | null;
  remarks:                 string;
  /**
   * Phase 1 (Raw Mats): optional in drafts — Phase 8 wires the snapshot
   * on PR2 generation, Phase 10 enables procurement override. Existing
   * draft builders that don't set this still compile; persistence falls
   * back to the DB default until those phases land.
   */
  is_raw_material?:        boolean;
  /**
   * Phase 1 (Raw Mats): optional, populated by Phase 8 from the upstream
   * `supplier_item_selections.quote_justification`.
   */
  quote_justification?:    string | null;
}
