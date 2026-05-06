import { supabase } from '@/lib/supabase';
import type { WarehouseDecision, WarehouseValidationHistoryRow } from '@/types/warehouse';

const db = supabase as any;

/**
 * Paginated warehouse validation decisions for the current validator.
 * Completed rows only (`validated_at` set). PR1 headers resolved in batch.
 */
export async function fetchMyWarehouseValidationHistoryPaged(options: {
  validatorId: string;
  limit: number;
  offset: number;
}): Promise<{ rows: WarehouseValidationHistoryRow[]; total_count: number }> {
  const { validatorId, limit, offset } = options;

  const { data, error, count } = await db
    .from('warehouse_validations')
    .select('id, pr1_id, decision, notes, validated_at, validator_id', { count: 'exact' })
    .eq('validator_id', validatorId)
    .not('validated_at', 'is', null)
    .not('decision', 'is', null)
    .order('validated_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  const raw = data ?? [];
  const total_count = count ?? 0;

  if (raw.length === 0) {
    return { rows: [], total_count };
  }

  const pr1Ids = Array.from(new Set((raw as { pr1_id: string }[]).map((r) => r.pr1_id)));

  const { data: pr1Rows, error: pr1Err } = await db
    .from('pr1_requests')
    .select('id, pr1_number, purpose, department_name_snapshot, status')
    .in('id', pr1Ids);

  if (pr1Err) throw pr1Err;

  const pr1Map: Record<
    string,
    { pr1_number: string; purpose: string; department_name_snapshot: string; status: string }
  > = Object.fromEntries(
    (pr1Rows ?? []).map((p: any) => [
      p.id,
      {
        pr1_number: p.pr1_number,
        purpose: p.purpose,
        department_name_snapshot: p.department_name_snapshot,
        status: p.status,
      },
    ])
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
    };
  });

  return { rows, total_count };
}
