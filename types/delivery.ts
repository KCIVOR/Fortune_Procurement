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
  created_at: string;
  updated_at: string;
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

export interface DeliveryWithHistory extends Delivery {
  history: DeliveryHistoryEntry[];
}

// Supplier update form
export interface DeliverySupplierUpdateValues {
  new_status: DeliveryStatus;
  scheduled_date: string;
  note: string;
}

// Procurement follow-up note form
export interface DeliveryFollowUpValues {
  note: string;
}
