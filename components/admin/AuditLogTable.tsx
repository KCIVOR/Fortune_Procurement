'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
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
    return (
      <div className="bg-white rounded-lg border border-[#E5EAFF] p-8">
        <LoadingState message="Loading audit logs..." size="sm" className="!flex-row !gap-2" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-[#E5EAFF] p-8 text-center">
        <EmptyState title="No audit logs found" className="py-0 px-0" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-[#E5EAFF] overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-[#E5EAFF] bg-[#F7F9FC]">
              <TableHead className="text-xs font-semibold text-[#40527A]">Timestamp</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A]">Action</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A]">Document Type</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A]">Document ID</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A]">IP Address</TableHead>
              <TableHead className="text-xs font-semibold text-[#40527A] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow
                key={log.id}
                className="border-b border-[#E5EAFF] hover:bg-[#F7F9FC] transition"
              >
                <TableCell className="text-xs text-[#0F1F3A] font-mono">
                  {log.created_at ? format(new Date(log.created_at), 'MMM d, HH:mm:ss') : 'N/A'}
                </TableCell>
                <TableCell className="text-xs text-[#0F1F3A] font-medium">
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                    {log.action}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-[#40527A]">{log.document_type || '—'}</TableCell>
                <TableCell className="text-xs text-[#40527A] font-mono truncate max-w-xs">
                  {log.document_id ? log.document_id.substring(0, 8) + '...' : '—'}
                </TableCell>
                <TableCell className="text-xs text-[#40527A] font-mono">{log.ip_address || '—'}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRowClick?.(log)}
                    className="text-[#1E4BFF] hover:text-[#0F1F3A] hover:bg-blue-50"
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
