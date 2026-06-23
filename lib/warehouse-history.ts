import { supabase } from '@/lib/supabase';
import type {
  FetchMyWarehouseValidationHistoryPagedOptions,
  WarehouseDecision,
  WarehouseValidationHistoryRow,
} from '@/types/warehouse';

const db = supabase as any;

function sanitizeFreeText(term: string): string {
  return term.replace(/[%_,]/g, '').trim();
}

function startOfDayIso(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toISOString();
}

function endOfDayIso(dateStr: string): string {
  const d = new Date(`${dateStr}T23:59:59.999`);
  return d.toISOString();
}

function applyDecisionAndDateFilters(
  q: any,
  opts: Pick<FetchMyWarehouseValidationHistoryPagedOptions, 'decision' | 'validatedFrom' | 'validatedTo'>,
): any {
  let query = q;
  if (opts.decision && opts.decision !== 'all') {
    query = query.eq('decision', opts.decision);
  }
  if (opts.validatedFrom?.trim()) {
    query = query.gte('validated_at', startOfDayIso(opts.validatedFrom.trim()));
  }
  if (opts.validatedTo?.trim()) {
    query = query.lte('validated_at', endOfDayIso(opts.validatedTo.trim()));
  }
  return query;
}

type SearchRestriction =
  | { kind: 'none' }
  | { kind: 'empty' }
  | { kind: 'pr1_in'; pr1Ids: string[] }
  | { kind: 'id_in'; validationIds: string[] }
  | { kind: 'or_pr1_or_id'; pr1Ids: string[]; validationIds: string[] };

function applySearchRestriction(q: any, r: SearchRestriction): any {
  if (r.kind === 'none' || r.kind === 'empty') return q;
  if (r.kind === 'pr1_in') return q.in('pr1_id', r.pr1Ids);
  if (r.kind === 'id_in') return q.in('id', r.validationIds);
  return q.or(
    `pr1_id.in.(${r.pr1Ids.join(',')}),id.in.(${r.validationIds.join(',')})`,
  );
}

async function resolveSearchRestriction(
  validatorId: string,
  ilikePattern: string,
  statusPr1Ids: string[] | null,
): Promise<SearchRestriction> {
  let pr1Query = db
    .from('pr1_requests')
    .select('id')
    .or(
      `pr1_number.ilike.${ilikePattern},purpose.ilike.${ilikePattern},department_name_snapshot.ilike.${ilikePattern}`,
    );
  if (statusPr1Ids && statusPr1Ids.length > 0) {
    pr1Query = pr1Query.in('id', statusPr1Ids);
  }

  const { data: pr1Hits, error: pr1Err } = await pr1Query;
  if (pr1Err) throw pr1Err;
  const pr1MatchIds = ((pr1Hits ?? []) as { id: string }[]).map((x) => x.id).filter(Boolean);

  const { data: noteHitsRaw, error: noteErr } = await db
    .from('warehouse_validations')
    .select('id, pr1_id')
    .eq('validator_id', validatorId)
    .not('validated_at', 'is', null)
    .not('decision', 'is', null)
    .ilike('notes', ilikePattern);
  if (noteErr) throw noteErr;

  const noteRows = (noteHitsRaw ?? []) as { id: string; pr1_id: string }[];
  let noteValIds = noteRows.map((r) => r.id).filter(Boolean);
  if (statusPr1Ids && statusPr1Ids.length > 0) {
    noteValIds = noteRows.filter((r) => statusPr1Ids.includes(r.pr1_id)).map((r) => r.id);
  }

  if (pr1MatchIds.length === 0 && noteValIds.length === 0) return { kind: 'empty' };
  if (pr1MatchIds.length > 0 && noteValIds.length === 0) return { kind: 'pr1_in', pr1Ids: pr1MatchIds };
  if (noteValIds.length > 0 && pr1MatchIds.length === 0) return { kind: 'id_in', validationIds: noteValIds };
  return { kind: 'or_pr1_or_id', pr1Ids: pr1MatchIds, validationIds: noteValIds };
}

/**
 * Paginated warehouse validation decisions for the current validator.
 * Completed rows only (`validated_at` set). PR1 headers resolved in batch.
 */
export async function fetchMyWarehouseValidationHistoryPaged(
  options: FetchMyWarehouseValidationHistoryPagedOptions,
): Promise<{ rows: WarehouseValidationHistoryRow[]; total_count: number }> {
  const {
    validatorId,
    limit,
    offset,
    search = null,
    decision = 'all',
    pr1Status = null,
    validatedFrom = null,
    validatedTo = null,
  } = options;

  let statusPr1Ids: string[] | null = null;
  const statusTrim = pr1Status?.trim();
  if (statusTrim && statusTrim !== 'all') {
    const { data: stRows, error: stErr } = await db.from('pr1_requests').select('id').eq('status', statusTrim);
    if (stErr) throw stErr;
    statusPr1Ids = ((stRows ?? []) as { id: string }[]).map((r) => r.id).filter(Boolean);
    if (statusPr1Ids.length === 0) {
      return { rows: [], total_count: 0 };
    }
  }

  const safeSearch = sanitizeFreeText((search ?? '').trim());
  let searchRestriction: SearchRestriction = { kind: 'none' };

  if (safeSearch) {
    const ilikePattern = `%${safeSearch}%`;
    searchRestriction = await resolveSearchRestriction(validatorId, ilikePattern, statusPr1Ids);
    if (searchRestriction.kind === 'empty') {
      return { rows: [], total_count: 0 };
    }
  }

  const baseSelect =
    'id, pr1_id, decision, notes, validated_at, validator_id';

  let listQuery = db
    .from('warehouse_validations')
    .select(baseSelect)
    .eq('validator_id', validatorId)
    .not('validated_at', 'is', null)
    .not('decision', 'is', null)
    .order('validated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  listQuery = applyDecisionAndDateFilters(listQuery, { decision, validatedFrom, validatedTo });

  if (searchRestriction.kind !== 'none') {
    listQuery = applySearchRestriction(listQuery, searchRestriction);
  } else if (statusPr1Ids) {
    listQuery = listQuery.in('pr1_id', statusPr1Ids);
  }

  let countQuery = db
    .from('warehouse_validations')
    .select('id', { count: 'exact', head: true })
    .eq('validator_id', validatorId)
    .not('validated_at', 'is', null)
    .not('decision', 'is', null);

  countQuery = applyDecisionAndDateFilters(countQuery, { decision, validatedFrom, validatedTo });

  if (searchRestriction.kind !== 'none') {
    countQuery = applySearchRestriction(countQuery, searchRestriction);
  } else if (statusPr1Ids) {
    countQuery = countQuery.in('pr1_id', statusPr1Ids);
  }

  const [listRes, countRes] = await Promise.all([listQuery, countQuery]);

  if (listRes.error) throw listRes.error;
  if (countRes.error) throw countRes.error;

  const raw = listRes.data ?? [];
  const total_count = countRes.count ?? 0;

  if (raw.length === 0) {
    return { rows: [], total_count };
  }

  const pr1Ids = Array.from(new Set((raw as { pr1_id: string }[]).map((r) => r.pr1_id)));

  const { data: pr1Rows, error: pr1Err } = await db
    .from('pr1_requests')
    .select('id, pr1_number, purpose, department_name_snapshot, status, request_type')
    .in('id', pr1Ids);

  if (pr1Err) throw pr1Err;

  const pr1Map: Record<
    string,
    { pr1_number: string; purpose: string; department_name_snapshot: string; status: string; request_type: 'goods' | 'services' }
  > = Object.fromEntries(
    (pr1Rows ?? []).map((p: any) => [
      p.id,
      {
        pr1_number: p.pr1_number,
        purpose: p.purpose,
        department_name_snapshot: p.department_name_snapshot,
        status: p.status,
        request_type: (p.request_type ?? 'goods') as 'goods' | 'services',
      },
    ]),
  );

  const rows: WarehouseValidationHistoryRow[] = (raw as any[]).map((row) => {
    const p = pr1Map[row.pr1_id];
    return {
      validation_id: row.id,
      pr1_id: row.pr1_id,
      pr1_number: p?.pr1_number ?? '—',
      purpose: p?.purpose ?? '—',
      department: p?.department_name_snapshot ?? '—',
      pr1_status: p?.status ?? '—',
      decision: row.decision as WarehouseDecision,
      notes: row.notes ?? '',
      validated_at: row.validated_at as string,
      action_url: `/warehouse/${row.pr1_id}`,
      request_type: p?.request_type ?? 'goods',
    };
  });

  return { rows, total_count };
}
