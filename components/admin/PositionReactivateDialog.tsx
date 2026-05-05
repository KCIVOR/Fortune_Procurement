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

interface PositionReactivateDialogProps {
  position: AdminPosition | null;
  isOpen: boolean;
  isLoading?: boolean;
  onConfirm: (pos: AdminPosition) => Promise<void>;
  onCancel: () => void;
}

export default function PositionReactivateDialog({
  position,
  isOpen,
  isLoading = false,
  onConfirm,
  onCancel,
}: PositionReactivateDialogProps) {
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

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-semibold text-[#0F1F3A]">
            Reactivate Position
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-3 text-sm text-[#40527A] pt-2">
            <div>
              <p className="font-medium mb-1">
                <strong>{position.title}</strong>
              </p>
              {position.role_name && (
                <p className="text-xs text-[#40527A]">
                  Role: {position.role_name}
                </p>
              )}
            </div>

            <p>
              This position will become available again for future assignments.
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
            I want to reactivate this position
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
            className="text-xs bg-green-600 hover:bg-green-700 text-white"
          >
            {isLoading ? 'Reactivating...' : 'Reactivate'}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
