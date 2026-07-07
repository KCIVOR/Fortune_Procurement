import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type { SupplierProduct } from '@/types/database';
import { createNotification } from '@/lib/notifications';

const db = supabase as any;

async function notifyAllProcurementUsers(params: {
  title:         string;
  body:          string;
  type:          'info' | 'action_required' | 'approved' | 'rejected';
  document_type: string;
  document_id:   string;
  action_url:    string | null;
}): Promise<void> {
  try {
    const { data: role } = await db.from('roles').select('id').eq('name', 'procurement').maybeSingle();
    if (!role?.id) return;
    const { data: recipients } = await db.from('profiles').select('id').eq('role_id', role.id);
    const list = (recipients ?? []) as { id: string }[];
    if (list.length === 0) return;
    await Promise.all(
      list.map(p =>
        createNotification({
          user_id:       p.id,
          title:         params.title,
          body:          params.body,
          type:          params.type,
          document_type: params.document_type,
          document_id:   params.document_id,
          action_url:    params.action_url,
        })
      )
    );
  } catch {
    /* best-effort */
  }
}

// ─── Input types ─────────────────────────────────────────────────────────────

export interface SupplierProductInput {
  product_name:     string;
  product_code?:    string | null;
  category?:        string | null;
  description?:     string | null;
  specifications?:  string | null;
  accreditation_id?: string | null;
  item_type?:       'goods' | 'services';
}

// Queue row type enriched with supplier name for procurement views
export interface ProductQueueRow extends SupplierProduct {
  supplier_full_name: string | null;
}

// ─── Supplier: list own products ─────────────────────────────────────────────

export async function getMySupplierProducts(
  profile: UserProfile
): Promise<SupplierProduct[]> {
  const { data, error } = await db
    .from('supplier_products')
    .select('*')
    .eq('supplier_id', profile.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupplierProduct[];
}

// ─── Supplier: create new draft product ──────────────────────────────────────

export async function createSupplierProduct(
  input:   SupplierProductInput,
  profile: UserProfile
): Promise<SupplierProduct> {
  const now = new Date().toISOString();
  const { data, error } = await db
    .from('supplier_products')
    .insert({
      supplier_id:      profile.id,
      product_name:     input.product_name.trim(),
      product_code:     input.product_code     ?? null,
      category:         input.category         ?? null,
      description:      input.description      ?? null,
      specifications:   input.specifications   ?? null,
      accreditation_id: input.accreditation_id ?? null,
      item_type:        input.item_type        ?? 'goods',
      status:           'draft',
      created_at:       now,
      updated_at:       now,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as SupplierProduct;
}

// ─── Supplier: update a draft product ────────────────────────────────────────
// Only allowed while status = draft.

export async function updateSupplierProduct(
  productId: string,
  input:     Partial<SupplierProductInput>,
  profile:   UserProfile
): Promise<void> {
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updated_at: now };
  if (input.product_name    !== undefined) updates.product_name    = input.product_name.trim();
  if (input.product_code    !== undefined) updates.product_code    = input.product_code;
  if (input.category        !== undefined) updates.category        = input.category;
  if (input.description     !== undefined) updates.description     = input.description;
  if (input.specifications  !== undefined) updates.specifications  = input.specifications;
  if (input.accreditation_id !== undefined) updates.accreditation_id = input.accreditation_id;
  if (input.item_type       !== undefined) updates.item_type       = input.item_type;

  const { error } = await db
    .from('supplier_products')
    .update(updates)
    .eq('id', productId)
    .eq('supplier_id', profile.id)
    .eq('status', 'draft');
  if (error) throw error;
}

// ─── Supplier: submit product for procurement review ─────────────────────────

export async function submitSupplierProductForReview(
  productId: string,
  profile:   UserProfile
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db
    .from('supplier_products')
    .update({
      status:       'submitted',
      submitted_at: now,
      updated_at:   now,
    })
    .eq('id', productId)
    .eq('supplier_id', profile.id)
    .eq('status', 'draft');
  if (error) throw error;

  // Audit log (best-effort)
  try {
    const { error: auditErr } = await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'SUPPLIER_PRODUCT_SUBMITTED',
      document_type: 'SUPPLIER_PRODUCT',
      document_id:   productId,
      payload:       { supplier: profile.full_name },
    });
    if (auditErr) console.warn(auditErr);
  } catch {
    /* best-effort audit */
  }
}

// ─── Supplier: withdraw product (record retained; documents unchanged) ───────

export async function withdrawSupplierProduct(
  productId: string,
  profile:   UserProfile
): Promise<void> {
  const { data: row, error: fetchErr } = await db
    .from('supplier_products')
    .select('id, supplier_id, status, product_name')
    .eq('id', productId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) throw new Error('Product not found.');
  if ((row as any).supplier_id !== profile.id) throw new Error('Not allowed.');

  const st = (row as any).status as string;
  if (!['draft', 'submitted'].includes(st)) {
    throw new Error('Withdraw Product is only available for draft or submitted products.');
  }

  const wasSubmitted = st === 'submitted';
  const name         = (row as any).product_name as string;
  const now          = new Date().toISOString();

  const { error } = await db
    .from('supplier_products')
    .update({ status: 'withdrawn', updated_at: now })
    .eq('id', productId)
    .eq('supplier_id', profile.id)
    .in('status', ['draft', 'submitted']);
  if (error) throw error;

  try {
    const { error: auditErr } = await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'SUPPLIER_PRODUCT_WITHDRAWN',
      document_type: 'SUPPLIER_PRODUCT',
      document_id:   productId,
      payload:       { supplier: profile.full_name, prior_status: st, product_name: name },
    });
    if (auditErr) console.warn(auditErr);
  } catch {
    /* best-effort audit */
  }

  if (wasSubmitted) {
    await notifyAllProcurementUsers({
      title:         'Supplier Withdrew Product',
      body:          `${profile.full_name} withdrew the product "${name}" from the review queue.`,
      type:          'action_required',
      document_type: 'SUPPLIER_PRODUCT',
      document_id:   productId,
      action_url:    null,
    });
  }
}

// ─── Any role with RLS access: fetch product by id ───────────────────────────

export async function getSupplierProductById(
  productId: string
): Promise<SupplierProduct | null> {
  const { data, error } = await db
    .from('supplier_products')
    .select('*')
    .eq('id', productId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as SupplierProduct | null;
}

// ─── Procurement: review queue (submitted + under_review) ────────────────────

export async function getProductReviewQueueForProcurement(): Promise<ProductQueueRow[]> {
  const { data, error } = await db
    .from('supplier_products')
    .select('*')
    .in('status', ['submitted', 'under_review'])
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  if (!data || (data as any[]).length === 0) return [];

  // Enrich with supplier name
  const supplierIds: string[] = Array.from(
    new Set((data as any[]).map(r => r.supplier_id as string))
  );
  const { data: profiles } = await db
    .from('profiles')
    .select('id, full_name')
    .in('id', supplierIds);
  const profileMap: Record<string, string> = Object.fromEntries(
    ((profiles ?? []) as any[]).map(p => [p.id as string, p.full_name as string])
  );

  return (data as any[]).map(row => ({
    ...row,
    supplier_full_name: profileMap[row.supplier_id as string] ?? null,
  })) as ProductQueueRow[];
}

// ─── Procurement: get ALL products (for filtering) ───────────────────────────

export async function getAllProductsForProcurement(): Promise<ProductQueueRow[]> {
  const { data, error } = await db
    .from('supplier_products')
    .select('*')
    .neq('status', 'draft') // Exclude drafts (supplier hasn't submitted yet)
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  if (!data || (data as any[]).length === 0) return [];

  // Enrich with supplier name
  const supplierIds: string[] = Array.from(
    new Set((data as any[]).map(r => r.supplier_id as string))
  );
  const { data: profiles } = await db
    .from('profiles')
    .select('id, full_name')
    .in('id', supplierIds);
  const profileMap: Record<string, string> = Object.fromEntries(
    ((profiles ?? []) as any[]).map(p => [p.id as string, p.full_name as string])
  );

  return (data as any[]).map(row => ({
    ...row,
    supplier_full_name: profileMap[row.supplier_id as string] ?? null,
  })) as ProductQueueRow[];
}

// ─── Procurement: mark product under active review ───────────────────────────

export async function markProductUnderReview(
  productId: string,
  profile:   UserProfile,
  notes?:    string
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db
    .from('supplier_products')
    .update({
      status:       'under_review',
      reviewed_by:  profile.id,
      reviewed_at:  now,
      review_notes: notes ?? null,
      updated_at:   now,
    })
    .eq('id', productId)
    .eq('status', 'submitted');
  if (error) throw error;
}

// ─── Procurement: verify product directly (no TSQA/RSE required) ─────────────
// Only Procurement can verify directly. Verified products can later be
// offered in RFQ (Phase 4 onwards — not connected here).

export async function markProductVerified(
  productId: string,
  profile:   UserProfile,
  notes?:    string,
  /** Rev #3: manually entered by procurement. Optional — null/undefined means no expiry set. */
  validUntil?: string | null
): Promise<void> {
  const { data: product, error: fetchErr } = await db
    .from('supplier_products')
    .select('supplier_id, status')
    .eq('id', productId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!product) throw new Error('Product not found.');
  if ((product as any).status === 'withdrawn') {
    throw new Error('This product was withdrawn by the supplier and cannot be verified.');
  }

  // Rev #3: expiry is now a manual, optional field. If provided, it must be a future date.
  let validUntilValue: string | null = null;
  if (validUntil) {
    const chosen = new Date(`${validUntil}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(chosen.getTime()) || chosen <= today) {
      throw new Error('Expiry date must be a valid date in the future.');
    }
    validUntilValue = validUntil;
  }

  const now = new Date().toISOString();

  const { error } = await db
    .from('supplier_products')
    .update({
      status:       'verified',
      verified_at:  now,
      reviewed_by:  profile.id,
      reviewed_at:  now,
      review_notes: notes ?? null,
      valid_until:  validUntilValue,
      updated_at:   now,
    })
    .eq('id', productId);
  if (error) throw error;

  // Audit log (best-effort)
  try {
    const { error: auditErr } = await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'SUPPLIER_PRODUCT_VERIFIED',
      document_type: 'SUPPLIER_PRODUCT',
      document_id:   productId,
      payload:       { reviewer: profile.full_name, review_notes: notes ?? null, valid_until: validUntilValue },
    });
    if (auditErr) console.warn(auditErr);
  } catch {
    /* best-effort audit */
  }

  // Notify supplier (best-effort)
  try {
    await createNotification({
      user_id:       (product as any).supplier_id as string,
      title:         'Supplier Product Verified',
      body:          notes
                       ? `Your product has been verified. Notes: ${notes}`
                       : 'Your supplier product has been verified.',
      type:          'approved',
      document_type: 'SUPPLIER_PRODUCT',
      document_id:   productId,
      action_url:    null,
    });
  } catch { /* non-blocking */ }
}

// ─── Procurement: edit expiry on an already-verified product ─────────────────
// Scoped to status = 'verified' only. Does not touch 'expired'/'inactive' —
// those go through reopenProductForReview() -> markProductVerified() so an
// un-expiry is a deliberate re-review, not a quiet date edit.

export async function updateProductVerificationExpiry(
  productId: string,
  profile:   UserProfile,
  validUntil: string | null
): Promise<void> {
  const { data: product, error: fetchErr } = await db
    .from('supplier_products')
    .select('status, valid_until')
    .eq('id', productId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!product) throw new Error('Product not found.');
  if ((product as any).status !== 'verified') {
    throw new Error('Only a verified product\'s expiry can be edited directly.');
  }

  let validUntilValue: string | null = null;
  if (validUntil) {
    const chosen = new Date(`${validUntil}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (Number.isNaN(chosen.getTime()) || chosen <= today) {
      throw new Error('Expiry date must be a valid date in the future.');
    }
    validUntilValue = validUntil;
  }

  const now = new Date().toISOString();
  const oldValidUntil = (product as any).valid_until ?? null;

  const { error } = await db
    .from('supplier_products')
    .update({ valid_until: validUntilValue, updated_at: now })
    .eq('id', productId);
  if (error) throw error;

  try {
    const { error: auditErr } = await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'SUPPLIER_PRODUCT_EXPIRY_UPDATED',
      document_type: 'SUPPLIER_PRODUCT',
      document_id:   productId,
      payload:       { updated_by: profile.full_name, old_valid_until: oldValidUntil, new_valid_until: validUntilValue },
    });
    if (auditErr) console.warn(auditErr);
  } catch {
    /* best-effort audit */
  }
}

// ─── Procurement: reject product ─────────────────────────────────────────────

export async function markProductRejected(
  productId: string,
  profile:   UserProfile,
  notes?:    string
): Promise<void> {
  const { data: product, error: fetchErr } = await db
    .from('supplier_products')
    .select('supplier_id, status')
    .eq('id', productId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!product) throw new Error('Product not found.');
  if ((product as any).status === 'withdrawn') {
    throw new Error('This product was withdrawn by the supplier and cannot be rejected.');
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from('supplier_products')
    .update({
      status:       'rejected',
      rejected_at:  now,
      reviewed_by:  profile.id,
      reviewed_at:  now,
      review_notes: notes ?? null,
      updated_at:   now,
    })
    .eq('id', productId);
  if (error) throw error;

  // Audit log (best-effort)
  try {
    const { error: auditErr } = await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'SUPPLIER_PRODUCT_REJECTED',
      document_type: 'SUPPLIER_PRODUCT',
      document_id:   productId,
      payload:       { reviewer: profile.full_name, review_notes: notes ?? null },
    });
    if (auditErr) console.warn(auditErr);
  } catch {
    /* best-effort audit */
  }

  // Notify supplier (best-effort)
  try {
    await createNotification({
      user_id:       (product as any).supplier_id as string,
      title:         'Supplier Product Rejected',
      body:          notes
                       ? `Your product was rejected. Reason: ${notes}`
                       : 'Your supplier product has been rejected.',
      type:          'rejected',
      document_type: 'SUPPLIER_PRODUCT',
      document_id:   productId,
      action_url:    null,
    });
  } catch { /* non-blocking */ }
}

// ─── Procurement: revoke/expire a verified product ────────────────────────────
// verified → expired. verified_at is retained for audit; Can Offer becomes No.

export async function revokeProductVerification(
  productId: string,
  profile:   UserProfile,
  reason:    string
): Promise<void> {
  if (!reason.trim()) {
    throw new Error('A reason is required to revoke verification.');
  }

  const { data: product, error: fetchErr } = await db
    .from('supplier_products')
    .select('supplier_id, status, product_name')
    .eq('id', productId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!product) throw new Error('Product not found.');
  if ((product as any).status !== 'verified') {
    throw new Error('Only verified products can have verification revoked.');
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from('supplier_products')
    .update({
      status:       'expired',
      valid_until:  null,
      reviewed_by:  profile.id,
      reviewed_at:  now,
      review_notes: reason.trim(),
      updated_at:   now,
    })
    .eq('id', productId)
    .eq('status', 'verified');
  if (error) throw error;

  try {
    const { error: auditErr } = await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'SUPPLIER_PRODUCT_EXPIRED',
      document_type: 'SUPPLIER_PRODUCT',
      document_id:   productId,
      payload:       {
        reviewer:     profile.full_name,
        reason:       reason.trim(),
        product_name: (product as any).product_name,
      },
    });
    if (auditErr) console.warn(auditErr);
  } catch {
    /* best-effort audit */
  }

  try {
    await createNotification({
      user_id:       (product as any).supplier_id as string,
      title:         'Product Verification Revoked',
      body:          `Verification for "${(product as any).product_name}" has been revoked. Reason: ${reason.trim()}`,
      type:          'rejected',
      document_type: 'SUPPLIER_PRODUCT',
      document_id:   productId,
      action_url:    null,
    });
  } catch { /* non-blocking */ }
}

// ─── Procurement: reopen a verified, inactive, or expired product for review ───
// verified | inactive | expired → under_review. Clears verified_at + valid_until.

export async function reopenProductForReview(
  productId: string,
  profile:   UserProfile,
  notes?:    string
): Promise<void> {
  const { data: product, error: fetchErr } = await db
    .from('supplier_products')
    .select('supplier_id, status, product_name')
    .eq('id', productId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!product) throw new Error('Product not found.');

  const st = (product as any).status as string;
  if (st !== 'verified' && st !== 'inactive' && st !== 'expired') {
    throw new Error('Only verified, inactive, or expired products can be reopened for review.');
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from('supplier_products')
    .update({
      status:       'under_review',
      verified_at:  null,
      valid_until:  null,
      reviewed_by:  profile.id,
      reviewed_at:  now,
      review_notes: notes?.trim() || null,
      updated_at:   now,
    })
    .eq('id', productId)
    .in('status', ['verified', 'inactive', 'expired']);
  if (error) throw error;

  try {
    const { error: auditErr } = await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'SUPPLIER_PRODUCT_REOPENED',
      document_type: 'SUPPLIER_PRODUCT',
      document_id:   productId,
      payload:       {
        reviewer:     profile.full_name,
        prior_status: st,
        notes:        notes?.trim() || null,
        product_name: (product as any).product_name,
      },
    });
    if (auditErr) console.warn(auditErr);
  } catch {
    /* best-effort audit */
  }

  try {
    await createNotification({
      user_id:       (product as any).supplier_id as string,
      title:         'Product Reopened for Review',
      body:          notes?.trim()
                       ? `"${(product as any).product_name}" is under procurement review again. Notes: ${notes.trim()}`
                       : `"${(product as any).product_name}" has been reopened for procurement review.`,
      type:          'action_required',
      document_type: 'SUPPLIER_PRODUCT',
      document_id:   productId,
      action_url:    null,
    });
  } catch { /* non-blocking */ }
}

// ─── Supplier: request re-verification of an expired product ─────────────────
// expired → submitted. Clears valid_until, re-stamps submitted_at.
// Notifies all Procurement users so the record re-enters the review queue.

export async function requestProductReverification(
  productId: string,
  profile:   UserProfile
): Promise<void> {
  const { data: product, error: fetchErr } = await db
    .from('supplier_products')
    .select('status, product_name')
    .eq('id', productId)
    .eq('supplier_id', profile.id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!product) throw new Error('Product not found.');
  if ((product as any).status !== 'expired') {
    throw new Error('Only expired products can be submitted for re-verification.');
  }

  const now = new Date().toISOString();
  const { error } = await db
    .from('supplier_products')
    .update({
      status:       'submitted',
      submitted_at: now,
      valid_until:  null,
      updated_at:   now,
    })
    .eq('id', productId)
    .eq('supplier_id', profile.id)
    .eq('status', 'expired');
  if (error) throw error;

  try {
    await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'SUPPLIER_PRODUCT_REVERIFICATION_REQUESTED',
      document_type: 'SUPPLIER_PRODUCT',
      document_id:   productId,
      payload:       { supplier: profile.full_name, product_name: (product as any).product_name },
    });
  } catch { /* best-effort */ }

  await notifyAllProcurementUsers({
    title:         'Supplier Requested Re-verification',
    body:          `${profile.full_name} requested re-verification for "${(product as any).product_name}".`,
    type:          'action_required',
    document_type: 'SUPPLIER_PRODUCT',
    document_id:   productId,
    action_url:    `/accreditation/products/${productId}`,
  });
}

// ─── Supplier: list own verified products ────────────────────────────────────
// Verified products will later be eligible for RFQ offering (Phase 4+).

export async function getVerifiedProductsForCurrentSupplier(
  profile: UserProfile
): Promise<SupplierProduct[]> {
  const { data, error } = await db
    .from('supplier_products')
    .select('*')
    .eq('supplier_id', profile.id)
    .eq('status', 'verified')
    .order('verified_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupplierProduct[];
}

// ─── Phase 5 (Raw Mats): list all "active" products for the current supplier ─
// Returns verified and in-flight products (submitted / under_review / pending_tsqa)
// so the supplier can offer them in RFQ canvassing per the relaxed rule:
// suppliers may pick verified, unverified, or fill manually for any line.
//
// Excluded statuses:
//   - 'draft'      — not yet submitted; private to the supplier
//   - 'rejected'   — explicitly disqualified
//   - 'inactive'   — withdrawn from active catalog
//   - 'withdrawn'  — supplier removed it
//
// The legacy `getVerifiedProductsForCurrentSupplier` stays intact for callers
// that genuinely need verified-only (e.g. compliance dashboards). New canvassing
// surfaces should use this function instead.
export async function getActiveProductsForCurrentSupplier(
  profile: UserProfile
): Promise<SupplierProduct[]> {
  const { data, error } = await db
    .from('supplier_products')
    .select('*')
    .eq('supplier_id', profile.id)
    .in('status', ['verified', 'submitted', 'under_review', 'pending_tsqa', 'expired'])
    .order('verified_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as SupplierProduct[];
}

// ─── Phase 8: create + immediately submit a product proposed from an RFQ ──────
// Creates a draft product and submits it for Procurement review in a single
// atomic-ish operation. The product lands in the Procurement Product Review
// queue (/accreditation/products) with status = 'submitted'.
//
// accreditation_id is linked if the supplier already has an approved or
// in-progress accreditation; otherwise left null (product can still be reviewed).

export interface RFQProductProposalInput {
  product_name:    string;
  product_code?:   string | null;
  category?:       string | null;
  description?:    string | null;
  specifications?: string | null;
  item_type?:      'goods' | 'services';
}

export async function createAndSubmitSupplierProductForRFQ(
  input:   RFQProductProposalInput,
  profile: UserProfile
): Promise<SupplierProduct> {
  const now = new Date().toISOString();

  // Best-effort: find supplier accreditation to link (any non-rejected one)
  let accreditationId: string | null = null;
  try {
    const { data: acc } = await db
      .from('supplier_accreditations')
      .select('id')
      .eq('supplier_id', profile.id)
      .not('status', 'eq', 'rejected')
      .not('status', 'eq', 'withdrawn')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    accreditationId = (acc?.id as string) ?? null;
  } catch { /* non-blocking — product is still created without accreditation_id */ }

  // Insert directly as 'submitted' (skips draft state for speed in RFQ context)
  const { data, error } = await db
    .from('supplier_products')
    .insert({
      supplier_id:      profile.id,
      product_name:     input.product_name.trim(),
      product_code:     input.product_code    ?? null,
      category:         input.category        ?? null,
      description:      input.description     ?? null,
      specifications:   input.specifications  ?? null,
      accreditation_id: accreditationId,
      item_type:        input.item_type       ?? 'goods',
      status:           'submitted',
      submitted_at:     now,
      created_at:       now,
      updated_at:       now,
    })
    .select('*')
    .single();
  if (error) throw error;

  const product = data as SupplierProduct;

  // Audit + notify procurement (best-effort; mirrors submitSupplierProductForReview)
  try {
    const { error: auditErr } = await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'SUPPLIER_PRODUCT_SUBMITTED',
      document_type: 'SUPPLIER_PRODUCT',
      document_id:   product.id,
      payload:       { supplier: profile.full_name, source: 'rfq_proposal' },
    });
    if (auditErr) console.warn(auditErr);
  } catch {
    /* best-effort audit */
  }

  try {
    const { data: procRole } = await db.from('roles').select('id').eq('name', 'procurement').maybeSingle();
    if (procRole?.id) {
      const { data: procUsers } = await db.from('profiles').select('id').eq('role_id', procRole.id);
      await Promise.all(
        ((procUsers ?? []) as any[]).map((p: any) =>
          createNotification({
            user_id:       p.id as string,
            title:         'New Product Proposed via RFQ',
            body:          `${profile.full_name} proposed a new product for validation: ${product.product_name}`,
            type:          'info',
            document_type: 'supplier_product',
            document_id:   product.id,
            action_url:    `/accreditation/products/${product.id}`,
          })
        )
      );
    }
  } catch { /* notifications are best-effort */ }

  return product;
}
