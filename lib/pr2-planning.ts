import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type { PR2Request, PR2ItemAttachment } from '@/types/pr2';
import { canRequestRawMaterials } from '@/lib/raw-material-access';
import { submitPR2ForApproval } from '@/lib/pr2-approvals';
import { requireAuthUserId } from '@/lib/auth-session';

const db = supabase as any;

const ATTACHMENT_SIGNED_URL_TTL = 3600; // 1 hour

/**
 * Planning's own PR2-direct requests (list view) — raw material and/or
 * services, paginated with optional filters. `requestType` defaults to
 * 'raw_material' to preserve existing call sites' behavior unchanged; pass
 * 'all' to fetch both types together (used by the combined list page once
 * Services entry ships).
 */
export async function fetchMyRawMaterialPR2s(
  requisitionerId: string,
  options: {
    limit?:       number;
    offset?:      number;
    status?:      string;
    priority?:    string;
    search?:      string;
    dateFrom?:    string;
    dateTo?:      string;
    requestType?: 'raw_material' | 'services' | 'all';
  } = {}
): Promise<{ requests: PR2Request[]; total_count: number }> {
  const { limit, offset = 0, status, priority, search, dateFrom, dateTo, requestType = 'raw_material' } = options;

  const applyFilters = (q: any) => {
    q = q.eq('requisitioner_id', requisitionerId);
    q = requestType === 'all'
      ? q.in('request_type', ['raw_material', 'services'])
      : q.eq('request_type', requestType);

    if (status && status !== 'all') {
      q = q.eq('status', status);
    }
    if (priority && priority !== 'all') {
      q = q.eq('priority', priority);
    }
    if (search && search.trim()) {
      const t = `%${search.trim()}%`;
      q = q.or(`pr2_number.ilike.${t},purpose.ilike.${t}`);
    }
    if (dateFrom) {
      q = q.gte('created_at', `${dateFrom}T00:00:00.000Z`);
    }
    if (dateTo) {
      q = q.lte('created_at', `${dateTo}T23:59:59.999Z`);
    }

    return q;
  };

  let dataQuery = applyFilters(db.from('pr2_requests').select('*')).order(
    'created_at',
    { ascending: false }
  );
  if (limit != null && limit > 0) {
    dataQuery = dataQuery.range(offset, offset + limit - 1);
  }

  const [listRes, countRes] = await Promise.all([
    dataQuery,
    applyFilters(db.from('pr2_requests').select('id', { count: 'exact', head: true })),
  ]);

  if (listRes.error) throw listRes.error;
  if (countRes.error) throw countRes.error;

  return {
    requests:    (listRes.data ?? []) as PR2Request[],
    total_count: countRes.count ?? 0,
  };
}

export interface RawMaterialPR2ItemInput {
  /** Real pr2_items.id once saved; absent for a row not yet persisted. */
  id?:                 string;
  item_order:          number;
  item_code:           string;
  description:         string;
  unit_of_measure:     string;
  quantity_requested:  number;
  remarks?:            string | null;
}

export interface RawMaterialPR2DraftInput {
  requisitioner_name?: string | null;
  purpose:        string;
  date_required:  string;
  priority?:      'normal' | 'medium' | 'high';
  remarks?:       string | null;
  items:          RawMaterialPR2ItemInput[];
}

/** Next 4-digit suffix for PR2-{year}-####. Guide only — not reserved. */
export async function fetchSuggestedRawMaterialPR2Sequence(year?: number): Promise<string> {
  const y = year ?? new Date().getFullYear();
  const { data, error } = await db.rpc('next_pr2_sequence', { p_year: y });
  if (error) throw error;
  return String(data ?? '0001');
}

export const PR2_NUMBER_DUPLICATE_ERROR =
  'This PR2 number is already in use. Please choose a different number.';

/**
 * Duplicate check via SECURITY DEFINER RPC — runs across ALL pr2 rows regardless of
 * the caller's RLS. Planning requestors only see their own PR2s under RLS
 * ("Requestors can read own PR2 requests"), so a direct table query here would be
 * blind to other users' PR2 numbers, mirroring the PR1 duplicate-check hazard
 * (see checkPR1NumberExists in lib/pr1.ts).
 */
export async function checkPR2NumberExists(
  pr2Number: string,
  excludeId?: string
): Promise<boolean> {
  const { data, error } = await db.rpc('pr2_number_exists', {
    p_number:     pr2Number.trim(),
    p_exclude_id: excludeId ?? null,
  });
  if (error) throw error;
  return data === true;
}

function buildItemRows(
  pr2Id: string,
  items: RawMaterialPR2ItemInput[],
  requestType: 'raw_material' | 'services' = 'raw_material',
) {
  if (!items || items.length === 0) {
    throw new Error('At least one line item is required.');
  }
  return items.map((item, idx) => ({
    pr2_id:                               pr2Id,
    item_order:                           item.item_order ?? idx + 1,
    item_code:                            item.item_code,
    description:                          item.description,
    unit_of_measure:                      item.unit_of_measure,
    pr1_item_id:                          null,
    quantity_requested:                   item.quantity_requested,
    qty_on_hand:                          0,
    qty_incoming:                         0,
    quantity_to_purchase:                 item.quantity_requested,
    selected_rfq_supplier_id:             null,
    supplier_name_snapshot:               '',
    quoted_description:                   item.description,
    is_alternative:                       false,
    unit_price:                           0,
    lead_time_days:                       0,
    total_price:                          0,
    vat_type:                             null,
    vat_rate_applied:                     null,
    remarks:                              item.remarks ?? null,
    is_raw_material:                      requestType === 'raw_material',
    quote_justification:                  null,
    pr1_remarks_snapshot:                 null,
    pr1_quantity_requested_snapshot:      null,
    quantity_override_reason_snapshot:    null,
    quantity_overridden_by_name_snapshot: null,
    rfq_item_quote_id:                    null,
  }));
}

/**
 * Planning-only: create a PR2 directly (no PR1, no warehouse validation) —
 * raw material or services. Prepared By = the Planning requestor. Left in
 * draft — call submitRawMaterialPR2() to send it to approval. `requestType`
 * defaults to 'raw_material' so existing call sites are unaffected.
 */
export async function createRawMaterialPR2(
  profile: UserProfile,
  pr2NumberInput: string,
  input: RawMaterialPR2DraftInput,
  requestType: 'raw_material' | 'services' = 'raw_material',
): Promise<{ id: string; items: Array<{ id: string; item_order: number }> }> {
  if (!canRequestRawMaterials(profile)) {
    throw new Error('Only Planning may create direct PR2 requests.');
  }

  const now = new Date().toISOString();
  const pr2Number = pr2NumberInput.trim();
  if (!pr2Number) throw new Error('PR2 number is required.');

  const { data: dup } = await db
    .from('pr2_requests')
    .select('id')
    .eq('pr2_number', pr2Number)
    .maybeSingle();
  if (dup?.id) throw new Error(`PR2 number ${pr2Number} is already in use.`);

  const insertPayload: Record<string, any> = {
    pr2_number:                    pr2Number,
    pr1_id:                        null,
    rfq_id:                        null,
    request_type:                  requestType,
    requisitioner_id:              profile.id,
    requisitioner_name_snapshot:   input.requisitioner_name?.trim() || profile.full_name,
    department_id:                 profile.department_id ?? null,
    department_name_snapshot:      profile.department ?? '',
    purpose:                       input.purpose,
    date_required:                 input.date_required,
    priority:                      input.priority ?? 'normal',
    pr1_number_snapshot:           '',
    rfq_number_snapshot:           '',
    status:                        'draft',
    generated_by:                  profile.id,
    generated_at:                  now,
    prepared_by_id:                profile.id,
    prepared_by_name_snapshot:     profile.full_name,
    prepared_by_position_snapshot: profile.position,
    prepared_at:                   now,
    remarks:                       input.remarks ?? null,
    updated_at:                    now,
  };

  let { data: pr2, error: pr2Err } = await db
    .from('pr2_requests')
    .insert(insertPayload)
    .select('id')
    .single();

  if (pr2Err && (pr2Err.code === '42703' || String(pr2Err.message ?? '').includes('priority'))) {
    delete insertPayload.priority;
    const res = await db
      .from('pr2_requests')
      .insert(insertPayload)
      .select('id')
      .single();
    pr2 = res.data;
    pr2Err = res.error;
  }

  if (pr2Err) {
    if (pr2Err.code === '23505' && String(pr2Err.message ?? '').includes('pr2_number')) {
      throw new Error(`PR2 number ${pr2Number} is already in use.`);
    }
    throw pr2Err;
  }

  const pr2Id = pr2.id as string;
  const itemRows = buildItemRows(pr2Id, input.items, requestType);

  const { data: insertedItems, error: itemsErr } = await db
    .from('pr2_items')
    .insert(itemRows)
    .select('id, item_order');
  if (itemsErr) throw itemsErr;

  await db.from('audit_logs').insert({
    actor_id:      profile.id,
    action:        requestType === 'services' ? 'PR2_SERVICES_CREATED' : 'PR2_RAW_MATERIAL_CREATED',
    document_type: 'PR2',
    document_id:   pr2Id,
    payload: {
      pr2_number: pr2Number,
      created_by: profile.full_name,
      line_count: itemRows.length,
    },
  });

  return { id: pr2Id, items: (insertedItems ?? []) as Array<{ id: string; item_order: number }> };
}

/**
 * Preserve pr2_items.id across edits by matching incoming rows to existing DB
 * rows via `id` — update in place rather than delete+reinsert. Attachments
 * are FK'd (ON DELETE CASCADE) to pr2_item_id, so a delete+reinsert on every
 * save would silently orphan/destroy any attachments uploaded on a previous
 * save. Only rows genuinely removed by the user are deleted; only genuinely
 * new rows are inserted.
 */
async function syncRawMaterialItems(
  pr2Id: string,
  items: RawMaterialPR2ItemInput[],
  requestType: 'raw_material' | 'services' = 'raw_material',
): Promise<Array<{ id: string; item_order: number }>> {
  const { data: existingDbItems, error: fetchErr } = await db
    .from('pr2_items')
    .select('id')
    .eq('pr2_id', pr2Id);
  if (fetchErr) throw fetchErr;

  const dbIds = new Set(((existingDbItems ?? []) as any[]).map((r) => r.id as string));
  const validIncoming = items.filter((i) => i.description.trim() !== '');
  if (validIncoming.length === 0) {
    throw new Error('At least one line item is required.');
  }

  const incomingIds = new Set(validIncoming.map((i) => i.id).filter(Boolean) as string[]);
  const idsToDelete = Array.from(dbIds).filter((id) => !incomingIds.has(id));
  if (idsToDelete.length > 0) {
    const { data: delRows, error: delErr } = await db.from('pr2_items').delete().in('id', idsToDelete).select('id');
    if (delErr) throw delErr;
    if (!delRows || delRows.length !== idsToDelete.length) {
      throw new Error('Some items could not be removed — this request may no longer be editable.');
    }
  }

  const toUpdate = validIncoming.filter((i) => i.id && dbIds.has(i.id));
  const toInsert = validIncoming.filter((i) => !i.id || !dbIds.has(i.id));

  const updated: Array<{ id: string; item_order: number }> = [];
  for (const item of toUpdate) {
    const { data: updRows, error: updErr } = await db
      .from('pr2_items')
      .update({
        item_order:           item.item_order,
        item_code:            item.item_code,
        description:          item.description,
        unit_of_measure:      item.unit_of_measure,
        quantity_requested:   item.quantity_requested,
        quantity_to_purchase: item.quantity_requested,
        remarks:              item.remarks ?? null,
      })
      .eq('id', item.id)
      .select('id');
    if (updErr) throw updErr;
    if (!updRows || updRows.length === 0) {
      throw new Error(`Failed to save changes to item "${item.description}" — it may no longer be editable.`);
    }
    updated.push({ id: item.id!, item_order: item.item_order });
  }

  let inserted: Array<{ id: string; item_order: number }> = [];
  if (toInsert.length > 0) {
    const itemRows = buildItemRows(pr2Id, toInsert, requestType);
    const { data, error: insErr } = await db
      .from('pr2_items')
      .insert(itemRows)
      .select('id, item_order');
    if (insErr) throw insErr;
    inserted = (data ?? []) as Array<{ id: string; item_order: number }>;
  }

  return [...updated, ...inserted];
}

/** Planning-only: edit a draft raw-material PR2 (header and/or full item replace). */
export async function updateRawMaterialPR2Draft(
  pr2Id: string,
  profile: UserProfile,
  input: Partial<RawMaterialPR2DraftInput>
): Promise<{ items: Array<{ id: string; item_order: number }> }> {
  const now = new Date().toISOString();

  const { data: pr2, error: pr2Err } = await db
    .from('pr2_requests')
    .select('id, status, request_type, requisitioner_id')
    .eq('id', pr2Id)
    .maybeSingle();
  if (pr2Err) throw pr2Err;
  if (!pr2) throw new Error('PR2 not found.');
  if (pr2.request_type !== 'raw_material' && pr2.request_type !== 'services') {
    throw new Error('Not a Planning-direct PR2.');
  }
  if (pr2.requisitioner_id !== profile.id) throw new Error('You may only edit your own requests.');
  if (pr2.status !== 'draft' && pr2.status !== 'revision_requested') throw new Error('Only draft or revision-requested PR2s can be edited.');

  const patch: Record<string, unknown> = { updated_at: now };
  if (input.purpose !== undefined) patch.purpose = input.purpose;
  if (input.date_required !== undefined) patch.date_required = input.date_required;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.remarks !== undefined) patch.remarks = input.remarks;

  if (Object.keys(patch).length > 1) {
    const { error } = await db.from('pr2_requests').update(patch).eq('id', pr2Id);
    if (error) throw error;
  }

  let syncedItems: Array<{ id: string; item_order: number }> = [];
  if (input.items) {
    syncedItems = await syncRawMaterialItems(pr2Id, input.items, pr2.request_type as 'raw_material' | 'services');
  }

  return { items: syncedItems };
}

/** Planning-only: delete a draft raw-material PR2 (own drafts only). */
export async function deleteDraftRawMaterialPR2(pr2Id: string, profile: UserProfile): Promise<void> {
  const { data: pr2, error: fetchErr } = await db
    .from('pr2_requests')
    .select('id, requisitioner_id, request_type, status')
    .eq('id', pr2Id)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!pr2) throw new Error(`PR2 not found (id: ${pr2Id}).`);
  if (pr2.request_type !== 'raw_material' && pr2.request_type !== 'services') {
    throw new Error('Not a Planning-direct PR2.');
  }

  if (pr2.requisitioner_id !== profile.id && profile.role !== 'admin') {
    throw new Error('Not authorized to delete this request.');
  }
  if (pr2.status !== 'draft') {
    throw new Error('Only draft requests can be deleted.');
  }

  try {
    await db.from('audit_logs').insert({
      actor_id:      profile.id,
      action:        'PR2_RAW_MATERIAL_DRAFT_DELETED',
      document_type: 'PR2',
      document_id:   pr2Id,
      payload:       { deleted_by: profile.full_name },
    });
  } catch {}

  const { error: itemsErr } = await db.from('pr2_items').delete().eq('pr2_id', pr2Id);
  if (itemsErr) throw itemsErr;

  const { error: delErr } = await db.from('pr2_requests').delete().eq('id', pr2Id);
  if (delErr) throw delErr;
}

/** Planning-only: submit a draft Planning-direct PR2 (raw material or services) into the PR2_FINAL approval chain. */
export async function submitRawMaterialPR2(pr2Id: string, profile: UserProfile): Promise<void> {
  const { data: pr2, error } = await db
    .from('pr2_requests')
    .select('id, request_type, requisitioner_id')
    .eq('id', pr2Id)
    .maybeSingle();
  if (error) throw error;
  if (!pr2) throw new Error('PR2 not found.');
  if (pr2.request_type !== 'raw_material' && pr2.request_type !== 'services') {
    throw new Error('Not a Planning-direct PR2.');
  }
  if (pr2.requisitioner_id !== profile.id) throw new Error('You may only submit your own requests.');

  await submitPR2ForApproval(pr2Id, profile);
}

// ─── Raw-material PR2 item attachments ────────────────────────────────────────
// Mirrors uploadPR1Attachment/deletePR1Attachment/fetchPR1Attachments in
// lib/pr1.ts, scoped to pr2_item_attachments instead (raw-material PR2 items
// have no pr1_item_id to hang an attachment off of).

export async function uploadPR2ItemAttachment(
  pr2Id: string,
  pr2ItemId: string,
  file: File,
): Promise<PR2ItemAttachment> {
  const authUserId = await requireAuthUserId();
  const ts = Date.now();
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `pr2/${pr2Id}/${pr2ItemId}/${ts}_${safeFilename}`;

  const { error: uploadErr } = await supabase.storage
    .from('pr2-item-attachments')
    .upload(storagePath, file, { upsert: false });
  if (uploadErr) throw uploadErr;

  const { data, error: insertErr } = await db
    .from('pr2_item_attachments')
    .insert({
      pr2_id:       pr2Id,
      pr2_item_id:  pr2ItemId,
      uploaded_by:  authUserId,
      storage_path: storagePath,
      file_name:    file.name,
      file_size:    file.size,
      mime_type:    file.type || null,
    })
    .select('*')
    .single();

  if (insertErr) {
    await supabase.storage.from('pr2-item-attachments').remove([storagePath]);
    throw insertErr;
  }

  try {
    await db.from('audit_logs').insert({
      actor_id:      authUserId,
      action:        'PR2_RAW_MATERIAL_ATTACHMENT_UPLOADED',
      document_type: 'PR2',
      document_id:   pr2Id,
      payload:       { file_name: file.name, file_size: file.size, pr2_item_id: pr2ItemId },
    });
  } catch {}

  return data as PR2ItemAttachment;
}

export async function deletePR2ItemAttachment(attachment: PR2ItemAttachment, actorId?: string): Promise<void> {
  const { error: dbErr } = await db
    .from('pr2_item_attachments')
    .delete()
    .eq('id', attachment.id);
  if (dbErr) throw dbErr;

  await supabase.storage.from('pr2-item-attachments').remove([attachment.storage_path]);

  if (actorId) {
    try {
      await db.from('audit_logs').insert({
        actor_id:      actorId,
        action:        'PR2_RAW_MATERIAL_ATTACHMENT_DELETED',
        document_type: 'PR2',
        document_id:   attachment.pr2_id,
        payload:       { file_name: attachment.file_name, pr2_item_id: attachment.pr2_item_id },
      });
    } catch {}
  }
}

/** Fetch all attachments for a raw-material PR2 and resolve signed URLs for display. */
export async function fetchPR2ItemAttachments(pr2Id: string): Promise<PR2ItemAttachment[]> {
  const { data, error } = await db
    .from('pr2_item_attachments')
    .select('*')
    .eq('pr2_id', pr2Id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as PR2ItemAttachment[];
  if (rows.length === 0) return [];

  return Promise.all(
    rows.map(async (row) => {
      try {
        const { data: urlData } = await supabase.storage
          .from('pr2-item-attachments')
          .createSignedUrl(row.storage_path, ATTACHMENT_SIGNED_URL_TTL);
        return { ...row, signed_url: urlData?.signedUrl ?? undefined };
      } catch {
        return row;
      }
    }),
  );
}
