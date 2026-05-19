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
import type { AdminDepartment } from '@/lib/admin-masterdata';

interface DepartmentReactivateDialogProps {
  department: AdminDepartment | null;
  isOpen: boolean;
  isLoading?: boolean;
  onConfirm: (dept: AdminDepartment) => Promise<void>;
  onCancel: () => void;
}

export default function DepartmentReactivateDialog({
  department,
  isOpen,
  isLoading = false,
  onConfirm,
  onCancel,
}: DepartmentReactivateDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const handleConfirm = async () => {
    if (!department) return;
    await onConfirm(department);
    setAcknowledged(false);
  };

  const handleCancel = () => {
    setAcknowledged(false);
    onCancel();
  };

  if (!department) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-semibold text-pq-neutral-900">
            Reactivate Department
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-sm text-pq-neutral-500 pt-2">
            <div>
              <p className="font-medium mb-2">
                <strong>{department.name}</strong> ({department.code})
              </p>
            </div>
            <p>
              This department will become available again for future assignments.
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
            I want to reactivate this department
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
            className="text-xs bg-pq-success-600 hover:bg-pq-success-600 text-white"
          >
            {isLoading ? 'Reactivating...' : 'Reactivate'}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
