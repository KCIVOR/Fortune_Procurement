import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import { createNotification } from '@/lib/notifications';
import type {
  RfqBatch,
  RfqSupplier,
  RfqItemQuote,
  CanvassingQueueRow,
  RfqDetailView,
  QuoteMatrixRow,
  SupplierRfqInboxRow,
  SubstituteDecisionRow,
  SubstituteDecision,
  SubstituteReviewItem,
  SubstituteReviewBundle,
} from '@/types/canvassing';

const db = supabase as any;

// ─── Canvassing queue (procurement) ──────────────────────────────────────────
// Returns PR1s with status=for_canvassing, joined with their RFQ if one exists.

export async function fetchCanvassingQueue(): Promise<CanvassingQueueRow[]> {
  const { data: pr1s, error: pr1Err } = await db
    .from('pr1_requests')
    .select('id, pr1_number, requisitioner_name_snapshot, department_name_snapshot, purpose, priority, date_required, submitted_at')
    .in('status', ['for_canvassing', 'canvassing_complete'])
    .order('submitted_at', { ascending: true });

  if (pr1Err) throw pr1Err;
  if (!pr1s || pr1s.length === 0) return [];

  const pr1Ids = (pr1s as any[]).map((r: any) => r.id);

  const { data: rfqs, error: rfqErr } = await db
    .from('rfq_batches')
    .select('id, pr1_id, rfq_number, status')
    .in('pr1_id', pr1Ids);

  if (rfqErr) throw rfqErr;

  const rfqMap: Record<string, any> = {};
  for (const rfq of (rfqs ?? []) as any[]) {
    rfqMap[rfq.pr1_id] = rfq;
  }

  return (pr1s as any[]).map((pr1: any) => {
    const rfq = rfqMap[pr1.id] ?? null;
    return {
      pr1_id:                      pr1.id,
      pr1_number:                  pr1.pr1_number,
      requisitioner_name_snapshot: pr1.requisitioner_name_snapshot,
      department_name_snapshot:    pr1.department_name_snapshot,
      purpose:                     pr1.purpose,
      priority:                    pr1.priority ?? 'normal',
      date_required:               pr1.date_required,
      submitted_at:                pr1.submitted_at,
      rfq_id:                      rfq?.id ?? null,
      rfq_number:                  rfq?.rfq_number ?? null,
      rfq_status:                  rfq?.status ?? null,
    };
  });
}

// ─── Canvassing queue: paginated ─────────────────────────────────────────────

const CANVASSING_QUEUE_PR1_SELECT =
  'id, pr1_number, requisitioner_name_snapshot, department_name_snapshot, purpose, priority, date_required, submitted_at';

export async function fetchCanvassingQueuePaged(options: {
  limit: number;
  offset: number;
  search?: string;
}): Promise<{ rows: CanvassingQueueRow[]; total_count: number }> {
  const { limit, offset, search } = options;
  const term = search?.trim();

  let pr1IdsMatchingRfqNumber: string[] = [];
  if (term) {
    const pattern = `%${term}%`;
    const { data: rfqHits, error: rfqSearchErr } = await db
      .from('rfq_batches')
      .select('pr1_id')
      .ilike('rfq_number', pattern);
    if (rfqSearchErr) throw rfqSearchErr;
    pr1IdsMatchingRfqNumber = Array.from(
      new Set((rfqHits ?? []).map((r: any) => r.pr1_id).filter(Boolean))
    );
  }

  const applyFilters = (q: any) => {
    q = q.in('status', ['for_canvassing', 'canvassing_complete']);
    if (term) {
      const p = `%${term}%`;
      const orParts = [
        `pr1_number.ilike.${p}`,
        `purpose.ilike.${p}`,
        `department_name_snapshot.ilike.${p}`,
        `requisitioner_name_snapshot.ilike.${p}`,
      ];
      if (pr1IdsMatchingRfqNumber.length > 0) {
        orParts.push(`id.in.(${pr1IdsMatchingRfqNumber.join(',')})`);
      }
      q = q.or(orParts.join(','));
    }
    return q;
  };

  const [pr1sRes, countRes] = await Promise.all([
    applyFilters(db.from('pr1_requests').select(CANVASSING_QUEUE_PR1_SELECT))
      .order('submitted_at', { ascending: true })
      .range(offset, offset + limit - 1),
    applyFilters(db.from('pr1_requests').select('id', { count: 'exact', head: true })),
  ]);

  if (pr1sRes.error) throw pr1sRes.error;
  if (countRes.error) throw countRes.error;

  const pr1s = pr1sRes.data ?? [];
  if (pr1s.length === 0) return { rows: [], total_count: countRes.count ?? 0 };

  const pr1Ids = (pr1s as any[]).map((r: any) => r.id);

  const { data: rfqs, error: rfqErr } = await db
    .from('rfq_batches')
    .select('id, pr1_id, rfq_number, status')
    .in('pr1_id', pr1Ids);

  if (rfqErr) throw rfqErr;

  const rfqMap: Record<string, any> = {};
  for (const rfq of (rfqs ?? []) as any[]) {
    rfqMap[rfq.pr1_id] = rfq;
  }

  return {
    rows: (pr1s as any[]).map((pr1: any) => {
      const rfq = rfqMap[pr1.id] ?? null;
      return {
        pr1_id:                      pr1.id,
        pr1_number:                  pr1.pr1_number,
        requisitioner_name_snapshot: pr1.requisitioner_name_snapshot,
        department_name_snapshot:    pr1.department_name_snapshot,
        purpose:                     pr1.purpose,
        priority:                    pr1.priority ?? 'normal',
        date_required:               pr1.date_required,
        submitted_at:                pr1.submitted_at,
        rfq_id:                      rfq?.id ?? null,
        rfq_number:                  rfq?.rfq_number ?? null,
        rfq_status:                  rfq?.status ?? null,
      };
    }),
    total_count: countRes.count ?? 0,
  };
}

// ─── RFQ detail (procurement) ─────────────────────────────────────────────────

export async function fetchRfqDetail(rfqId: string): Promise<RfqDetailView | null> {
  const { data: rfq, error: rfqErr } = await db
    .from('rfq_batches')
    .select('*')
    .eq('id', rfqId)
    .maybeSingle();

  if (rfqErr) throw rfqErr;
  if (!rfq) return null;

  const [pr1Res, itemsRes, suppliersRes] = await Promise.all([
    db.from('pr1_requests')
      .select('id, pr1_number, requisitioner_name_snapshot, department_name_snapshot, purpose, date_required')
      .eq('id', rfq.pr1_id)
      .maybeSingle(),
    db.from('pr1_items')
      .select('id, item_order, item_code, description, unit_of_measure, quantity_requested')
      .eq('pr1_id', rfq.pr1_id)
      .order('item_order', { ascending: true }),
    db.from('rfq_suppliers')
      .select('*')
      .eq('rfq_id', rfqId),
  ]);

  if (pr1Res.error) throw pr1Res.error;
  if (!pr1Res.data) return null;
  if (itemsRes.error) throw itemsRes.error;

  const assignedSuppliers: any[] = suppliersRes.data ?? [];
  const supplierIds = assignedSuppliers.map((s: any) => s.id);

  // Optional data — never throw, fall back to empty
  let quotes: any[] = [];
  let selections: any[] = [];

  const [selectionsRes, quotesRes] = await Promise.all([
    db.from('supplier_item_selections').select('*').eq('rfq_id', rfqId),
    supplierIds.length > 0
      ? db.from('rfq_item_quotes').select('*').in('rfq_supplier_id', supplierIds)
      : Promise.resolve({ data: [] }),
  ]);
  quotes     = quotesRes.data ?? [];
  selections = selectionsRes.data ?? [];

  // Fetch substitute decisions for this PR1 (covers all alternative quotes in the RFQ)
  let substituteDecisions: SubstituteDecisionRow[] = [];
  const { data: decisionData } = await db
    .from('substitute_decisions')
    .select('*')
    .eq('pr1_id', rfq.pr1_id);
  substituteDecisions = (decisionData ?? []) as SubstituteDecisionRow[];

  // All supplier profiles for assignment dropdown — two separate queries, no subquery
  const { data: roles } = await db.from('roles').select('id').eq('name', 'supplier');
  const supplierRoleId = (roles ?? [])[0]?.id ?? null;
  let allSuppliers: any[] = [];
  if (supplierRoleId) {
    const { data } = await db
      .from('profiles')
      .select('id, full_name')
      .eq('role_id', supplierRoleId)
      .order('full_name', { ascending: true });
    allSuppliers = data ?? [];
  }

  return {
    rfq,
    pr1:        pr1Res.data,
    items:      itemsRes.data ?? [],
    suppliers:  assignedSuppliers,
    quotes,
    selections,
    substituteDecisions,
    allSuppliers,
  };
}

// ─── Build quote comparison matrix ───────────────────────────────────────────

export function buildQuoteMatrix(detail: RfqDetailView): QuoteMatrixRow[] {
  const decisionByQuoteId: Record<string, SubstituteDecision> = {};
  for (const d of detail.substituteDecisions) {
    decisionByQuoteId[d.rfq_item_quote_id] = d.decision;
  }

  return detail.items.map(item => {
    const selection = detail.selections.find(s => s.pr1_item_id === item.id);

    const quotes = detail.suppliers.map(supplier => {
      const quote = detail.quotes.find(
        q => q.rfq_supplier_id === supplier.id && q.pr1_item_id === item.id
      );
      return {
        rfq_supplier_id:    supplier.id,
        quote_id:           quote?.id ?? null,
        supplier_name:      supplier.supplier_name_snapshot,
        quoted_description: quote?.quoted_description ?? '',
        is_alternative:     quote?.is_alternative ?? false,
        unit_price:         quote ? Number(quote.unit_price) : 0,
        lead_time_days:     quote?.lead_time_days ?? 0,
        remarks:            quote?.remarks ?? null,
        total_price:        quote ? Number(quote.unit_price) * item.quantity_requested : 0,
        is_selected:        selection?.selected_rfq_supplier_id === supplier.id,
        substitute_decision: quote ? decisionByQuoteId[quote.id] ?? null : null,
      };
    });

    return {
      item,
      quotes,
      selected_rfq_supplier_id: selection?.selected_rfq_supplier_id ?? null,
    };
  });
}

// ─── Create RFQ ───────────────────────────────────────────────────────────────

export async function createRfq(
  pr1Id: string,
  deadline: string | null,
  notes: string,
  profile: UserProfile
): Promise<string> {
  // Idempotency: return existing RFQ if one already exists for this PR1.
  const { data: existing } = await db
    .from('rfq_batches')
    .select('id')
    .eq('pr1_id', pr1Id)
    .maybeSingle();

  if (existing?.id) return existing.id;

  const now = new Date().toISOString();

  // Generate rfq_number via DB sequence function — collision-safe.
  const { data: rfqNum, error: numErr } = await (supabase as any).rpc('generate_rfq_number');
  if (numErr) throw numErr;
  const rfq_number = rfqNum as string;

  const { data, error } = await db
    .from('rfq_batches')
    .insert({
      pr1_id:     pr1Id,
      rfq_number,
      status:     'draft',
      issued_by:  profile.id,
      deadline:   deadline || null,
      notes:      notes.trim() || null,
      updated_at: now,
    })
    .select('id')
    .single();

  // Race condition: another request inserted between our check and insert.
  // The UNIQUE(pr1_id) constraint fires — fetch and return the winner.
  if (error) {
    if (error.code === '23505') {
      const { data: race } = await db
        .from('rfq_batches')
        .select('id')
        .eq('pr1_id', pr1Id)
        .maybeSingle();
      if (race?.id) return race.id;
    }
    throw error;
  }

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'RFQ_CREATED',
    document_type: 'RFQ',
    document_id:   data.id,
    payload:       { rfq_number, pr1_id: pr1Id },
  });

  return data.id;
}

// ─── Assign suppliers to RFQ ─────────────────────────────────────────────────

export async function assignSuppliers(
  rfqId: string,
  supplierIds: string[],
  allSuppliers: { id: string; full_name: string }[]
): Promise<void> {
  const nameMap = Object.fromEntries(allSuppliers.map(s => [s.id, s.full_name]));

  const rows = supplierIds.map(id => ({
    rfq_id:                 rfqId,
    supplier_id:            id,
    supplier_name_snapshot: nameMap[id] ?? '',
    status:                 'invited',
    invited_at:             new Date().toISOString(),
  }));

  const { error } = await db.from('rfq_suppliers').insert(rows);
  if (error) throw error;
}

// ─── Issue RFQ (draft → open) ─────────────────────────────────────────────────

export async function issueRfq(rfqId: string, profile: UserProfile): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await db
    .from('rfq_batches')
    .update({ status: 'open', issued_at: now, updated_at: now })
    .eq('id', rfqId)
    .eq('status', 'draft');

  if (error) throw error;

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'RFQ_ISSUED',
    document_type: 'RFQ',
    document_id:   rfqId,
    payload:       { issued_by: profile.full_name },
  });

  // Notify each invited supplier (best-effort)
  try {
    const { data: suppliers } = await db
      .from('rfq_suppliers')
      .select('id, supplier_id')
      .eq('rfq_id', rfqId);

    const supplierRows: { id: string; supplier_id: string }[] = suppliers ?? [];
    if (supplierRows.length === 0) return;

    const supplierUserIds = supplierRows.map(s => s.supplier_id);

    // Deduplicate: skip users who already have an unread action_required for this RFQ
    const { data: existing } = await db
      .from('notifications')
      .select('user_id')
      .eq('document_id', rfqId)
      .eq('type', 'action_required')
      .eq('read', false)
      .in('user_id', supplierUserIds);

    const notifiedSet = new Set<string>((existing ?? []).map((n: any) => n.user_id as string));

    await Promise.all(
      supplierRows
        .filter(s => !notifiedSet.has(s.supplier_id))
        .map(s =>
          createNotification({
            user_id:       s.supplier_id,
            title:         'RFQ Issued',
            body:          'You have been invited to submit a quotation.',
            type:          'action_required',
            document_type: 'rfq',
            document_id:   rfqId,
            action_url:    `/supplier/quotations/${s.id}`,
          })
        )
    );
  } catch {
    // Notifications are best-effort; do not fail issueRfq
  }
}

// ─── Close RFQ ────────────────────────────────────────────────────────────────

export async function closeRfq(rfqId: string, pr1Id: string, profile: UserProfile): Promise<void> {
  const now = new Date().toISOString();

  const { error: rfqErr } = await db
    .from('rfq_batches')
    .update({ status: 'closed', updated_at: now })
    .eq('id', rfqId)
    .eq('status', 'open');

  if (rfqErr) throw rfqErr;

  const { error: pr1Err } = await db
    .from('pr1_requests')
    .update({ status: 'canvassing_complete', updated_at: now })
    .eq('id', pr1Id);

  if (pr1Err) throw pr1Err;

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        'RFQ_CLOSED',
    document_type: 'RFQ',
    document_id:   rfqId,
    payload:       { closed_by: profile.full_name, pr1_id: pr1Id },
  });
}

// ─── Save supplier selection ──────────────────────────────────────────────────

export async function saveItemSelection(
  rfqId: string,
  pr1ItemId: string,
  selectedRfqSupplierId: string,
  notes: string,
  profile: UserProfile
): Promise<void> {
  const now = new Date().toISOString();

  // Guard: if this quote is an alternative, requestor must have accepted it
  const { data: quote } = await db
    .from('rfq_item_quotes')
    .select('id, is_alternative')
    .eq('rfq_supplier_id', selectedRfqSupplierId)
    .eq('pr1_item_id', pr1ItemId)
    .maybeSingle();

  if (quote?.is_alternative) {
    const { data: decision } = await db
      .from('substitute_decisions')
      .select('decision')
      .eq('rfq_item_quote_id', quote.id)
      .maybeSingle();

    if (!decision) {
      throw new Error('This is a substitute item. Requestor must approve before selection.');
    }
    if (decision.decision === 'rejected') {
      throw new Error('Requestor rejected this substitute. Choose a different supplier.');
    }
  }

  const { error } = await db
    .from('supplier_item_selections')
    .upsert(
      {
        rfq_id:                   rfqId,
        pr1_item_id:              pr1ItemId,
        selected_rfq_supplier_id: selectedRfqSupplierId,
        selected_by:              profile.id,
        selected_at:              now,
        selection_notes:          notes.trim() || null,
      },
      { onConflict: 'rfq_id,pr1_item_id' }
    );

  if (error) throw error;
}

// ─── Substitute item review (requestor) ─────────────────────────────────────

/**
 * Fetch all alternative-flagged quotes across every PR1 the given requestor owns,
 * plus each decision state. Used by the requestor inbox / notification count.
 */
export async function fetchSubstitutesForRequestor(
  requisitionerId: string
): Promise<SubstituteReviewBundle[]> {
  const { data: pr1s, error: pr1Err } = await db
    .from('pr1_requests')
    .select('id, pr1_number, purpose, department_name_snapshot, requisitioner_id')
    .eq('requisitioner_id', requisitionerId);

  if (pr1Err || !pr1s || pr1s.length === 0) return [];

  const pr1Ids = (pr1s as any[]).map((r: any) => r.id);

  const bundles = await Promise.all(
    (pr1s as any[]).map((pr1: any) => loadSubstitutesForPr1(pr1))
  );

  return bundles.filter(b => b !== null && b.substitutes.length > 0) as SubstituteReviewBundle[];
}

/**
 * Load the substitute-review bundle for a single PR1. Returns null if the
 * requestor has no permission (RLS will zero-fill), or no PR1 exists.
 */
export async function fetchSubstituteBundleForPr1(
  pr1Id: string
): Promise<SubstituteReviewBundle | null> {
  const { data: pr1 } = await db
    .from('pr1_requests')
    .select('id, pr1_number, purpose, department_name_snapshot, requisitioner_id')
    .eq('id', pr1Id)
    .maybeSingle();

  if (!pr1) return null;
  return loadSubstitutesForPr1(pr1);
}

async function loadSubstitutesForPr1(pr1: any): Promise<SubstituteReviewBundle | null> {
  // Find all RFQ batches linked to this PR1
  const { data: rfqs } = await db
    .from('rfq_batches')
    .select('id, rfq_number')
    .eq('pr1_id', pr1.id);

  const rfqArr: any[] = rfqs ?? [];
  if (rfqArr.length === 0) {
    return { pr1, substitutes: [] };
  }

  const rfqIds = rfqArr.map(r => r.id);

  // rfq_suppliers for these RFQs
  const { data: rfqSuppliers } = await db
    .from('rfq_suppliers')
    .select('id, rfq_id, supplier_name_snapshot')
    .in('rfq_id', rfqIds);

  const supplierArr: any[] = rfqSuppliers ?? [];
  if (supplierArr.length === 0) {
    return { pr1, substitutes: [] };
  }

  const rfqSupplierIds = supplierArr.map(rs => rs.id);

  // All alternative quotes
  const { data: quotes } = await db
    .from('rfq_item_quotes')
    .select('*')
    .in('rfq_supplier_id', rfqSupplierIds)
    .eq('is_alternative', true)
    .not('submitted_at', 'is', null);

  const quoteArr: any[] = quotes ?? [];
  if (quoteArr.length === 0) {
    return { pr1, substitutes: [] };
  }

  // Items + decisions in parallel
  const itemIds = Array.from(new Set(quoteArr.map(q => q.pr1_item_id)));
  const quoteIds = quoteArr.map(q => q.id);

  const [itemsRes, decisionsRes] = await Promise.all([
    db.from('pr1_items')
      .select('id, item_order, item_code, description, unit_of_measure, quantity_requested')
      .in('id', itemIds),
    db.from('substitute_decisions')
      .select('*')
      .in('rfq_item_quote_id', quoteIds),
  ]);

  const itemMap: Record<string, any> = Object.fromEntries(((itemsRes.data ?? []) as any[]).map((i: any) => [i.id, i]));
  const supplierMap: Record<string, any> = Object.fromEntries(supplierArr.map(rs => [rs.id, rs]));
  const rfqMap: Record<string, any> = Object.fromEntries(rfqArr.map(r => [r.id, r]));
  const decisionMap: Record<string, SubstituteDecisionRow> = Object.fromEntries(
    ((decisionsRes.data ?? []) as SubstituteDecisionRow[]).map(d => [d.rfq_item_quote_id, d])
  );

  const substitutes: SubstituteReviewItem[] = quoteArr
    .map((q: any): SubstituteReviewItem | null => {
      const item     = itemMap[q.pr1_item_id];
      const supplier = supplierMap[q.rfq_supplier_id];
      if (!item || !supplier) return null;
      const rfq = rfqMap[supplier.rfq_id];
      const decision = decisionMap[q.id] ?? null;
      return {
        quote_id:             q.id,
        rfq_id:               supplier.rfq_id,
        rfq_number:           rfq?.rfq_number ?? '',
        rfq_supplier_id:      supplier.id,
        supplier_name:        supplier.supplier_name_snapshot,
        pr1_item_id:          item.id,
        item_order:           item.item_order,
        item_code:            item.item_code,
        original_description: item.description,
        original_quantity:    item.quantity_requested,
        unit_of_measure:      item.unit_of_measure,
        quoted_description:   q.quoted_description,
        unit_price:           Number(q.unit_price),
        lead_time_days:       q.lead_time_days,
        remarks:              q.remarks,
        submitted_at:         q.submitted_at,
        decision:             decision?.decision ?? null,
        decided_at:           decision?.decided_at ?? null,
        decision_notes:       decision?.notes ?? null,
      };
    })
    .filter((s): s is SubstituteReviewItem => s !== null)
    .sort((a, b) => a.item_order - b.item_order);

  return { pr1, substitutes };
}

export async function saveSubstituteDecision(
  quoteId: string,
  pr1Id: string,
  decision: SubstituteDecision,
  notes: string,
  profile: UserProfile
): Promise<void> {
  const now = new Date().toISOString();

  const { error } = await db
    .from('substitute_decisions')
    .upsert(
      {
        rfq_item_quote_id: quoteId,
        pr1_id:            pr1Id,
        decision,
        decided_by:        profile.id,
        decided_at:        now,
        notes:             notes.trim() || null,
      },
      { onConflict: 'rfq_item_quote_id' }
    );

  if (error) throw error;

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        decision === 'accepted' ? 'SUBSTITUTE_ACCEPTED' : 'SUBSTITUTE_REJECTED',
    document_type: 'RFQ_QUOTE',
    document_id:   quoteId,
    payload:       { pr1_id: pr1Id, notes },
  });
}

export async function fetchPendingSubstituteCount(requisitionerId: string): Promise<number> {
  const bundles = await fetchSubstitutesForRequestor(requisitionerId);
  return bundles.reduce(
    (sum, b) => sum + b.substitutes.filter(s => s.decision === null).length,
    0
  );
}

// ─── Supplier inbox ───────────────────────────────────────────────────────────

export async function fetchSupplierInbox(supplierId: string): Promise<SupplierRfqInboxRow[]> {
  const { data: assignments, error: assErr } = await db
    .from('rfq_suppliers')
    .select('id, rfq_id, supplier_name_snapshot, status, invited_at, responded_at')
    .eq('supplier_id', supplierId);

  if (assErr) throw assErr;
  if (!assignments || assignments.length === 0) return [];

  const rfqIds = (assignments as any[]).map((a: any) => a.rfq_id);

  const { data: rfqs, error: rfqErr } = await db
    .from('rfq_batches')
    .select('id, rfq_number, status, deadline, pr1_id')
    .in('id', rfqIds);

  if (rfqErr) throw rfqErr;

  const pr1Ids = Array.from(new Set((rfqs ?? []).map((r: any) => r.pr1_id as string)));

  const [pr1Res, quotesRes] = await Promise.all([
    db.from('pr1_requests')
      .select('id, pr1_number, department_name_snapshot, purpose')
      .in('id', pr1Ids),
    db.from('rfq_item_quotes')
      .select('rfq_supplier_id, pr1_item_id, submitted_at')
      .in('rfq_supplier_id', (assignments as any[]).map((a: any) => a.id)),
  ]);

  const rfqMap:   Record<string, any> = Object.fromEntries(((rfqs ?? []) as any[]).map((r: any) => [r.id, r]));
  const pr1Map:   Record<string, any> = Object.fromEntries(((pr1Res.data ?? []) as any[]).map((r: any) => [r.id, r]));
  const quotesArr: any[] = quotesRes.data ?? [];

  // Count items per rfq batch (via pr1_items)
  const itemCountRes = await db
    .from('pr1_items')
    .select('pr1_id')
    .in('pr1_id', pr1Ids);
  const itemCounts: Record<string, number> = {};
  for (const item of (itemCountRes.data ?? []) as any[]) {
    itemCounts[item.pr1_id] = (itemCounts[item.pr1_id] ?? 0) + 1;
  }

  return (assignments as any[]).map((assignment: any) => {
    const rfq = rfqMap[assignment.rfq_id];
    const pr1 = rfq ? pr1Map[rfq.pr1_id] : null;
    const quotesForThis = quotesArr.filter(
      q => q.rfq_supplier_id === assignment.id && q.submitted_at !== null
    );

    return {
      rfq_supplier_id:  assignment.id,
      rfq_id:           assignment.rfq_id,
      rfq_number:       rfq?.rfq_number ?? '',
      rfq_status:       rfq?.status ?? 'open',
      rfq_deadline:     rfq?.deadline ?? null,
      supplier_status:  assignment.status,
      pr1_number:       pr1?.pr1_number ?? '',
      department_name:  pr1?.department_name_snapshot ?? '',
      purpose:          pr1?.purpose ?? '',
      item_count:       rfq ? (itemCounts[rfq.pr1_id] ?? 0) : 0,
      quotes_submitted: quotesForThis.length,
    };
  });
}

// ─── Supplier RFQ inbox: paginated ───────────────────────────────────────────

export async function fetchSupplierInboxPaged(
  supplierId: string,
  options: { limit: number; offset: number }
): Promise<{ inbox: SupplierRfqInboxRow[]; total_count: number }> {
  const { limit, offset } = options;

  const [assignmentsRes, countRes] = await Promise.all([
    db
      .from('rfq_suppliers')
      .select('id, rfq_id, supplier_name_snapshot, status, invited_at, responded_at')
      .eq('supplier_id', supplierId)
      .order('invited_at', { ascending: false })
      .range(offset, offset + limit - 1),
    db
      .from('rfq_suppliers')
      .select('id', { count: 'exact', head: true })
      .eq('supplier_id', supplierId),
  ]);

  if (assignmentsRes.error) throw assignmentsRes.error;
  if (countRes.error) throw countRes.error;

  const assignments = assignmentsRes.data ?? [];
  if (assignments.length === 0) return { inbox: [], total_count: countRes.count ?? 0 };

  const rfqIds = (assignments as any[]).map((a: any) => a.rfq_id);

  const { data: rfqs, error: rfqErr } = await db
    .from('rfq_batches')
    .select('id, rfq_number, status, deadline, pr1_id')
    .in('id', rfqIds);

  if (rfqErr) throw rfqErr;

  const pr1Ids = Array.from(new Set(((rfqs ?? []) as any[]).map((r: any) => r.pr1_id as string)));

  const [pr1Res, quotesRes, itemCountRes] = await Promise.all([
    db.from('pr1_requests')
      .select('id, pr1_number, department_name_snapshot, purpose')
      .in('id', pr1Ids),
    db.from('rfq_item_quotes')
      .select('rfq_supplier_id, pr1_item_id, submitted_at')
      .in('rfq_supplier_id', (assignments as any[]).map((a: any) => a.id)),
    db.from('pr1_items')
      .select('pr1_id')
      .in('pr1_id', pr1Ids),
  ]);

  const rfqMap:   Record<string, any> = Object.fromEntries(((rfqs ?? []) as any[]).map((r: any) => [r.id, r]));
  const pr1Map:   Record<string, any> = Object.fromEntries(((pr1Res.data ?? []) as any[]).map((r: any) => [r.id, r]));
  const quotesArr: any[] = quotesRes.data ?? [];

  const itemCounts: Record<string, number> = {};
  for (const item of (itemCountRes.data ?? []) as any[]) {
    itemCounts[item.pr1_id] = (itemCounts[item.pr1_id] ?? 0) + 1;
  }

  return {
    inbox: (assignments as any[]).map((assignment: any) => {
      const rfq = rfqMap[assignment.rfq_id];
      const pr1 = rfq ? pr1Map[rfq.pr1_id] : null;
      const quotesForThis = quotesArr.filter(
        q => q.rfq_supplier_id === assignment.id && q.submitted_at !== null
      );
      return {
        rfq_supplier_id:  assignment.id,
        rfq_id:           assignment.rfq_id,
        rfq_number:       rfq?.rfq_number ?? '',
        rfq_status:       rfq?.status ?? 'open',
        rfq_deadline:     rfq?.deadline ?? null,
        supplier_status:  assignment.status,
        pr1_number:       pr1?.pr1_number ?? '',
        department_name:  pr1?.department_name_snapshot ?? '',
        purpose:          pr1?.purpose ?? '',
        item_count:       rfq ? (itemCounts[rfq.pr1_id] ?? 0) : 0,
        quotes_submitted: quotesForThis.length,
      };
    }),
    total_count: countRes.count ?? 0,
  };
}

// ─── Supplier quotation detail ────────────────────────────────────────────────

export interface SupplierQuoteDetail {
  rfqSupplier: {
    id:     string;
    status: string;
    rfq_id: string;
  };
  rfq: {
    id:         string;
    rfq_number: string;
    status:     string;
    deadline:   string | null;
    notes:      string | null;
  };
  pr1: {
    pr1_number:              string;
    department_name_snapshot: string;
    purpose:                 string;
  };
  items: {
    id:                 string;
    item_order:         number;
    item_code:          string;
    description:        string;
    unit_of_measure:    string;
    quantity_requested: number;
  }[];
  quotes: RfqItemQuote[];
}

export async function fetchSupplierQuoteDetail(
  rfqSupplierId: string,
  supplierId: string
): Promise<SupplierQuoteDetail | null> {
  const { data: rs, error: rsErr } = await db
    .from('rfq_suppliers')
    .select('id, rfq_id, supplier_id, status')
    .eq('id', rfqSupplierId)
    .eq('supplier_id', supplierId)
    .maybeSingle();

  if (rsErr) throw rsErr;
  if (!rs) return null;

  const [rfqRes, quotesRes] = await Promise.all([
    db.from('rfq_batches')
      .select('id, rfq_number, status, deadline, notes, pr1_id')
      .eq('id', rs.rfq_id)
      .maybeSingle(),
    db.from('rfq_item_quotes')
      .select('*')
      .eq('rfq_supplier_id', rfqSupplierId),
  ]);

  if (rfqRes.error) throw rfqRes.error;
  if (!rfqRes.data) return null;

  const rfq = rfqRes.data;

  const [pr1Res, itemsRes] = await Promise.all([
    db.from('pr1_requests')
      .select('pr1_number, department_name_snapshot, purpose')
      .eq('id', rfq.pr1_id)
      .maybeSingle(),
    db.from('pr1_items')
      .select('id, item_order, item_code, description, unit_of_measure, quantity_requested')
      .eq('pr1_id', rfq.pr1_id)
      .order('item_order', { ascending: true }),
  ]);

  if (!pr1Res.data) return null;

  return {
    rfqSupplier: rs,
    rfq,
    pr1:         pr1Res.data,
    items:       itemsRes.data ?? [],
    quotes:      quotesRes.data ?? [],
  };
}

// ─── Submit supplier quotation ────────────────────────────────────────────────

export interface QuoteDraft {
  pr1_item_id:        string;
  quoted_description: string;
  is_alternative:     boolean;
  unit_price:         number;
  lead_time_days:     number;
  remarks:            string;
}

export async function submitSupplierQuotation(
  rfqSupplierId: string,
  quotes: QuoteDraft[]
): Promise<void> {
  const now = new Date().toISOString();

  const rows = quotes.map(q => ({
    rfq_supplier_id:    rfqSupplierId,
    pr1_item_id:        q.pr1_item_id,
    quoted_description: q.quoted_description.trim(),
    is_alternative:     q.is_alternative,
    unit_price:         q.unit_price,
    lead_time_days:     q.lead_time_days,
    remarks:            q.remarks.trim() || null,
    submitted_at:       now,
    updated_at:         now,
  }));

  const { error: upsertErr } = await db
    .from('rfq_item_quotes')
    .upsert(rows, { onConflict: 'rfq_supplier_id,pr1_item_id' });

  if (upsertErr) throw upsertErr;

  const { error: statusErr } = await db
    .from('rfq_suppliers')
    .update({ status: 'submitted', responded_at: now })
    .eq('id', rfqSupplierId);

  if (statusErr) throw statusErr;
}

// ─── Procurement dashboard stats ──────────────────────────────────────────────

export async function fetchProcurementStats(): Promise<{
  forCanvassing:       number;
  openRfqs:            number;
  canvassingComplete:  number;
  high_priority_count: number;
  medium_priority_count: number;
}> {
  const [queueRes, openRfqRes, completeRes, highRes, mediumRes] = await Promise.all([
    db.from('pr1_requests').select('id', { count: 'exact', head: true }).eq('status', 'for_canvassing'),
    db.from('rfq_batches').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    db.from('pr1_requests').select('id', { count: 'exact', head: true }).eq('status', 'canvassing_complete'),
    db.from('pr1_requests').select('id', { count: 'exact', head: true }).eq('status', 'for_canvassing').eq('priority', 'high'),
    db.from('pr1_requests').select('id', { count: 'exact', head: true }).eq('status', 'for_canvassing').eq('priority', 'medium'),
  ]);

  return {
    forCanvassing:        queueRes.count ?? 0,
    openRfqs:             openRfqRes.count ?? 0,
    canvassingComplete:   completeRes.count ?? 0,
    high_priority_count:  highRes.count ?? 0,
    medium_priority_count: mediumRes.count ?? 0,
  };
}

// ─── Supplier dashboard stats ─────────────────────────────────────────────────

export async function fetchSupplierStats(supplierId: string): Promise<{
  openRfqs:    number;
  submitted:   number;
  pending:     number;
}> {
  const { data: assignments, error: assErr } = await db
    .from('rfq_suppliers')
    .select('id, rfq_id, status')
    .eq('supplier_id', supplierId);

  if (assErr || !assignments || assignments.length === 0) {
    return { openRfqs: 0, submitted: 0, pending: 0 };
  }

  const rfqIds = (assignments as any[]).map((a: any) => a.rfq_id);
  const { data: rfqs } = await db
    .from('rfq_batches')
    .select('id, status')
    .in('id', rfqIds);

  const openRfqIds = new Set(
    ((rfqs ?? []) as any[]).filter(r => r.status === 'open').map(r => r.id)
  );

  const arr: any[] = assignments as any[];
  return {
    openRfqs:  arr.filter(a => openRfqIds.has(a.rfq_id)).length,
    submitted: arr.filter(a => a.status === 'submitted').length,
    pending:   arr.filter(a => a.status === 'invited' && openRfqIds.has(a.rfq_id)).length,
  };
}
