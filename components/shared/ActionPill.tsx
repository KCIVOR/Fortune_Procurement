import React from 'react';
import { CheckCircle2, RotateCcw, Circle as XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionPillProps {
  action?: string | null;
  className?: string;
}

export default function ActionPill({ action, className }: ActionPillProps) {
  if (action === 'approved') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5',
          className
        )}
      >
        <CheckCircle2 className="w-3 h-3" />
        Approved
      </span>
    );
  }

  if (action === 'rejected') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5',
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
        'inline-flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5',
        className
      )}
    >
      <RotateCcw className="w-3 h-3" />
      Revision Requested
    </span>
  );
}

