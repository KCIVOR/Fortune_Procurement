import type { UserProfile } from '@/types/auth';

/** Phase 4H — employees may only view their own PR1 detail (RLS also enforces). */
export function canViewPr1Detail(
  profile: UserProfile,
  pr1: { requisitioner_id: string },
): boolean {
  if (profile.role !== 'employee') return true;
  return profile.id === pr1.requisitioner_id;
}
