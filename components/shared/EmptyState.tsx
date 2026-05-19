import { cn } from '@/lib/utils';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ElementType;
  className?: string;
}

export default function EmptyState({
  title = 'Nothing here yet',
  description,
  action,
  icon: Icon = Inbox,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-10 px-6 text-center', className)}>
      <div className="w-12 h-12 rounded-md bg-pq-neutral-50 border border-pq-neutral-200 flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-pq-neutral-400" />
      </div>
      <h3 className="text-base font-semibold text-pq-neutral-900 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-pq-neutral-500 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
