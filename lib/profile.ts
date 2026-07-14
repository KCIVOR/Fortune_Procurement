import { supabase } from '@/lib/supabase';
import type { UserProfile, AppRole, AppPosition } from '@/types/auth';

export async function updateOwnFullName(userId: string, fullName: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = supabase.from('profiles') as any;
  const { error } = await table.update({ full_name: fullName }).eq('id', userId);
  if (error) throw new Error(error.message);
}

export async function updateOwnPaymentTerms(
  userId: string,
  paymentTerms: string | null,
  role?: AppRole,
): Promise<void> {
  if (role && role !== 'supplier') {
    throw new Error('Only supplier accounts can set default payment terms.');
  }
  const trimmed = paymentTerms?.trim() ?? '';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const table = supabase.from('profiles') as any;
  const { error } = await table
    .update({ payment_terms: trimmed || null })
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      email,
      role_id,
      position_id,
      department_id,
      active,
      payment_terms,
      supplier_supply_type,
      roles:role_id ( name ),
      positions:position_id ( title ),
      departments:department_id ( name )
    `)
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as any;
  const supplyType = row.supplier_supply_type;
  const supplier_supply_type =
    supplyType === 'raw_material' || supplyType === 'normal' || supplyType === 'service'
      ? supplyType
      : null;

  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role: row.roles?.name as AppRole,
    role_id: row.role_id,
    position: row.positions?.title as AppPosition,
    position_id: row.position_id,
    department: row.departments?.name,
    department_id: row.department_id,
    active: row.active ?? true,
    payment_terms: row.payment_terms ?? null,
    supplier_supply_type,
  };
}
