import React from 'react';
import { cn } from '@/lib/utils';

interface ApprovalQueueTableShellProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export default function ApprovalQueueTableShell({ title, icon, children, className }: ApprovalQueueTableShellProps) {
  return (
    <div className={cn('bg-white rounded-md border border-pq-neutral-200 overflow-hidden mb-3', className)}>
      <div className="px-5 py-2.5 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">{title}</span>
      </div>
      {children}
    </div>
  );
}

