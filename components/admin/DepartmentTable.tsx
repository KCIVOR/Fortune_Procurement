'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import { format } from 'date-fns';
import { Pencil, Power, PowerOff } from 'lucide-react';
import type { AdminDepartment } from '@/lib/admin-masterdata';

interface DepartmentTableProps {
  departments: AdminDepartment[];
  isLoading?: boolean;
  onEdit?: (dept: AdminDepartment) => void;
  onDeactivate?: (dept: AdminDepartment) => void;
  onReactivate?: (dept: AdminDepartment) => void;
}

export default function DepartmentTable({ departments, isLoading = false, onEdit, onDeactivate, onReactivate }: DepartmentTableProps) {
  if (isLoading) {
    return <TableSkeleton rows={5} cols={6} />;
  }

  if (departments.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-pq-neutral-200 p-8 text-center">
        <EmptyState title="No departments found" className="py-0 px-0" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-pq-neutral-200 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-pq-neutral-200 bg-pq-neutral-50">
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Department Name</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Code</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Status</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Users</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Created</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.map((dept) => (
              <TableRow
                key={dept.id}
                className={`border-b border-pq-neutral-200 hover:bg-pq-neutral-50 transition ${!dept.active ? 'opacity-60' : ''}`}
              >
                <TableCell className="text-xs text-pq-neutral-900 font-medium">
                  {dept.name}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500 font-mono">
                  <span className="px-2 py-1 bg-pq-warning-100 text-pq-warning-600 rounded text-xs inline-block">
                    {dept.code}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500 text-center">
                  {dept.active ? (
                    <span className="px-2 py-1 bg-pq-success-100 text-pq-success-600 rounded text-xs inline-block font-medium">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-pq-neutral-100 text-pq-neutral-500 rounded text-xs inline-block font-medium">
                      Inactive
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500 text-center">
                  {dept.user_count !== undefined ? (
                    <span className="px-2 py-1 bg-pq-neutral-100 text-pq-neutral-500 rounded text-xs inline-block">
                      {dept.user_count}
                    </span>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500">
                  {dept.created_at ? format(new Date(dept.created_at), 'MMM d, yyyy') : '—'}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500 flex gap-1">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(dept)}
                      className="text-xs text-pq-primary-600 hover:text-pq-primary-600 hover:bg-pq-primary-50"
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  )}
                  {dept.active && onDeactivate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeactivate(dept)}
                      className="text-xs text-pq-neutral-600 hover:text-pq-neutral-900 hover:bg-pq-neutral-100"
                    >
                      <PowerOff className="w-3 h-3 mr-1" />
                      Deactivate
                    </Button>
                  )}
                  {!dept.active && onReactivate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onReactivate(dept)}
                      className="text-xs text-pq-neutral-600 hover:text-pq-neutral-900 hover:bg-pq-neutral-100"
                    >
                      <Power className="w-3 h-3 mr-1" />
                      Reactivate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
