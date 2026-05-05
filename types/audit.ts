export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  document_type: string | null;
  document_id: string | null;
  payload: Record<string, any> | null;
  ip_address: string | null;
  created_at: string;
  actor?: {
    id: string;
    full_name: string;
    email: string;
  };
}

export interface AuditLogFilters {
  action?: string;
  document_type?: string;
  date_from?: string;
  date_to?: string;
  actor_id?: string;
  limit?: number;
  offset?: number;
  page?: number;
}

export interface AuditLogListResult {
  logs: AuditLog[];
  total_count: number;
}
