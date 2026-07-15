import { supabase } from './supabase';

export type SupplierAccreditationStatus =
  | 'none'
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'missing_documents'
  | 'approved'
  | 'rejected'
  | 'withdrawn'
  | 'expired';

export type SupplierSupplyType = 'raw_material' | 'normal' | 'service';

export interface SupplierAccount {
  id: string;
  full_name: string;
  email: string;
  active: boolean;
  payment_terms: string | null;
  /** Rev #1 (VAT): whether this supplier is VAT-registered; toggled by procurement/admin. */
  is_vat_registered: boolean;
  /** Exclusive supply classification; null until procurement sets it. */
  supplier_supply_type: SupplierSupplyType | null;
  created_at: string;
  accreditation_status: SupplierAccreditationStatus;
  accreditation_id: string | null;
  product_count: number;
}

export interface SupplierAccountFilters {
  search?: string;
  status?: 'all' | 'active' | 'inactive';
  accreditation?: 'all' | 'approved' | 'pending' | 'none' | 'rejected';
  supply_type?: 'all' | SupplierSupplyType;
  limit?: number;
  offset?: number;
}

const PROFILE_SELECT =
  'id, full_name, email, payment_terms, is_vat_registered, supplier_supply_type, created_at, active, role_id, roles(name)';

const PENDING_ACCREDITATION = new Set(['submitted', 'under_review', 'missing_documents']);
const REJECTED_ACCREDITATION = new Set(['rejected', 'withdrawn', 'expired']);

let cachedSupplierRoleId: string | null | undefined;

async function getSupplierRoleId(): Promise<string | null> {
  if (cachedSupplierRoleId !== undefined) return cachedSupplierRoleId;
  const { data, error } = await supabase.from('roles').select('id').eq('name', 'supplier').maybeSingle();
  if (error) {
    console.error('Error fetching supplier role id:', error);
    cachedSupplierRoleId = null;
    return null;
  }
  const roleId = data?.id ?? null;
  cachedSupplierRoleId = roleId;
  return roleId;
}

type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  payment_terms?: string | null;
  is_vat_registered?: boolean;
  supplier_supply_type?: string | null;
  created_at: string;
  active?: boolean;
  role_id: string | null;
  roles?: { name: string } | { name: string }[] | null;
};

function mapProfileRow(user: ProfileRow): ProfileRow & { roles?: { name: string } | null } {
  const roles = user.roles;
  const roleName = Array.isArray(roles) ? roles[0] : roles;
  return { ...user, roles: roleName ?? null };
}

function buildProfileQuery(supplierRoleId: string, filters: SupplierAccountFilters) {
  const { search, status = 'all', supply_type = 'all' } = filters;

  let query = supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('role_id', supplierRoleId)
    .order('full_name', { ascending: true });

  if (search?.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`full_name.ilike.${term},email.ilike.${term}`);
  }

  if (status === 'active') {
    query = query.eq('active', true);
  } else if (status === 'inactive') {
    query = query.eq('active', false);
  }

  if (supply_type !== 'all') {
    query = query.eq('supplier_supply_type', supply_type);
  }

  return query;
}

function latestAccreditationBySupplier(
  rows: { id: string; supplier_id: string; status: string; created_at: string }[],
): Record<string, { id: string; status: string }> {
  const sorted = [...rows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const map: Record<string, { id: string; status: string }> = {};
  for (const row of sorted) {
    if (!map[row.supplier_id]) {
      map[row.supplier_id] = { id: row.id, status: row.status };
    }
  }
  return map;
}

function toAccreditationStatus(raw: string | undefined): SupplierAccreditationStatus {
  if (!raw) return 'none';
  const allowed: SupplierAccreditationStatus[] = [
    'draft',
    'submitted',
    'under_review',
    'missing_documents',
    'approved',
    'rejected',
    'withdrawn',
    'expired',
  ];
  return allowed.includes(raw as SupplierAccreditationStatus)
    ? (raw as SupplierAccreditationStatus)
    : 'none';
}

function matchesAccreditationFilter(
  account: SupplierAccount,
  filter: SupplierAccountFilters['accreditation'],
): boolean {
  if (!filter || filter === 'all') return true;
  const s = account.accreditation_status;
  switch (filter) {
    case 'approved':
      return s === 'approved';
    case 'pending':
      return PENDING_ACCREDITATION.has(s);
    case 'none':
      return s === 'none' || s === 'draft';
    case 'rejected':
      return REJECTED_ACCREDITATION.has(s);
    default:
      return true;
  }
}

async function enrichProfiles(profiles: ProfileRow[]): Promise<SupplierAccount[]> {
  if (profiles.length === 0) return [];

  const ids = profiles.map((p) => p.id);

  const [accRes, prodRes] = await Promise.all([
    supabase
      .from('supplier_accreditations')
      .select('id, supplier_id, status, created_at')
      .in('supplier_id', ids),
    supabase.from('supplier_products').select('supplier_id').in('supplier_id', ids),
  ]);

  if (accRes.error) console.error('Error fetching supplier accreditations:', accRes.error);
  if (prodRes.error) console.error('Error fetching supplier products:', prodRes.error);

  const accMap = latestAccreditationBySupplier((accRes.data ?? []) as {
    id: string;
    supplier_id: string;
    status: string;
    created_at: string;
  }[]);

  const productCounts: Record<string, number> = {};
  for (const id of ids) productCounts[id] = 0;
  for (const row of prodRes.data ?? []) {
    const sid = (row as { supplier_id: string }).supplier_id;
    productCounts[sid] = (productCounts[sid] ?? 0) + 1;
  }

  return profiles.map((p) => {
    const latest = accMap[p.id];
    const rawStatus = latest?.status;
    const accreditation_status = toAccreditationStatus(rawStatus);
    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      active: p.active ?? true,
      payment_terms: p.payment_terms ?? null,
      is_vat_registered: p.is_vat_registered === true,
      supplier_supply_type: (() => {
        const v = p.supplier_supply_type;
        if (v === 'raw_material' || v === 'normal' || v === 'service') return v;
        return null;
      })(),
      created_at: p.created_at,
      accreditation_status,
      accreditation_id:
        latest && accreditation_status !== 'none' && accreditation_status !== 'draft'
          ? latest.id
          : null,
      product_count: productCounts[p.id] ?? 0,
    };
  });
}

export async function listSupplierAccountsWithCount(
  filters: SupplierAccountFilters = {},
): Promise<{ suppliers: SupplierAccount[]; total_count: number }> {
  const { limit = 20, offset = 0, accreditation = 'all' } = filters;

  const supplierRoleId = await getSupplierRoleId();
  if (!supplierRoleId) return { suppliers: [], total_count: 0 };

  const { data, error } = await buildProfileQuery(supplierRoleId, filters);

  if (error) {
    console.error('Error fetching supplier accounts:', error);
    return { suppliers: [], total_count: 0 };
  }

  const profiles = (data ?? []).map((row) => mapProfileRow(row as ProfileRow));
  const enriched = await enrichProfiles(profiles);
  const filtered = enriched.filter((row) => matchesAccreditationFilter(row, accreditation));
  const total_count = filtered.length;
  const suppliers = filtered.slice(offset, offset + limit);

  return { suppliers, total_count };
}

export async function getSupplierAccountById(id: string): Promise<SupplierAccount | null> {
  const supplierRoleId = await getSupplierRoleId();
  if (!supplierRoleId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching supplier account:', error);
    return null;
  }

  if (!data) return null;

  const profile = mapProfileRow(data as ProfileRow);
  if (profile.role_id !== supplierRoleId || profile.roles?.name !== 'supplier') {
    return null;
  }

  const [enriched] = await enrichProfiles([profile]);
  return enriched ?? null;
}
