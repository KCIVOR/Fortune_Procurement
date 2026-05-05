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

interface DepartmentDeactivateDialogProps {
  department: AdminDepartment | null;
  isOpen: boolean;
  isLoading?: boolean;
  onConfirm: (dept: AdminDepartment) => Promise<void>;
  onCancel: () => void;
}

export default function DepartmentDeactivateDialog({
  department,
  isOpen,
  isLoading = false,
  onConfirm,
  onCancel,
}: DepartmentDeactivateDialogProps) {
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
          <AlertDialogTitle className="text-lg font-semibold text-[#0F1F3A]">
            Deactivate Department
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-sm text-[#40527A] pt-2">
            <div>
              <p className="font-medium mb-2">
                <strong>{department.name}</strong> ({department.code})
              </p>
              {department.user_count ? (
                <p className="text-xs">
                  {department.user_count} user{department.user_count !== 1 ? 's' : ''} assigned to this department
                </p>
              ) : null}
            </div>
            <p>
              This department will no longer be available for new assignments, but existing users and historical PRs will remain unchanged.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center space-x-2 py-4 border-t border-[#E5EAFF]">
          <Checkbox
            id="acknowledge"
            checked={acknowledged}
            onCheckedChange={(checked) => setAcknowledged(checked === true)}
            disabled={isLoading}
          />
          <Label htmlFor="acknowledge" className="text-xs font-medium text-[#40527A] cursor-pointer">
            I understand this will deactivate this department
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
            className="text-xs bg-red-600 hover:bg-red-700 text-white"
          >
            {isLoading ? 'Deactivating...' : 'Deactivate'}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
