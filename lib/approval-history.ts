import { supabase } from '@/lib/supabase';
import type {
  ApprovalHistoryDocumentFilter,
  ApprovalHistoryRow,
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
    default:
      return '/approvals/history';
  }
}

/**
 * Paginated list of approval_actions for the current actor, joined to approval_instances
 * for document type / workflow status. Document numbers are resolved in batch (no per-row queries).
 */
export async function fetchMyApprovalHistoryPaged(options: {
  actorId: string;
  documentType: ApprovalHistoryDocumentFilter;
  limit: number;
  offset: number;
}): Promise<{ rows: ApprovalHistoryRow[]; total_count: number }> {
  const { actorId, documentType, limit, offset } = options;

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
  }

  const [pr1Res, pr2Res, poRes] = await Promise.all([
    pr1Ids.size > 0
      ? db.from('pr1_requests').select('id, pr1_number').in('id', Array.from(pr1Ids))
      : Promise.resolve({ data: [] as any[], error: null }),
    pr2Ids.size > 0
      ? db.from('pr2_requests').select('id, pr2_number').in('id', Array.from(pr2Ids))
      : Promise.resolve({ data: [] as any[], error: null }),
    poIds.size > 0
      ? db.from('po_requests').select('id, po_number').in('id', Array.from(poIds))
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  if (pr1Res.error) throw pr1Res.error;
  if (pr2Res.error) throw pr2Res.error;
  if (poRes.error) throw poRes.error;

  const pr1Num: Record<string, string> = Object.fromEntries(
    ((pr1Res.data ?? []) as any[]).map((r: any) => [r.id, r.pr1_number])
  );
  const pr2Num: Record<string, string> = Object.fromEntries(
    ((pr2Res.data ?? []) as any[]).map((r: any) => [r.id, r.pr2_number])
  );
  const poNum: Record<string, string> = Object.fromEntries(
    ((poRes.data ?? []) as any[]).map((r: any) => [r.id, r.po_number])
  );

  const rows: ApprovalHistoryRow[] = [];

  for (const row of raw) {
    const inst = Array.isArray(row.approval_instances)
      ? row.approval_instances[0]
      : row.approval_instances;
    if (!inst?.document_id || !inst?.document_type) continue;

    const dt = inst.document_type as 'PR1' | 'PR2' | 'PO';
    const docId = inst.document_id as string;

    let document_number = '—';
    if (dt === 'PR1') document_number = pr1Num[docId] ?? '—';
    else if (dt === 'PR2') document_number = pr2Num[docId] ?? '—';
    else if (dt === 'PO') document_number = poNum[docId] ?? '—';

    rows.push({
      approval_action_id: row.id,
      instance_id:        row.instance_id,
      document_type:      dt,
      document_id:        docId,
      document_number,
      action:             row.action,
      step_order:         row.step_order,
      remarks:            row.remarks ?? null,
      acted_at:           row.acted_at,
      instance_status:    inst.status,
      action_url:         actionUrl(dt, row.instance_id),
    });
  }

  return { rows, total_count };
}
