import React from 'react';
import { cn } from '@/lib/utils';

export default function DetailInfoField({
  icon,
  label,
  value,
  className,
  valueClassName,
  labelTone = 'default',
  labelSpacing = 'normal',
  layout = 'stacked',
}: {
  icon?: React.ReactNode;
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
  valueClassName?: string;
  labelTone?: 'default' | 'muted';
  labelSpacing?: 'normal' | 'compact';
  layout?: 'stacked' | 'inline';
}) {
  if (layout === 'inline') {
    return (
      <div className={cn('flex items-start gap-2.5', className)}>
        {icon}
        <div className="min-w-0">
          <div className="text-xs text-pq-neutral-400 uppercase tracking-wide font-semibold">
            {label}
          </div>
          <div
            className={cn(
              'text-sm text-pq-neutral-900 mt-0.5 font-medium',
              valueClassName
            )}
          >
            {value}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div
        className={cn(
          'flex items-center gap-1.5',
          labelSpacing === 'compact' ? 'mb-0.5' : 'mb-1'
        )}
      >
        {icon}
        <div
          className={cn(
            'text-xs font-semibold uppercase tracking-wide',
            labelTone === 'muted' ? 'text-pq-neutral-400' : 'text-pq-neutral-500'
          )}
        >
          {label}
        </div>
      </div>
      <div className={cn('text-sm text-pq-neutral-900 font-medium', valueClassName)}>
        {value}
      </div>
    </div>
  );
}
