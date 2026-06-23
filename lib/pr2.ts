import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type { PR2Request, PR2WithItems, PR2ItemDraft } from '@/types/pr2';
import { createNotification } from '@/lib/notifications';
import { fetchWarehouseProcurementByPr1Item, fetchRfqQuoteAttachmentsByRfq } from '@/lib/canvassing';
import { fetchPR1Attachments } from './pr1';
import type { PR1Attachment } from '@/types/pr1';
import type { RfqQuoteAttachment } from '@/types/canvassing';

const db = supabase as any;

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function fetchDepartmentOptions(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await db
    .from('departments')
    .select('id, name')
    .eq('active', true)
    .order('name', { ascending: true });
  if (error) throw error;
  return (data ?? []) as { id: string; name: string }[];
}

export async function fetchPR2s(options: {
  limit:  number;
  offset: number;
  status?: string;
  search?: string;
  departmentId?: string;
}): Promise<{ pr2s: PR2Request[]; total_count: number }> {
  const { limit, offset, status, search, departmentId } = options;

  const buildBaseQuery = () => {
    let q = db.from('pr2_requests').select('*');

    if (status && status !== 'all') {
      q = q.eq('status', status);
    }

    if (search && search.trim()) {
      const t = `%${search.trim()}%`;
      q = q.or(`pr2_number.ilike.${t},purpose.ilike.${t}`);
    }

    if (departmentId) {
      q = q.eq('department_id', departmentId);
    }

    return q;
  };

  const [listRes, countRes] = await Promise.all([
    buildBaseQuery()
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
    buildBaseQuery().select('*', { count: 'exact', head: true }),
  ]);

  if (listRes.error) throw listRes.error;
  if (countRes.error) throw countRes.error;

  return {
    pr2s:        (listRes.data ?? []) as PR2Request[],
    total_count: countRes.count ?? 0,
  };
}

export async function fetchPR2ById(id: string): Promise<PR2WithItems | null> {
  const { data: pr2, error } = await db
    .from('pr2_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!pr2) return null;

  const { data: items, error: itemsErr } = await db
    .from('pr2_items')
    .select('*')
    .eq('pr2_id', id)
    .order('item_order', { ascending: true });

  if (itemsErr) throw itemsErr;

  const [pr1Attachments, quoteAttachmentsByQuote, pr1TypeRes] = await Promise.all([
    fetchPR1Attachments(pr2.pr1_id).catch(() => [] as PR1Attachment[]),
    pr2.rfq_id
      ? fetchRfqQuoteAttachmentsByRfq(pr2.rfq_id).catch(() => ({} as Record<string, RfqQuoteAttachment[]>))
      : Promise.resolve({} as Record<string, RfqQuoteAttachment[]>),
    db.from('pr1_requests').select('request_type').eq('id', pr2.pr1_id).maybeSingle(),
  ]);

  const attachmentsByItem: Record<string, PR1Attachment[]> = {};
  for (const att of pr1Attachments) {
    if (!attachmentsByItem[att.pr1_item_id]) attachmentsByItem[att.pr1_item_id] = [];
    attachmentsByItem[att.pr1_item_id].push(att);
  }

  const itemsWithAttachments = (items ?? []).map((item: any) => ({
    ...item,
    attachments:       item.pr1_item_id ? (attachmentsByItem[item.pr1_item_id] ?? []) : [],
    quote_attachments: item.rfq_item_quote_id ? (quoteAttachmentsByQuote[item.rfq_item_quote_id] ?? []) : [],
  }));

  const request_type = (pr1TypeRes.data as any)?.request_type ?? 'goods';
  return { ...pr2, request_type, items: itemsWithAttachments } as PR2WithItems;
}

export async function fetchPR2ByRfqId(rfqId: string): Promise<PR2Request | null> {
  const { data, error } = await db
    .from('pr2_requests')
    .select('*')
    .eq('rfq_id', rfqId)
    .maybeSingle();

  if (error) throw error;
  return data as PR2Request | null;
}

// ─── Generate PR2 from closed RFQ ────────────────────────────────────────────
// Pulls all data from the RFQ's winning selections and creates a PR2 with
// pre-filled items. Procurement can then adjust qty_on_hand / qty_incoming.

export async function generatePR2FromRfq(
  rfqId: string,
  profile: UserProfile
): Promise<string> {
  // Idempotency: return existing PR2 if already generated
  const { data: existing } = await db
    .from('pr2_requests')
    .select('id')
    .eq('rfq_id', rfqId)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const now = new Date().toISOString();

  // Fetch RFQ + PR1 header
  const { data: rfq, error: rfqErr } = await db
    .from('rfq_batches')
    .select('id, rfq_number, pr1_id, status')
    .eq('id', rfqId)
    .maybeSingle();
  if (rfqErr) throw rfqErr;
  if (!rfq) throw new Error('RFQ not found.');
  if (rfq.status !== 'closed') throw new Error('RFQ must be closed before generating a PR2.');

  const { data: pr1, error: pr1Err } = await db
    .from('pr1_requests')
    .select('id, pr1_number, requisitioner_id, requisitioner_name_snapshot, department_id, department_name_snapshot, purpose, date_required')
    .eq('id', rfq.pr1_id)
    .maybeSingle();
  if (pr1Err) throw pr1Err;
  if (!pr1) throw new Error('PR1 not found.');

  // Fetch winning selections for this RFQ.
  // Phase 8 (Raw Mats): also pull `quote_justification` and
  // `requires_justification` so we can snapshot them onto pr2_items.
  const { data: selections, error: selErr } = await db
    .from('supplier_item_selections')
    .select('pr1_item_id, selected_rfq_supplier_id, selection_notes, quote_justification, requires_justification')
    .eq('rfq_id', rfqId);
  if (selErr) throw selErr;
  if (!selections || selections.length === 0) throw new Error('No supplier selections found. Close the RFQ first.');

  // Fetch PR1 items (for line metadata; quantities may come from warehouse procurement_qty).
  // Phase 8 (Raw Mats): include `is_raw_material` so PR2 lines can carry the
  // classification snapshot through PO / GRN / delivery downstream.
  const { data: pr1Items, error: pr1ItemsErr } = await db
    .from('pr1_items')
    .select('id, item_order, item_code, description, unit_of_measure, quantity_requested, stock_on_hand, is_raw_material')
    .eq('pr1_id', rfq.pr1_id)
    .order('item_order', { ascending: true });
  if (pr1ItemsErr) throw pr1ItemsErr;

  const wh = await fetchWarehouseProcurementByPr1Item(pr1.id);

  const pr2QtyForPr1Line = (pr1ItemId: string, pr1LineQty: number) => {
    if (!wh.validated) return Number(pr1LineQty) || 0;
    const p = wh.byPr1ItemId[pr1ItemId];
    if (p !== undefined && p > 0) return p;
    return Number(pr1LineQty) || 0;
  };

  const pr1ItemMap: Record<string, any> = Object.fromEntries(
    ((pr1Items ?? []) as any[]).map((i: any) => [i.id, i]),
  );

  // Fetch all quotes for winning rfq_supplier_ids
  const winningSupplierIds = Array.from(new Set((selections as any[]).map((s: any) => s.selected_rfq_supplier_id)));
  const { data: quotes, error: quotesErr } = await db
    .from('rfq_item_quotes')
    .select('id, rfq_supplier_id, pr1_item_id, quoted_description, is_alternative, unit_price, lead_time_days, remarks')
    .in('rfq_supplier_id', winningSupplierIds);
  if (quotesErr) throw quotesErr;

  // Fetch rfq_supplier names
  const { data: rfqSuppliers, error: rsErr } = await db
    .from('rfq_suppliers')
    .select('id, supplier_name_snapshot')
    .in('id', winningSupplierIds);
  if (rsErr) throw rsErr;

  const supplierNameMap: Record<string, string> = Object.fromEntries(
    ((rfqSuppliers ?? []) as any[]).map((rs: any) => [rs.id, rs.supplier_name_snapshot])
  );
  const quoteMap: Record<string, any> = {};
  for (const q of (quotes ?? []) as any[]) {
    quoteMap[`${q.rfq_supplier_id}:${q.pr1_item_id}`] = q;
  }

  // Guard: alternative quotes must be accepted by the requestor
  const alternativeQuoteIds = ((quotes ?? []) as any[])
    .filter(q => q.is_alternative)
    .map(q => q.id)
    .filter(Boolean);

  if (alternativeQuoteIds.length > 0) {
    const { data: decisions } = await db
      .from('substitute_decisions')
      .select('rfq_item_quote_id, decision')
      .in('rfq_item_quote_id', alternativeQuoteIds);

    const decisionMap: Record<string, string> = Object.fromEntries(
      ((decisions ?? []) as any[]).map((d: any) => [d.rfq_item_quote_id, d.decision])
    );

    for (const q of (quotes ?? []) as any[]) {
      if (!q.is_alternative) continue;
      const isWinner = ((selections as any[]).some(
        s => s.selected_rfq_supplier_id === q.rfq_supplier_id &&
             s.pr1_item_id === q.pr1_item_id
      ));
      if (!isWinner) continue;
      const decision = decisionMap[q.id];
      if (decision === 'rejected') {
        throw new Error(`Item "${q.quoted_description}" was rejected by the requestor and cannot be included.`);
      }
      if (!decision) {
        throw new Error(`Item "${q.quoted_description}" is an alternative awaiting requestor approval. Cannot generate PR2 yet.`);
      }
    }
  }

  // Generate PR2 number - extract year and sequence from RFQ number (RFQ-YYYY-NNN -> PR2-YYYY-NNN)
  const rfqParts = rfq.rfq_number.replace('RFQ-', '');
  const pr2Number = `PR2-${rfqParts}`;

  // Insert PR2 header
  const { data: pr2, error: pr2Err } = await db
    .from('pr2_requests')
    .insert({
      pr2_number:                  pr2Number,
      pr1_id:                      pr1.id,
      rfq_id:                      rfqId,
      requisitioner_id:            pr1.requisitioner_id,
      requisitioner_name_snapshot: pr1.requisitioner_name_snapshot,
      department_id:               pr1.department_id,
      department_name_snapshot:    pr1.department_name_snapshot,
      purpose:                     pr1.purpose,
      date_required:               pr1.date_required,
      pr1_number_snapshot:         pr1.pr1_number,
      rfq_number_snapshot:         rfq.rfq_number,
      status:                      'draft',
      generated_by:                profile.id,
      generated_at:                now,
      updated_at:                  now,
    })
    .select('id')
    .single();
  if (pr2Err) throw pr2Err;

  const pr2Id = pr2.id;

  // Build PR2 items — one row per winning selection only; qty from warehouse procurement when validated
  const itemRows = ((selections ?? []) as any[])
    .map((sel: any) => {
      const item = pr1ItemMap[sel.pr1_item_id];
      if (!item) return null;
      const supplierName = supplierNameMap[sel.selected_rfq_supplier_id] ?? '';
      const quote = quoteMap[`${sel.selected_rfq_supplier_id}:${item.id}`] ?? null;
      const unitPrice = quote ? Number(quote.unit_price) : 0;
      const qty = pr2QtyForPr1Line(item.id, item.quantity_requested);

      return {
        pr2_id:                  pr2Id,
        item_order:              item.item_order,
        item_code:               item.item_code,
        description:             item.description,
        unit_of_measure:         item.unit_of_measure,
        pr1_item_id:             item.id,
        quantity_requested:      qty,
        qty_on_hand:             0,
        qty_incoming:            0,
        quantity_to_purchase:    qty,
        selected_rfq_supplier_id: sel.selected_rfq_supplier_id ?? null,
        supplier_name_snapshot:  supplierName,
        quoted_description:      quote?.quoted_description ?? item.description,
        is_alternative:          quote?.is_alternative ?? false,
        unit_price:              unitPrice,
        lead_time_days:          quote?.lead_time_days ?? 0,
        total_price:             unitPrice * qty,
        remarks:                 sel.selection_notes ?? null,
        // Phase 8 (Raw Mats): snapshot the requestor's classification (from
        // pr1_items) and procurement's award-time justification (from
        // supplier_item_selections). Both default to safe values when the
        // upstream rows are silent so legacy PR2 generation paths still work.
        is_raw_material:         item.is_raw_material === true,
        quote_justification:     sel.requires_justification === true
          ? (sel.quote_justification ?? null)
          : null,
        rfq_item_quote_id:       quote?.id ?? null,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  itemRows.sort((a, b) => a.item_order - b.item_order);

  if (itemRows.length > 0) {
    const { error: itemsErr } = await db.from('pr2_items').insert(itemRows);
    if (itemsErr) throw itemsErr;
  }

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'PR2_GENERATED',
    document_type: 'PR2',
    document_id:   pr2Id,
    payload:       { pr2_number: pr2Number, rfq_id: rfqId, pr1_id: pr1.id },
  });

  // Notify requisitioner (best-effort)
  try {
    if (pr1.requisitioner_id) {
      await createNotification({
        user_id:       pr1.requisitioner_id,
        title:         'PR2 Generated',
        body:          'Your request has progressed to PR2.',
        type:          'info',
        document_type: 'pr2',
        document_id:   pr2Id,
        action_url:    `/pr2/${pr2Id}`,
      });
    }
  } catch {
    // Notifications are best-effort; do not fail PR2 generation
  }

  return pr2Id;
}

// ─── Update PR2 items (procurement edits qty_on_hand / qty_incoming / remarks) ─

export async function savePR2Items(
  pr2Id: string,
  items: PR2ItemDraft[],
  remarks: string,
  profile: UserProfile
): Promise<void> {
  const now = new Date().toISOString();

  // Upsert each item (update inventory fields only — pricing comes from canvassing)
  for (const item of items) {
    const qtyToPurchase = Math.max(0, Number(item.quantity_to_purchase) || 0);
    await db
      .from('pr2_items')
      .update({
        qty_on_hand:          Number(item.qty_on_hand) || 0,
        qty_incoming:         Number(item.qty_incoming) || 0,
        quantity_to_purchase: qtyToPurchase,
        total_price:          item.unit_price * qtyToPurchase,
        remarks:              item.remarks?.trim() || null,
      })
      .eq('pr2_id', pr2Id)
      .eq('item_order', item.item_order);
  }

  await db
    .from('pr2_requests')
    .update({ remarks: remarks?.trim() || null, updated_at: now })
    .eq('id', pr2Id);

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'PR2_UPDATED',
    document_type: 'PR2',
    document_id:   pr2Id,
    payload:       { updated_by: profile.full_name },
  });
}

// ─── Phase 10 (Raw Mats): procurement override of the snapshot flag ──────────
// PR2 inherits `is_raw_material` from the upstream `pr1_items` row at PR2
// generation. Procurement may flip the snapshot on a single PR2 line at any
// time after generation — this mutator writes the new value, refreshes the
// PR2 header `updated_at`, and emits an audit log entry so the override is
// traceable.
//
// The DB-level RLS on `pr2_items` already restricts updates to the
// `procurement` role; this function does an additional app-layer guard to
// produce a friendlier error when called from elsewhere by mistake.

export async function updatePR2ItemRawMaterial(
  pr2Id: string,
  pr2ItemId: string,
  isRawMaterial: boolean,
  profile: UserProfile,
): Promise<void> {
  if (profile.role !== 'procurement' && profile.role !== 'admin') {
    throw new Error(
      `User role '${profile.role}' is not authorized to override the raw-material flag.`,
    );
  }

  const now = new Date().toISOString();

  // Fetch current value first so the audit log captures the before/after.
  const { data: existing, error: fetchErr } = await db
    .from('pr2_items')
    .select('id, pr2_id, item_order, description, is_raw_material')
    .eq('id', pr2ItemId)
    .eq('pr2_id', pr2Id)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!existing) {
    throw new Error('PR2 line not found, or it does not belong to this PR2.');
  }

  const previous = (existing as any).is_raw_material === true;
  if (previous === isRawMaterial) return; // no-op

  const { error: updateErr } = await db
    .from('pr2_items')
    .update({ is_raw_material: isRawMaterial })
    .eq('id', pr2ItemId)
    .eq('pr2_id', pr2Id);

  if (updateErr) throw updateErr;

  // Touch the PR2 header so list views and dashboards register the change.
  await db
    .from('pr2_requests')
    .update({ updated_at: now })
    .eq('id', pr2Id);

  // Audit log (best-effort — do not fail the override if logging breaks).
  try {
    await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'RAW_MATERIAL_FLAG_CHANGED',
      document_type: 'PR2_ITEM',
      document_id:   pr2ItemId,
      payload: {
        pr2_id:           pr2Id,
        item_order:       (existing as any).item_order,
        item_description: (existing as any).description,
        previous_value:   previous,
        new_value:        isRawMaterial,
        changed_by:       profile.full_name,
        role:             profile.role,
        position:         profile.position,
      },
    });
  } catch (auditErr) {
    console.warn('Failed to write raw-material override audit log:', auditErr);
  }
}

// ─── Grand total ──────────────────────────────────────────────────────────────

export function calcPR2GrandTotal(items: { unit_price: number; quantity_to_purchase: number }[]): number {
  return items.reduce((sum, item) => sum + item.unit_price * item.quantity_to_purchase, 0);
}
