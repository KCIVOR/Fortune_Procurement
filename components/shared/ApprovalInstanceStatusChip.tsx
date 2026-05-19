import React from 'react';
import { CheckCircle2, RotateCcw, Circle as XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApprovalInstanceStatusChipProps {
  status?: string | null;
  className?: string;
}

export default function ApprovalInstanceStatusChip({ status, className }: ApprovalInstanceStatusChipProps) {
  if (!status) return null;

  if (status === 'active') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium text-pq-neutral-900 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md px-2.5 py-1',
          className
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-pq-primary-600 animate-pulse" />
        Pending Approval
      </span>
    );
  }

  if (status === 'approved') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded-full px-2.5 py-1',
          className
        )}
      >
        <CheckCircle2 className="w-3 h-3" />
        Approved
      </span>
    );
  }

  if (status === 'rejected') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium text-pq-danger-600 bg-pq-danger-100 border border-pq-danger-100 rounded-full px-2.5 py-1',
          className
        )}
      >
        <XCircle className="w-3 h-3" />
        Rejected
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2.5 py-1',
        className
      )}
    >
      <RotateCcw className="w-3 h-3" />
      Revision Requested
    </span>
  );
}

