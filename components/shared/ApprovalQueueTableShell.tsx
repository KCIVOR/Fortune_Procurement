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
    <div className={cn('bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden mb-3', className)}>
      <div className="px-5 py-2.5 border-b border-[#D8E2FF] bg-[#F7F9FC] flex items-center gap-2">
        {icon}
        <span className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">{title}</span>
      </div>
      {children}
    </div>
  );
}

