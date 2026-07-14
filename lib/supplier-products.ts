import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type { SupplierProduct } from '@/types/database';

const db = supabase as any;

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

const SUPPLIER_CATALOG_WRITE_DENIED =
  'Suppliers cannot modify the product catalog. Procurement adds verified products for raw mat suppliers.';

// ─── Supplier mutations denied (procurement owns catalog) ─────────────────────

export async function createSupplierProduct(
  _input:   SupplierProductInput,
  _profile: UserProfile
): Promise<SupplierProduct> {
  throw new Error(SUPPLIER_CATALOG_WRITE_DENIED);
}

export async function updateSupplierProduct(
  _productId: string,
  _input:     Partial<SupplierProductInput>,
  _profile:   UserProfile
): Promise<void> {
  throw new Error(SUPPLIER_CATALOG_WRITE_DENIED);
}

export async function submitSupplierProductForReview(
  _productId: string,
  _profile:   UserProfile
): Promise<void> {
  throw new Error(SUPPLIER_CATALOG_WRITE_DENIED);
}

export async function withdrawSupplierProduct(
  _productId: string,
  _profile:   UserProfile
): Promise<void> {
  throw new Error(SUPPLIER_CATALOG_WRITE_DENIED);
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
  /** Kept for call-site compat; product expiry is disabled — always writes null. */
  _validUntil?: string | null
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

  const now = new Date().toISOString();

  const { error } = await db
    .from('supplier_products')
    .update({
      status:       'verified',
      verified_at:  now,
      reviewed_by:  profile.id,
      reviewed_at:  now,
      review_notes: notes ?? null,
      valid_until:  null,
      updated_at:   now,
    })
    .eq('id', productId);
  if (error) throw error;
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
}

// ─── Procurement: deactivate a verified catalog product ─────────────────────
// verified → inactive. Keeps the row (quotes may still reference it).
// Does not appear in quote catalog picker; award path unchanged (soft).

export async function deactivateProduct(
  productId: string,
  profile:   UserProfile,
  notes?:    string
): Promise<void> {
  const { data: product, error: fetchErr } = await db
    .from('supplier_products')
    .select('id, status')
    .eq('id', productId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!product) throw new Error('Product not found.');
  if ((product as { status: string }).status !== 'verified') {
    throw new Error('Only verified products can be deactivated.');
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await db
    .from('supplier_products')
    .update({
      status:       'inactive',
      reviewed_by:  profile.id,
      reviewed_at:  now,
      review_notes: notes?.trim() || null,
      updated_at:   now,
    })
    .eq('id', productId)
    .eq('status', 'verified')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!updated) {
    throw new Error('Product could not be deactivated. It may no longer be verified.');
  }
}

// ─── Procurement: reactivate an inactive catalog product ────────────────────
// inactive → verified. Direct restore for catalog ownership model.

export async function reactivateProduct(
  productId: string,
  profile:   UserProfile,
  notes?:    string
): Promise<void> {
  const { data: product, error: fetchErr } = await db
    .from('supplier_products')
    .select('id, status')
    .eq('id', productId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!product) throw new Error('Product not found.');
  if ((product as { status: string }).status !== 'inactive') {
    throw new Error('Only inactive products can be reactivated.');
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await db
    .from('supplier_products')
    .update({
      status:       'verified',
      verified_at:  now,
      reviewed_by:  profile.id,
      reviewed_at:  now,
      review_notes: notes?.trim() || null,
      valid_until:  null,
      updated_at:   now,
    })
    .eq('id', productId)
    .eq('status', 'inactive')
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!updated) {
    throw new Error('Product could not be reactivated. It may no longer be inactive.');
  }
}

// ─── Procurement: reopen a verified, inactive, or expired product for review ───
// verified | inactive | expired → under_review. Clears verified_at + valid_until.
// Product expiry edit/revoke helpers removed; cron no longer auto-expires products.

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
}

// ─── Supplier: request re-verification — denied (procurement owns catalog) ───

export async function requestProductReverification(
  _productId: string,
  _profile:   UserProfile
): Promise<void> {
  throw new Error(SUPPLIER_CATALOG_WRITE_DENIED);
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

// ─── Quote picker: verified goods catalog products only ─────────────────────

export async function getActiveProductsForCurrentSupplier(
  profile: UserProfile
): Promise<SupplierProduct[]> {
  const { data, error } = await db
    .from('supplier_products')
    .select('*')
    .eq('supplier_id', profile.id)
    .eq('status', 'verified')
    .eq('item_type', 'goods')
    .order('verified_at', { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as SupplierProduct[];
}

// ─── RFQ product proposal — denied (procurement owns catalog) ─────────────────

export interface RFQProductProposalInput {
  product_name:    string;
  product_code?:   string | null;
  category?:       string | null;
  description?:    string | null;
  specifications?: string | null;
  item_type?:      'goods' | 'services';
}

export async function createAndSubmitSupplierProductForRFQ(
  _input:   RFQProductProposalInput,
  _profile: UserProfile
): Promise<SupplierProduct> {
  throw new Error(SUPPLIER_CATALOG_WRITE_DENIED);
}
