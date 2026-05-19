'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
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
    return <TableSkeleton rows={5} cols={5} />;
  }

  if (positions.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-pq-neutral-200 p-8 text-center">
        <EmptyState title="No positions found" className="py-0 px-0" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-pq-neutral-200 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-pq-neutral-200 bg-pq-neutral-50">
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Position Title</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Role</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Status</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Created</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((position) => (
              <TableRow
                key={position.id}
                className={`border-b border-pq-neutral-200 hover:bg-pq-neutral-50 transition ${!position.active ? 'opacity-60' : ''}`}
              >
                <TableCell className="text-xs text-pq-neutral-900 font-medium">
                  {position.title}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500">
                  {position.role_name ? (
                    <span className="px-2 py-1 bg-pq-success-100 text-pq-success-600 rounded text-xs inline-block">
                      {position.role_name}
                    </span>
                  ) : (
                    <span className="text-pq-neutral-400">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500 text-center">
                  {position.active ? (
                    <span className="px-2 py-1 bg-pq-success-100 text-pq-success-600 rounded text-xs inline-block font-medium">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-pq-neutral-100 text-pq-neutral-500 rounded text-xs inline-block font-medium">
                      Inactive
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500">
                  {position.created_at ? format(new Date(position.created_at), 'MMM d, yyyy') : '—'}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500 flex gap-1">
                  {onEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(position)}
                      className="text-xs text-pq-primary-600 hover:text-pq-primary-600 hover:bg-pq-primary-50"
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
                      className="text-xs text-pq-neutral-600 hover:text-pq-neutral-900 hover:bg-pq-neutral-100"
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
