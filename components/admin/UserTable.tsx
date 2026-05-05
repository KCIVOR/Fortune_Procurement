'use client';

import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Eye } from 'lucide-react';
import type { AdminUser } from '@/lib/admin-users';

interface UserTableProps {
  users: AdminUser[];
  isLoading?: boolean;
}

export default function UserTable({ users, isLoading = false }: UserTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-[#E5EAFF] p-8">
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-[#1E4BFF] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[#40527A]">Loading users...</span>
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-[#E5EAFF] p-8 text-center">
        <p className="text-sm text-[#40527A]">No users found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-[#E5EAFF] overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#E5EAFF] bg-[#F7F9FC]">
              <TableHead className="text-xs font-semibold text-[#40527A]">Name</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A]">Email</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A]">Role</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A]">Position</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A]">Department</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A]">Created</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow
                key={user.id}
                className="border-b border-[#E5EAFF] hover:bg-[#F7F9FC] transition"
              >
                <TableCell className="text-xs text-[#0F1F3A] font-medium">
                  {user.full_name}
                </TableCell>
                <TableCell className="text-xs text-[#40527A] font-mono">{user.email}</TableCell>
                <TableCell className="text-xs text-[#0F1F3A]">
                  {user.role_name ? (
                    <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                      {user.role_name}
                    </span>
                  ) : (
                    <span className="text-[#BFC7D5]">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-[#40527A]">
                  {user.position_title || '—'}
                </TableCell>
                <TableCell className="text-xs text-[#40527A]">
                  {user.department_name || '—'}
                </TableCell>
                <TableCell className="text-xs text-[#40527A]">
                  {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/admin/users/${user.id}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#1E4BFF] hover:text-[#0F1F3A] hover:bg-blue-50"
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
