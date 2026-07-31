export type DeliveryStatus =
  | 'pending'
  | 'scheduled'
  | 'in_transit'
  | 'delayed'
  | 'delivered'
  | 'cancelled';

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending:    'Pending',
  scheduled:  'Scheduled',
  in_transit: 'In Transit',
  delayed:    'Delayed',
  delivered:  'Delivered',
  cancelled:  'Cancelled',
};

export const DELIVERY_STATUS_ORDER: DeliveryStatus[] = [
  'pending',
  'scheduled',
  'in_transit',
  'delayed',
  'delivered',
];

export interface Delivery {
  id: string;
  po_id: string;
  po_number_snapshot: string;
  pr2_number_snapshot: string;
  pr1_number_snapshot: string;
  rfq_number_snapshot: string;
  supplier_id: string | null;
  supplier_name_snapshot: string;
  requisitioner_id: string | null;
  requisitioner_name_snapshot: string;
  department_name_snapshot: string;
  purpose: string;
  status: DeliveryStatus;
  commitment_date: string | null;
  scheduled_date: string | null;
  actual_delivery_date: string | null;
  delivery_address: string;
  warehouse: string;
  grand_total: number;
  /** Storage path within bucket `delivery-receipts`; set when marking In Transit with DR upload */
  dr_document_path: string | null;
  dr_document_filename: string | null;
  dr_document_uploaded_at: string | null;
  request_type: 'goods' | 'services' | 'raw_material';
  has_grn: boolean;
  forwarded_to_procurement?: boolean;
  forwarded_at?: string | null;
  created_at: string;
  updated_at: string;
  /** Rev #9: resolved from pr1_requests.priority via ID-based join at read time. */
  priority?: string;
}

export interface DeliveryHistoryEntry {
  id: string;
  delivery_id: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  status_from: DeliveryStatus | null;
  status_to: DeliveryStatus | null;
  note: string | null;
  scheduled_date: string | null;
  created_at: string;
}

/**
 * Line item for the delivery's PO — intentionally excludes unit_price/total_price.
 * Pricing is not shown anywhere on delivery tracking pages, so it's left out of
 * the query entirely rather than fetched and hidden in the UI.
 */
export interface DeliveryItem {
  id: string;
  item_order: number;
  item_code: string;
  description: string;
  unit_of_measure: string;
  quantity_to_purchase: number;
}

export interface DeliveryWithHistory extends Delivery {
  history: DeliveryHistoryEntry[];
  items: DeliveryItem[];
}

// Supplier update form
export interface DeliverySupplierUpdateValues {
  new_status: DeliveryStatus;
  scheduled_date: string;
  note: string;
  /** Required when new_status === 'in_transit'; set after uploadDeliveryReceipt succeeds */
  dr_document_path?: string | null;
  dr_document_filename?: string | null;
}

// Procurement follow-up note form
export interface DeliveryFollowUpValues {
  note: string;
}
