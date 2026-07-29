import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type { PR2Request, PR2WithItems, PR2ItemDraft, PR2ItemAttachment } from '@/types/pr2';
import { createNotification } from '@/lib/notifications';
import { fetchWarehouseProcurementByPr1Item, fetchRfqQuoteAttachmentsByRfq } from '@/lib/canvassing';
import { fetchPR1Attachments } from './pr1';
import type { PR1Attachment } from '@/types/pr1';
import { fetchPR2ItemAttachments } from '@/lib/pr2-planning';
import type { RfqQuoteAttachment } from '@/types/canvassing';
import { getVatSettings, computeLineVat, aggregateVat } from '@/lib/vat';
import { resolvePR2RequestType } from '@/lib/pr2-classification';

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

/** Next 4-digit suffix for PR2-{year}-####. Guide only — not reserved. */
export async function fetchSuggestedPR2Sequence(year?: number): Promise<string> {
  const y = year ?? new Date().getFullYear();
  const { data, error } = await db.rpc('next_pr2_sequence', { p_year: y });
  if (error) throw error;
  return String(data ?? '0001');
}

export async function fetchPR2s(options: {
  limit:  number;
  offset: number;
  status?: string;
  search?: string;
  departmentId?: string;
  /** Rev #9: priority lives on pr1_requests only — resolved via ID-based join. */
  priority?: string;
}): Promise<{ pr2s: PR2Request[]; total_count: number }> {
  const { limit, offset, status, search, departmentId, priority } = options;

  // Priority pre-filter: resolve matching pr1 ids first (ID-based, never pr1_number text).
  let priorityPr1Ids: string[] | null = null;
  if (priority && priority !== 'all') {
    const { data: pr1Hits } = await db
      .from('pr1_requests')
      .select('id')
      .eq('priority', priority);
    priorityPr1Ids = ((pr1Hits ?? []) as any[]).map(r => r.id);
  }

  const buildBaseQuery = () => {
    let q = db.from('pr2_requests').select('*');

    if (priorityPr1Ids !== null) {
      if (priorityPr1Ids.length === 0) {
        q = q.eq('id', '00000000-0000-0000-0000-000000000000');
      } else {
        q = q.in('pr1_id', priorityPr1Ids);
      }
    }

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

  const rows = (listRes.data ?? []) as any[];
  const pr1Ids = Array.from(new Set(rows.map(r => r.pr1_id).filter(Boolean)));
  let priorityByPr1Id: Record<string, string> = {};
  if (pr1Ids.length > 0) {
    const { data: pr1s } = await db
      .from('pr1_requests')
      .select('id, priority')
      .in('id', pr1Ids);
    priorityByPr1Id = Object.fromEntries(((pr1s ?? []) as any[]).map(p => [p.id, p.priority ?? 'normal']));
  }

  return {
    pr2s:        rows.map(r => ({ ...r, pr1_priority: priorityByPr1Id[r.pr1_id] ?? 'normal' })) as PR2Request[],
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

  const [pr1Attachments, pr2ItemAttachments, quoteAttachmentsByQuote, pr1Res] = await Promise.all([
    pr2.pr1_id
      ? fetchPR1Attachments(pr2.pr1_id).catch(() => [] as PR1Attachment[])
      : Promise.resolve([] as PR1Attachment[]),
    // Raw-material items have no pr1_item_id to hang a pr1_attachments row
    // off, so they carry their own pr2_item_attachments instead.
    pr2.request_type === 'raw_material'
      ? fetchPR2ItemAttachments(pr2.id).catch(() => [] as PR2ItemAttachment[])
      : Promise.resolve([] as PR2ItemAttachment[]),
    pr2.rfq_id
      ? fetchRfqQuoteAttachmentsByRfq(pr2.rfq_id).catch(() => ({} as Record<string, RfqQuoteAttachment[]>))
      : Promise.resolve({} as Record<string, RfqQuoteAttachment[]>),
    pr2.pr1_id
      ? db.from('pr1_requests').select('request_type, priority').eq('id', pr2.pr1_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const attachmentsByItem: Record<string, PR1Attachment[]> = {};
  for (const att of pr1Attachments) {
    if (!attachmentsByItem[att.pr1_item_id]) attachmentsByItem[att.pr1_item_id] = [];
    attachmentsByItem[att.pr1_item_id].push(att);
  }

  const pr2AttachmentsByItem: Record<string, PR2ItemAttachment[]> = {};
  for (const att of pr2ItemAttachments) {
    if (!pr2AttachmentsByItem[att.pr2_item_id]) pr2AttachmentsByItem[att.pr2_item_id] = [];
    pr2AttachmentsByItem[att.pr2_item_id].push(att);
  }

  const itemsWithAttachments = (items ?? []).map((item: any) => ({
    ...item,
    attachments:       item.pr1_item_id ? (attachmentsByItem[item.pr1_item_id] ?? []) : (pr2AttachmentsByItem[item.id] ?? []),
    quote_attachments: item.rfq_item_quote_id ? (quoteAttachmentsByQuote[item.rfq_item_quote_id] ?? []) : [],
  }));

  // Phase 1 (Raw Mats): pr2.request_type is now the source of truth; the PR1
  // join is only a fallback for rows generated before the column existed.
  const request_type = resolvePR2RequestType(pr2, (pr1Res.data as any) ?? null);
  const pr1_priority = (pr1Res.data as any)?.priority ?? 'normal';
  return { ...pr2, request_type, pr1_priority, items: itemsWithAttachments } as PR2WithItems;
}

/** Per-line warehouse quantity override reason/actor, keyed by pr1_item_id — forwarded onto pr2_items as a read-only snapshot at generation time. */
async function fetchWarehouseOverridesByPr1Item(
  pr1Id: string
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
      reason:              r.quantity_override_reason ?? '',
      overridden_by_name:  r.quantity_overridden_by_name_snapshot ?? null,
    };
  }
  return map;
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



// Rev #1 (VAT): aggregates a PR2's line-level VAT snapshots into a Subtotal/VAT/Total split.
export function calcPR2VatBreakdown(
  items: { unit_price: number; quantity_to_purchase: number; vat_type?: 'vat_inclusive' | 'vat_exclusive' | null; vat_rate_applied?: number | null }[]
): { subtotal: number; vatAmount: number; total: number } {
  return aggregateVat(
    items.map(i => ({
      unitPrice: Number(i.unit_price) || 0,
      qty: Number(i.quantity_to_purchase) || 0,
      vatType: i.vat_type ?? null,
      vatRateApplied: i.vat_rate_applied ?? null,
    }))
  );
}

// ─── Update PR2 items (procurement edits qty_on_hand / qty_incoming / remarks) ─

export async function savePR2Items(
  pr2Id: string,
  items: PR2ItemDraft[],
  remarks: string,
  profile: UserProfile
): Promise<void> {
  const now = new Date().toISOString();

  // Update quantity_to_purchase and remarks only — SOH and in-transit come from warehouse validation
  for (const item of items) {
    const qtyToPurchase = Math.max(0, Number(item.quantity_to_purchase) || 0);
    const vatType = item.vat_type ?? null;
    const breakdown = computeLineVat(item.unit_price, qtyToPurchase, vatType !== null, vatType, item.vat_rate_applied ?? 0);
    await db
      .from('pr2_items')
      .update({
        quantity_to_purchase: qtyToPurchase,
        total_price:          breakdown.total,
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
