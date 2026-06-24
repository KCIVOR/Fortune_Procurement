import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type { SupplierAccreditation } from '@/types/database';
import { createNotification, type NotificationInsert } from '@/lib/notifications';
import { getExpirySettings, addDays } from '@/lib/system-settings';

const db = supabase as any;

// ─── Local helper: fan-out notification to all users of a given role ──────────
// Mirrors the pattern used in notifyApproversForStep (lib/notifications.ts).
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

// ─── Queue row type (accreditation + supplier display fields) ─────────────────

export interface AccreditationQueueRow extends SupplierAccreditation {
  supplier_full_name: string | null;
  supplier_email:     string | null;
}

// ─── Supplier: get own most-recent accreditation ──────────────────────────────

export async function getMyAccreditation(
  profile: UserProfile
): Promise<SupplierAccreditation | null> {
  const { data, error } = await db
    .from('supplier_accreditations')
    .select('*')
    .eq('supplier_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as SupplierAccreditation | null;
}

// ─── Supplier: create a new draft accreditation ───────────────────────────────
// Blocks if a non-rejected accreditation already exists for the supplier.

export async function createDraftAccreditation(
  profile: UserProfile
): Promise<SupplierAccreditation> {
  const { data: existing, error: checkErr } = await db
    .from('supplier_accreditations')
    .select('id, status')
    .eq('supplier_id', profile.id)
    .in('status', [
      'draft',
      'submitted',
      'under_review',
      'missing_documents',
      'approved',
    ])
    .maybeSingle();
  if (checkErr) throw checkErr;
  if (existing) {
    throw new Error(
      `Accreditation already exists with status "${(existing as any).status}". ` +
      'Continue from your existing record.'
    );
  }

  const now = new Date().toISOString();
  const { data, error } = await db
    .from('supplier_accreditations')
    .insert({
      supplier_id: profile.id,
      status:      'draft',
      created_at:  now,
      updated_at:  now,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as SupplierAccreditation;
}

// ─── Supplier: submit accreditation for procurement review ────────────────────
// Allowed from: draft, missing_documents (re-submission after correction).

export async function submitAccreditation(
  accreditationId: string,
  profile:         UserProfile
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db
    .from('supplier_accreditations')
    .update({
      status:       'submitted',
      submitted_at: now,
      updated_at:   now,
    })
    .eq('id', accreditationId)
    .eq('supplier_id', profile.id)
    .in('status', ['draft', 'missing_documents']);
  if (error) throw error;

  // Audit log (best-effort)
  try {
    const { error: auditErr } = await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'ACCREDITATION_SUBMITTED',
      document_type: 'ACCREDITATION',
      document_id:   accreditationId,
      payload:       { supplier: profile.full_name },
    });
    if (auditErr) console.warn(auditErr);
  } catch {
    /* best-effort audit */
  }

  // Notify all procurement users (best-effort)
  try {
    await notifyByRole('procurement', {
      title:         'New Supplier Accreditation Submitted',
      body:          `${profile.full_name} has submitted their supplier accreditation for review.`,
      type:          'action_required',
      document_type: 'ACCREDITATION',
      document_id:   accreditationId,
      action_url:    null,
    });
  } catch { /* notifications are non-blocking */ }
}

// ─── Supplier: withdraw application (audit history retained) ─────────────────

export async function withdrawAccreditation(
  accreditationId: string,
  profile: UserProfile
): Promise<void> {
  const { data: row, error: fetchErr } = await db
    .from('supplier_accreditations')
    .select('id, supplier_id, status')
    .eq('id', accreditationId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) throw new Error('Accreditation not found.');
  if ((row as any).supplier_id !== profile.id) throw new Error('Not allowed.');

  const st = (row as any).status as string;
  if (!['draft', 'submitted', 'missing_documents'].includes(st)) {
    throw new Error('Withdraw Application is only available for draft, submitted, or missing-documents applications.');
  }

  const notifyProcurement = st === 'submitted' || st === 'missing_documents';
  const now = new Date().toISOString();

  const { error } = await db
    .from('supplier_accreditations')
    .update({ status: 'withdrawn', updated_at: now })
    .eq('id', accreditationId)
    .eq('supplier_id', profile.id)
    .in('status', ['draft', 'submitted', 'missing_documents']);
  if (error) throw error;

  try {
    const { error: auditErr } = await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'ACCREDITATION_WITHDRAWN',
      document_type: 'ACCREDITATION',
      document_id:   accreditationId,
      payload:       { supplier: profile.full_name, prior_status: st },
    });
    if (auditErr) console.warn(auditErr);
  } catch {
    /* best-effort audit */
  }

  if (notifyProcurement) {
    try {
      await notifyByRole('procurement', {
        title:         'Supplier Withdrew Accreditation Application',
        body:          `${profile.full_name} has withdrawn their supplier accreditation application (previously ${st.replace(/_/g, ' ')}).`,
        type:          'action_required',
        document_type: 'ACCREDITATION',
        document_id:   accreditationId,
        action_url:    null,
      });
    } catch { /* non-blocking */ }
  }
}

// ─── Procurement / admin: get full pending queue ──────────────────────────────

export async function getAccreditationQueueForProcurement(): Promise<AccreditationQueueRow[]> {
  const { data, error } = await db
    .from('supplier_accreditations')
    .select('*')
    .in('status', ['submitted', 'under_review', 'missing_documents'])
    .order('submitted_at', { ascending: true });
  if (error) throw error;
  if (!data || (data as any[]).length === 0) return [];

  // Enrich with supplier profile data
  const supplierIds: string[] = Array.from(
    new Set((data as any[]).map(r => r.supplier_id as string))
  );
  const { data: profiles } = await db
    .from('profiles')
    .select('id, full_name, email')
    .in('id', supplierIds);
  const profileMap: Record<string, { full_name: string; email: string }> = Object.fromEntries(
    ((profiles ?? []) as any[]).map(p => [p.id as string, p])
  );

  return (data as any[]).map(row => ({
    ...row,
    supplier_full_name: profileMap[row.supplier_id as string]?.full_name ?? null,
    supplier_email:     profileMap[row.supplier_id as string]?.email     ?? null,
  })) as AccreditationQueueRow[];
}

// ─── Procurement / admin: get ALL accreditations (for filtering) ──────────────

export async function getAllAccreditationsForProcurement(): Promise<AccreditationQueueRow[]> {
  const { data, error } = await db
    .from('supplier_accreditations')
    .select('*')
    .neq('status', 'draft') // Exclude drafts (supplier hasn't submitted yet)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  if (!data || (data as any[]).length === 0) return [];

  // Enrich with supplier profile data
  const supplierIds: string[] = Array.from(
    new Set((data as any[]).map(r => r.supplier_id as string))
  );
  const { data: profiles } = await db
    .from('profiles')
    .select('id, full_name, email')
    .in('id', supplierIds);
  const profileMap: Record<string, { full_name: string; email: string }> = Object.fromEntries(
    ((profiles ?? []) as any[]).map(p => [p.id as string, p])
  );

  return (data as any[]).map(row => ({
    ...row,
    supplier_full_name: profileMap[row.supplier_id as string]?.full_name ?? null,
    supplier_email:     profileMap[row.supplier_id as string]?.email     ?? null,
  })) as AccreditationQueueRow[];
}

// ─── Procurement / admin: fetch single accreditation by id ───────────────────

export async function getAccreditationById(
  accreditationId: string
): Promise<SupplierAccreditation | null> {
  const { data, error } = await db
    .from('supplier_accreditations')
    .select('*')
    .eq('id', accreditationId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as SupplierAccreditation | null;
}

// ─── Procurement: begin formal review ────────────────────────────────────────
// Sets status = under_review; only transitions from submitted.

export async function markAccreditationUnderReview(
  accreditationId: string,
  profile:         UserProfile
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db
    .from('supplier_accreditations')
    .update({
      status:      'under_review',
      reviewed_by: profile.id,
      reviewed_at: now,
      updated_at:  now,
    })
    .eq('id', accreditationId)
    .eq('status', 'submitted');
  if (error) throw error;
}

// ─── Procurement: request missing documents from supplier ─────────────────────

export async function requestMissingDocuments(
  accreditationId: string,
  note:            string,
  profile:         UserProfile
): Promise<void> {
  const { data: acc, error: fetchErr } = await db
    .from('supplier_accreditations')
    .select('supplier_id, status')
    .eq('id', accreditationId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!acc) throw new Error('Accreditation not found.');
  const accSt = (acc as any).status as string;
  if (accSt === 'withdrawn') {
    throw new Error('This application was withdrawn and cannot be updated.');
  }
  if (accSt === 'approved' || accSt === 'rejected') {
    throw new Error('This application is already closed.');
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from('supplier_accreditations')
    .update({
      status:                 'missing_documents',
      missing_documents_note: note,
      reviewed_by:            profile.id,
      reviewed_at:            now,
      updated_at:             now,
    })
    .eq('id', accreditationId);
  if (error) throw error;

  // Audit log (best-effort)
  try {
    const { error: auditErr } = await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'ACCREDITATION_MISSING_DOCUMENTS_REQUESTED',
      document_type: 'ACCREDITATION',
      document_id:   accreditationId,
      payload:       { reviewer: profile.full_name, note },
    });
    if (auditErr) console.warn(auditErr);
  } catch {
    /* best-effort audit */
  }

  // Notify supplier (best-effort)
  try {
    await createNotification({
      user_id:       (acc as any).supplier_id as string,
      title:         'Additional Documents Required for Accreditation',
      body:          note,
      type:          'action_required',
      document_type: 'ACCREDITATION',
      document_id:   accreditationId,
      action_url:    null,
    });
  } catch { /* non-blocking */ }
}

// ─── Procurement: approve accreditation ──────────────────────────────────────

export async function approveAccreditation(
  accreditationId: string,
  profile:         UserProfile,
  reviewNotes?:    string
): Promise<void> {
  const { data: acc, error: fetchErr } = await db
    .from('supplier_accreditations')
    .select('supplier_id, status')
    .eq('id', accreditationId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!acc) throw new Error('Accreditation not found.');
  const accSt = (acc as any).status as string;
  if (accSt === 'withdrawn') {
    throw new Error('This application was withdrawn and cannot be approved.');
  }

  const now = new Date().toISOString();
  const settings  = await getExpirySettings();
  const validUntil = addDays(new Date(now), settings.accreditation_validity_days);

  const { error } = await db
    .from('supplier_accreditations')
    .update({
      status:       'approved',
      approved_at:  now,
      reviewed_by:  profile.id,
      reviewed_at:  now,
      review_notes: reviewNotes ?? null,
      valid_until:  validUntil,
      updated_at:   now,
    })
    .eq('id', accreditationId);
  if (error) throw error;

  // Audit log (best-effort)
  try {
    const { error: auditErr } = await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'ACCREDITATION_APPROVED',
      document_type: 'ACCREDITATION',
      document_id:   accreditationId,
      payload:       { reviewer: profile.full_name, review_notes: reviewNotes ?? null },
    });
    if (auditErr) console.warn(auditErr);
  } catch {
    /* best-effort audit */
  }

  // Notify supplier (best-effort)
  try {
    await createNotification({
      user_id:       (acc as any).supplier_id as string,
      title:         'Supplier Accreditation Approved',
      body:          reviewNotes
                       ? `Your accreditation has been approved. Notes: ${reviewNotes}`
                       : 'Your supplier accreditation has been approved.',
      type:          'approved',
      document_type: 'ACCREDITATION',
      document_id:   accreditationId,
      action_url:    null,
    });
  } catch { /* non-blocking */ }
}

// ─── Procurement: reject accreditation ───────────────────────────────────────

export async function rejectAccreditation(
  accreditationId: string,
  profile:         UserProfile,
  reviewNotes?:    string
): Promise<void> {
  const { data: acc, error: fetchErr } = await db
    .from('supplier_accreditations')
    .select('supplier_id, status')
    .eq('id', accreditationId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!acc) throw new Error('Accreditation not found.');
  const accSt = (acc as any).status as string;
  if (accSt === 'withdrawn') {
    throw new Error('This application was withdrawn and cannot be rejected.');
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from('supplier_accreditations')
    .update({
      status:       'rejected',
      rejected_at:  now,
      reviewed_by:  profile.id,
      reviewed_at:  now,
      review_notes: reviewNotes ?? null,
      updated_at:   now,
    })
    .eq('id', accreditationId);
  if (error) throw error;

  // Audit log (best-effort)
  try {
    const { error: auditErr } = await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'ACCREDITATION_REJECTED',
      document_type: 'ACCREDITATION',
      document_id:   accreditationId,
      payload:       { reviewer: profile.full_name, review_notes: reviewNotes ?? null },
    });
    if (auditErr) console.warn(auditErr);
  } catch {
    /* best-effort audit */
  }

  // Notify supplier (best-effort)
  try {
    await createNotification({
      user_id:       (acc as any).supplier_id as string,
      title:         'Supplier Accreditation Rejected',
      body:          reviewNotes
                       ? `Your accreditation was rejected. Reason: ${reviewNotes}`
                       : 'Your supplier accreditation has been rejected.',
      type:          'rejected',
      document_type: 'ACCREDITATION',
      document_id:   accreditationId,
      action_url:    null,
    });
  } catch { /* non-blocking */ }
}

// ─── Procurement: revoke/expire an approved accreditation ──────────────────────
// approved → expired. Prior approval timestamps are retained for audit.

export async function revokeAccreditation(
  accreditationId: string,
  profile:         UserProfile,
  reason:          string
): Promise<void> {
  if (!reason.trim()) {
    throw new Error('A reason is required to revoke accreditation.');
  }

  const { data: acc, error: fetchErr } = await db
    .from('supplier_accreditations')
    .select('supplier_id, status')
    .eq('id', accreditationId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!acc) throw new Error('Accreditation not found.');
  if ((acc as any).status !== 'approved') {
    throw new Error('Only approved accreditations can be revoked.');
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from('supplier_accreditations')
    .update({
      status:       'expired',
      valid_until:  null,
      reviewed_by:  profile.id,
      reviewed_at:  now,
      review_notes: reason.trim(),
      updated_at:   now,
    })
    .eq('id', accreditationId)
    .eq('status', 'approved');
  if (error) throw error;

  try {
    const { error: auditErr } = await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'ACCREDITATION_EXPIRED',
      document_type: 'ACCREDITATION',
      document_id:   accreditationId,
      payload:       { reviewer: profile.full_name, reason: reason.trim() },
    });
    if (auditErr) console.warn(auditErr);
  } catch {
    /* best-effort audit */
  }

  try {
    await createNotification({
      user_id:       (acc as any).supplier_id as string,
      title:         'Supplier Accreditation Revoked',
      body:          `Your accreditation has been revoked. Reason: ${reason.trim()}`,
      type:          'rejected',
      document_type: 'ACCREDITATION',
      document_id:   accreditationId,
      action_url:    null,
    });
  } catch { /* non-blocking */ }
}

// ─── Procurement: reopen an approved or expired accreditation for review ─────
// approved | expired → under_review. Clears approved_at + valid_until; prior history stays in audit_logs.

export async function reopenAccreditationForReview(
  accreditationId: string,
  profile:         UserProfile,
  notes?:          string
): Promise<void> {
  const { data: acc, error: fetchErr } = await db
    .from('supplier_accreditations')
    .select('supplier_id, status')
    .eq('id', accreditationId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!acc) throw new Error('Accreditation not found.');
  const accSt = (acc as any).status as string;
  if (accSt !== 'approved' && accSt !== 'expired') {
    throw new Error('Only approved or expired accreditations can be reopened for review.');
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from('supplier_accreditations')
    .update({
      status:       'under_review',
      approved_at:  null,
      valid_until:  null,
      reviewed_by:  profile.id,
      reviewed_at:  now,
      review_notes: notes?.trim() || null,
      updated_at:   now,
    })
    .eq('id', accreditationId)
    .in('status', ['approved', 'expired']);
  if (error) throw error;

  try {
    const { error: auditErr } = await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'ACCREDITATION_REOPENED',
      document_type: 'ACCREDITATION',
      document_id:   accreditationId,
      payload:       { reviewer: profile.full_name, notes: notes?.trim() || null },
    });
    if (auditErr) console.warn(auditErr);
  } catch {
    /* best-effort audit */
  }

  try {
    await createNotification({
      user_id:       (acc as any).supplier_id as string,
      title:         'Accreditation Reopened for Review',
      body:          notes?.trim()
                       ? `Your accreditation is under review again. Notes: ${notes.trim()}`
                       : 'Your supplier accreditation has been reopened for procurement review.',
      type:          'action_required',
      document_type: 'ACCREDITATION',
      document_id:   accreditationId,
      action_url:    null,
    });
  } catch { /* non-blocking */ }
}
