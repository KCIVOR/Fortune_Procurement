import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import { getVatSettings, computeLineVat } from '@/lib/vat';

const db = supabase as any;

async function fetchWarehouseOverridesByPr1Item(
  pr1Id: string,
): Promise<Record<string, { reason: string; overridden_by_name: string | null }>> {
  const { data: wv } = await db
    .from('warehouse_validations')
    .select('id')
    .eq('pr1_id', pr1Id)
    .maybeSingle();
  if (!wv?.id) return {};

  const { data: rows } = await db
    .from('warehouse_validation_items')
    .select('pr1_item_id, quantity_override_reason, quantity_overridden_by_name_snapshot')
    .eq('validation_id', wv.id)
    .not('quantity_overridden_by', 'is', null);

  const map: Record<string, { reason: string; overridden_by_name: string | null }> = {};
  for (const r of (rows ?? []) as any[]) {
    map[r.pr1_item_id] = {
      reason:             r.quantity_override_reason ?? '',
      overridden_by_name: r.quantity_overridden_by_name_snapshot ?? null,
    };
  }
  return map;
}

/**
 * Goods only: sync winning RFQ selections onto existing warehouse-created PR2 lines.
 * Updates supplier/price fields in place (match by pr1_item_id).
 */
export async function syncPR2ItemsFromRfqSelections(
  pr2Id: string,
  rfqId: string,
  profile: UserProfile,
): Promise<void> {
  const { data: pr2, error: pr2Err } = await db
    .from('pr2_requests')
    .select('id, pr1_id, pr2_number')
    .eq('id', pr2Id)
    .maybeSingle();
  if (pr2Err) throw pr2Err;
  if (!pr2) throw new Error('PR2 not found.');

  const { data: rfq, error: rfqErr } = await db
    .from('rfq_batches')
    .select('id, rfq_number, pr1_id, status, pr2_id')
    .eq('id', rfqId)
    .maybeSingle();
  if (rfqErr) throw rfqErr;
  if (!rfq) throw new Error('RFQ not found.');
  if (rfq.pr2_id && rfq.pr2_id !== pr2Id) {
    throw new Error('RFQ is linked to a different PR2.');
  }
  if (rfq.pr1_id !== pr2.pr1_id) {
    throw new Error('RFQ and PR2 must belong to the same PR1.');
  }

  const { data: selections, error: selErr } = await db
    .from('supplier_item_selections')
    .select('pr1_item_id, selected_rfq_supplier_id, selection_notes, quote_justification, requires_justification')
    .eq('rfq_id', rfqId);
  if (selErr) throw selErr;
  if (!selections?.length) {
    throw new Error('No supplier selections found. Award suppliers before closing the RFQ.');
  }

  const { data: pr2Items, error: pr2ItemsErr } = await db
    .from('pr2_items')
    .select('id, pr1_item_id, item_order, quantity_to_purchase, quantity_requested')
    .eq('pr2_id', pr2Id);
  if (pr2ItemsErr) throw pr2ItemsErr;
  if (!pr2Items?.length) throw new Error('PR2 has no line items to sync.');

  const pr2ItemByPr1Id: Record<string, any> = Object.fromEntries(
    (pr2Items as any[]).filter((i) => i.pr1_item_id).map((i) => [i.pr1_item_id, i]),
  );

  const { data: pr1Items, error: pr1ItemsErr } = await db
    .from('pr1_items')
    .select('id, item_order, item_code, description, unit_of_measure, quantity_requested, is_raw_material, remarks')
    .eq('pr1_id', pr2.pr1_id);
  if (pr1ItemsErr) throw pr1ItemsErr;

  const pr1ItemMap: Record<string, any> = Object.fromEntries(
    ((pr1Items ?? []) as any[]).map((i) => [i.id, i]),
  );

  const whOverrides = await fetchWarehouseOverridesByPr1Item(pr2.pr1_id);

  const winningSupplierIds = Array.from(
    new Set((selections as any[]).map((s) => s.selected_rfq_supplier_id).filter(Boolean)),
  );

  const { data: quotes, error: quotesErr } = await db
    .from('rfq_item_quotes')
    .select('id, rfq_supplier_id, pr1_item_id, quoted_description, is_alternative, unit_price, lead_time_days, remarks, vat_type')
    .in('rfq_supplier_id', winningSupplierIds);
  if (quotesErr) throw quotesErr;

  const { data: rfqSuppliers, error: rsErr } = await db
    .from('rfq_suppliers')
    .select('id, supplier_name_snapshot, supplier_id')
    .in('id', winningSupplierIds);
  if (rsErr) throw rsErr;

  const supplierNameMap: Record<string, string> = Object.fromEntries(
    ((rfqSuppliers ?? []) as any[]).map((rs) => [rs.id, rs.supplier_name_snapshot]),
  );

  const supplierIdsForVat = Array.from(
    new Set(((rfqSuppliers ?? []) as any[]).map((rs) => rs.supplier_id).filter(Boolean)),
  );
  const { data: vatProfiles } = supplierIdsForVat.length > 0
    ? await db.from('profiles').select('id, is_vat_registered').in('id', supplierIdsForVat)
    : { data: [] as any[] };
  const vatRegisteredBySupplierId: Record<string, boolean> = Object.fromEntries(
    ((vatProfiles ?? []) as any[]).map((p) => [p.id, Boolean(p.is_vat_registered)]),
  );
  const isRfqSupplierVatRegistered: Record<string, boolean> = Object.fromEntries(
    ((rfqSuppliers ?? []) as any[]).map((rs) => [
      rs.id,
      rs.supplier_id ? Boolean(vatRegisteredBySupplierId[rs.supplier_id]) : false,
    ]),
  );

  const vatSettings = await getVatSettings();
  const quoteMap: Record<string, any> = {};
  for (const q of (quotes ?? []) as any[]) {
    quoteMap[`${q.rfq_supplier_id}:${q.pr1_item_id}`] = q;
  }

  const alternativeQuoteIds = ((quotes ?? []) as any[])
    .filter((q) => q.is_alternative)
    .map((q) => q.id)
    .filter(Boolean);

  if (alternativeQuoteIds.length > 0) {
    const { data: decisions } = await db
      .from('substitute_decisions')
      .select('rfq_item_quote_id, decision')
      .in('rfq_item_quote_id', alternativeQuoteIds);

    const decisionMap: Record<string, string> = Object.fromEntries(
      ((decisions ?? []) as any[]).map((d) => [d.rfq_item_quote_id, d.decision]),
    );

    for (const q of (quotes ?? []) as any[]) {
      if (!q.is_alternative) continue;
      const isWinner = (selections as any[]).some(
        (s) => s.selected_rfq_supplier_id === q.rfq_supplier_id && s.pr1_item_id === q.pr1_item_id,
      );
      if (!isWinner) continue;
      const decision = decisionMap[q.id];
      if (decision === 'rejected') {
        throw new Error(`Item "${q.quoted_description}" was rejected by the requestor and cannot be included.`);
      }
      if (!decision) {
        throw new Error(
          `Item "${q.quoted_description}" is an alternative awaiting requestor approval. Cannot close RFQ yet.`,
        );
      }
    }
  }

  const now = new Date().toISOString();
  let synced = 0;

  for (const sel of selections as any[]) {
    const pr2Item = pr2ItemByPr1Id[sel.pr1_item_id];
    if (!pr2Item) continue;

    const item = pr1ItemMap[sel.pr1_item_id];
    if (!item) continue;

    const supplierName = supplierNameMap[sel.selected_rfq_supplier_id] ?? '';
    const quote = quoteMap[`${sel.selected_rfq_supplier_id}:${item.id}`] ?? null;
    const unitPrice = quote ? Number(quote.unit_price) : 0;
    const qty = Number(pr2Item.quantity_to_purchase) || Number(pr2Item.quantity_requested) || 0;
    const isVatRegistered = isRfqSupplierVatRegistered[sel.selected_rfq_supplier_id] ?? false;
    const vatBreakdown = computeLineVat(
      unitPrice,
      qty,
      isVatRegistered,
      quote?.vat_type ?? null,
      vatSettings.vat_rate,
    );

    const { error: updErr } = await db
      .from('pr2_items')
      .update({
        selected_rfq_supplier_id:            sel.selected_rfq_supplier_id ?? null,
        supplier_name_snapshot:              supplierName,
        quoted_description:                  quote?.quoted_description ?? item.description,
        is_alternative:                      quote?.is_alternative ?? false,
        unit_price:                          unitPrice,
        lead_time_days:                      quote?.lead_time_days ?? 0,
        total_price:                         vatBreakdown.total,
        vat_type:                            vatBreakdown.vatType,
        vat_rate_applied:                    vatBreakdown.vatType ? vatSettings.vat_rate : null,
        remarks:                             sel.selection_notes ?? null,
        quote_justification:                 sel.requires_justification === true
          ? (sel.quote_justification ?? null)
          : null,
        rfq_item_quote_id:                   quote?.id ?? null,
        quantity_override_reason_snapshot:   whOverrides[item.id]?.reason || null,
        quantity_overridden_by_name_snapshot: whOverrides[item.id]?.overridden_by_name || null,
        pr1_quantity_requested_snapshot:     Number(item.quantity_requested),
        pr1_remarks_snapshot:                item.remarks ?? null,
      })
      .eq('id', pr2Item.id);
    if (updErr) throw updErr;
    synced++;
  }

  if (synced === 0) {
    throw new Error('No PR2 lines could be synced from RFQ selections.');
  }

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'PR2_SYNCED_FROM_RFQ',
    document_type: 'PR2',
    document_id:   pr2Id,
    payload: {
      pr2_number: pr2.pr2_number,
      rfq_id:     rfqId,
      rfq_number: rfq.rfq_number,
      synced_by:  profile.full_name,
      line_count: synced,
    },
  });
}

/**
 * PR2-native requests only (Raw Material or Planning-direct Services): sync
 * winning RFQ selections onto the PR2's own lines (match by pr2_item_id
 * directly — there is no PR1/warehouse layer to snapshot from, unlike the
 * goods/services-via-PR1 sync above).
 */
export async function syncRawMaterialPR2ItemsFromRfqSelections(
  pr2Id: string,
  rfqId: string,
  profile: UserProfile,
): Promise<void> {
  const { data: pr2, error: pr2Err } = await db
    .from('pr2_requests')
    .select('id, request_type, pr2_number, pr1_id')
    .eq('id', pr2Id)
    .maybeSingle();
  if (pr2Err) throw pr2Err;
  if (!pr2) throw new Error('PR2 not found.');
  if (pr2.pr1_id || (pr2.request_type !== 'raw_material' && pr2.request_type !== 'services')) {
    throw new Error('Not a PR2-native (Planning-direct) request.');
  }

  const { data: rfq, error: rfqErr } = await db
    .from('rfq_batches')
    .select('id, rfq_number, pr2_id, status')
    .eq('id', rfqId)
    .maybeSingle();
  if (rfqErr) throw rfqErr;
  if (!rfq) throw new Error('RFQ not found.');
  if (rfq.pr2_id !== pr2Id) {
    throw new Error('RFQ is linked to a different PR2.');
  }

  const { data: selections, error: selErr } = await db
    .from('supplier_item_selections')
    .select('pr2_item_id, selected_rfq_supplier_id, selection_notes, quote_justification, requires_justification')
    .eq('rfq_id', rfqId)
    .not('pr2_item_id', 'is', null);
  if (selErr) throw selErr;
  if (!selections?.length) {
    throw new Error('No supplier selections found. Award suppliers before closing the RFQ.');
  }

  const { data: pr2Items, error: pr2ItemsErr } = await db
    .from('pr2_items')
    .select('id, item_order, description, quantity_to_purchase, quantity_requested')
    .eq('pr2_id', pr2Id);
  if (pr2ItemsErr) throw pr2ItemsErr;
  if (!pr2Items?.length) throw new Error('PR2 has no line items to sync.');

  const pr2ItemById: Record<string, any> = Object.fromEntries(
    (pr2Items as any[]).map((i) => [i.id, i]),
  );

  const winningSupplierIds = Array.from(
    new Set((selections as any[]).map((s) => s.selected_rfq_supplier_id).filter(Boolean)),
  );

  const { data: quotes, error: quotesErr } = await db
    .from('rfq_item_quotes')
    .select('id, rfq_supplier_id, pr2_item_id, quoted_description, is_alternative, unit_price, lead_time_days, remarks, vat_type')
    .in('rfq_supplier_id', winningSupplierIds);
  if (quotesErr) throw quotesErr;

  const { data: rfqSuppliers, error: rsErr } = await db
    .from('rfq_suppliers')
    .select('id, supplier_name_snapshot, supplier_id')
    .in('id', winningSupplierIds);
  if (rsErr) throw rsErr;

  const supplierNameMap: Record<string, string> = Object.fromEntries(
    ((rfqSuppliers ?? []) as any[]).map((rs) => [rs.id, rs.supplier_name_snapshot]),
  );

  const supplierIdsForVat = Array.from(
    new Set(((rfqSuppliers ?? []) as any[]).map((rs) => rs.supplier_id).filter(Boolean)),
  );
  const { data: vatProfiles } = supplierIdsForVat.length > 0
    ? await db.from('profiles').select('id, is_vat_registered').in('id', supplierIdsForVat)
    : { data: [] as any[] };
  const vatRegisteredBySupplierId: Record<string, boolean> = Object.fromEntries(
    ((vatProfiles ?? []) as any[]).map((p) => [p.id, Boolean(p.is_vat_registered)]),
  );
  const isRfqSupplierVatRegistered: Record<string, boolean> = Object.fromEntries(
    ((rfqSuppliers ?? []) as any[]).map((rs) => [
      rs.id,
      rs.supplier_id ? Boolean(vatRegisteredBySupplierId[rs.supplier_id]) : false,
    ]),
  );

  const vatSettings = await getVatSettings();
  const quoteMap: Record<string, any> = {};
  for (const q of (quotes ?? []) as any[]) {
    quoteMap[`${q.rfq_supplier_id}:${q.pr2_item_id}`] = q;
  }

  const alternativeQuoteIds = ((quotes ?? []) as any[])
    .filter((q) => q.is_alternative)
    .map((q) => q.id)
    .filter(Boolean);

  if (alternativeQuoteIds.length > 0) {
    const { data: decisions } = await db
      .from('substitute_decisions')
      .select('rfq_item_quote_id, decision')
      .in('rfq_item_quote_id', alternativeQuoteIds);

    const decisionMap: Record<string, string> = Object.fromEntries(
      ((decisions ?? []) as any[]).map((d) => [d.rfq_item_quote_id, d.decision]),
    );

    for (const q of (quotes ?? []) as any[]) {
      if (!q.is_alternative) continue;
      const isWinner = (selections as any[]).some(
        (s) => s.selected_rfq_supplier_id === q.rfq_supplier_id && s.pr2_item_id === q.pr2_item_id,
      );
      if (!isWinner) continue;
      const decision = decisionMap[q.id];
      if (decision === 'rejected') {
        throw new Error(`Item "${q.quoted_description}" was rejected and cannot be included.`);
      }
      if (!decision) {
        throw new Error(
          `Item "${q.quoted_description}" is an alternative awaiting review. Cannot close RFQ yet.`,
        );
      }
    }
  }

  const now = new Date().toISOString();
  let synced = 0;

  for (const sel of selections as any[]) {
    const pr2Item = pr2ItemById[sel.pr2_item_id];
    if (!pr2Item) continue;

    const supplierName = supplierNameMap[sel.selected_rfq_supplier_id] ?? '';
    const quote = quoteMap[`${sel.selected_rfq_supplier_id}:${pr2Item.id}`] ?? null;
    const unitPrice = quote ? Number(quote.unit_price) : 0;
    const qty = Number(pr2Item.quantity_to_purchase) || Number(pr2Item.quantity_requested) || 0;
    const isVatRegistered = isRfqSupplierVatRegistered[sel.selected_rfq_supplier_id] ?? false;
    const vatBreakdown = computeLineVat(
      unitPrice,
      qty,
      isVatRegistered,
      quote?.vat_type ?? null,
      vatSettings.vat_rate,
    );

    const { error: updErr } = await db
      .from('pr2_items')
      .update({
        selected_rfq_supplier_id: sel.selected_rfq_supplier_id ?? null,
        supplier_name_snapshot:   supplierName,
        quoted_description:       quote?.quoted_description ?? pr2Item.description,
        is_alternative:           quote?.is_alternative ?? false,
        unit_price:               unitPrice,
        lead_time_days:           quote?.lead_time_days ?? 0,
        total_price:              vatBreakdown.total,
        vat_type:                 vatBreakdown.vatType,
        vat_rate_applied:         vatBreakdown.vatType ? vatSettings.vat_rate : null,
        remarks:                  sel.selection_notes ?? null,
        quote_justification:      sel.requires_justification === true
          ? (sel.quote_justification ?? null)
          : null,
        rfq_item_quote_id:        quote?.id ?? null,
      })
      .eq('id', pr2Item.id);
    if (updErr) throw updErr;
    synced++;
  }

  if (synced === 0) {
    throw new Error('No PR2 lines could be synced from RFQ selections.');
  }

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'PR2_SYNCED_FROM_RFQ',
    document_type: 'PR2',
    document_id:   pr2Id,
    payload: {
      pr2_number: pr2.pr2_number,
      rfq_id:     rfqId,
      rfq_number: rfq.rfq_number,
      synced_by:  profile.full_name,
      line_count: synced,
    },
  });
}

/** Returns true when the latest RFQ approval instance is fully approved. */
export async function isRfqApprovalComplete(rfqId: string): Promise<boolean> {
  const { data, error } = await db
    .from('approval_instances')
    .select('status')
    .eq('document_type', 'RFQ')
    .eq('document_id', rfqId)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.status === 'approved';
}
