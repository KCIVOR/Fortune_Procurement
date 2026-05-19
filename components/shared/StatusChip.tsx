import { cn } from '@/lib/utils';

export type StatusVariant =
  | 'draft'
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'validated'
  | 'failed_validation'
  | 'sent'
  | 'received'
  | 'completed'
  | 'cancelled';

const VARIANT_LABELS: Record<StatusVariant, string> = {
  draft:             'Draft',
  pending:           'Pending',
  in_review:         'In Review',
  approved:          'Approved',
  rejected:          'Rejected',
  validated:         'Validated',
  failed_validation: 'Failed Validation',
  sent:              'Sent',
  received:          'Received',
  completed:         'Completed',
  cancelled:         'Cancelled',
};

const VARIANT_COLORS: Record<StatusVariant, { bg: string; text: string; border: string; dot: string }> = {
  draft:             { bg: 'bg-pq-neutral-50', text: 'text-pq-neutral-500', border: 'border-pq-neutral-200', dot: 'bg-pq-neutral-400' },
  pending:           { bg: 'bg-pq-warning-100', text: 'text-pq-warning-600', border: 'border-pq-warning-100', dot: 'bg-pq-warning-600' },
  in_review:         { bg: 'bg-pq-primary-50', text: 'text-pq-primary-700', border: 'border-pq-primary-200', dot: 'bg-pq-primary-600' },
  approved:          { bg: 'bg-pq-success-100', text: 'text-pq-success-600', border: 'border-pq-success-100', dot: 'bg-pq-success-600' },
  rejected:          { bg: 'bg-pq-danger-100', text: 'text-pq-danger-600', border: 'border-pq-danger-100', dot: 'bg-pq-danger-600' },
  validated:         { bg: 'bg-pq-success-100', text: 'text-pq-success-600', border: 'border-pq-success-100', dot: 'bg-pq-success-600' },
  failed_validation: { bg: 'bg-pq-danger-100', text: 'text-pq-danger-600', border: 'border-pq-danger-100', dot: 'bg-pq-danger-600' },
  sent:              { bg: 'bg-pq-primary-50', text: 'text-pq-primary-700', border: 'border-pq-primary-200', dot: 'bg-pq-primary-600' },
  received:          { bg: 'bg-pq-success-100', text: 'text-pq-success-600', border: 'border-pq-success-100', dot: 'bg-pq-success-600' },
  completed:         { bg: 'bg-pq-success-100', text: 'text-pq-success-600', border: 'border-pq-success-100', dot: 'bg-pq-success-600' },
  cancelled:         { bg: 'bg-pq-neutral-50', text: 'text-pq-neutral-500', border: 'border-pq-neutral-200', dot: 'bg-pq-neutral-400' },
};

interface StatusChipProps {
  status: StatusVariant;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function StatusChip({ status, label, size = 'md', className }: StatusChipProps) {
  const colors = VARIANT_COLORS[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium border rounded-full',
        colors.bg,
        colors.text,
        colors.border,
        size === 'sm'
          ? 'text-xs px-2.5 py-1'
          : size === 'lg'
            ? 'text-sm px-3.5 py-2'
            : 'text-xs px-3 py-1.5',
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
      {label ?? VARIANT_LABELS[status]}
    </span>
  );
}
