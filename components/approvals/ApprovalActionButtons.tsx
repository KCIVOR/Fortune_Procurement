import type { ElementType } from 'react';

export const APPROVAL_ACTION_ROW_CLASS = 'grid grid-cols-3 gap-2';

type ApprovalActionVariant = 'approve' | 'revise' | 'reject';

const variantStyles: Record<ApprovalActionVariant, string> = {
  approve: 'bg-pq-success-600 hover:bg-pq-success-600 text-white border-pq-success-600',
  revise: 'bg-white hover:bg-orange-50 text-orange-600 border-orange-300 hover:border-orange-400',
  reject: 'bg-white hover:bg-pq-danger-100 text-pq-danger-600 border-red-300 hover:border-red-400',
};

export function ApprovalActionButton({
  icon: Icon,
  label,
  variant,
  onClick,
  disabled,
}: {
  icon: ElementType;
  label: string;
  variant: ApprovalActionVariant;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex w-full min-w-0 flex-col items-center justify-center gap-1 rounded-md border px-1.5 py-2.5 text-[11px] font-semibold leading-tight transition disabled:opacity-50 ${variantStyles[variant]}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="text-center">{label}</span>
    </button>
  );
}
