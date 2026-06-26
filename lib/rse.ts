import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type { RseRecord } from '@/types/database';
import { createNotification, type NotificationInsert } from '@/lib/notifications';

const db = supabase as any;

// ─── Input / queue types ──────────────────────────────────────────────────────

export interface CreateRSEInput {
  supplier_id:         string;
  supplier_product_id: string;
  accreditation_id?:   string | null;
  reason?:             string | null;
  procurement_notes?:  string | null;
  /** If provided, RSE is immediately assigned and status = 'assigned'. */
  assigned_to?:        string | null;
}

/** RSE row enriched with product name, supplier name, and assignee name. */
export interface RSEQueueRow extends RseRecord {
  product_name:       string | null;
  supplier_full_name: string | null;
  assigned_to_name:   string | null;
}

// ─── Local helper: fan-out notification to all users of a given role ──────────
async function notifyByRole(
  roleName:     string,
  notification: Omit<NotificationInsert, 'user_id'>
): Promise<void> {
  const { data: role } = await db
    .from('roles')
    .select('id')
    .eq('name', roleName)
    .maybeSingle();
  if (!role?.id) return;

  const { data: recipients } = await db
    .from('profiles')
    .select('id')
    .eq('role_id', role.id);
  if (!recipients || (recipients as any[]).length === 0) return;

  const rows = (recipients as any[]).map(p => ({
    ...notification,
    user_id: p.id as string,
    read:    false,
  }));
  await db.from('notifications').insert(rows);
}

// ─── Shared row enrichment ────────────────────────────────────────────────────

async function enrichRSERows(rows: any[]): Promise<RSEQueueRow[]> {
  const productIds    = Array.from(new Set(rows.map(r => r.supplier_product_id as string)));
  const supplierIds   = Array.from(new Set(rows.map(r => r.supplier_id as string)));
  const assigneeIds   = Array.from(
    new Set(rows.map(r => r.assigned_to as string | null).filter((id): id is string => !!id))
  );
  const allProfileIds = Array.from(new Set([...supplierIds, ...assigneeIds]));

  const [productsRes, profilesRes] = await Promise.all([
    productIds.length > 0
      ? db.from('supplier_products').select('id, product_name').in('id', productIds)
      : Promise.resolve({ data: [] }),
    allProfileIds.length > 0
      ? db.from('profiles').select('id, full_name').in('id', allProfileIds)
      : Promise.resolve({ data: [] }),
  ]);

  const productMap: Record<string, string> = Object.fromEntries(
    ((productsRes.data ?? []) as any[]).map(p => [p.id as string, p.product_name as string])
  );
  const profileMap: Record<string, string> = Object.fromEntries(
    ((profilesRes.data ?? []) as any[]).map(p => [p.id as string, p.full_name as string])
  );

  return rows.map(row => ({
    ...row,
    product_name:       productMap[row.supplier_product_id as string]               ?? null,
    supplier_full_name: profileMap[row.supplier_id as string]                       ?? null,
    assigned_to_name:   row.assigned_to ? (profileMap[row.assigned_to as string] ?? null) : null,
  })) as RSEQueueRow[];
}

// ─── Procurement: create RSE from a supplier product ─────────────────────────
// Also sets supplier_products.status = pending_tsqa.

export async function createRSEFromSupplierProduct(
  input:   CreateRSEInput,
  profile: UserProfile
): Promise<RseRecord> {
  const { data: spRow, error: spErr } = await db
    .from('supplier_products')
    .select('status')
    .eq('id', input.supplier_product_id)
    .maybeSingle();
  if (spErr) throw spErr;
  if (!spRow) throw new Error('Product not found.');
  if ((spRow as any).status === 'withdrawn') {
    throw new Error('This product was withdrawn by the supplier and cannot be sent for TSQA evaluation.');
  }

  const now        = new Date().toISOString();
  const status     = input.assigned_to ? 'assigned' : 'created';
  const assignedAt = input.assigned_to ? now         : null;

  const { data, error } = await db
    .from('rse_records')
    .insert({
      supplier_id:         input.supplier_id,
      supplier_product_id: input.supplier_product_id,
      accreditation_id:    input.accreditation_id  ?? null,
      status,
      created_by:          profile.id,
      assigned_to:         input.assigned_to         ?? null,
      assigned_at:         assignedAt,
      reason:              input.reason              ?? null,
      procurement_notes:   input.procurement_notes   ?? null,
      created_at:          now,
      updated_at:          now,
    })
    .select('*')
    .single();
  if (error) throw error;

  // Set product status to pending_tsqa
  await db
    .from('supplier_products')
    .update({ status: 'pending_tsqa', updated_at: now })
    .eq('id', input.supplier_product_id);

  const rseRecord = data as RseRecord;

  // Audit log (best-effort)
  const auditAction = input.assigned_to ? 'RSE_ASSIGNED_TO_TSQA' : 'RSE_CREATED';
  try {
    const { error: auditErr } = await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        auditAction,
      document_type: 'RSE',
      document_id:   rseRecord.id,
      payload: {
        rse_number:          rseRecord.rse_number,
        supplier_product_id: input.supplier_product_id,
        assigned_to:         input.assigned_to ?? null,
        creator:             profile.full_name,
      },
    });
    if (auditErr) console.warn(auditErr);
  } catch {
    /* best-effort audit */
  }

  // If immediately assigned, notify the TSQA user (best-effort)
  if (input.assigned_to) {
    try {
      await createNotification({
        user_id:       input.assigned_to,
        title:         'New RSE Assigned to You',
        body:          `RSE ${rseRecord.rse_number} has been assigned to you for product evaluation.`,
        type:          'action_required',
        document_type: 'RSE',
        document_id:   rseRecord.id,
        action_url:    '/tsqa/rse',
      });
    } catch { /* non-blocking */ }
  }

  return rseRecord;
}

// ─── Any role with RLS access: fetch RSE by id ───────────────────────────────

export async function getRSEById(rseId: string): Promise<RseRecord | null> {
  const { data, error } = await db
    .from('rse_records')
    .select('*')
    .eq('id', rseId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as RseRecord | null;
}

// ─── Procurement: full RSE queue (all records) ───────────────────────────────

export async function getRSEQueueForProcurement(): Promise<RSEQueueRow[]> {
  const { data, error } = await db
    .from('rse_records')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!data || (data as any[]).length === 0) return [];
  return enrichRSERows(data as any[]);
}

// ─── TSQA: own assigned queue (assigned to me + unassigned open records) ─────

export async function getRSEQueueForTSQA(profile: UserProfile): Promise<RSEQueueRow[]> {
  const { data, error } = await db
    .from('rse_records')
    .select('*')
    .or(`assigned_to.eq.${profile.id},status.eq.created`)
    .in('status', ['created', 'assigned', 'under_review'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!data || (data as any[]).length === 0) return [];
  return enrichRSERows(data as any[]);
}

// ─── Procurement: assign an unassigned RSE to a TSQA user ────────────────────

export async function assignRSEToTSQA(
  rseId:      string,
  tsqaUserId: string,
  profile:    UserProfile
): Promise<void> {
  const { data: rse, error: fetchErr } = await db
    .from('rse_records')
    .select('rse_number')
    .eq('id', rseId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!rse) throw new Error('RSE not found.');

  const now = new Date().toISOString();
  const { error } = await db
    .from('rse_records')
    .update({
      assigned_to: tsqaUserId,
      assigned_at: now,
      status:      'assigned',
      updated_at:  now,
    })
    .eq('id', rseId);
  if (error) throw error;

  // Audit log (best-effort)
  try {
    const { error: auditErr } = await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'RSE_ASSIGNED_TO_TSQA',
      document_type: 'RSE',
      document_id:   rseId,
      payload:       { rse_number: (rse as any).rse_number, assigned_to: tsqaUserId, by: profile.full_name },
    });
    if (auditErr) console.warn(auditErr);
  } catch {
    /* best-effort audit */
  }

  // Notify assigned TSQA user (best-effort)
  try {
    await createNotification({
      user_id:       tsqaUserId,
      title:         'RSE Assigned to You',
      body:          `RSE ${(rse as any).rse_number as string} has been assigned to you for product evaluation.`,
      type:          'action_required',
      document_type: 'RSE',
      document_id:   rseId,
      action_url:    '/tsqa/rse',
    });
  } catch { /* non-blocking */ }
}

// ─── TSQA: begin active review ────────────────────────────────────────────────
// Transitions status from assigned or created → under_review.
// Also assigns the RSE to the current TSQA user if not already assigned.

export async function startRSEReview(
  rseId:   string,
  profile: UserProfile
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db
    .from('rse_records')
    .update({
      status:      'under_review',
      assigned_to: profile.id,
      assigned_at: now,
      updated_at:  now,
    })
    .eq('id', rseId)
    .in('status', ['assigned', 'created']);
  if (error) throw error;

  // Audit log (best-effort)
  try {
    const { error: auditErr } = await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'RSE_REVIEW_STARTED',
      document_type: 'RSE',
      document_id:   rseId,
      payload:       { reviewer: profile.full_name },
    });
    if (auditErr) console.warn(auditErr);
  } catch {
    /* best-effort audit */
  }
}

// ─── Procurement: list available TSQA users for assignment dropdown ───────────

export interface TSQAUserOption {
  id:        string;
  full_name: string;
}

export async function listTSQAUsers(): Promise<TSQAUserOption[]> {
  const { data: role } = await db
    .from('roles')
    .select('id')
    .eq('name', 'tsqa')
    .maybeSingle();
  if (!role?.id) return [];

  const { data, error } = await db
    .from('profiles')
    .select('id, full_name')
    .eq('role_id', role.id)
    .order('full_name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as TSQAUserOption[];
}

// ─── TSQA: stat counts for dashboard ─────────────────────────────────────────
// Returns counts for all RSE records visible to the current TSQA user.
// Active counts mirror getRSEQueueForTSQA; completed counts query separately.

export interface RSEStats {
  created:      number;
  assigned:     number;
  under_review: number;
  passed:       number;
  failed:       number;
}

export async function getRSEStatsForTSQA(profile: UserProfile): Promise<RSEStats> {
  // One query per terminal status to keep it simple and avoid GROUP BY complexities.
  const statuses: Array<keyof RSEStats> = ['created', 'assigned', 'under_review', 'passed', 'failed'];
  const results = await Promise.all(
    statuses.map(status =>
      db
        .from('rse_records')
        .select('id', { count: 'exact', head: true })
        .or(`assigned_to.eq.${profile.id},created_by.eq.${profile.id}`)
        .eq('status', status)
        .then(({ count }: { count: number | null }) => ({ status, count: count ?? 0 }))
    )
  );
  return Object.fromEntries(results.map(r => [r.status, r.count])) as RSEStats;
}

// ─── TSQA: completed RSE history (passed/failed/cancelled) ───────────────────

export async function getRSEHistoryForTSQA(profile: UserProfile): Promise<RSEQueueRow[]> {
  const { data, error } = await db
    .from('rse_records')
    .select('*')
    .or(`assigned_to.eq.${profile.id},created_by.eq.${profile.id}`)
    .in('status', ['passed', 'failed', 'cancelled'])
    .order('completed_at', { ascending: false });
  if (error) throw error;
  if (!data || (data as any[]).length === 0) return [];
  return enrichRSERows(data as any[]);
}

// ─── Any role: RSE records linked to a specific product ──────────────────────

export interface RSEWithReview extends RseRecord {
  product_name:       string | null;
  supplier_full_name: string | null;
  assigned_to_name:   string | null;
  tsqa_result:        'passed' | 'failed' | null;
  tsqa_remarks:       string | null;
  tsqa_test_findings: string | null;
  tsqa_reviewed_at:   string | null;
}

export async function getRSERecordsByProductId(
  productId: string
): Promise<RSEWithReview[]> {
  const { data, error } = await db
    .from('rse_records')
    .select('*')
    .eq('supplier_product_id', productId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!data || (data as any[]).length === 0) return [];

  const base = await enrichRSERows(data as any[]);

  // Fetch tsqa_reviews for each rse
  const rseIds = base.map(r => r.id);
  const { data: reviews } = await db
    .from('tsqa_reviews')
    .select('rse_id, result, remarks, test_findings, reviewed_at')
    .in('rse_id', rseIds)
    .order('reviewed_at', { ascending: false });

  // Map most-recent review per RSE
  const reviewMap: Record<string, any> = {};
  for (const rev of (reviews ?? []) as any[]) {
    if (!reviewMap[rev.rse_id as string]) reviewMap[rev.rse_id as string] = rev;
  }

  return base.map(row => ({
    ...row,
    tsqa_result:        reviewMap[row.id]?.result        ?? null,
    tsqa_remarks:       reviewMap[row.id]?.remarks       ?? null,
    tsqa_test_findings: reviewMap[row.id]?.test_findings ?? null,
    tsqa_reviewed_at:   reviewMap[row.id]?.reviewed_at   ?? null,
  }));
}

// ─── Procurement: products linked to a specific accreditation ─────────────────

export interface ProductWithRSESummary {
  id:           string;
  product_name: string;
  product_code: string | null;
  status:       string;
  verified_at:  string | null;
  rejected_at:  string | null;
  latest_rse_status:  string | null;
  latest_tsqa_result: string | null;
}

export async function getProductsByAccreditationId(
  accreditationId: string
): Promise<ProductWithRSESummary[]> {
  const { data: products, error } = await db
    .from('supplier_products')
    .select('id, product_name, product_code, status, verified_at, rejected_at')
    .eq('accreditation_id', accreditationId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!products || (products as any[]).length === 0) return [];

  const productIds = (products as any[]).map((p: any) => p.id as string);

  // Get most-recent RSE per product
  const { data: rseData } = await db
    .from('rse_records')
    .select('id, supplier_product_id, status')
    .in('supplier_product_id', productIds)
    .order('created_at', { ascending: false });

  const latestRsePerProduct: Record<string, any> = {};
  for (const rse of (rseData ?? []) as any[]) {
    if (!latestRsePerProduct[rse.supplier_product_id as string]) {
      latestRsePerProduct[rse.supplier_product_id as string] = rse;
    }
  }

  // Get tsqa_reviews for those RSE records
  const rseIds = Object.values(latestRsePerProduct).map((r: any) => r.id as string);
  const reviewMap: Record<string, string | null> = {};
  if (rseIds.length > 0) {
    const { data: reviews } = await db
      .from('tsqa_reviews')
      .select('rse_id, result')
      .in('rse_id', rseIds)
      .order('reviewed_at', { ascending: false });
    for (const rev of (reviews ?? []) as any[]) {
      if (!reviewMap[rev.rse_id as string]) reviewMap[rev.rse_id as string] = rev.result as string;
    }
  }

  return (products as any[]).map((p: any) => {
    const latestRse = latestRsePerProduct[p.id as string];
    return {
      id:                  p.id as string,
      product_name:        p.product_name as string,
      product_code:        p.product_code as string | null,
      status:              p.status as string,
      verified_at:         p.verified_at as string | null,
      rejected_at:         p.rejected_at as string | null,
      latest_rse_status:   latestRse ? (latestRse.status as string) : null,
      latest_tsqa_result:  latestRse ? (reviewMap[latestRse.id as string] ?? null) : null,
    };
  });
}

// ─── Procurement: cancel RSE ──────────────────────────────────────────────────
// Only allowed while the RSE is still active (not yet passed/failed/cancelled).

export async function cancelRSE(
  rseId:   string,
  profile: UserProfile,
  reason?: string
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db
    .from('rse_records')
    .update({
      status:     'cancelled',
      reason:     reason ?? null,
      updated_at: now,
    })
    .eq('id', rseId)
    .in('status', ['created', 'assigned', 'under_review']);
  if (error) throw error;
}
