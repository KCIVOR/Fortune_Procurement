import { supabase } from '@/lib/supabase';
import type {
  ApprovalHistoryDocumentFilter,
  ApprovalHistoryRow,
  FetchMyApprovalHistoryPagedOptions,
} from '@/types/approvals';

const db = supabase as any;

function actionUrl(documentType: string, instanceId: string): string {
  switch (documentType) {
    case 'PR1':
      return `/approvals/${instanceId}`;
    case 'PR2':
      return `/approvals/pr2/${instanceId}`;
    case 'PO':
      return `/approvals/po/${instanceId}`;
    case 'RFQ':
      return `/approvals/rfq/${instanceId}`;
    default:
      return '/approvals/history';
  }
}

/** Remove ILIKE wildcards from user input so patterns stay predictable. */
function sanitizeFreeText(term: string): string {
  return term.replace(/[%_]/g, '').trim();
}

type SearchInstanceResolution = 'none' | 'empty' | Set<string>;

/**
 * Resolve approval_instance ids whose documents match the search and/or whose remarks match.
 * `none` = do not restrict by instance_id.
 * `empty` = no instances match (caller should return zero rows).
 */
async function resolveSearchInstanceIds(
  actorId: string,
  documentType: ApprovalHistoryDocumentFilter,
  searchRaw: string | null | undefined,
): Promise<SearchInstanceResolution> {
  const raw = (searchRaw ?? '').trim();
  if (!raw) return 'none';

  const safe = sanitizeFreeText(raw);
  if (!safe) return 'none';

  const pattern = `%${safe}%`;
  const instanceIds = new Set<string>();

  const docTypes: Array<'PR1' | 'PR2' | 'PO' | 'RFQ'> =
    documentType === 'all' ? ['PR1', 'PR2', 'PO', 'RFQ'] : [documentType as any];

  for (const dt of docTypes) {
    if (dt === 'PR1') {
      const { data, error } = await db.from('pr1_requests').select('id').ilike('pr1_number', pattern);
      if (error) throw error;
      const ids = ((data ?? []) as { id: string }[]).map((r) => r.id).filter(Boolean);
      if (ids.length === 0) continue;
      const { data: inst, error: e2 } = await db
        .from('approval_instances')
        .select('id')
        .eq('document_type', 'PR1')
        .in('document_id', ids);
      if (e2) throw e2;
      for (const r of (inst ?? []) as { id: string }[]) instanceIds.add(r.id);
    } else if (dt === 'PR2') {
      const { data, error } = await db.from('pr2_requests').select('id').ilike('pr2_number', pattern);
      if (error) throw error;
      const ids = ((data ?? []) as { id: string }[]).map((r) => r.id).filter(Boolean);
      if (ids.length === 0) continue;
      const { data: inst, error: e2 } = await db
        .from('approval_instances')
        .select('id')
        .eq('document_type', 'PR2')
        .in('document_id', ids);
      if (e2) throw e2;
      for (const r of (inst ?? []) as { id: string }[]) instanceIds.add(r.id);
    } else if (dt === 'PO') {
      const { data, error } = await db.from('po_requests').select('id').ilike('po_number', pattern);
      if (error) throw error;
      const ids = ((data ?? []) as { id: string }[]).map((r) => r.id).filter(Boolean);
      if (ids.length === 0) continue;
      const { data: inst, error: e2 } = await db
        .from('approval_instances')
        .select('id')
        .eq('document_type', 'PO')
        .in('document_id', ids);
      if (e2) throw e2;
      for (const r of (inst ?? []) as { id: string }[]) instanceIds.add(r.id);
    } else if (dt === 'RFQ') {
      const { data, error } = await db.from('rfq_batches').select('id').ilike('rfq_number', pattern);
      if (error) throw error;
      const ids = ((data ?? []) as { id: string }[]).map((r) => r.id).filter(Boolean);
      if (ids.length === 0) continue;
      const { data: inst, error: e2 } = await db
        .from('approval_instances')
        .select('id')
        .eq('document_type', 'RFQ')
        .in('document_id', ids);
      if (e2) throw e2;
      for (const r of (inst ?? []) as { id: string }[]) instanceIds.add(r.id);
    }
  }

  const { data: remarkActions, error: re } = await db
    .from('approval_actions')
    .select('instance_id')
    .eq('actor_id', actorId)
    .not('remarks', 'is', null)
    .ilike('remarks', pattern);
  if (re) throw re;

  const remarkInstIds = Array.from(
    new Set(
      ((remarkActions ?? []) as { instance_id: string }[])
        .map((r) => r.instance_id)
        .filter(Boolean),
    ),
  );

  if (remarkInstIds.length > 0) {
    let instQ = db.from('approval_instances').select('id').in('id', remarkInstIds);
    if (documentType !== 'all') instQ = instQ.eq('document_type', documentType);
    const { data: instRows, error: e3 } = await instQ;
    if (e3) throw e3;
    for (const r of (instRows ?? []) as { id: string }[]) instanceIds.add(r.id);
  }

  if (instanceIds.size === 0) return 'empty';
  return instanceIds;
}

function startOfDayIso(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toISOString();
}

function endOfDayIso(dateStr: string): string {
  const d = new Date(`${dateStr}T23:59:59.999`);
  return d.toISOString();
}

function applyActionAndDateFilters(
  q: any,
  opts: Pick<FetchMyApprovalHistoryPagedOptions, 'action' | 'actedAtFrom' | 'actedAtTo'>,
): any {
  let query = q;
  if (opts.action && opts.action !== 'all') {
    query = query.eq('action', opts.action);
  }
  if (opts.actedAtFrom?.trim()) {
    query = query.gte('acted_at', startOfDayIso(opts.actedAtFrom.trim()));
  }
  if (opts.actedAtTo?.trim()) {
    query = query.lte('acted_at', endOfDayIso(opts.actedAtTo.trim()));
  }
  return query;
}

/**
 * Paginated list of approval_actions for the current actor, joined to approval_instances
 * for document type / workflow status. Document numbers are resolved in batch (no per-row queries).
 */
export async function fetchMyApprovalHistoryPaged(
  options: FetchMyApprovalHistoryPagedOptions,
): Promise<{ rows: ApprovalHistoryRow[]; total_count: number }> {
  const {
    actorId,
    documentType,
    limit,
    offset,
    action = 'all',
    actedAtFrom = null,
    actedAtTo = null,
    search = null,
  } = options;

  const searchInstances = await resolveSearchInstanceIds(actorId, documentType, search);
  if (searchInstances === 'empty') {
    return { rows: [], total_count: 0 };
  }

  const instanceIdList =
    searchInstances instanceof Set ? Array.from(searchInstances) : null;

  const embed =
    documentType === 'all'
      ? 'approval_instances(document_type, document_id, status)'
      : 'approval_instances!inner(document_type, document_id, status)';

  const selectFields = `
    id,
    instance_id,
    step_order,
    action,
    remarks,
    acted_at,
    ${embed}
  `;

  let listQuery = db
    .from('approval_actions')
    .select(selectFields)
    .eq('actor_id', actorId)
    .order('acted_at', { ascending: false })
    .range(offset, offset + limit - 1);

  listQuery = applyActionAndDateFilters(listQuery, { action, actedAtFrom, actedAtTo });

  if (instanceIdList) {
    listQuery = listQuery.in('instance_id', instanceIdList);
  }

  if (documentType !== 'all') {
    listQuery = listQuery.eq('approval_instances.document_type', documentType);
  }

  const countSelect =
    documentType === 'all'
      ? 'id'
      : 'id, approval_instances!inner(document_type)';

  let countQuery = db
    .from('approval_actions')
    .select(countSelect, { count: 'exact', head: true })
    .eq('actor_id', actorId);

  countQuery = applyActionAndDateFilters(countQuery, { action, actedAtFrom, actedAtTo });

  if (instanceIdList) {
    countQuery = countQuery.in('instance_id', instanceIdList);
  }

  if (documentType !== 'all') {
    countQuery = countQuery.eq('approval_instances.document_type', documentType);
  }

  const [listRes, countRes] = await Promise.all([listQuery, countQuery]);

  if (listRes.error) throw listRes.error;
  if (countRes.error) throw countRes.error;

  const raw = (listRes.data ?? []) as any[];
  const total_count = countRes.count ?? 0;

  if (raw.length === 0) {
    return { rows: [], total_count };
  }

  const pr1Ids = new Set<string>();
  const pr2Ids = new Set<string>();
  const poIds = new Set<string>();
  const rfqIds = new Set<string>();

  for (const row of raw) {
    const inst = Array.isArray(row.approval_instances)
      ? row.approval_instances[0]
      : row.approval_instances;
    if (!inst?.document_id || !inst?.document_type) continue;
    const dt = inst.document_type as string;
    const did = inst.document_id as string;
    if (dt === 'PR1') pr1Ids.add(did);
    else if (dt === 'PR2') pr2Ids.add(did);
    else if (dt === 'PO') poIds.add(did);
    else if (dt === 'RFQ') rfqIds.add(did);
  }

  const [pr1Res, poRes, rfqRes] = await Promise.all([
    pr1Ids.size > 0
      ? db.from('pr1_requests').select('id, pr1_number, request_type').in('id', Array.from(pr1Ids))
      : Promise.resolve({ data: [] as any[], error: null }),
    poIds.size > 0
      ? db.from('po_requests').select('id, po_number, pr2_id').in('id', Array.from(poIds))
      : Promise.resolve({ data: [] as any[], error: null }),
    rfqIds.size > 0
      ? db.from('rfq_batches').select('id, rfq_number, pr1_id, pr2_id').in('id', Array.from(rfqIds))
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  if (pr1Res.error) throw pr1Res.error;
  if (poRes.error) throw poRes.error;
  if (rfqRes.error) throw rfqRes.error;

  // PO rows carry their request_type via pr2_id, not their own column — merge
  // those pr2_ids into the same pr2_requests lookup used for direct PR2 rows.
  for (const po of (poRes.data ?? []) as any[]) {
    if (po.pr2_id) pr2Ids.add(po.pr2_id);
  }

  // RFQ rows also carry request_type via either pr1_id or pr2_id
  for (const rfq of (rfqRes.data ?? []) as any[]) {
    if (rfq.pr1_id) pr1Ids.add(rfq.pr1_id);
    if (rfq.pr2_id) pr2Ids.add(rfq.pr2_id);
  }

  // If RFQ caused new PR1s to be added, re-fetch them
  let extraPr1ResData: any[] = [];
  const fetchedPr1Ids = new Set(((pr1Res.data ?? []) as any[]).map(r => r.id));
  const missingPr1Ids = Array.from(pr1Ids).filter(id => !fetchedPr1Ids.has(id));
  if (missingPr1Ids.length > 0) {
    const { data: missingPr1s, error: missingPr1sErr } = await db.from('pr1_requests').select('id, pr1_number, request_type').in('id', missingPr1Ids);
    if (missingPr1sErr) throw missingPr1sErr;
    extraPr1ResData = missingPr1s ?? [];
  }
  const finalPr1ResData = ((pr1Res.data ?? []) as any[]).concat(extraPr1ResData);

  let pr2ResData: any[] = [];
  if (pr2Ids.size > 0) {
    const { data, error } = await db.from('pr2_requests').select('id, pr2_number, request_type').in('id', Array.from(pr2Ids));
    if (error) throw error;
    pr2ResData = data ?? [];

    const foundIds = new Set(pr2ResData.map(r => r.id));
    const missingIds = Array.from(pr2Ids).filter(id => !foundIds.has(id));

    if (missingIds.length > 0) {
      const { data: archData, error: archErr } = await db.from('pr2_requests_archive').select('id, pr2_number, request_type').in('id', missingIds);
      if (archErr) throw archErr;
      pr2ResData = pr2ResData.concat(archData ?? []);
    }
  }

  const pr1Num: Record<string, string> = Object.fromEntries(
    finalPr1ResData.map((r: any) => [r.id, r.pr1_number]),
  );
  const pr1Type: Record<string, string> = Object.fromEntries(
    finalPr1ResData.map((r: any) => [r.id, r.request_type ?? 'goods']),
  );
  const pr2Num: Record<string, string> = Object.fromEntries(
    pr2ResData.map((r: any) => [r.id, r.pr2_number]),
  );
  const pr2Type: Record<string, string> = Object.fromEntries(
    pr2ResData.map((r: any) => [r.id, r.request_type ?? 'goods']),
  );
  const poNum: Record<string, string> = Object.fromEntries(
    ((poRes.data ?? []) as any[]).map((r: any) => [r.id, r.po_number]),
  );
  const poPr2Id: Record<string, string> = Object.fromEntries(
    ((poRes.data ?? []) as any[])
      .filter((r: any) => !!r.pr2_id)
      .map((r: any) => [r.id, r.pr2_id]),
  );
  const rfqNum: Record<string, string> = Object.fromEntries(
    ((rfqRes.data ?? []) as any[]).map((r: any) => [r.id, r.rfq_number]),
  );
  const rfqPr1Id: Record<string, string> = Object.fromEntries(
    ((rfqRes.data ?? []) as any[])
      .filter((r: any) => !!r.pr1_id)
      .map((r: any) => [r.id, r.pr1_id]),
  );
  const rfqPr2Id: Record<string, string> = Object.fromEntries(
    ((rfqRes.data ?? []) as any[])
      .filter((r: any) => !!r.pr2_id)
      .map((r: any) => [r.id, r.pr2_id]),
  );

  const rows: ApprovalHistoryRow[] = [];

  for (const row of raw) {
    const inst = Array.isArray(row.approval_instances)
      ? row.approval_instances[0]
      : row.approval_instances;
    if (!inst?.document_id || !inst?.document_type) continue;

    const dt = inst.document_type as 'PR1' | 'PR2' | 'PO' | 'RFQ';
    const docId = inst.document_id as string;

    let document_number = '—';
    let request_type: 'goods' | 'services' | 'raw_material' | undefined;
    if (dt === 'PR1') {
      document_number = pr1Num[docId] ?? '—';
      request_type = (pr1Type[docId] as 'goods' | 'services' | undefined) ?? 'goods';
    } else if (dt === 'PR2') {
      document_number = pr2Num[docId] ?? '—';
      request_type = (pr2Type[docId] as 'goods' | 'services' | 'raw_material' | undefined) ?? 'goods';
    } else if (dt === 'PO') {
      document_number = poNum[docId] ?? '—';
      const linkedPr2Id = poPr2Id[docId];
      request_type = (linkedPr2Id ? (pr2Type[linkedPr2Id] as 'goods' | 'services' | 'raw_material' | undefined) : undefined) ?? 'goods';
    } else if (dt === 'RFQ') {
      document_number = rfqNum[docId] ?? '—';
      const linkedPr1Id = rfqPr1Id[docId];
      const linkedPr2Id = rfqPr2Id[docId];
      if (linkedPr1Id) {
        request_type = (pr1Type[linkedPr1Id] as 'goods' | 'services' | undefined) ?? 'goods';
      } else if (linkedPr2Id) {
        request_type = (pr2Type[linkedPr2Id] as 'goods' | 'services' | 'raw_material' | undefined) ?? 'goods';
      }
    }

    rows.push({
      approval_action_id: row.id,
      instance_id: row.instance_id,
      document_type: dt,
      document_id: docId,
      document_number,
      action: row.action,
      step_order: row.step_order,
      remarks: row.remarks ?? null,
      acted_at: row.acted_at,
      instance_status: inst.status,
      action_url: actionUrl(dt, row.instance_id),
      request_type,
    });
  }

  return { rows, total_count };
}
