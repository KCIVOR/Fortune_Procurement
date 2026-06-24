import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type { SystemExpirySettings } from '@/types/database';

const db = supabase as any;

export async function getExpirySettings(): Promise<SystemExpirySettings> {
  const { data, error } = await db
    .from('system_expiry_settings')
    .select('*')
    .single();
  if (error) throw error;
  return data as SystemExpirySettings;
}

export async function updateExpirySettings(
  profile: UserProfile,
  settings: {
    accreditation_validity_days: number;
    product_validity_days: number;
  }
): Promise<void> {
  const { error } = await db
    .from('system_expiry_settings')
    .update({
      accreditation_validity_days: settings.accreditation_validity_days,
      product_validity_days:       settings.product_validity_days,
      updated_by:                  profile.id,
      updated_at:                  new Date().toISOString(),
    })
    .eq('id', true);
  if (error) throw error;
}

export function addDays(fromDate: Date, days: number): string {
  const d = new Date(fromDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0]; // 'YYYY-MM-DD'
}
