'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Trash2 } from 'lucide-react';
import type { WorkflowStepConfig, StepDependencyCheck } from '@/types/workflow-admin';

interface WorkflowStepDeleteDialogProps {
  step: WorkflowStepConfig | null;
  dependencyCheck: StepDependencyCheck | null;
  isOpen: boolean;
  isLoading: boolean;
  onConfirm: (step: WorkflowStepConfig) => Promise<void>;
  onCancel: () => void;
}

export default function WorkflowStepDeleteDialog({
  step,
  dependencyCheck,
  isOpen,
  isLoading,
  onConfirm,
  onCancel,
}: WorkflowStepDeleteDialogProps) {
  if (!step) return null;

  const canDelete = dependencyCheck?.canDelete ?? true;
  const hasWarning = dependencyCheck?.actionCount && dependencyCheck.actionCount > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-pq-danger-600" />
            Delete Approval Step
          </DialogTitle>
          <DialogDescription className="text-xs text-pq-neutral-500">
            Are you sure you want to delete this step?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step details */}
          <div className="bg-pq-neutral-50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-pq-neutral-500">Step Order:</span>
              <span className="text-xs text-pq-neutral-900 font-medium">{step.step_order}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-pq-neutral-500">Role:</span>
              <span className="text-xs text-pq-neutral-900">{step.role_required}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-pq-neutral-500">Position:</span>
              <span className="text-xs text-pq-neutral-900">{step.position_required}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-pq-neutral-500">Action Label:</span>
              <span className="text-xs text-pq-neutral-900">{step.action_label}</span>
            </div>
          </div>

          {/* Cannot delete error */}
          {!canDelete && dependencyCheck?.reason && (
            <div className="bg-pq-danger-100 border border-pq-danger-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-pq-danger-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-pq-danger-900">Cannot Delete</p>
                <p className="text-xs text-pq-danger-700 mt-1">{dependencyCheck.reason}</p>
              </div>
            </div>
          )}

          {/* Warning about historical actions */}
          {canDelete && hasWarning && (
            <div className="bg-pq-warning-100 border border-pq-warning-200 rounded-lg p-3 flex gap-2">
              <AlertCircle className="w-4 h-4 text-pq-warning-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-pq-warning-900">Historical Data Warning</p>
                <p className="text-xs text-pq-warning-700 mt-1">
                  {dependencyCheck?.actionCount} historical approval action(s) reference this step order.
                  Deleting this step will not affect historical records, but the step order will no longer be available.
                </p>
              </div>
            </div>
          )}

          {/* General warning */}
          {canDelete && !hasWarning && (
            <div className="bg-pq-neutral-100 border border-pq-neutral-200 rounded-lg p-3">
              <p className="text-xs text-pq-neutral-700">
                This action cannot be undone. After deletion, you'll need to reorder remaining steps if necessary.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => onConfirm(step)}
            disabled={!canDelete || isLoading}
            className="text-xs"
          >
            {isLoading ? 'Deleting...' : 'Delete Step'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
