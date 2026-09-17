import { supabase } from './supabase';
import type { AuditLog, AuditLogFilters } from '@/types/audit';

export async function getEnrichedAuditNames(payload: Record<string, any>): Promise<Record<string, string | null>> {
  try {
    const enriched: Record<string, string | null> = {};

    const idSet = new Set<string>();
    if (payload.old_role_id) idSet.add(payload.old_role_id);
    if (payload.new_role_id) idSet.add(payload.new_role_id);
    if (payload.old_position_id) idSet.add(payload.old_position_id);
    if (payload.new_position_id) idSet.add(payload.new_position_id);
    if (payload.old_department_id) idSet.add(payload.old_department_id);
    if (payload.new_department_id) idSet.add(payload.new_department_id);

    if (idSet.size === 0) return enriched;

    const ids = Array.from(idSet);

    // Fetch roles
    const { data: rolesData } = await supabase
      .from('roles')
      .select('id, name')
      .in('id', ids);

    const roleMap = new Map((rolesData as any[] || []).map(r => [r.id, r.name]));

    // Fetch positions
    const { data: positionsData } = await supabase
      .from('positions')
      .select('id, title')
      .in('id', ids);

    const positionMap = new Map((positionsData as any[] || []).map(p => [p.id, p.title]));

    // Fetch departments
    const { data: departmentsData } = await supabase
      .from('departments')
      .select('id, name')
      .in('id', ids);

    const departmentMap = new Map((departmentsData as any[] || []).map(d => [d.id, d.name]));

    enriched.old_role_name = payload.old_role_id ? roleMap.get(payload.old_role_id) || null : null;
    enriched.new_role_name = payload.new_role_id ? roleMap.get(payload.new_role_id) || null : null;
    enriched.old_position_title = payload.old_position_id ? positionMap.get(payload.old_position_id) || null : null;
    enriched.new_position_title = payload.new_position_id ? positionMap.get(payload.new_position_id) || null : null;
    enriched.old_department_name = payload.old_department_id ? departmentMap.get(payload.old_department_id) || null : null;
    enriched.new_department_name = payload.new_department_id ? departmentMap.get(payload.new_department_id) || null : null;

    return enriched;
  } catch (err) {
    console.error('Error enriching audit names:', err);
    return {};
  }
}

function applyAuditFilters<T extends { ilike: any; eq: any; gte: any; lte: any }>(
  query: T,
  filters: AuditLogFilters,
): T {
  if (filters.action && filters.action.trim()) {
    query = query.ilike('action', `%${filters.action}%`);
  }

  if (filters.document_type && filters.document_type.trim()) {
    query = query.eq('document_type', filters.document_type);
  }

  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from);
  }

  if (filters.date_to) {
    query = query.lte('created_at', filters.date_to);
  }

  if (filters.actor_id) {
    query = query.eq('actor_id', filters.actor_id);
  }

  return query;
}

function buildAuditQuery(filters: AuditLogFilters) {
  const query = supabase
    .from('audit_logs')
    .select('id, actor_id, action, document_type, document_id, payload, ip_address, created_at');

  return applyAuditFilters(query, filters);
}

function buildAuditCountQuery(filters: AuditLogFilters) {
  const query = supabase
    .from('audit_logs')
    .select('id', { count: 'exact', head: true });

  return applyAuditFilters(query, filters);
}

export async function listAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLog[]> {
  const { limit = 20, offset = 0 } = filters;

  let query = buildAuditQuery(filters)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching audit logs:', error);
    return [];
  }

  return data || [];
}

export async function listAuditLogsWithCount(filters: AuditLogFilters = {}): Promise<{ logs: AuditLog[]; total_count: number }> {
  const { limit = 20, offset = 0 } = filters;

  const logsQuery = buildAuditQuery(filters)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const countQuery = buildAuditCountQuery(filters);

  const [logsResult, countResult] = await Promise.all([logsQuery, countQuery]);

  const logsData = logsResult as any;
  const countData = countResult as any;

  if (logsData.error) {
    console.error('Error fetching audit logs:', logsData.error);
    return { logs: [], total_count: 0 };
  }

  return {
    logs: logsData.data || [],
    total_count: countData?.count ?? 0,
  };
}

export async function getAuditLogStats(): Promise<{
  total_count: number;
  document_types: string[];
  actions: string[];
}> {
  const { data: doctypes } = await supabase
    .from('audit_logs')
    .select('document_type')
    .not('document_type', 'is', null);

  const { data: actions } = await supabase
    .from('audit_logs')
    .select('action');

  const { count } = await supabase
    .from('audit_logs')
    .select('id', { count: 'exact', head: true });

  const document_types = Array.from(new Set(
    (doctypes || [])
      .map((r) => (r as { document_type: string }).document_type)
      .filter(Boolean)
  ));
  const action_list = Array.from(new Set(
    (actions || [])
      .map((r) => (r as { action: string }).action)
      .filter(Boolean)
  ));

  return {
    total_count: count ?? 0,
    document_types,
    actions: action_list,
  };
}
