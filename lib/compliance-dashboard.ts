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
  /**
   * Distinct open RFQs where this supplier has at least one quote line on a
   * **raw-material** PR1 item linked to a non-verified product.
   * Phase 11 (Raw Mats) re-scoped this from "any unverified product link" to
   * "raw-mats lines only" — non-raw-mats lines may legitimately be offered
   * with unverified products under the relaxed rules introduced in Phase 5.
   */
  rfqsPendingProductValidation: number;
}

export interface ProcurementComplianceDashboardStats {
  accreditationPendingReview: number;
  productsPendingReview:      number;
  productsPendingTsqa:        number;
  verifiedProducts:           number;
  rejectedProducts:           number;
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
        // Phase 11 (Raw Mats): widen the quote query to pull `pr1_item_id`
        // so we can later filter to raw-mats lines only. Pre-Phase-11
        // behaviour flagged ANY non-verified linked product as a
        // compliance issue; that produced false alarms after Phase 5
        // since suppliers may legitimately offer unverified products on
        // non-raw-mats lines.
        const { data: quotes } = await db
          .from('rfq_item_quotes')
          .select('rfq_supplier_id, supplier_product_id, pr1_item_id')
          .in('rfq_supplier_id', openRsIds)
          .not('supplier_product_id', 'is', null);
        const quoteRows = ((quotes ?? []) as any[]).filter(q => q.pr1_item_id);

        // Resolve which PR1 items are raw mats — only those count.
        const pr1ItemIds = Array.from(
          new Set(quoteRows.map((q: any) => q.pr1_item_id as string)),
        );
        let rawMatItemSet = new Set<string>();
        if (pr1ItemIds.length > 0) {
          const { data: pr1Items } = await db
            .from('pr1_items')
            .select('id, is_raw_material')
            .in('id', pr1ItemIds)
            .eq('is_raw_material', true);
          rawMatItemSet = new Set(
            ((pr1Items ?? []) as any[]).map((p: any) => p.id as string),
          );
        }

        // Only consider quotes on raw-mats lines.
        const rawMatQuotes = quoteRows.filter(q =>
          rawMatItemSet.has(q.pr1_item_id as string),
        );

        const productIds = Array.from(
          new Set(
            rawMatQuotes
              .map((q: any) => q.supplier_product_id as string)
              .filter(Boolean),
          ),
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
          for (const q of rawMatQuotes) {
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
  ]);

  return {
    accreditationPendingReview: accPend.count ?? 0,
    productsPendingReview:      prodReview.count ?? 0,
    productsPendingTsqa:        prodTsqa.count ?? 0,
    verifiedProducts:           verified.count ?? 0,
    rejectedProducts:           rejected.count ?? 0,
  };
}
