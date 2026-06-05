import { supabase } from '@/lib/supabase';

/** JWT user id for RLS columns (must match auth.uid(), not a stale profile snapshot). */
export async function requireAuthUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user?.id) {
    throw new Error('Not authenticated');
  }
  return user.id;
}
