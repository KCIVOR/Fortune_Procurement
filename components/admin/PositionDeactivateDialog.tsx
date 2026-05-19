'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { AdminPosition } from '@/lib/admin-masterdata';

interface PositionDeactivateDialogProps {
  position: AdminPosition | null;
  isOpen: boolean;
  isLoading?: boolean;
  onConfirm: (pos: AdminPosition) => Promise<void>;
  onCancel: () => void;
}

export default function PositionDeactivateDialog({
  position,
  isOpen,
  isLoading = false,
  onConfirm,
  onCancel,
}: PositionDeactivateDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const handleConfirm = async () => {
    if (!position) return;
    await onConfirm(position);
    setAcknowledged(false);
  };

  const handleCancel = () => {
    setAcknowledged(false);
    onCancel();
  };

  if (!position) return null;

  const hasWorkflowUsage = (position.workflow_usage_count || 0) > 0;
  const hasAssignedUsers = (position.user_count || 0) > 0;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-semibold text-pq-neutral-900">
            Deactivate Position
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-sm text-pq-neutral-500 pt-2">
            <div>
              <p className="font-medium mb-1">
                <strong>{position.title}</strong>
              </p>
              {position.role_name && (
                <p className="text-xs text-pq-neutral-500">
                  Role: {position.role_name}
                </p>
              )}
            </div>

            {hasAssignedUsers && (
              <div className="bg-pq-primary-50 border border-pq-primary-200 rounded p-2">
                <p className="text-xs font-medium text-pq-primary-900 mb-1">Assigned Users</p>
                <p className="text-xs text-pq-primary-600">
                  This position is currently assigned to {position.user_count} user{position.user_count !== 1 ? 's' : ''}. Existing users will keep this position.
                </p>
              </div>
            )}

            {hasWorkflowUsage && (
              <div className="bg-pq-warning-100 border border-pq-warning-100 rounded p-2">
                <p className="text-xs font-medium text-pq-warning-600 mb-1">Workflow Impact</p>
                <p className="text-xs text-pq-warning-600">
                  This position is used in {position.workflow_usage_count} approval workflow step{position.workflow_usage_count !== 1 ? 's' : ''}. Deactivating it may affect future approval setup. Existing workflow records will not be changed.
                </p>
              </div>
            )}

            <p>
              This position will no longer be available for new assignments, but existing users and historical records will remain unchanged.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center space-x-2 py-4 border-t border-pq-neutral-200">
          <Checkbox
            id="acknowledge"
            checked={acknowledged}
            onCheckedChange={(checked) => setAcknowledged(checked === true)}
            disabled={isLoading}
          />
          <Label htmlFor="acknowledge" className="text-xs font-medium text-pq-neutral-500 cursor-pointer">
            I understand this will deactivate this position
          </Label>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <AlertDialogCancel
            onClick={handleCancel}
            disabled={isLoading}
            className="text-xs"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!acknowledged || isLoading}
            className="text-xs bg-pq-danger-600 hover:bg-pq-danger-600 text-white"
          >
            {isLoading ? 'Deactivating...' : 'Deactivate'}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
