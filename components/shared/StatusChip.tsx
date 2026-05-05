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
  draft:             { bg: 'bg-[#F7F9FC]', text: 'text-[#40527A]', border: 'border-[#D8E2FF]', dot: 'bg-[#BFC7D5]' },
  pending:           { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-600' },
  in_review:         { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-600' },
  approved:          { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-600' },
  rejected:          { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-600' },
  validated:         { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-600' },
  failed_validation: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-600' },
  sent:              { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-600' },
  received:          { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-600' },
  completed:         { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-600' },
  cancelled:         { bg: 'bg-[#F7F9FC]', text: 'text-[#40527A]', border: 'border-[#D8E2FF]', dot: 'bg-[#BFC7D5]' },
};

interface StatusChipProps {
  status: StatusVariant;
  label?: string;
  size?: 'sm' | 'md';
}

export default function StatusChip({ status, label, size = 'md' }: StatusChipProps) {
  const colors = VARIANT_COLORS[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium border rounded-full',
        colors.bg,
        colors.text,
        colors.border,
        size === 'sm' ? 'text-xs px-2.5 py-1' : 'text-xs px-3 py-1.5'
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
      {label ?? VARIANT_LABELS[status]}
    </span>
  );
}
