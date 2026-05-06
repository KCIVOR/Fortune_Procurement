'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
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
    return (
      <div className="bg-white rounded-lg border border-[#E5EAFF] p-8">
        <LoadingState message="Loading departments..." size="sm" className="!flex-row !gap-2" />
      </div>
    );
  }

  if (departments.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-[#E5EAFF] p-8 text-center">
        <EmptyState title="No departments found" className="py-0 px-0" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-[#E5EAFF] overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#E5EAFF] bg-[#F7F9FC]">
              <TableHead className="text-xs font-semibold text-[#40527A]">Department Name</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A]">Code</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A]">Status</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A]">Users</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A]">Created</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.map((dept) => (
              <TableRow
                key={dept.id}
                className={`border-b border-[#E5EAFF] hover:bg-[#F7F9FC] transition ${!dept.active ? 'opacity-60' : ''}`}
              >
                <TableCell className="text-xs text-[#0F1F3A] font-medium">
                  {dept.name}
                </TableCell>
                <TableCell className="text-xs text-[#40527A] font-mono">
                  <span className="px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs inline-block">
                    {dept.code}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-[#40527A] text-center">
                  {dept.active ? (
                    <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs inline-block font-medium">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs inline-block font-medium">
                      Inactive
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-[#40527A] text-center">
                  {dept.user_count !== undefined ? (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs inline-block">
                      {dept.user_count}
                    </span>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="text-xs text-[#40527A]">
                  {dept.created_at ? format(new Date(dept.created_at), 'MMM d, yyyy') : '—'}
                </TableCell>
                <TableCell className="text-xs text-[#40527A] flex gap-1">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(dept)}
                      className="text-xs text-[#1E4BFF] hover:text-[#1E4BFF] hover:bg-blue-50"
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
                      className="text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100"
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
                      className="text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100"
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
