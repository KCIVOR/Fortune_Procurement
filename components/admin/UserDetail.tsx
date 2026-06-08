'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, CreditCard as Edit, Lock, Power, PowerOff } from 'lucide-react';
import { format } from 'date-fns';
import ResetPasswordModal from '@/components/admin/ResetPasswordModal';
import UserDeactivateDialog from '@/components/admin/UserDeactivateDialog';
import UserReactivateDialog from '@/components/admin/UserReactivateDialog';
import { setUserActiveStatus } from '@/lib/admin-users';
import type { AdminUser } from '@/lib/admin-users';

interface UserDetailProps {
  user: AdminUser;
  isAdmin?: boolean;
  currentAdminId?: string;
  onStatusChanged?: (user: AdminUser) => void;
}

export default function UserDetail({
  user,
  isAdmin = false,
  currentAdminId,
  onStatusChanged,
}: UserDetailProps) {
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const canDeactivate = isAdmin && user.active && user.id !== currentAdminId;
  const canReactivate = isAdmin && !user.active;

  async function handleDeactivate() {
    setIsStatusLoading(true);
    setStatusError(null);
    const result = await setUserActiveStatus(user.id, false);
    if (!result.success || !result.user) {
      setStatusError(result.error ?? 'Failed to deactivate user');
      setIsStatusLoading(false);
      return;
    }
    setDeactivateDialogOpen(false);
    onStatusChanged?.(result.user);
    setIsStatusLoading(false);
  }

  async function handleReactivate() {
    setIsStatusLoading(true);
    setStatusError(null);
    const result = await setUserActiveStatus(user.id, true);
    if (!result.success || !result.user) {
      setStatusError(result.error ?? 'Failed to reactivate user');
      setIsStatusLoading(false);
      return;
    }
    setReactivateDialogOpen(false);
    onStatusChanged?.(result.user);
    setIsStatusLoading(false);
  }

  return (
    <div className="space-y-6">
      <Link href="/admin/users">
        <Button variant="outline" className="text-sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Users
        </Button>
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-2xl font-bold text-pq-neutral-900">{user.full_name}</h2>
            {user.active ? (
              <span className="px-2 py-1 bg-pq-success-100 text-pq-success-600 rounded text-xs font-medium">
                Active
              </span>
            ) : (
              <span className="px-2 py-1 bg-pq-neutral-100 text-pq-neutral-500 rounded text-xs font-medium">
                Inactive
              </span>
            )}
          </div>
          <p className="text-sm text-pq-neutral-500 mt-1">{user.email}</p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2 justify-end">
            {canDeactivate && (
              <Button
                onClick={() => setDeactivateDialogOpen(true)}
                className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-sm"
              >
                <PowerOff className="w-4 h-4 mr-2" />
                Deactivate
              </Button>
            )}
            {canReactivate && (
              <Button
                onClick={() => setReactivateDialogOpen(true)}
                className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-sm"
              >
                <Power className="w-4 h-4 mr-2" />
                Reactivate
              </Button>
            )}
            <Button
              onClick={() => setIsResetModalOpen(true)}
              className="bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-sm"
            >
              <Lock className="w-4 h-4 mr-2" />
              Reset Password
            </Button>
            <Link href={`/admin/users/${user.id}/edit`}>
              <Button className="bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm">
                <Edit className="w-4 h-4 mr-2" />
                Edit Assignment
              </Button>
            </Link>
          </div>
        )}
      </div>

      {statusError && (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-4">
          <p className="text-sm text-pq-danger-600">{statusError}</p>
        </div>
      )}

      {isAdmin && (
        <ResetPasswordModal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          userId={user.id}
          userEmail={user.email}
        />
      )}

      <UserDeactivateDialog
        user={user}
        isOpen={deactivateDialogOpen}
        isLoading={isStatusLoading}
        onConfirm={handleDeactivate}
        onCancel={() => {
          if (!isStatusLoading) setDeactivateDialogOpen(false);
        }}
      />

      <UserReactivateDialog
        user={user}
        isOpen={reactivateDialogOpen}
        isLoading={isStatusLoading}
        onConfirm={handleReactivate}
        onCancel={() => {
          if (!isStatusLoading) setReactivateDialogOpen(false);
        }}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-white rounded-lg border border-pq-neutral-200 p-4">
          <p className="text-xs font-medium text-pq-neutral-500 mb-2">Profile ID</p>
          <p className="text-sm font-mono text-pq-neutral-900 break-all">{user.id}</p>
        </Card>

        <Card className="bg-white rounded-lg border border-pq-neutral-200 p-4">
          <p className="text-xs font-medium text-pq-neutral-500 mb-2">Role</p>
          <p className="text-sm text-pq-neutral-900">
            {user.role_name ? (
              <span className="px-2 py-1 bg-pq-primary-50 text-pq-primary-700 rounded text-xs inline-block">
                {user.role_name}
              </span>
            ) : (
              <span className="text-pq-neutral-400">Not assigned</span>
            )}
          </p>
        </Card>

        <Card className="bg-white rounded-lg border border-pq-neutral-200 p-4">
          <p className="text-xs font-medium text-pq-neutral-500 mb-2">Position</p>
          <p className="text-sm text-pq-neutral-900">{user.position_title || <span className="text-pq-neutral-400">Not assigned</span>}</p>
        </Card>

        <Card className="bg-white rounded-lg border border-pq-neutral-200 p-4">
          <p className="text-xs font-medium text-pq-neutral-500 mb-2">Department</p>
          <p className="text-sm text-pq-neutral-900">{user.department_name || <span className="text-pq-neutral-400">Not assigned</span>}</p>
        </Card>

        <Card className="bg-white rounded-lg border border-pq-neutral-200 p-4">
          <p className="text-xs font-medium text-pq-neutral-500 mb-2">Email</p>
          <p className="text-sm font-mono text-pq-neutral-900">{user.email}</p>
        </Card>

        <Card className="bg-white rounded-lg border border-pq-neutral-200 p-4">
          <p className="text-xs font-medium text-pq-neutral-500 mb-2">Created</p>
          <p className="text-sm text-pq-neutral-900">
            {user.created_at ? format(new Date(user.created_at), 'PPP p') : 'Unknown'}
          </p>
        </Card>

        {user.role_name === 'supplier' && (
          <Card className="bg-white rounded-lg border border-pq-neutral-200 p-4 md:col-span-2">
            <p className="text-xs font-medium text-pq-neutral-500 mb-2">Default Payment Terms</p>
            <p className="text-sm text-pq-neutral-900">
              {user.payment_terms?.trim() ? (
                user.payment_terms
              ) : (
                <span className="text-pq-neutral-400">Not set — PO generation will require manual entry</span>
              )}
            </p>
          </Card>
        )}
      </div>

      <div className="bg-pq-primary-50 border border-pq-primary-200 rounded-lg p-5">
        <h4 className="font-semibold text-pq-primary-900 text-sm mb-2">User Management</h4>
        <p className="text-xs text-pq-primary-600 leading-relaxed">
          Use <strong>Deactivate</strong> to block sign-in while preserving history. Use <strong>Reactivate</strong> to restore access.
          <strong> Reset Password</strong> sets a new temporary password. <strong>Edit Assignment</strong> updates role, position, and department.
        </p>
      </div>
    </div>
  );
}
