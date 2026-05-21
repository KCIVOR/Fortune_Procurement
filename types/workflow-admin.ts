// ─── Workflow Admin Types ─────────────────────────────────────────────────────
// Type definitions for workflow configuration management

export interface WorkflowConfig {
  id: string;
  code: string;
  name: string;
  form_template_id: string | null;
  active: boolean;
  created_at: string;
  step_count?: number;
  instance_count?: number;
}

export interface WorkflowStepConfig {
  id: string;
  workflow_id: string;
  step_order: number;
  role_required: string;
  position_required: string | null;
  action_label: string;
  is_final: boolean;
  created_at: string;
}

export interface WorkflowDetail extends WorkflowConfig {
  steps: WorkflowStepConfig[];
}

export interface WorkflowStepFormData {
  step_order: number;
  role_required: string;
  position_required: string;
  action_label: string;
  is_final: boolean;
}

export interface WorkflowValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RoleOption {
  id: string;
  name: string;
}

export interface PositionOption {
  id: string;
  title: string;
  role_id: string;
  role_name: string;
}

export interface StepDependencyCheck {
  canDelete: boolean;
  reason?: string;
  activeInstanceCount?: number;
  actionCount?: number;
}

export interface WorkflowAuditPayload {
  workflow_code: string;
  step_order?: number;
  old_values?: Partial<WorkflowStepConfig>;
  new_values?: Partial<WorkflowStepConfig>;
  changed_fields?: string[];
  actor?: string;
  timestamp: string;
}
