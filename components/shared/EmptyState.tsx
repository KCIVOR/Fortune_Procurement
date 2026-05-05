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
      <div className="w-12 h-12 rounded-[4px] bg-[#F7F9FC] border border-[#D8E2FF] flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-[#BFC7D5]" />
      </div>
      <h3 className="text-base font-semibold text-[#0F1F3A] mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-[#40527A] max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
