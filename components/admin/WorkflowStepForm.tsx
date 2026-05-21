'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle } from 'lucide-react';
import type { WorkflowStepConfig, WorkflowStepFormData, RoleOption, PositionOption } from '@/types/workflow-admin';
import { getWorkflowWarnings } from '@/lib/workflow-admin';

interface WorkflowStepFormProps {
  mode: 'create' | 'edit';
  workflowCode: string;
  initialData?: WorkflowStepConfig;
  roles: RoleOption[];
  positions: PositionOption[];
  existingStepOrders: number[];
  onSubmit: (data: WorkflowStepFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function WorkflowStepForm({
  mode,
  workflowCode,
  initialData,
  roles,
  positions,
  existingStepOrders,
  onSubmit,
  onCancel,
  isLoading = false,
}: WorkflowStepFormProps) {
  const [stepOrder, setStepOrder] = useState(initialData?.step_order || 0);
  const [roleRequired, setRoleRequired] = useState(initialData?.role_required || '');
  const [positionRequired, setPositionRequired] = useState(initialData?.position_required || '');
  const [actionLabel, setActionLabel] = useState(initialData?.action_label || '');
  const [isFinal, setIsFinal] = useState(initialData?.is_final || false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-suggest next available step order for create mode
  useEffect(() => {
    if (mode === 'create' && stepOrder === 0) {
      const maxOrder = existingStepOrders.length > 0 ? Math.max(...existingStepOrders) : 0;
      setStepOrder(maxOrder + 1);
    }
  }, [mode, existingStepOrders, stepOrder]);

  // Filter positions by selected role
  // Note: approver and procurement roles are interchangeable in the approval logic
  const filteredPositions = positions.filter((pos) => {
    if (!roleRequired) return true;
    
    // Allow approver and procurement roles to see each other's positions
    if ((roleRequired === 'approver' || roleRequired === 'procurement') &&
        (pos.role_name === 'approver' || pos.role_name === 'procurement')) {
      return true;
    }
    
    return pos.role_name === roleRequired;
  });

  // Get warnings for this step
  const warnings = getWorkflowWarnings(workflowCode, stepOrder);

  // Validation
  const isValid =
    stepOrder > 0 &&
    roleRequired.trim().length > 0 &&
    positionRequired.trim().length > 0 &&
    actionLabel.trim().length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!isValid) {
      setError('All fields are required');
      return;
    }

    // Check for duplicate step order (only in create mode or if order changed)
    if (mode === 'create' || stepOrder !== initialData?.step_order) {
      if (existingStepOrders.includes(stepOrder)) {
        setError(`Step order ${stepOrder} already exists`);
        return;
      }
    }

    try {
      setError(null);
      setIsSaving(true);
      await onSubmit({
        step_order: stepOrder,
        role_required: roleRequired,
        position_required: positionRequired,
        action_label: actionLabel.trim(),
        is_final: isFinal,
      });
      // Note: If onSubmit succeeds, the parent should close the dialog
      // If it doesn't close, we need to reset the saving state
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
    } finally {
      // Always reset saving state - the parent will close the dialog on success
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-3">
          <p className="text-xs text-pq-danger-600">{error}</p>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="bg-pq-warning-100 border border-pq-warning-100 rounded-lg p-3 flex gap-2">
          <AlertCircle className="w-4 h-4 text-pq-warning-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-pq-warning-600">Special Workflow Logic</p>
            {warnings.map((warning, index) => (
              <p key={index} className="text-xs text-pq-warning-600 mt-1">
                {warning}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="stepOrder" className="text-xs font-medium text-pq-neutral-500">
          Step Order *
        </Label>
        <Input
          id="stepOrder"
          type="number"
          min="1"
          placeholder="e.g., 1, 2, 3"
          value={stepOrder || ''}
          onChange={(e) => setStepOrder(parseInt(e.target.value) || 0)}
          disabled={isLoading || isSaving}
          className="text-sm"
        />
        <p className="text-xs text-pq-neutral-400">
          {mode === 'create' && `Next available: ${Math.max(...existingStepOrders, 0) + 1}`}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="role" className="text-xs font-medium text-pq-neutral-500">
          Role Required *
        </Label>
        <Select
          value={roleRequired}
          onValueChange={(value) => {
            setRoleRequired(value);
            // Reset position if it doesn't match the new role
            const currentPos = positions.find((p) => p.title === positionRequired);
            if (currentPos && currentPos.role_name !== value) {
              setPositionRequired('');
            }
          }}
          disabled={isLoading || isSaving}
        >
          <SelectTrigger className="text-sm">
            <SelectValue placeholder="Select a role" />
          </SelectTrigger>
          <SelectContent>
            {roles.map((role) => (
              <SelectItem key={role.id} value={role.name}>
                {role.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="position" className="text-xs font-medium text-pq-neutral-500">
          Position Required *
        </Label>
        <Select
          value={positionRequired}
          onValueChange={setPositionRequired}
          disabled={isLoading || isSaving || !roleRequired}
        >
          <SelectTrigger className="text-sm">
            <SelectValue placeholder={roleRequired ? 'Select a position' : 'Select a role first'} />
          </SelectTrigger>
          <SelectContent>
            {filteredPositions.length === 0 ? (
              <div className="p-2 text-xs text-pq-neutral-400">
                No positions available for this role
              </div>
            ) : (
              filteredPositions.map((position) => (
                <SelectItem key={position.id} value={position.title}>
                  {position.title}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="actionLabel" className="text-xs font-medium text-pq-neutral-500">
          Action Label *
        </Label>
        <Input
          id="actionLabel"
          placeholder="e.g., Reviewed By, Approved By, Acknowledged By"
          value={actionLabel}
          onChange={(e) => setActionLabel(e.target.value)}
          disabled={isLoading || isSaving}
          className="text-sm"
        />
        <p className="text-xs text-pq-neutral-400">
          This label appears in approval timelines and signatures
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="isFinal"
          checked={isFinal}
          onCheckedChange={(checked) => setIsFinal(checked === true)}
          disabled={isLoading || isSaving}
        />
        <Label
          htmlFor="isFinal"
          className="text-xs font-medium text-pq-neutral-500 cursor-pointer"
        >
          This is the final approval step
        </Label>
      </div>

      <div className="flex items-center justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
          className="text-xs"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!isValid || isLoading || isSaving}
          size="sm"
          className="text-xs"
        >
          {isSaving ? 'Saving...' : mode === 'create' ? 'Create Step' : 'Update Step'}
        </Button>
      </div>
    </form>
  );
}
