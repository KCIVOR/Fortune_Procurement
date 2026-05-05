'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import PageHeader from '@/components/shared/PageHeader';
import AuditFilterPanel from '@/components/admin/AuditFilterPanel';
import AuditLogTable from '@/components/admin/AuditLogTable';
import AuditLogDetail from '@/components/admin/AuditLogDetail';
import { listAuditLogsWithCount, getAuditLogStats } from '@/lib/audit';
import type { AuditLog, AuditLogFilters } from '@/types/audit';

export default function AuditPage() {
  const { profile, loading: authLoading } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentTypes, setDocumentTypes] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (authLoading) return;

    if (!profile) {
      setError('Not authenticated');
      setIsLoading(false);
      return;
    }

    if (profile.role !== 'admin') {
      setError('Access denied. Admin role required.');
      setIsLoading(false);
      return;
    }

    loadData();
  }, [authLoading, profile, currentPage, rowsPerPage, filters]);

  async function loadData() {
    try {
      setIsLoading(true);
      setError(null);

      const offset = (currentPage - 1) * rowsPerPage;
      const [auditData, stats] = await Promise.all([
        listAuditLogsWithCount({ ...filters, limit: rowsPerPage, offset }),
        getAuditLogStats(),
      ]);

      setLogs(auditData.logs);
      setTotalCount(auditData.total_count);
      setDocumentTypes(stats.document_types);
      setActions(stats.actions);
    } catch (err) {
      console.error('Error loading audit data:', err);
      setError('Failed to load audit logs');
    } finally {
      setIsLoading(false);
    }
  }

  function handleFilter(newFilters: AuditLogFilters) {
    setFilters(newFilters);
    setCurrentPage(1);
  }

  function handleRowsPerPageChange(newLimit: number) {
    setRowsPerPage(newLimit);
    setCurrentPage(1);
  }

  function handleNextPage() {
    const totalPages = Math.ceil(totalCount / rowsPerPage);
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  }

  function handlePreviousPage() {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  }

  function handleViewDetail(log: AuditLog) {
    setSelectedLog(log);
    setShowDetail(true);
  }

  if (authLoading) {
    return (
      <AppShell title="Audit Logs">
        <LoadingState message="Loading..." />
      </AppShell>
    );
  }

  if (error === 'Access denied. Admin role required.') {
    return (
      <AppShell title="Audit Logs">
        <div className="space-y-6">
          <PageHeader title="Audit Logs" description="System activity and action history" />
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Access Denied</h3>
            <p className="text-sm text-red-800">
              You do not have permission to view audit logs. Only administrators can access this feature.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error && error !== 'Access denied. Admin role required.') {
    return (
      <AppShell title="Audit Logs">
        <div className="space-y-6">
          <PageHeader title="Audit Logs" description="System activity and action history" />
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Error</h3>
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const totalPages = Math.ceil(totalCount / rowsPerPage);
  const startIndex = logs.length > 0 ? (currentPage - 1) * rowsPerPage + 1 : 0;
  const endIndex = startIndex + logs.length - 1;

  return (
    <AppShell title="Audit Logs">
      <div className="space-y-6">
        <PageHeader title="Audit Logs" description="View system activity and action history" />

        <AuditFilterPanel
          document_types={documentTypes}
          actions={actions}
          onFilter={handleFilter}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPage={rowsPerPage}
          isLoading={isLoading}
        />

        <AuditLogTable logs={logs} isLoading={isLoading} onRowClick={handleViewDetail} />

        {/* Pagination Controls */}
        {logs.length > 0 && (
          <div className="bg-white rounded-lg border border-[#E5EAFF] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[#40527A]">
                Showing {startIndex}–{endIndex} of {totalCount} log entries
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1 || isLoading}
                  className="px-3 py-1 text-xs font-medium text-[#40527A] bg-[#F7F9FC] border border-[#D8E2FF] rounded hover:bg-[#E5EAFF] disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>
                <div className="text-xs text-[#40527A] font-medium">
                  Page {currentPage} of {totalPages}
                </div>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages || isLoading}
                  className="px-3 py-1 text-xs font-medium text-[#40527A] bg-[#F7F9FC] border border-[#D8E2FF] rounded hover:bg-[#E5EAFF] disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        <AuditLogDetail log={selectedLog} isOpen={showDetail} onClose={() => setShowDetail(false)} />
      </div>
    </AppShell>
  );
}
