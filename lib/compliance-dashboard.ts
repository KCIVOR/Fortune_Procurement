import { supabase } from '@/lib/supabase';

const db = supabase as any;

export interface SupplierComplianceDashboardStats {
  accreditationStatus: string | null;
  totalProducts:          number;
  verifiedProducts:       number;
  inReviewProducts:       number;
  pendingTsqaProducts:    number;
  rejectedProducts:      number;
  draftProducts:          number;
  /** Distinct open RFQs where this supplier has at least one quote line linked to a non-verified product */
  rfqsPendingProductValidation: number;
}

export interface ProcurementComplianceDashboardStats {
  accreditationPendingReview: number;
  productsPendingReview:      number;
  productsPendingTsqa:        number;
  verifiedProducts:           number;
  rejectedProducts:           number;
  rsePendingTsqa:             number;
}

/** Supplier dashboard — counts only; no hard-coded totals. */
export async function fetchSupplierComplianceDashboardStats(
  supplierId: string
): Promise<SupplierComplianceDashboardStats> {
  const [
    accRes,
    totalRes,
    verifiedRes,
    submittedRes,
    underReviewRes,
    pendingTsqaRes,
    rejectedRes,
    draftRes,
  ] = await Promise.all([
    db
      .from('supplier_accreditations')
      .select('status')
      .eq('supplier_id', supplierId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from('supplier_products').select('id', { count: 'exact', head: true }).eq('supplier_id', supplierId),
    db.from('supplier_products').select('id', { count: 'exact', head: true }).eq('supplier_id', supplierId).eq('status', 'verified'),
    db.from('supplier_products').select('id', { count: 'exact', head: true }).eq('supplier_id', supplierId).eq('status', 'submitted'),
    db.from('supplier_products').select('id', { count: 'exact', head: true }).eq('supplier_id', supplierId).eq('status', 'under_review'),
    db.from('supplier_products').select('id', { count: 'exact', head: true }).eq('supplier_id', supplierId).eq('status', 'pending_tsqa'),
    db.from('supplier_products').select('id', { count: 'exact', head: true }).eq('supplier_id', supplierId).eq('status', 'rejected'),
    db.from('supplier_products').select('id', { count: 'exact', head: true }).eq('supplier_id', supplierId).eq('status', 'draft'),
  ]);

  let rfqsPending = 0;
  try {
    const { data: rsRows } = await db
      .from('rfq_suppliers')
      .select('id, rfq_id')
      .eq('supplier_id', supplierId);
    const rsList = (rsRows ?? []) as { id: string; rfq_id: string }[];
    if (rsList.length > 0) {
      const rfqIds     = Array.from(new Set(rsList.map(r => r.rfq_id)));
      const { data: openRfqs } = await db
        .from('rfq_batches')
        .select('id')
        .in('id', rfqIds)
        .eq('status', 'open');
      const openSet = new Set((openRfqs ?? []).map((r: any) => r.id as string));
      const openRsIds = rsList.filter(r => openSet.has(r.rfq_id)).map(r => r.id);
      if (openRsIds.length > 0) {
        const { data: quotes } = await db
          .from('rfq_item_quotes')
          .select('rfq_supplier_id, supplier_product_id')
          .in('rfq_supplier_id', openRsIds)
          .not('supplier_product_id', 'is', null);
        const productIds = Array.from(
          new Set(
            ((quotes ?? []) as any[])
              .map((q: any) => q.supplier_product_id as string)
              .filter(Boolean)
          )
        );
        if (productIds.length > 0) {
          const { data: prods } = await db
            .from('supplier_products')
            .select('id, status, supplier_id')
            .in('id', productIds)
            .eq('supplier_id', supplierId)
            .neq('status', 'verified');
          const pendingProductIds = new Set((prods ?? []).map((p: any) => p.id as string));
          const affectedRfqs = new Set<string>();
          for (const q of (quotes ?? []) as any[]) {
            if (pendingProductIds.has(q.supplier_product_id as string)) {
              const rs = rsList.find(x => x.id === q.rfq_supplier_id);
              if (rs && openSet.has(rs.rfq_id)) affectedRfqs.add(rs.rfq_id);
            }
          }
          rfqsPending = affectedRfqs.size;
        }
      }
    }
  } catch {
    rfqsPending = 0;
  }

  const inReview =
    (submittedRes.count ?? 0) + (underReviewRes.count ?? 0);

  return {
    accreditationStatus:          (accRes.data?.status as string) ?? null,
    totalProducts:                totalRes.count ?? 0,
    verifiedProducts:             verifiedRes.count ?? 0,
    inReviewProducts:             inReview,
    pendingTsqaProducts:          pendingTsqaRes.count ?? 0,
    rejectedProducts:             rejectedRes.count ?? 0,
    draftProducts:                draftRes.count ?? 0,
    rfqsPendingProductValidation: rfqsPending,
  };
}

/** Procurement / admin dashboard — compliance slice only. */
export async function fetchProcurementComplianceDashboardStats(): Promise<ProcurementComplianceDashboardStats> {
  const [
    accPend,
    prodReview,
    prodTsqa,
    verified,
    rejected,
    rseActive,
  ] = await Promise.all([
    db
      .from('supplier_accreditations')
      .select('id', { count: 'exact', head: true })
      .in('status', ['submitted', 'under_review', 'missing_documents']),
    db
      .from('supplier_products')
      .select('id', { count: 'exact', head: true })
      .in('status', ['submitted', 'under_review']),
    db
      .from('supplier_products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_tsqa'),
    db
      .from('supplier_products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'verified'),
    db
      .from('supplier_products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'rejected'),
    db
      .from('rse_records')
      .select('id', { count: 'exact', head: true })
      .in('status', ['created', 'assigned', 'under_review']),
  ]);

  return {
    accreditationPendingReview: accPend.count ?? 0,
    productsPendingReview:      prodReview.count ?? 0,
    productsPendingTsqa:        prodTsqa.count ?? 0,
    verifiedProducts:           verified.count ?? 0,
    rejectedProducts:           rejected.count ?? 0,
    rsePendingTsqa:             rseActive.count ?? 0,
  };
}
