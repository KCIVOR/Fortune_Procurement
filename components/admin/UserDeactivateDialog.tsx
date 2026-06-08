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
import type { AdminUser } from '@/lib/admin-users';

interface UserDeactivateDialogProps {
  user: AdminUser | null;
  isOpen: boolean;
  isLoading?: boolean;
  onConfirm: (user: AdminUser) => Promise<void>;
  onCancel: () => void;
}

export default function UserDeactivateDialog({
  user,
  isOpen,
  isLoading = false,
  onConfirm,
  onCancel,
}: UserDeactivateDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  const handleConfirm = async () => {
    if (!user) return;
    await onConfirm(user);
    setAcknowledged(false);
  };

  const handleCancel = () => {
    setAcknowledged(false);
    onCancel();
  };

  if (!user) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-semibold text-pq-neutral-900">
            Deactivate User
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-sm text-pq-neutral-500 pt-2">
            <div>
              <p className="font-medium mb-2">
                <strong>{user.full_name}</strong>
              </p>
              <p className="text-xs font-mono">{user.email}</p>
            </div>
            <p>
              This user will no longer be able to sign in. Their historical PRs, approvals, and audit records will remain unchanged.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center space-x-2 py-4 border-t border-pq-neutral-200">
          <Checkbox
            id="acknowledge-deactivate-user"
            checked={acknowledged}
            onCheckedChange={(checked) => setAcknowledged(checked === true)}
            disabled={isLoading}
          />
          <Label htmlFor="acknowledge-deactivate-user" className="text-xs font-medium text-pq-neutral-500 cursor-pointer">
            I understand this will deactivate this user account
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
