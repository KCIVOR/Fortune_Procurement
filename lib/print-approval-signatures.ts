import type { ApprovalAction } from '@/types/approvals';

/** Latest action for a step (by acted_at), for print views when multiple rows exist. */
export function latestActionForStep<
  T extends { step_order: number; acted_at: string }
>(actions: T[], stepOrder: number): T | null {
  const matches = actions.filter(a => a.step_order === stepOrder);
  if (matches.length === 0) return null;
  return [...matches].sort(
    (a, b) => new Date(b.acted_at).getTime() - new Date(a.acted_at).getTime()
  )[0];
}

export function labelForApprovalAction(action: ApprovalAction): string {
  switch (action) {
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'revision_requested':
      return 'Revision Requested';
  }
}
