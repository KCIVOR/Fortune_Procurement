'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import PageHeader from '@/components/shared/PageHeader';
import WorkflowTable from '@/components/admin/WorkflowTable';
import WorkflowStepEditor from '@/components/admin/WorkflowStepEditor';
import WorkflowStepForm from '@/components/admin/WorkflowStepForm';
import WorkflowStepDeleteDialog from '@/components/admin/WorkflowStepDeleteDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import {
  listWorkflows,
  getWorkflowWithSteps,
  listRolesForDropdown,
  listPositionsForDropdown,
  createWorkflowStep,
  updateWorkflowStep,
  deleteWorkflowStep,
  checkStepDependencies,
  validateWorkflowSteps,
} from '@/lib/workflow-admin';
import type {
  WorkflowConfig,
  WorkflowDetail,
  WorkflowStepConfig,
  WorkflowStepFormData,
  RoleOption,
  PositionOption,
  StepDependencyCheck,
} from '@/types/workflow-admin';

export default function WorkflowsPage() {
  const { profile, loading: authLoading } = useAuth();

  // Data state
  const [workflows, setWorkflows] = useState<WorkflowConfig[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDetail | null>(null);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);

  // Loading states
  const [isLoadingWorkflows, setIsLoadingWorkflows] = useState(true);
  const [isLoadingSteps, setIsLoadingSteps] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [isStepFormOpen, setIsStepFormOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [stepFormMode, setStepFormMode] = useState<'create' | 'edit'>('create');
  const [editingStep, setEditingStep] = useState<WorkflowStepConfig | null>(null);
  const [deletingStep, setDeletingStep] = useState<WorkflowStepConfig | null>(null);
  const [dependencyCheck, setDependencyCheck] = useState<StepDependencyCheck | null>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Load workflows and reference data on mount
  useEffect(() => {
    if (authLoading) return;

    if (!profile) {
      setError('Not authenticated');
      setIsLoadingWorkflows(false);
      return;
    }

    if (profile.role !== 'admin') {
      setError('Access denied. Admin role required.');
      setIsLoadingWorkflows(false);
      return;
    }

    loadInitialData();
  }, [authLoading, profile]);

  async function loadInitialData() {
    try {
      setIsLoadingWorkflows(true);
      setError(null);

      const [workflowsData, rolesData, positionsData] = await Promise.all([
        listWorkflows(),
        listRolesForDropdown(),
        listPositionsForDropdown(),
      ]);

      setWorkflows(workflowsData);
      setRoles(rolesData);
      setPositions(positionsData);
    } catch (err) {
      console.error('Error loading initial data:', err);
      setError('Failed to load workflows');
    } finally {
      setIsLoadingWorkflows(false);
    }
  }

  async function handleSelectWorkflow(workflow: WorkflowConfig) {
    try {
      setIsLoadingSteps(true);
      setError(null);

      const workflowDetail = await getWorkflowWithSteps(workflow.id);
      setSelectedWorkflow(workflowDetail);
    } catch (err) {
      console.error('Error loading workflow steps:', err);
      setError('Failed to load workflow steps');
    } finally {
      setIsLoadingSteps(false);
    }
  }

  async function reloadCurrentWorkflow() {
    if (!selectedWorkflow) return;

    try {
      setIsLoadingSteps(true);
      const workflowDetail = await getWorkflowWithSteps(selectedWorkflow.id);
      setSelectedWorkflow(workflowDetail);

      // Also reload workflows list to update step counts
      const workflowsData = await listWorkflows();
      setWorkflows(workflowsData);
    } catch (err) {
      console.error('Error reloading workflow:', err);
      setError('Failed to reload workflow');
    } finally {
      setIsLoadingSteps(false);
    }
  }

  // ─── Step CRUD Handlers ───────────────────────────────────────────────────

  function handleAddStep() {
    setStepFormMode('create');
    setEditingStep(null);
    setIsStepFormOpen(true);
  }

  function handleEditStep(step: WorkflowStepConfig) {
    setStepFormMode('edit');
    setEditingStep(step);
    setIsStepFormOpen(true);
  }

  async function handleDeleteStep(step: WorkflowStepConfig) {
    try {
      setIsActionLoading(true);
      const depCheck = await checkStepDependencies(step.id);
      setDependencyCheck(depCheck);
      setDeletingStep(step);
      setIsDeleteDialogOpen(true);
    } catch (err) {
      console.error('Error checking step dependencies:', err);
      setError('Failed to check step dependencies');
    } finally {
      setIsActionLoading(false);
    }
  }

  async function handleCreateStep(data: WorkflowStepFormData) {
    if (!selectedWorkflow || !profile?.id) {
      throw new Error('Missing required data');
    }

    setError(null);

    // Validate before creating
    const validation = validateWorkflowSteps(
      [
        ...selectedWorkflow.steps,
        {
          id: 'temp',
          workflow_id: selectedWorkflow.id,
          created_at: new Date().toISOString(),
          ...data,
        },
      ],
      selectedWorkflow.code
    );

    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const result = await createWorkflowStep(selectedWorkflow.id, data, profile.id);

    if (!result.success) {
      throw new Error(result.error || 'Failed to create step');
    }

    setIsStepFormOpen(false);
    setEditingStep(null);
    await reloadCurrentWorkflow();
  }

  async function handleUpdateStep(data: WorkflowStepFormData) {
    if (!editingStep || !selectedWorkflow || !profile?.id) {
      throw new Error('Missing required data');
    }

    setError(null);

    // Validate before updating
    const updatedSteps = selectedWorkflow.steps.map((s) =>
      s.id === editingStep.id ? { ...s, ...data } : s
    );

    const validation = validateWorkflowSteps(updatedSteps, selectedWorkflow.code);

    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    const result = await updateWorkflowStep(editingStep.id, data, profile.id);

    if (!result.success) {
      throw new Error(result.error || 'Failed to update step');
    }

    setIsStepFormOpen(false);
    setEditingStep(null);
    await reloadCurrentWorkflow();
  }

  async function handleConfirmDelete(step: WorkflowStepConfig) {
    if (!profile?.id) return;

    try {
      setIsActionLoading(true);
      setError(null);

      const result = await deleteWorkflowStep(step.id, profile.id);

      if (!result.success) {
        setError(result.error || 'Failed to delete step');
        return;
      }

      setIsDeleteDialogOpen(false);
      setDeletingStep(null);
      setDependencyCheck(null);
      await reloadCurrentWorkflow();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete step';
      setError(message);
    } finally {
      setIsActionLoading(false);
    }
  }

  function handleCancelStepForm() {
    setIsStepFormOpen(false);
    setEditingStep(null);
    setError(null);
  }

  function handleCancelDelete() {
    setIsDeleteDialogOpen(false);
    setDeletingStep(null);
    setDependencyCheck(null);
    setError(null);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <AppShell title="Workflow Configuration">
        <LoadingState message="Loading..." />
      </AppShell>
    );
  }

  if (error === 'Access denied. Admin role required.') {
    return (
      <AppShell title="Workflow Configuration">
        <div className="space-y-6">
          <PageHeader
            title="Approval Workflows"
            description="Configure approval pipeline steps and authorities"
          />
          <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Access Denied</h3>
            <p className="text-sm text-pq-danger-600">
              You do not have permission to configure workflows. Only administrators can access this feature.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Workflow Configuration">
      <div className="space-y-6">
        <PageHeader
          title="Approval Workflows"
          description="Configure approval pipeline steps and authorities"
        />

        {/* Error banner */}
        {error && error !== 'Access denied. Admin role required.' && (
          <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-4">
            <p className="text-xs text-pq-danger-600">{error}</p>
          </div>
        )}

        {/* Workflow selector */}
        <WorkflowTable
          workflows={workflows}
          isLoading={isLoadingWorkflows}
          selectedWorkflowId={selectedWorkflow?.id}
          onSelectWorkflow={handleSelectWorkflow}
        />

        {/* Step editor (shown when workflow selected) */}
        {selectedWorkflow && (
          <WorkflowStepEditor
            workflowId={selectedWorkflow.id}
            workflowCode={selectedWorkflow.code}
            steps={selectedWorkflow.steps}
            roles={roles}
            positions={positions}
            isLoading={isLoadingSteps}
            onAddStep={handleAddStep}
            onEditStep={handleEditStep}
            onDeleteStep={handleDeleteStep}
            activeInstanceCount={selectedWorkflow.instance_count}
          />
        )}

        {/* Step form dialog */}
        <Dialog open={isStepFormOpen} onOpenChange={(open) => !open && handleCancelStepForm()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {stepFormMode === 'create' ? 'Add Approval Step' : 'Edit Approval Step'}
              </DialogTitle>
              <DialogClose />
            </DialogHeader>
            {selectedWorkflow && (
              <WorkflowStepForm
                mode={stepFormMode}
                workflowCode={selectedWorkflow.code}
                initialData={editingStep || undefined}
                roles={roles}
                positions={positions}
                existingStepOrders={
                  stepFormMode === 'create'
                    ? selectedWorkflow.steps.map((s) => s.step_order)
                    : selectedWorkflow.steps
                        .filter((s) => s.id !== editingStep?.id)
                        .map((s) => s.step_order)
                }
                onSubmit={stepFormMode === 'create' ? handleCreateStep : handleUpdateStep}
                onCancel={handleCancelStepForm}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* Delete confirmation dialog */}
        <WorkflowStepDeleteDialog
          step={deletingStep}
          dependencyCheck={dependencyCheck}
          isOpen={isDeleteDialogOpen}
          isLoading={isActionLoading}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      </div>
    </AppShell>
  );
}
