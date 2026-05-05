export type PR2Status =
  | 'draft'
  | 'pending_phase1_approval'
  | 'phase1_approved'
  | 'pending_phase2_approval'
  | 'phase2_approved'
  | 'cancelled';

export const PR2_STATUS_LABELS: Record<PR2Status, string> = {
  draft:                    'Draft',
  pending_phase1_approval:  'Pending Phase 1',
  phase1_approved:          'Phase 1 Approved',
  pending_phase2_approval:  'Pending Phase 2',
  phase2_approved:          'Approved',
  cancelled:                'Cancelled',
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
  remarks:                     string | null;
  status:                      PR2Status;
  generated_by:                string | null;
  generated_at:                string;
  created_at:                  string;
  updated_at:                  string;
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
  remarks:                 string | null;
  created_at:              string;
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
  remarks:                 string;
}
