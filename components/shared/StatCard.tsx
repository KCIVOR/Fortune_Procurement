import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export interface StatCardProps {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  trend?: {
    value: string;
    direction: 'up' | 'down';
  };
  accent?: 'blue' | 'green' | 'amber' | 'red';
  isLoading?: boolean;
  className?: string;
}

export function StatCard({
  icon,
  label,
  value,
  subtext,
  trend,
  accent = 'blue',
  isLoading = false,
  className,
}: StatCardProps) {
  if (isLoading) {
    return (
      <div className={cn(
        'relative bg-pq-white border border-pq-neutral-200 rounded-xl p-5 shadow-sm overflow-hidden',
        'min-h-[120px] h-full flex flex-col',
        className
      )}>
        {/* Accent strip */}
        <div className={cn(
          'absolute top-0 left-0 right-0 h-[3px]',
          accent === 'blue' && 'bg-gradient-to-r from-pq-primary-500 to-pq-accent-500',
          accent === 'green' && 'bg-gradient-to-r from-pq-success-600 to-pq-success-500',
          accent === 'amber' && 'bg-gradient-to-r from-pq-warning-600 to-pq-warning-500',
          accent === 'red' && 'bg-gradient-to-r from-pq-danger-600 to-pq-danger-500'
        )} />
        
        <div className="flex justify-between items-start mb-2">
          <Skeleton className="h-4 w-24 bg-pq-neutral-200" />
          <Skeleton className="h-8 w-8 rounded-md bg-pq-neutral-200" />
        </div>
        <Skeleton className="h-8 w-32 mb-2 flex-grow bg-pq-neutral-200" />
        <Skeleton className="h-4 w-40 bg-pq-neutral-200" />
      </div>
    );
  }

  return (
    <div className={cn(
      'relative bg-pq-white border border-pq-neutral-200 rounded-xl p-5 shadow-sm overflow-hidden transition hover:shadow-md hover:border-pq-neutral-300',
      'min-h-[120px] h-full flex flex-col',
      className
    )}>
      {/* Accent strip */}
      <div className={cn(
        'absolute top-0 left-0 right-0 h-[3px]',
        accent === 'blue' && 'bg-gradient-to-r from-pq-primary-500 to-pq-accent-500',
        accent === 'green' && 'bg-gradient-to-r from-pq-success-600 to-pq-success-500',
        accent === 'amber' && 'bg-gradient-to-r from-pq-warning-600 to-pq-warning-500',
        accent === 'red' && 'bg-gradient-to-r from-pq-danger-600 to-pq-danger-500'
      )} />

      <div className="flex justify-between items-start">
        <div className="text-xs font-bold uppercase tracking-wider text-pq-neutral-500 mb-2">
          {label}
        </div>
        {icon && <div className="text-pq-neutral-400 shrink-0">{icon}</div>}
      </div>

      <div className="text-3xl font-extrabold text-pq-neutral-900 tracking-tight leading-none mb-2 truncate flex-grow flex items-center" title={String(value)}>
        {value}
      </div>

      {(subtext || trend) && (
        <div className="text-xs text-pq-neutral-500 flex items-center gap-1.5 mt-auto">
          {trend && (
            <span className={cn(
              'inline-flex items-center font-bold',
              trend.direction === 'up' ? 'text-pq-success-600' : 'text-pq-danger-600'
            )}>
              {trend.direction === 'up' ? '↑' : '↓'} {trend.value}
            </span>
          )}
          {subtext && <span>{subtext}</span>}
        </div>
      )}
    </div>
  );
}
