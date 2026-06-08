'use client';

import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import { format } from 'date-fns';
import { Eye } from 'lucide-react';
import type { AdminUser } from '@/lib/admin-users';

interface UserTableProps {
  users: AdminUser[];
  isLoading?: boolean;
}

export default function UserTable({ users, isLoading = false }: UserTableProps) {
  if (isLoading) {
    return <TableSkeleton rows={5} cols={8} />;
  }

  if (users.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-pq-neutral-200 p-8 text-center">
        <EmptyState title="No users found" className="py-0 px-0" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-pq-neutral-200 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-pq-neutral-200 bg-pq-neutral-50">
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Name</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Email</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Role</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Position</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Department</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Created</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow
                key={user.id}
                className={`border-b border-pq-neutral-200 hover:bg-pq-neutral-50 transition ${!user.active ? 'opacity-60' : ''}`}
              >
                <TableCell className="text-xs text-pq-neutral-900 font-medium">
                  {user.full_name}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500 font-mono">{user.email}</TableCell>
                <TableCell className="text-xs text-pq-neutral-900">
                  {user.role_name ? (
                    <span className="px-2 py-1 bg-pq-primary-50 text-pq-primary-700 rounded text-xs">
                      {user.role_name}
                    </span>
                  ) : (
                    <span className="text-pq-neutral-400">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500">
                  {user.position_title || '—'}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500">
                  {user.department_name || '—'}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500">
                  {user.active ? (
                    <span className="px-2 py-1 bg-pq-success-100 text-pq-success-600 rounded text-xs font-medium">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-pq-neutral-100 text-pq-neutral-500 rounded text-xs font-medium">
                      Inactive
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500">
                  {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/admin/users/${user.id}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-pq-primary-600 hover:text-pq-neutral-900 hover:bg-pq-primary-50"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
