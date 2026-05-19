'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import { format } from 'date-fns';
import type { AdminRole } from '@/lib/admin-masterdata';

interface RoleTableProps {
  roles: AdminRole[];
  isLoading?: boolean;
}

export default function RoleTable({ roles, isLoading = false }: RoleTableProps) {
  if (isLoading) {
    return <TableSkeleton rows={5} cols={3} />;
  }

  if (roles.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-pq-neutral-200 p-8 text-center">
        <EmptyState title="No roles found" className="py-0 px-0" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-pq-neutral-200 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-pq-neutral-200 bg-pq-neutral-50">
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Role Name</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Users</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow
                key={role.id}
                className="border-b border-pq-neutral-200 hover:bg-pq-neutral-50 transition"
              >
                <TableCell className="text-xs text-pq-neutral-900 font-medium">
                  <span className="px-2 py-1 bg-pq-primary-50 text-pq-primary-700 rounded text-xs inline-block">
                    {role.name}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500 text-center">
                  {role.user_count !== undefined ? (
                    <span className="px-2 py-1 bg-pq-neutral-100 text-pq-neutral-500 rounded text-xs inline-block">
                      {role.user_count}
                    </span>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500">
                  {role.created_at ? format(new Date(role.created_at), 'MMM d, yyyy') : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
