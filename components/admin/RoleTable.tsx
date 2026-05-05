'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import type { AdminRole } from '@/lib/admin-masterdata';

interface RoleTableProps {
  roles: AdminRole[];
  isLoading?: boolean;
}

export default function RoleTable({ roles, isLoading = false }: RoleTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-[#E5EAFF] p-8">
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-[#1E4BFF] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[#40527A]">Loading roles...</span>
        </div>
      </div>
    );
  }

  if (roles.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-[#E5EAFF] p-8 text-center">
        <p className="text-sm text-[#40527A]">No roles found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-[#E5EAFF] overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#E5EAFF] bg-[#F7F9FC]">
              <TableHead className="text-xs font-semibold text-[#40527A]">Role Name</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A]">Users</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A]">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roles.map((role) => (
              <TableRow
                key={role.id}
                className="border-b border-[#E5EAFF] hover:bg-[#F7F9FC] transition"
              >
                <TableCell className="text-xs text-[#0F1F3A] font-medium">
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs inline-block">
                    {role.name}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-[#40527A] text-center">
                  {role.user_count !== undefined ? (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs inline-block">
                      {role.user_count}
                    </span>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="text-xs text-[#40527A]">
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
