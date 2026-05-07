import type { StatusVariant } from '@/components/shared/StatusChip';

export type PR1Status =
  | 'draft'
  | 'pending_warehouse'
  | 'pending_approval'
  | 'resolved_internal'
  | 'revision_requested'
  | 'for_canvassing'
  | 'canvassing_complete'
  | 'approved'
  | 'rejected'
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
  created_at: string;
  validated_soh?: number | null;
  warehouse_decision?: string | null;
}

/** `warehouse_validations` header merged by `fetchPR1ById` when a row exists for this PR1. */
export interface PR1WarehouseValidationSummary {
  decision: 'sufficient' | 'insufficient' | null;
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
  created_at: string;
  updated_at: string;
  /** Derived employee-facing lifecycle (not stored in DB). */
  lifecycle_display_label?: string;
  lifecycle_display_chip?: StatusVariant;
}

export interface PR1WithItems extends PR1Request {
  items: PR1Item[];
  warehouse_validation?: PR1WarehouseValidationSummary | null;
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
}

export interface PR1FormValues {
  pr1_number: string;
  purpose: string;
  date_required: string;
  items: PR1ItemDraft[];
}

export const PR1_STATUS_LABELS: Record<PR1Status, string> = {
  draft:                'Draft',
  pending_warehouse:    'Pending Warehouse Validation',
  pending_approval:     'Pending Approval',
  resolved_internal:    'Resolved — Stock Sufficient',
  revision_requested:   'Revision Requested',
  for_canvassing:       'For Canvassing',
  canvassing_complete:  'Canvassing Complete',
  approved:             'Approved',
  rejected:             'Rejected',
  cancelled:            'Cancelled',
};

export const EMPTY_ITEM = (): PR1ItemDraft => ({
  item_order: 1,
  item_code: '',
  description: '',
  unit_of_measure: '',
  stock_on_hand: '',
  quantity_requested: '',
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
