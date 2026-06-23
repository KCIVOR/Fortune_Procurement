import type { StatusVariant } from '@/components/shared/StatusChip';
import type { WarehouseItemRoute, WarehouseDecision } from '@/types/warehouse';

export type PR1RequestType = 'goods' | 'services';

export type PR1Status =
  | 'draft'
  | 'pending_warehouse'
  | 'pending_approval'
  | 'approved_for_warehouse'
  | 'resolved_internal'
  | 'revision_requested'
  | 'for_canvassing'
  | 'canvassing_complete'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled';

export type DownstreamStage = 'PR1 Approval' | 'Processing (PR2)' | 'Canvassing' | 'PO Issued' | 'For Delivery' | 'Completed';

export interface PR1Item {
  id: string;
  pr1_id: string;
  item_order: number;
  item_code: string;
  description: string;
  unit_of_measure: string;
  stock_on_hand: number;
  quantity_requested: number;
  /**
   * Phase 1 (Raw Mats): true when this line is a raw material requiring
   * verification consideration during canvassing. Set by the requestor at
   * PR1 creation; locked once PR1 leaves draft. Procurement may override
   * the snapshot on the corresponding PR2 line later.
   * DB column is NOT NULL DEFAULT false, so this is always present.
   */
  is_raw_material: boolean;
  created_at: string;
  validated_soh?: number | null;
  warehouse_decision?: string | null;
  /** Populated after warehouse submit from `warehouse_validation_items`. */
  warehouse_item_route?: WarehouseItemRoute | null;
  warehouse_internal_fulfilled_qty?: number | null;
  warehouse_procurement_qty?: number | null;
  /** Populated by fetchPR1ById — attachments for this specific item. */
  attachments?: PR1Attachment[];
}

/** `warehouse_validations` header merged by `fetchPR1ById` when a row exists for this PR1. */
export interface PR1WarehouseValidationSummary {
  decision: WarehouseDecision | null;
  validator_name_snapshot: string | null;
  validator_position_snapshot: string | null;
  notes: string | null;
  validated_at: string | null;
}

export interface PR1Request {
  id: string;
  pr1_number: string;
  requisitioner_id: string;
  requisitioner_name_snapshot: string;
  department_id: string;
  department_name_snapshot: string;
  purpose: string;
  date_required: string;
  status: PR1Status;
  submitted_at: string | null;
  prepared_by_id: string | null;
  prepared_by_name_snapshot: string | null;
  prepared_by_position_snapshot: string | null;
  prepared_at: string | null;
  priority: 'normal' | 'medium' | 'high';
  request_type: PR1RequestType;
  created_at: string;
  updated_at: string;
  /** Derived employee-facing lifecycle (not stored in DB). */
  lifecycle_display_label?: string;
  lifecycle_display_chip?: StatusVariant;
}

/** A single image attachment linked to a PR1 item. */
export interface PR1Attachment {
  id: string;
  pr1_id: string;
  pr1_item_id: string;
  uploaded_by: string;
  storage_path: string;   // pr1/{pr1_id}/{pr1_item_id}/{ts}_{filename}
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  /** Signed URL generated client-side for display; not stored in DB. */
  signed_url?: string;
}

export interface PR1WithItems extends PR1Request {
  items: PR1Item[];
  warehouse_validation?: PR1WarehouseValidationSummary | null;
  attachments?: PR1Attachment[];
}

/** Batch lifecycle resolution for PR1 list / detail (Option C — display only). */
export interface PR1LifecycleSummary {
  lifecycle_display_label: string;
  lifecycle_display_chip: StatusVariant;
}

// Form state for create/edit
export interface PR1ItemDraft {
  id?: string;
  item_order: number;
  item_code: string;
  description: string;
  unit_of_measure: string;
  stock_on_hand: number | '';
  quantity_requested: number | '';
  /**
   * Phase 1 (Raw Mats): optional in the draft form because the UI checkbox
   * is wired in Phase 3. Existing form code that doesn't set this still
   * compiles; persistence relies on the DB default until Phase 3 lands.
   */
  is_raw_material?: boolean;
}

export interface PR1FormValues {
  pr1_number: string;
  purpose: string;
  date_required: string;
  request_type: PR1RequestType;
  items: PR1ItemDraft[];
}

export const PR1_STATUS_LABELS: Record<PR1Status, string> = {
  draft:                  'Draft',
  pending_warehouse:      'Pending Warehouse Validation',
  pending_approval:       'Pending Approval',
  approved_for_warehouse: 'Approved — Awaiting Warehouse',
  resolved_internal:      'Resolved — Stock Sufficient',
  revision_requested:     'Needs Revision',
  for_canvassing:         'For Canvassing',
  canvassing_complete:    'Canvassing Complete',
  approved:               'Approved',
  rejected:               'Rejected',
  completed:              'Completed',
  cancelled:              'Cancelled',
};

export const EMPTY_ITEM = (): PR1ItemDraft => ({
  item_order: 1,
  item_code: '',
  description: '',
  unit_of_measure: '',
  stock_on_hand: '',
  quantity_requested: '',
  // Phase 3 (Raw Mats): default unchecked per decision D5.
  is_raw_material: false,
});

export const PURPOSE_OPTIONS = [
  'Office Supplies',
  'IT Equipment',
  'Maintenance & Repair',
  'Project Materials',
  'Operations Support',
  'Other',
] as const;

export const UNIT_OPTIONS = [
  'pcs',
  'box',
  'set',
  'pack',
  'ream',
  'roll',
  'bottle',
  'liter',
  'kg',
  'meter',
  'pair',
  'unit',
  'Other',
] as const;
