'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, CreditCard as Edit, Lock } from 'lucide-react';
import { format } from 'date-fns';
import ResetPasswordModal from '@/components/admin/ResetPasswordModal';
import type { AdminUser } from '@/lib/admin-users';

interface UserDetailProps {
  user: AdminUser;
  isAdmin?: boolean;
}

export default function UserDetail({ user, isAdmin = false }: UserDetailProps) {
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link href="/admin/users">
        <Button variant="outline" className="text-sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Users
        </Button>
      </Link>

      {/* Header with Edit Button */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-pq-neutral-900">{user.full_name}</h2>
          <p className="text-sm text-pq-neutral-500 mt-1">{user.email}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
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

      {/* Reset Password Modal */}
      {isAdmin && (
        <ResetPasswordModal
          isOpen={isResetModalOpen}
          onClose={() => setIsResetModalOpen(false)}
          userId={user.id}
          userEmail={user.email}
        />
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile ID */}
        <Card className="bg-white rounded-lg border border-pq-neutral-200 p-4">
          <p className="text-xs font-medium text-pq-neutral-500 mb-2">Profile ID</p>
          <p className="text-sm font-mono text-pq-neutral-900 break-all">{user.id}</p>
        </Card>

        {/* Role */}
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

        {/* Position */}
        <Card className="bg-white rounded-lg border border-pq-neutral-200 p-4">
          <p className="text-xs font-medium text-pq-neutral-500 mb-2">Position</p>
          <p className="text-sm text-pq-neutral-900">{user.position_title || <span className="text-pq-neutral-400">Not assigned</span>}</p>
        </Card>

        {/* Department */}
        <Card className="bg-white rounded-lg border border-pq-neutral-200 p-4">
          <p className="text-xs font-medium text-pq-neutral-500 mb-2">Department</p>
          <p className="text-sm text-pq-neutral-900">{user.department_name || <span className="text-pq-neutral-400">Not assigned</span>}</p>
        </Card>

        {/* Email */}
        <Card className="bg-white rounded-lg border border-pq-neutral-200 p-4">
          <p className="text-xs font-medium text-pq-neutral-500 mb-2">Email</p>
          <p className="text-sm font-mono text-pq-neutral-900">{user.email}</p>
        </Card>

        {/* Created At */}
        <Card className="bg-white rounded-lg border border-pq-neutral-200 p-4">
          <p className="text-xs font-medium text-pq-neutral-500 mb-2">Created</p>
          <p className="text-sm text-pq-neutral-900">
            {user.created_at ? format(new Date(user.created_at), 'PPP p') : 'Unknown'}
          </p>
        </Card>
      </div>

      {/* Info Box */}
      <div className="bg-pq-primary-50 border border-pq-primary-200 rounded-lg p-5">
        <h4 className="font-semibold text-pq-primary-900 text-sm mb-2">User Management</h4>
        <p className="text-xs text-pq-primary-600 leading-relaxed">
          Use the <strong>Reset Password</strong> button to set a new temporary password for this user. The <strong>Edit Assignment</strong> button allows you to update their role, position, and department.
        </p>
      </div>
    </div>
  );
}
