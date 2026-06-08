import type { SupabaseClient } from '@supabase/supabase-js';

export type SupplierDefaults = {
  role_id: string;
  position_id: string;
  department_id: string;
};

export type SupplierDefaultsResult =
  | SupplierDefaults
  | { error: string };

/**
 * Resolve fixed supplier assignment ids for procurement-provisioned accounts.
 * Server-only — never accept role/position/department from the client.
 */
export async function resolveSupplierDefaults(
  admin: SupabaseClient,
): Promise<SupplierDefaultsResult> {
  const [roleRes, posRes, deptRes] = await Promise.all([
    admin.from('roles').select('id').eq('name', 'supplier').maybeSingle(),
    admin.from('positions').select('id').eq('title', 'Supplier Representative').maybeSingle(),
    admin.from('departments').select('id').eq('code', 'GS').maybeSingle(),
  ]);

  if (roleRes.error) {
    return { error: `Supplier role lookup failed: ${roleRes.error.message}` };
  }
  if (posRes.error) {
    return { error: `Supplier position lookup failed: ${posRes.error.message}` };
  }
  if (deptRes.error) {
    return { error: `Supplier department lookup failed: ${deptRes.error.message}` };
  }

  const role_id = roleRes.data?.id;
  const position_id = posRes.data?.id;
  const department_id = deptRes.data?.id;

  if (!role_id || !position_id || !department_id) {
    return {
      error: 'Supplier role, position, or department is not configured in the database.',
    };
  }

  return { role_id, position_id, department_id };
}
