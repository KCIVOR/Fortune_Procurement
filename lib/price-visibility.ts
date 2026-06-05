import type { AppPosition, AppRole, UserProfile } from '@/types/auth';

/** Shown when the user is not allowed to see commercial amounts. */
export const PRICE_HIDDEN_LABEL = 'Price hidden';

/** Approver positions that may view commercial amounts (D7). */
export const COMMERCIAL_PRICING_APPROVER_POSITIONS: readonly AppPosition[] = [
  'Director',
  'Finance Director',
];

/** Logistics routes (D2) — Director only, not Finance Director. */
export function isDirectorApprover(
  role: AppRole | undefined | null,
  position: AppPosition | string | undefined | null,
): boolean {
  return role === 'approver' && position === 'Director';
}

export function isApproverWithCommercialPricing(
  role: AppRole | undefined | null,
  position: AppPosition | string | undefined | null,
): boolean {
  return (
    role === 'approver' &&
    COMMERCIAL_PRICING_APPROVER_POSITIONS.includes(position as AppPosition)
  );
}

/**
 * Procurement, admin, and approver + Director or Finance Director may see unit
 * prices, line totals, grand totals, and canvass amounts (not supplier portal).
 */
export function canViewCommercialPricing(
  profile: Pick<UserProfile, 'role' | 'position'> | null | undefined,
): boolean {
  if (!profile) return false;
  if (profile.role === 'admin' || profile.role === 'procurement') return true;
  if (isApproverWithCommercialPricing(profile.role, profile.position)) return true;
  return false;
}

/** Alias used on PR2 approval for competing supplier quotes. */
export function canViewCanvassPricing(
  profile: Pick<UserProfile, 'role' | 'position'> | null | undefined,
): boolean {
  return canViewCommercialPricing(profile);
}

export function formatCommercialAmount(
  amount: number,
  canView: boolean,
  options?: Intl.NumberFormatOptions,
): string {
  if (!canView) return PRICE_HIDDEN_LABEL;
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    ...options,
  })}`;
}
