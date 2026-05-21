// ─── Workflow Admin Data Access Layer ─────────────────────────────────────────
// Functions for managing approval workflow configuration

import { supabase } from './supabase';
import type {
  WorkflowConfig,
  WorkflowDetail,
  WorkflowStepConfig,
  WorkflowStepFormData,
  WorkflowValidationResult,
  RoleOption,
  PositionOption,
  StepDependencyCheck,
} from '@/types/workflow-admin';

const db = supabase as any;

// ─── Read Operations ──────────────────────────────────────────────────────────

/**
 * List all workflows with step counts and active instance counts
 */
export async function listWorkflows(): Promise<WorkflowConfig[]> {
  const { data: workflows, error: wfError } = await db
    .from('approval_workflows')
    .select('id, code, name, form_template_id, active, created_at')
    .order('code', { ascending: true });

  if (wfError) {
    console.error('Error fetching workflows:', wfError);
    throw wfError;
  }

  if (!workflows || workflows.length === 0) return [];

  // Get step counts for each workflow
  const workflowIds = workflows.map((w: any) => w.id);
  
  const { data: steps, error: stepsError } = await db
    .from('approval_steps')
    .select('workflow_id')
    .in('workflow_id', workflowIds);

  if (stepsError) {
    console.error('Error fetching step counts:', stepsError);
  }

  // Get active instance counts
  const { data: instances, error: instancesError } = await db
    .from('approval_instances')
    .select('workflow_id')
    .in('workflow_id', workflowIds)
    .eq('status', 'active');

  if (instancesError) {
    console.error('Error fetching instance counts:', instancesError);
  }

  // Count steps and instances per workflow
  const stepCounts: Record<string, number> = {};
  const instanceCounts: Record<string, number> = {};

  (steps || []).forEach((s: any) => {
    stepCounts[s.workflow_id] = (stepCounts[s.workflow_id] || 0) + 1;
  });

  (instances || []).forEach((i: any) => {
    instanceCounts[i.workflow_id] = (instanceCounts[i.workflow_id] || 0) + 1;
  });

  return workflows.map((w: any) => ({
    ...w,
    step_count: stepCounts[w.id] || 0,
    instance_count: instanceCounts[w.id] || 0,
  }));
}

/**
 * Get a workflow with all its steps
 */
export async function getWorkflowWithSteps(
  workflowId: string
): Promise<WorkflowDetail | null> {
  const { data: workflow, error: wfError } = await db
    .from('approval_workflows')
    .select('id, code, name, form_template_id, active, created_at')
    .eq('id', workflowId)
    .maybeSingle();

  if (wfError) {
    console.error('Error fetching workflow:', wfError);
    throw wfError;
  }

  if (!workflow) return null;

  const { data: steps, error: stepsError } = await db
    .from('approval_steps')
    .select('id, workflow_id, step_order, role_required, position_required, action_label, is_final, created_at')
    .eq('workflow_id', workflowId)
    .order('step_order', { ascending: true });

  if (stepsError) {
    console.error('Error fetching workflow steps:', stepsError);
    throw stepsError;
  }

  return {
    ...workflow,
    steps: steps || [],
  };
}

/**
 * List all roles for dropdown selection
 */
export async function listRolesForDropdown(): Promise<RoleOption[]> {
  const { data, error } = await db
    .from('roles')
    .select('id, name')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching roles:', error);
    throw error;
  }

  return data || [];
}

/**
 * List all positions for dropdown selection (with role information)
 */
export async function listPositionsForDropdown(): Promise<PositionOption[]> {
  const { data, error } = await db
    .from('positions')
    .select('id, title, role_id, active, roles(name)')
    .eq('active', true)
    .order('title', { ascending: true });

  if (error) {
    console.error('Error fetching positions:', error);
    throw error;
  }

  return (data || []).map((pos: any) => ({
    id: pos.id,
    title: pos.title,
    role_id: pos.role_id,
    role_name: pos.roles?.name || '',
  }));
}

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate workflow steps configuration
 * @param steps - The workflow steps to validate
 * @param workflowCode - Optional workflow code for workflow-specific validation rules
 */
export function validateWorkflowSteps(
  steps: WorkflowStepConfig[],
  workflowCode?: string
): WorkflowValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Rule 1: At least one step must exist
  if (steps.length === 0) {
    errors.push('Workflow must have at least one step');
    return { valid: false, errors, warnings };
  }

  // Rule 2: At least one step must be marked as final
  // PO_APPROVAL workflow allows multiple final steps (Finance Director + Supplier)
  const finalSteps = steps.filter((s) => s.is_final);
  if (finalSteps.length === 0) {
    errors.push('Workflow must have at least one final step');
  } else if (finalSteps.length > 1 && workflowCode !== 'PO_APPROVAL') {
    // Only enforce single final step for non-PO workflows
    errors.push('Workflow can only have one final step');
  }

  // Rule 3: Step orders must be sequential (1, 2, 3...)
  const orders = steps.map((s) => s.step_order).sort((a, b) => a - b);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) {
      errors.push('Step orders must be sequential starting from 1 (1, 2, 3...)');
      break;
    }
  }

  // Rule 4: No duplicate step orders
  const uniqueOrders = new Set(orders);
  if (uniqueOrders.size !== orders.length) {
    errors.push('Duplicate step orders found');
  }

  // Rule 5: All steps must have required fields
  steps.forEach((step, index) => {
    if (!step.role_required) {
      errors.push(`Step ${index + 1}: Role is required`);
    }
    if (!step.position_required) {
      errors.push(`Step ${index + 1}: Position is required`);
    }
    if (!step.action_label || !step.action_label.trim()) {
      errors.push(`Step ${index + 1}: Action label is required`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Check if a step can be safely deleted
 */
export async function checkStepDependencies(
  stepId: string
): Promise<StepDependencyCheck> {
  // Get the step details
  const { data: step, error: stepError } = await db
    .from('approval_steps')
    .select('workflow_id, step_order')
    .eq('id', stepId)
    .maybeSingle();

  if (stepError || !step) {
    return {
      canDelete: false,
      reason: 'Step not found',
    };
  }

  // Check for active approval instances using this workflow
  const { data: activeInstances, error: instanceError } = await db
    .from('approval_instances')
    .select('id')
    .eq('workflow_id', step.workflow_id)
    .eq('status', 'active');

  if (instanceError) {
    console.error('Error checking active instances:', instanceError);
  }

  const activeCount = (activeInstances || []).length;

  // Check for recorded approval actions at this step
  const { data: actions, error: actionsError } = await db
    .from('approval_actions')
    .select('id, instance_id')
    .eq('step_order', step.step_order);

  if (actionsError) {
    console.error('Error checking approval actions:', actionsError);
  }

  const actionCount = (actions || []).length;

  // Determine if deletion is safe
  if (activeCount > 0) {
    return {
      canDelete: false,
      reason: `Cannot delete: ${activeCount} active approval instance(s) are using this workflow`,
      activeInstanceCount: activeCount,
      actionCount,
    };
  }

  if (actionCount > 0) {
    return {
      canDelete: true,
      reason: `Warning: ${actionCount} historical approval action(s) reference this step order`,
      activeInstanceCount: 0,
      actionCount,
    };
  }

  return {
    canDelete: true,
    activeInstanceCount: 0,
    actionCount: 0,
  };
}

// ─── Write Operations ─────────────────────────────────────────────────────────

/**
 * Create a new workflow step
 */
export async function createWorkflowStep(
  workflowId: string,
  stepData: WorkflowStepFormData,
  actorId: string
): Promise<{ success: boolean; error?: string; data?: WorkflowStepConfig }> {
  // 1. Validate position exists and matches role
  const { data: position, error: posError } = await db
    .from('positions')
    .select('id, title, role_id, roles(name)')
    .eq('title', stepData.position_required)
    .eq('active', true)
    .maybeSingle();

  if (posError) {
    console.error('Error validating position:', posError);
    return { success: false, error: 'Failed to validate position' };
  }

  if (!position) {
    return { success: false, error: 'Position not found or inactive' };
  }

  // 2. Validate role matches position's role
  // Note: approver and procurement roles are interchangeable
  const positionRole = position.roles?.name;
  const rolesMatch = positionRole === stepData.role_required ||
    ((positionRole === 'approver' || positionRole === 'procurement') &&
     (stepData.role_required === 'approver' || stepData.role_required === 'procurement'));
  
  if (!rolesMatch) {
    return {
      success: false,
      error: `Position "${stepData.position_required}" belongs to role "${positionRole}", not "${stepData.role_required}"`,
    };
  }

  // 3. Check for duplicate step order
  const { data: existing, error: existError } = await db
    .from('approval_steps')
    .select('id')
    .eq('workflow_id', workflowId)
    .eq('step_order', stepData.step_order)
    .maybeSingle();

  if (existError) {
    console.error('Error checking duplicate step order:', existError);
    return { success: false, error: 'Failed to validate step order' };
  }

  if (existing) {
    return { success: false, error: `Step order ${stepData.step_order} already exists` };
  }

  // 4. If marking as final, unmark other final steps
  if (stepData.is_final) {
    const { error: unfinalError } = await db
      .from('approval_steps')
      .update({ is_final: false })
      .eq('workflow_id', workflowId)
      .eq('is_final', true);

    if (unfinalError) {
      console.error('Error unmarking final steps:', unfinalError);
      return { success: false, error: 'Failed to update final step status' };
    }
  }

  // 5. Insert new step
  const { data: newStep, error: insertError } = await db
    .from('approval_steps')
    .insert([
      {
        workflow_id: workflowId,
        step_order: stepData.step_order,
        role_required: stepData.role_required,
        position_required: stepData.position_required,
        action_label: stepData.action_label.trim(),
        is_final: stepData.is_final,
      },
    ])
    .select('id, workflow_id, step_order, role_required, position_required, action_label, is_final, created_at')
    .single();

  if (insertError) {
    console.error('Error creating workflow step:', insertError);
    return { success: false, error: insertError.message };
  }

  // 6. Log audit
  const { data: workflow } = await db
    .from('approval_workflows')
    .select('code')
    .eq('id', workflowId)
    .maybeSingle();

  await logWorkflowAudit(
    'WORKFLOW_STEP_CREATED',
    workflowId,
    actorId,
    {
      workflow_code: workflow?.code || '',
      step_order: stepData.step_order,
      new_values: stepData,
      timestamp: new Date().toISOString(),
    }
  );

  return { success: true, data: newStep };
}

/**
 * Update an existing workflow step
 */
export async function updateWorkflowStep(
  stepId: string,
  updates: Partial<WorkflowStepFormData>,
  actorId: string
): Promise<{ success: boolean; error?: string; data?: WorkflowStepConfig }> {
  // 1. Get current step data
  const { data: currentStep, error: fetchError } = await db
    .from('approval_steps')
    .select('id, workflow_id, step_order, role_required, position_required, action_label, is_final, created_at')
    .eq('id', stepId)
    .maybeSingle();

  if (fetchError || !currentStep) {
    return { success: false, error: 'Step not found' };
  }

  // 2. If position is being updated, validate it
  if (updates.position_required && updates.position_required !== currentStep.position_required) {
    const roleToCheck = updates.role_required || currentStep.role_required;
    
    const { data: position, error: posError } = await db
      .from('positions')
      .select('id, title, role_id, roles(name)')
      .eq('title', updates.position_required)
      .eq('active', true)
      .maybeSingle();

    if (posError || !position) {
      return { success: false, error: 'Position not found or inactive' };
    }

    const positionRole = position.roles?.name;
    const rolesMatch = positionRole === roleToCheck ||
      ((positionRole === 'approver' || positionRole === 'procurement') &&
       (roleToCheck === 'approver' || roleToCheck === 'procurement'));
    
    if (!rolesMatch) {
      return {
        success: false,
        error: `Position "${updates.position_required}" belongs to role "${positionRole}", not "${roleToCheck}"`,
      };
    }
  }

  // 3. If step order is being updated, check for duplicates
  if (updates.step_order && updates.step_order !== currentStep.step_order) {
    const { data: existing, error: existError } = await db
      .from('approval_steps')
      .select('id')
      .eq('workflow_id', currentStep.workflow_id)
      .eq('step_order', updates.step_order)
      .neq('id', stepId)
      .maybeSingle();

    if (existError) {
      return { success: false, error: 'Failed to validate step order' };
    }

    if (existing) {
      return { success: false, error: `Step order ${updates.step_order} already exists` };
    }
  }

  // 4. If marking as final, unmark other final steps
  if (updates.is_final === true && !currentStep.is_final) {
    const { error: unfinalError } = await db
      .from('approval_steps')
      .update({ is_final: false })
      .eq('workflow_id', currentStep.workflow_id)
      .eq('is_final', true)
      .neq('id', stepId);

    if (unfinalError) {
      return { success: false, error: 'Failed to update final step status' };
    }
  }

  // 5. Apply updates
  const updateData: any = {};
  if (updates.step_order !== undefined) updateData.step_order = updates.step_order;
  if (updates.role_required !== undefined) updateData.role_required = updates.role_required;
  if (updates.position_required !== undefined) updateData.position_required = updates.position_required;
  if (updates.action_label !== undefined) updateData.action_label = updates.action_label.trim();
  if (updates.is_final !== undefined) updateData.is_final = updates.is_final;

  const { data: updatedStep, error: updateError } = await db
    .from('approval_steps')
    .update(updateData)
    .eq('id', stepId)
    .select('id, workflow_id, step_order, role_required, position_required, action_label, is_final, created_at')
    .single();

  if (updateError) {
    console.error('Error updating workflow step:', updateError);
    return { success: false, error: updateError.message };
  }

  // 6. Log audit
  const { data: workflow } = await db
    .from('approval_workflows')
    .select('code')
    .eq('id', currentStep.workflow_id)
    .maybeSingle();

  const changedFields = Object.keys(updates);
  await logWorkflowAudit(
    'WORKFLOW_STEP_UPDATED',
    currentStep.workflow_id,
    actorId,
    {
      workflow_code: workflow?.code || '',
      step_order: currentStep.step_order,
      old_values: currentStep,
      new_values: updates,
      changed_fields: changedFields,
      timestamp: new Date().toISOString(),
    }
  );

  return { success: true, data: updatedStep };
}

/**
 * Delete a workflow step
 */
export async function deleteWorkflowStep(
  stepId: string,
  actorId: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Check dependencies
  const depCheck = await checkStepDependencies(stepId);
  if (!depCheck.canDelete) {
    return { success: false, error: depCheck.reason };
  }

  // 2. Get step data for audit
  const { data: step, error: fetchError } = await db
    .from('approval_steps')
    .select('id, workflow_id, step_order, role_required, position_required, action_label, is_final')
    .eq('id', stepId)
    .maybeSingle();

  if (fetchError || !step) {
    return { success: false, error: 'Step not found' };
  }

  // 3. Delete the step
  const { error: deleteError } = await db
    .from('approval_steps')
    .delete()
    .eq('id', stepId);

  if (deleteError) {
    console.error('Error deleting workflow step:', deleteError);
    return { success: false, error: deleteError.message };
  }

  // 4. Log audit
  const { data: workflow } = await db
    .from('approval_workflows')
    .select('code')
    .eq('id', step.workflow_id)
    .maybeSingle();

  await logWorkflowAudit(
    'WORKFLOW_STEP_DELETED',
    step.workflow_id,
    actorId,
    {
      workflow_code: workflow?.code || '',
      step_order: step.step_order,
      old_values: step,
      timestamp: new Date().toISOString(),
    }
  );

  return { success: true };
}

/**
 * Reorder workflow steps
 */
export async function reorderWorkflowSteps(
  workflowId: string,
  newOrder: Array<{ id: string; step_order: number }>,
  actorId: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Get current steps
  const { data: currentSteps, error: fetchError } = await db
    .from('approval_steps')
    .select('id, step_order')
    .eq('workflow_id', workflowId);

  if (fetchError) {
    return { success: false, error: 'Failed to fetch current steps' };
  }

  // 2. Validate new order
  const orders = newOrder.map((o) => o.step_order).sort((a, b) => a - b);
  for (let i = 0; i < orders.length; i++) {
    if (orders[i] !== i + 1) {
      return { success: false, error: 'Step orders must be sequential (1, 2, 3...)' };
    }
  }

  // 3. Update each step in a transaction-like manner
  // Note: Supabase doesn't support transactions in the client library,
  // so we'll update sequentially and hope for the best
  for (const item of newOrder) {
    const { error: updateError } = await db
      .from('approval_steps')
      .update({ step_order: item.step_order })
      .eq('id', item.id);

    if (updateError) {
      console.error('Error reordering step:', updateError);
      return { success: false, error: 'Failed to reorder steps' };
    }
  }

  // 4. Log audit
  const { data: workflow } = await db
    .from('approval_workflows')
    .select('code')
    .eq('id', workflowId)
    .maybeSingle();

  await logWorkflowAudit(
    'WORKFLOW_STEPS_REORDERED',
    workflowId,
    actorId,
    {
      workflow_code: workflow?.code || '',
      old_order: currentSteps,
      new_order: newOrder,
      timestamp: new Date().toISOString(),
    }
  );

  return { success: true };
}

// ─── Audit ────────────────────────────────────────────────────────────────────

/**
 * Log workflow configuration changes to audit log
 */
export async function logWorkflowAudit(
  action: 'WORKFLOW_STEP_CREATED' | 'WORKFLOW_STEP_UPDATED' | 'WORKFLOW_STEP_DELETED' | 'WORKFLOW_STEPS_REORDERED',
  workflowId: string,
  actorId: string,
  payload: any
): Promise<void> {
  const { error } = await db
    .from('audit_logs')
    .insert([
      {
        action,
        document_type: 'WORKFLOW',
        document_id: workflowId,
        actor_id: actorId,
        payload,
      },
    ]);

  if (error) {
    console.error('Error logging workflow audit:', error);
  }
}

// ─── Special Workflow Warnings ────────────────────────────────────────────────

/**
 * Check if a workflow has special business logic that requires warnings
 */
export function getWorkflowWarnings(workflowCode: string, stepOrder: number): string[] {
  const warnings: string[] = [];

  // PR2_PHASE1 auto-approval logic
  if (workflowCode === 'PR2_PHASE1' && (stepOrder === 1 || stepOrder === 2)) {
    warnings.push(
      '⚠️ This step has special auto-approval logic. If Step 1 approves and there are no alternatives, Step 2 is automatically approved. Changing the position may affect this automated workflow.'
    );
  }

  // PO_APPROVAL delivery creation logic
  if (workflowCode === 'PO_APPROVAL' && stepOrder === 4) {
    warnings.push(
      '⚠️ This step triggers delivery tracking creation. Ensure the position remains a supplier role to maintain proper delivery workflow functionality.'
    );
  }

  return warnings;
}
