export type WarehouseDecision = 'sufficient' | 'insufficient';
export type ItemAvailability = 'available' | 'unavailable';

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
  item_notes: string;
  created_at: string;
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
  availability: ItemAvailability | null;
  item_notes: string;
}

export interface ValidationFormValues {
  items: ValidationItemDraft[];
  notes: string;
  decision: WarehouseDecision | null;
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
  // joined from warehouse_validations if it exists
  validation_id: string | null;
  validation_decision: WarehouseDecision | null;
}
