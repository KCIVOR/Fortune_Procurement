export type WarehouseDecision =
  | 'sufficient'
  | 'insufficient'
  | 'rejected'
  | 'revision_requested';

/** Terminal warehouse actions that do not require SOH verification. */
export type WarehouseTerminalAction = 'rejected' | 'revision_requested';
export type ItemAvailability = 'available' | 'unavailable';
/** Set on submit from verified SOH vs requested qty. Partial stock uses `partial`, not `availability`. */
export type WarehouseItemRoute = 'internal' | 'procurement' | 'partial';

export interface WarehouseValidation {
  id: string;
  pr1_id: string;
  validator_id: string | null;
  validator_name_snapshot: string;
  validator_position_snapshot: string;
  decision: WarehouseDecision | null;
  notes: string;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WarehouseValidationItem {
  id: string;
  validation_id: string;
  pr1_item_id: string;
  item_order: number;
  item_code: string;
  description: string;
  unit_of_measure: string;
  requestor_soh: number;
  validated_soh: number | null;
  quantity_requested: number;
  availability: ItemAvailability | null;
  item_route: WarehouseItemRoute | null;
  internal_fulfilled_qty: number;
  procurement_qty: number;
  item_notes: string;
  created_at: string;
  /** Set when warehouse changes quantity_requested away from the PR1 original. */
  quantity_override_reason: string | null;
  quantity_overridden_by: string | null;
  quantity_overridden_by_name_snapshot: string | null;
  quantity_overridden_at: string | null;
}

export interface WarehouseValidationWithItems extends WarehouseValidation {
  items: WarehouseValidationItem[];
}

// Form state per item during validation
export interface ValidationItemDraft {
  id: string;           // warehouse_validation_items.id
  pr1_item_id: string;
  item_order: number;
  item_code: string;
  description: string;
  unit_of_measure: string;
  requestor_soh: number;
  quantity_requested: number;
  validated_soh: number | '';
  item_notes: string;
  /** Reason for changing quantity_requested away from the PR1 original; required when overridden. */
  quantity_override_reason: string;
}

export interface ValidationFormValues {
  items: ValidationItemDraft[];
  notes: string;
}

/** Completed validation rows for `/warehouse/history` (PR1 columns from `pr1_requests`). */
export interface WarehouseValidationHistoryRow {
  validation_id: string;
  pr1_id: string;
  pr1_number: string;
  purpose: string;
  department: string;
  pr1_status: string;
  decision: WarehouseDecision;
  notes: string;
  validated_at: string;
  action_url: string;
  request_type: 'goods' | 'services';
}

export type WarehouseHistoryDecisionFilter = 'all' | WarehouseDecision;

/** Options for `fetchMyWarehouseValidationHistoryPaged`. */
export interface FetchMyWarehouseValidationHistoryPagedOptions {
  validatorId: string;
  limit: number;
  offset: number;
  search?: string | null;
  decision?: WarehouseHistoryDecisionFilter;
  /** PR1 request `status` enum value, or `'all'` / omitted for no filter. */
  pr1Status?: string | null;
  validatedFrom?: string | null;
  validatedTo?: string | null;
}

// PR1 summary shown on the warehouse queue
export interface PR1QueueRow {
  id: string;
  pr1_number: string;
  requisitioner_name_snapshot: string;
  department_name_snapshot: string;
  purpose: string;
  priority: string | null;
  date_required: string;
  submitted_at: string | null;
  status: string;
  request_type: 'goods' | 'services';
  // joined from warehouse_validations if it exists
  validation_id: string | null;
  validation_decision: WarehouseDecision | null;
}
