'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import { format } from 'date-fns';
import { Eye } from 'lucide-react';
import type { AuditLog } from '@/types/audit';

interface AuditLogTableProps {
  logs: AuditLog[];
  isLoading?: boolean;
  onRowClick?: (log: AuditLog) => void;
}

export default function AuditLogTable({ logs, isLoading = false, onRowClick }: AuditLogTableProps) {
  if (isLoading) {
    return <TableSkeleton rows={5} cols={5} />;
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-pq-neutral-200 p-8 text-center">
        <EmptyState title="No audit logs found" className="py-0 px-0" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-pq-neutral-200 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-pq-neutral-200 bg-pq-neutral-50">
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Timestamp</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Action</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Document Type</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Document ID</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">IP Address</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow
                key={log.id}
                className="border-b border-pq-neutral-200 hover:bg-pq-neutral-50 transition"
              >
                <TableCell className="text-xs text-pq-neutral-900 font-mono">
                  {log.created_at ? format(new Date(log.created_at), 'MMM d, HH:mm:ss') : 'N/A'}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-900 font-medium">
                  <span className="px-2 py-1 bg-pq-primary-50 text-pq-primary-700 rounded text-xs">
                    {log.action}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500">{log.document_type || '—'}</TableCell>
                <TableCell className="text-xs text-pq-neutral-500 font-mono truncate max-w-xs">
                  {log.document_id ? log.document_id.substring(0, 8) + '...' : '—'}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500 font-mono">{log.ip_address || '—'}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRowClick?.(log)}
                    className="text-pq-primary-600 hover:text-pq-neutral-900 hover:bg-pq-primary-50"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
