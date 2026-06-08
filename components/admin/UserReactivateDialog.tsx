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

interface UserReactivateDialogProps {
  user: AdminUser | null;
  isOpen: boolean;
  isLoading?: boolean;
  onConfirm: (user: AdminUser) => Promise<void>;
  onCancel: () => void;
}

export default function UserReactivateDialog({
  user,
  isOpen,
  isLoading = false,
  onConfirm,
  onCancel,
}: UserReactivateDialogProps) {
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
            Reactivate User
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-sm text-pq-neutral-500 pt-2">
            <div>
              <p className="font-medium mb-2">
                <strong>{user.full_name}</strong>
              </p>
              <p className="text-xs font-mono">{user.email}</p>
            </div>
            <p>
              This user will be able to sign in again with their existing credentials.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex items-center space-x-2 py-4 border-t border-pq-neutral-200">
          <Checkbox
            id="acknowledge-reactivate-user"
            checked={acknowledged}
            onCheckedChange={(checked) => setAcknowledged(checked === true)}
            disabled={isLoading}
          />
          <Label htmlFor="acknowledge-reactivate-user" className="text-xs font-medium text-pq-neutral-500 cursor-pointer">
            I want to reactivate this user account
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
