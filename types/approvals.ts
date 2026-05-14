export type ApprovalAction = 'approved' | 'rejected' | 'revision_requested';

// ─── PR2 approval types ───────────────────────────────────────────────────────

export interface PR2ApprovalQueueRow {
  pr2_id:                      string;
  pr2_number:                  string;
  requisitioner_name_snapshot: string;
  department_name_snapshot:    string;
  purpose:                     string;
  date_required:               string;
  pr2_status:                  string;
  instance_id:                 string;
  workflow_code:               string;
  current_step:                number;
  instance_status:             ApprovalInstanceStatus;
  started_at:                  string;
  step_position_required:      string;
  step_role_required:          string;
  step_action_label:           string;
  step_is_final:               boolean;
  pr1_priority?:               'normal' | 'medium' | 'high';
}

export interface PR2ApprovalDetail {
  pr2_id:                      string;
  pr2_number:                  string;
  pr1_number_snapshot:         string;
  rfq_number_snapshot:         string;
  requisitioner_name_snapshot: string;
  department_name_snapshot:    string;
  purpose:                     string;
  date_required:               string;
  pr2_status:                  string;
  generated_at:                string;
  remarks:                     string | null;
  pr1_priority?:               'normal' | 'medium' | 'high';
  /** Intersection ensures `pr1_item_id` for canvass lookups even if tooling resolves an older PR2ApprovalItem shape */
  items: Array<PR2ApprovalItem & { pr1_item_id: string | null }>;
  // Phase 1 instance (always present once submitted)
  phase1_instance_id:     string;
  phase1_workflow_id:     string;
  phase1_current_step:    number;
  phase1_instance_status: ApprovalInstanceStatus;
  phase1_steps:           WorkflowStep[];
  phase1_actions:         ApprovalActionRecord[];
  // Phase 2 instance (null until phase 1 approved)
  phase2_instance_id:     string | null;
  phase2_workflow_id:     string | null;
  phase2_current_step:    number | null;
  phase2_instance_status: ApprovalInstanceStatus | null;
  phase2_steps:           WorkflowStep[];
  phase2_actions:         ApprovalActionRecord[];
  // Which phase/instance the user is currently looking at (active one)
  active_instance_id:     string | null;
  active_workflow_code:   string | null;
  active_current_step:    number | null;
  active_instance_status: ApprovalInstanceStatus | null;
  active_steps:           WorkflowStep[];
}

export interface PR2ApprovalItem {
  id:                      string;
  /** Links PR2 line to PR1 item for canvass / rfq_item_quotes lookups */
  pr1_item_id:             string | null;
  item_order:              number;
  item_code:               string;
  description:             string;
  unit_of_measure:         string;
  quantity_requested:      number;
  qty_on_hand:             number;
  qty_incoming:            number;
  quantity_to_purchase:    number;
  supplier_name_snapshot:  string;
  unit_price:              number;
  total_price:             number;
}

// Must match approval_instances_status_check constraint: active | approved | rejected | cancelled
export type ApprovalInstanceStatus = 'active' | 'approved' | 'rejected' | 'cancelled';

// A row in the approval queue — one pending PR1 with its current step info
export interface PR1ApprovalQueueRow {
  // pr1_requests fields
  pr1_id: string;
  pr1_number: string;
  requisitioner_name_snapshot: string;
  department_name_snapshot: string;
  purpose: string;
  priority: string;
  date_required: string;
  submitted_at: string | null;
  // approval_instances fields
  instance_id: string;
  workflow_code: string;
  current_step: number;
  instance_status: ApprovalInstanceStatus;
  started_at: string;
  // current step definition
  step_position_required: string;
  step_role_required: string;
  step_action_label: string;
  step_is_final: boolean;
}

/** Latest PR1 approval instance snapshot for read-only signatory display (e.g. /pr1/[id]). */
export interface PR1ApprovalSignatories {
  instance_id: string;
  instance_status: ApprovalInstanceStatus;
  current_step: number;
  workflow_steps: WorkflowStep[];
  actions: ApprovalActionRecord[];
}

// Full approval detail for the detail page
export interface PR1ApprovalDetail {
  // pr1 header
  pr1_id: string;
  pr1_number: string;
  requisitioner_name_snapshot: string;
  department_name_snapshot: string;
  purpose: string;
  date_required: string;
  submitted_at: string | null;
  pr1_status: string;
  priority: 'normal' | 'medium' | 'high';
  // items
  items: PR1ApprovalItem[];
  // approval instance
  instance_id: string;
  workflow_id: string;
  workflow_code: string;
  current_step: number;
  instance_status: ApprovalInstanceStatus;
  started_at: string;
  // all steps in the workflow
  workflow_steps: WorkflowStep[];
  // all actions recorded so far
  actions: ApprovalActionRecord[];
  // warehouse validation summary (read-only context)
  warehouse_decision: string | null;
  warehouse_validator_name: string | null;
  warehouse_validated_at: string | null;
  warehouse_notes: string | null;
}

export interface PR1ApprovalItem {
  id: string;
  item_order: number;
  item_code: string;
  description: string;
  unit_of_measure: string;
  stock_on_hand: number;
  quantity_requested: number;
  /** Per-line SOH from warehouse_validation_items after validation */
  validated_soh?: number | null;
}

export interface WorkflowStep {
  step_order: number;
  role_required: string;
  position_required: string;
  action_label: string;
  is_final: boolean;
}

export interface ApprovalActionRecord {
  id: string;
  instance_id: string;
  step_order: number;
  action: ApprovalAction;
  actor_id: string;
  actor_name_snapshot: string;
  actor_position_snapshot: string;
  actor_department_snapshot: string;
  remarks: string | null;
  acted_at: string;
}

// ─── Approver signing history (/approvals/history) ─────────────────────────────

export type ApprovalHistoryDocumentFilter = 'all' | 'PR1' | 'PR2' | 'PO';

/** Action filter for `/approvals/history` (excluding `'all'` means no filter). */
export type ApprovalHistoryActionFilter = 'all' | ApprovalAction;

/** Options for `fetchMyApprovalHistoryPaged`. */
export interface FetchMyApprovalHistoryPagedOptions {
  actorId: string;
  documentType: ApprovalHistoryDocumentFilter;
  limit: number;
  offset: number;
  action?: ApprovalHistoryActionFilter;
  actedAtFrom?: string | null;
  actedAtTo?: string | null;
  search?: string | null;
}

export interface ApprovalHistoryRow {
  approval_action_id: string;
  instance_id: string;
  document_type: 'PR1' | 'PR2' | 'PO';
  document_id: string;
  document_number: string;
  action: ApprovalAction;
  step_order: number;
  remarks: string | null;
  acted_at: string;
  instance_status: ApprovalInstanceStatus;
  action_url: string;
}
