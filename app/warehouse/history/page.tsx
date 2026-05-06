'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import PaginationControls from '@/components/shared/PaginationControls';
import { useAuth } from '@/context/AuthContext';
import { fetchMyWarehouseValidationHistoryPaged } from '@/lib/warehouse-history';
import type { WarehouseValidationHistoryRow } from '@/types/warehouse';
import { ClipboardList, Eye, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

const DECISION_BADGE: Record<string, string> = {
  sufficient:   'bg-emerald-50 text-emerald-800 border-emerald-200',
  insufficient: 'bg-amber-50 text-amber-800 border-amber-200',
};

export default function WarehouseHistoryPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<WarehouseValidationHistoryRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  useEffect(() => {
    if (!profile) return;
    if (profile.role !== 'warehouse') {
      router.replace('/dashboard');
      return;
    }
    setLoading(true);
    setError('');
    const offset = (currentPage - 1) * rowsPerPage;

    fetchMyWarehouseValidationHistoryPaged({
      validatorId: profile.id,
      limit:       rowsPerPage,
      offset,
    })
      .then((page) => {
        setRows(page.rows);
        setTotalCount(page.total_count);
      })
      .catch(() => {
        setError('Failed to load warehouse history.');
        setRows([]);
        setTotalCount(0);
      })
      .finally(() => setLoading(false));
  }, [profile, router, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(totalCount / rowsPerPage) || 1;

  if (!profile) {
    return (
      <AppShell title="Warehouse History">
        <div className="flex justify-center py-24">
          <LoadingState message="Loading..." />
        </div>
      </AppShell>
    );
  }

  if (profile.role !== 'warehouse') {
    return null;
  }

  return (
    <AppShell title="Warehouse History">
      <PageHeader
        title="Warehouse History"
        description="PR1 stock validations you have completed."
      />

      {loading ? (
        <div className="flex justify-center py-24">
          <LoadingState message="Loading history..." />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">
          {error}
        </div>
      ) : totalCount === 0 ? (
        <div className="bg-white rounded-[4px] border border-[#D8E2FF]">
          <EmptyState
            title="No warehouse validations yet."
            description="When you submit a warehouse validation decision, it will appear here."
            icon={ClipboardList}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#D8E2FF] bg-[#F7F9FC]">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                      PR1
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                      Purpose
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                      Department
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                      Decision
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                      Validated
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                      PR1 status
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                      Notes
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8E2FF]">
                  {rows.map((r) => (
                    <tr key={r.validation_id} className="hover:bg-[#F7F9FC]">
                      <td className="px-5 py-3.5 font-mono font-semibold text-[#0F1F3A]">
                        {r.pr1_number}
                      </td>
                      <td className="px-5 py-3.5 text-[#40527A] max-w-[220px]" title={r.purpose}>
                        <span className="line-clamp-2">{r.purpose}</span>
                      </td>
                      <td className="px-5 py-3.5 text-[#40527A]">{r.department}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex text-xs font-semibold border rounded-full px-2 py-0.5 capitalize ${
                            DECISION_BADGE[r.decision] ??
                            'bg-[#F7F9FC] text-[#40527A] border-[#D8E2FF]'
                          }`}
                        >
                          {r.decision}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[#40527A] whitespace-nowrap">
                        {format(new Date(r.validated_at), 'MMM d, yyyy h:mm a')}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex text-xs font-semibold border rounded-full px-2 py-0.5 border-[#D8E2FF] bg-[#F7F9FC] text-[#40527A] capitalize">
                          {r.pr1_status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[#40527A] max-w-[200px] truncate" title={r.notes || undefined}>
                        {r.notes?.trim() ? r.notes : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={r.action_url}
                          className="inline-flex items-center gap-1.5 text-[#1E4BFF] hover:text-[#0F1F3A] text-xs font-semibold transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalCount > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={rowsPerPage}
              totalCount={totalCount}
              entityLabel="validations"
              loading={loading}
              onPageChange={(page) =>
                setCurrentPage(Math.max(1, Math.min(totalPages, page)))
              }
              className="rounded-[4px] border border-[#D8E2FF]"
            />
          )}
        </div>
      )}
    </AppShell>
  );
}
