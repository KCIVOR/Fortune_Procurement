import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type { RseRecord, TsqaReview } from '@/types/database';
import { createNotification, type NotificationInsert } from '@/lib/notifications';

const db = supabase as any;

// ─── Input type ───────────────────────────────────────────────────────────────

export interface TSQAResultInput {
  rse_id:         string;
  result:         'passed' | 'failed';
  remarks?:       string | null;
  test_findings?: string | null;
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

// ─── TSQA: get own assigned RSE records (active only) ─────────────────────────

export async function getAssignedRSEForCurrentTSQA(
  profile: UserProfile
): Promise<RseRecord[]> {
  const { data, error } = await db
    .from('rse_records')
    .select('*')
    .or(`assigned_to.eq.${profile.id},status.eq.created`)
    .in('status', ['created', 'assigned', 'under_review'])
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as RseRecord[];
}

// ─── TSQA: get review record for an RSE (most recent) ────────────────────────

export async function getTSQAReviewByRSEId(
  rseId: string
): Promise<TsqaReview | null> {
  const { data, error } = await db
    .from('tsqa_reviews')
    .select('*')
    .eq('rse_id', rseId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as TsqaReview | null;
}

// ─── TSQA: submit pass / fail evaluation result ───────────────────────────────
// Upserts tsqa_reviews (one per reviewer per RSE), propagates result to
// rse_records and supplier_products.
//
// IMPORTANT: supplier_accreditations is NOT touched here.
// Procurement owns accreditation approval/rejection (see lib/accreditation.ts).

export async function submitTSQAResult(
  input:   TSQAResultInput,
  profile: UserProfile
): Promise<void> {
  const now = new Date().toISOString();

  // 1. Fetch RSE for cascade targets and notification data
  const { data: rse, error: rseErr } = await db
    .from('rse_records')
    .select('supplier_product_id, supplier_id, rse_number')
    .eq('id', input.rse_id)
    .maybeSingle();
  if (rseErr) throw rseErr;
  if (!rse) throw new Error('RSE record not found.');

  // 2. Upsert tsqa_reviews (one review per reviewer per RSE)
  const { data: existing } = await db
    .from('tsqa_reviews')
    .select('id')
    .eq('rse_id', input.rse_id)
    .eq('reviewer_id', profile.id)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await db.from('tsqa_reviews').update({
      result:        input.result,
      remarks:       input.remarks       ?? null,
      test_findings: input.test_findings ?? null,
      reviewed_at:   now,
      updated_at:    now,
    }).eq('id', (existing as any).id as string);
    if (error) throw error;
  } else {
    const { error } = await db.from('tsqa_reviews').insert({
      rse_id:        input.rse_id,
      reviewer_id:   profile.id,
      result:        input.result,
      remarks:       input.remarks       ?? null,
      test_findings: input.test_findings ?? null,
      reviewed_at:   now,
    });
    if (error) throw error;
  }

  // 3. Update rse_records: finalise status and mark completed
  const { error: rseUpdateErr } = await db
    .from('rse_records')
    .update({ status: input.result, completed_at: now, updated_at: now })
    .eq('id', input.rse_id);
  if (rseUpdateErr) throw rseUpdateErr;

  // 4. Propagate result to supplier_products
  const productUpdate =
    input.result === 'passed'
      ? { status: 'verified',  verified_at: now, updated_at: now }
      : { status: 'rejected',  rejected_at: now, updated_at: now };

  const { error: productErr } = await db
    .from('supplier_products')
    .update(productUpdate)
    .eq('id', (rse as any).supplier_product_id as string);
  if (productErr) throw productErr;

  // 5. Audit log (best-effort)
  const auditAction = input.result === 'passed' ? 'TSQA_RESULT_PASSED' : 'TSQA_RESULT_FAILED';
  try {
    const { error: auditErr } = await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        auditAction,
      document_type: 'RSE',
      document_id:   input.rse_id,
      payload: {
        rse_number:          (rse as any).rse_number,
        result:              input.result,
        reviewer:            profile.full_name,
        supplier_product_id: (rse as any).supplier_product_id,
        remarks:             input.remarks ?? null,
      },
    });
    if (auditErr) console.warn(auditErr);
  } catch {
    /* best-effort audit */
  }

  // 6. Notifications (best-effort)
  const resultLabel = input.result === 'passed' ? 'Passed' : 'Failed';
  const notifType   = input.result === 'passed' ? 'approved' as const : 'rejected' as const;
  const rseNumber   = (rse as any).rse_number as string;

  try {
    // Notify the supplier
    await createNotification({
      user_id:       (rse as any).supplier_id as string,
      title:         `TSQA Evaluation ${resultLabel}`,
      body:          `Your product evaluation (RSE ${rseNumber}) has ${input.result}.${
                       input.remarks ? ` Remarks: ${input.remarks}` : ''
                     }`.trim(),
      type:          notifType,
      document_type: 'RSE',
      document_id:   input.rse_id,
      action_url:    null,
    });
  } catch { /* non-blocking */ }

  try {
    // Notify all procurement users
    await notifyByRole('procurement', {
      title:         `TSQA Evaluation ${resultLabel} — ${rseNumber}`,
      body:          `TSQA completed product evaluation. RSE ${rseNumber} result: ${input.result}.`,
      type:          notifType,
      document_type: 'RSE',
      document_id:   input.rse_id,
      action_url:    null,
    });
  } catch { /* non-blocking */ }
}
