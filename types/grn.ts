export type GRNStatus = 'open' | 'closed';

export const GRN_STATUS_LABELS: Record<GRNStatus, string> = {
  open:   'Open',
  closed: 'Closed',
};

export interface GRNReceipt {
  id: string;
  grn_number: string;
  delivery_id: string;

  // Snapshots
  po_number_snapshot: string;
  pr2_number_snapshot: string;
  pr1_number_snapshot: string;
  supplier_name_snapshot: string;
  department_name_snapshot: string;
  purpose: string;
  warehouse: string;
  delivery_address: string;

  // Physical document fields
  invoice_no: string;
  dr_no: string;
  dr_date: string | null;
  transaction_date: string;

  // Warehouse staff
  received_by_id: string | null;
  received_by_name_snapshot: string;
  received_by_position_snapshot: string;

  status: GRNStatus;
  remarks: string;

  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface GRNItem {
  id: string;
  grn_id: string;
  po_item_id: string | null;

  item_order: number;
  item_code: string;
  description: string;
  unit_of_measure: string;

  quantity_ordered: number;
  quantity_received: number;
  quantity_rejected: number;
  unit_price: number;
  remarks: string;

  created_at: string;
  updated_at: string;
}

export interface GRNWithItems extends GRNReceipt {
  items: GRNItem[];
}

// For the GRN queue list
export interface GRNQueueRow {
  id: string;
  grn_number: string;
  delivery_id: string;
  po_number_snapshot: string;
  supplier_name_snapshot: string;
  department_name_snapshot: string;
  warehouse: string;
  transaction_date: string;
  status: GRNStatus;
  closed_at: string | null;
  received_by_name_snapshot: string;
}

// Editable form state per item
export interface GRNItemDraft {
  id: string;
  po_item_id: string | null;
  item_order: number;
  item_code: string;
  description: string;
  unit_of_measure: string;
  quantity_ordered: number;
  quantity_received: number | '';
  quantity_rejected: number | '';
  unit_price: number;
  remarks: string;
}

export interface GRNFormValues {
  invoice_no: string;
  dr_no: string;
  dr_date: string;
  transaction_date: string;
  remarks: string;
  items: GRNItemDraft[];
}
