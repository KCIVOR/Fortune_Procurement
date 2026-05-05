'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { Pencil, Power, PowerOff } from 'lucide-react';
import type { AdminPosition } from '@/lib/admin-masterdata';

interface PositionTableProps {
  positions: AdminPosition[];
  isLoading?: boolean;
  onEdit?: (pos: AdminPosition) => void;
  onDeactivate?: (pos: AdminPosition) => void;
  onReactivate?: (pos: AdminPosition) => void;
}

export default function PositionTable({ positions, isLoading = false, onEdit, onDeactivate, onReactivate }: PositionTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border border-[#E5EAFF] p-8">
        <div className="flex items-center justify-center gap-2">
          <div className="w-4 h-4 border-2 border-[#1E4BFF] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[#40527A]">Loading positions...</span>
        </div>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-[#E5EAFF] p-8 text-center">
        <p className="text-sm text-[#40527A]">No positions found</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-[#E5EAFF] overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#E5EAFF] bg-[#F7F9FC]">
              <TableHead className="text-xs font-semibold text-[#40527A]">Position Title</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A]">Role</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A]">Status</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A]">Created</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position) => (
              <TableRow
                key={position.id}
                className={`border-b border-[#E5EAFF] hover:bg-[#F7F9FC] transition ${!position.active ? 'opacity-60' : ''}`}
              >
                <TableCell className="text-xs text-[#0F1F3A] font-medium">
                  {position.title}
                </TableCell>
                <TableCell className="text-xs text-[#40527A]">
                  {position.role_name ? (
                    <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded text-xs inline-block">
                      {position.role_name}
                    </span>
                  ) : (
                    <span className="text-[#BFC7D5]">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-[#40527A] text-center">
                  {position.active ? (
                    <span className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs inline-block font-medium">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs inline-block font-medium">
                      Inactive
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-[#40527A]">
                  {position.created_at ? format(new Date(position.created_at), 'MMM d, yyyy') : '—'}
                </TableCell>
                <TableCell className="text-xs text-[#40527A] flex gap-1">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(position)}
                      className="text-xs text-[#1E4BFF] hover:text-[#1E4BFF] hover:bg-blue-50"
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit
                    </Button>
                  )}
                  {position.active && onDeactivate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeactivate(position)}
                      className="text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    >
                      <PowerOff className="w-3 h-3 mr-1" />
                      Deactivate
                    </Button>
                  )}
                  {!position.active && onReactivate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onReactivate(position)}
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
