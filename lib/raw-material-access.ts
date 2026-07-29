import type { UserProfile } from '@/types/auth';

/** Department code for Planning (raw materials requestors). */
export const PLANNING_DEPARTMENT_CODE = 'PLAN';

/** Position title for Planning staff who may flag raw material lines on PR1. */
export const PLANNING_STAFF_POSITION = 'Planning Staff';

/**
 * Raw material requisitions are Planning-only (Final_Workflow.md).
 * Procurement may still reclassify lines on PR2 after warehouse handoff.
 */
export function canRequestRawMaterials(
  profile: UserProfile | null | undefined,
): boolean {
  if (!profile) return false;
  if (profile.role === 'admin') return true;
  if (profile.position === PLANNING_STAFF_POSITION) return true;
  const dept = profile.department?.trim().toLowerCase();
  return dept === 'planning';
}

export function assertRawMaterialRequestAccess(
  profile: UserProfile,
  items: Array<{ is_raw_material?: boolean }>,
): void {
  if (canRequestRawMaterials(profile)) return;
  if (items.some((i) => i.is_raw_material === true)) {
    throw new Error('Only Planning may request raw material items.');
  }
}

export function sanitizeRawMaterialFlags<T extends { is_raw_material?: boolean }>(
  profile: UserProfile,
  items: T[],
): T[] {
  if (canRequestRawMaterials(profile)) return items;
  return items.map((item) => ({ ...item, is_raw_material: false }));
}

/**
 * Phase 6: PR1 no longer supports raw material items for any role — raw
 * material requisitions go through Planning's PR2-direct form instead
 * (createRawMaterialPR2 in lib/pr2-planning.ts). Distinct from
 * sanitizeRawMaterialFlags/assertRawMaterialRequestAccess above, which stay
 * in place for the unrelated PR2-direct access gate.
 */
export function sanitizePR1RawMaterialFlags<T extends { is_raw_material?: boolean }>(
  items: T[],
): T[] {
  return items.map((item) => ({ ...item, is_raw_material: false }));
}

export function assertNoPR1RawMaterialItems(
  items: Array<{ is_raw_material?: boolean }>,
): void {
  if (items.some((i) => i.is_raw_material === true)) {
    throw new Error('PR1 no longer supports raw material items. Use the Raw Materials request form (Planning) instead.');
  }
}
