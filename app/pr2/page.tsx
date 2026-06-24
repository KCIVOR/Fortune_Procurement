'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import PaginationControls from '@/components/shared/PaginationControls';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import { fetchPR2s, fetchDepartmentOptions } from '@/lib/pr2';
import { useAuth } from '@/context/AuthContext';
import type { PR2Request } from '@/types/pr2';
import { PR2_STATUS_LABELS, type PR2Status } from '@/types/pr2';
import { format } from 'date-fns';
import { ClipboardList, ArrowRight } from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  draft:              'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200',
  pending_approval:   'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
  approved:           'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
  revision_requested: 'bg-orange-50 text-orange-700 border-orange-200',
  rejected:           'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
  cancelled:          'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
};

export default function PR2ListPage() {
  const { profile } = useAuth();
  const [pr2s, setPR2s] = useState<PR2Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedDept, setSelectedDept] = useState('all');
  const [deptOptions, setDeptOptions] = useState<{ id: string; name: string }[]>([]);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const canFilterByDept = profile?.role === 'admin' || profile?.role === 'procurement';

  useEffect(() => {
    if (!canFilterByDept) return;
    fetchDepartmentOptions()
      .then(setDeptOptions)
      .catch(() => {});
  }, [canFilterByDept]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setLoading(true);
    setError('');
    const offset = (currentPage - 1) * rowsPerPage;
    fetchPR2s({
      limit:  rowsPerPage,
      offset,
      status: selectedStatus,
      search: appliedSearch.trim() || undefined,
      departmentId: canFilterByDept && selectedDept !== 'all' ? selectedDept : undefined,
    })
      .then((result) => {
        setPR2s(result.pr2s);
        setTotalCount(result.total_count);
      })
      .catch(() => setError('Failed to load purchase requests.'))
      .finally(() => setLoading(false));
  }, [currentPage, rowsPerPage, selectedStatus, appliedSearch, selectedDept, canFilterByDept]);

  const totalPages = Math.ceil(totalCount / rowsPerPage);

  // Filter configuration for FilterBar
  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'pr2-search',
      label: 'Search',
      placeholder: 'PR2 number or purpose...',
      value: search,
      onChange: (value) => setSearch(value as string),
    },
    {
      type: 'select',
      id: 'pr2-status',
      label: 'Status',
      placeholder: 'All statuses',
      value: selectedStatus,
      onChange: (value) => {
        setSelectedStatus(value as string);
        setCurrentPage(1);
      },
      options: [
        { value: 'all', label: 'All statuses' },
        ...(Object.keys(PR2_STATUS_LABELS) as PR2Status[]).map((key) => ({
          value: key,
          label: PR2_STATUS_LABELS[key],
        })),
      ],
    },
    ...(canFilterByDept ? [{
      type: 'select' as const,
      id: 'pr2-dept',
      label: 'Department',
      placeholder: 'All departments',
      value: selectedDept,
      onChange: (value: string | [string, string]) => {
        setSelectedDept(value as string);
        setCurrentPage(1);
      },
      options: [
        { value: 'all', label: 'All departments' },
        ...deptOptions.map(d => ({ value: d.id, label: d.name })),
      ],
    }] : []),
  ];

  const handleApply = () => {
    setAppliedSearch(search);
    setCurrentPage(1);
  };

  const handleClear = () => {
    setSearch('');
    setAppliedSearch('');
    setSelectedStatus('all');
    setSelectedDept('all');
    setCurrentPage(1);
  };

  return (
    <AppShell title="Purchase Requests">
      <PageHeader
        title="Purchase Requests (PR2)"
        description="Procurement purchase requests generated from completed canvassing."
      />

      <FilterBar
        filters={filters}
        onApply={handleApply}
        onClear={handleClear}
        loading={loading}
        resultCount={totalCount}
        resultLabel="purchase request"
        className="mb-4"
      />

      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">{error}</div>
      ) : totalCount === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title="No purchase requests yet"
            description={
              appliedSearch.trim() || selectedStatus !== 'all'
                ? 'No purchase requests match your filters. Try adjusting search or status.'
                : 'Generate a PR2 from a completed canvassing RFQ.'
            }
            icon={ClipboardList}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="px-5 py-2.5 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center gap-2">
              <ClipboardList className="w-3.5 h-3.5 text-pq-neutral-400" />
              <span className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                {totalCount} Purchase Request{totalCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50/50">
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">PR2 No.</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Status</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Purpose</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Department</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Date Required</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {pr2s.map(pr2 => (
                    <tr key={pr2.id} className="hover:bg-pq-neutral-50 transition">
                      <td className="px-5 py-3.5 font-mono font-semibold text-pq-neutral-900 whitespace-nowrap">{pr2.pr2_number}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex text-xs font-semibold border rounded-full px-2 py-0.5 ${STATUS_STYLES[pr2.status] ?? STATUS_STYLES.draft}`}>
                          {PR2_STATUS_LABELS[pr2.status]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-pq-neutral-500 max-w-[220px] truncate">{pr2.purpose}</td>
                      <td className="px-5 py-3.5 text-pq-neutral-500 whitespace-nowrap">{pr2.department_name_snapshot}</td>
                      <td className="px-5 py-3.5 text-pq-neutral-500 whitespace-nowrap">{format(new Date(pr2.date_required), 'MMM d, yyyy')}</td>
                      <td className="px-5 py-3.5 text-right">
                        <Link href={`/pr2/${pr2.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-pq-neutral-500 hover:text-pq-neutral-900 transition">
                          View <ArrowRight className="w-3.5 h-3.5" />
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
              entityLabel="purchase requests"
              loading={loading}
              onPageChange={(page) => {
                if (page < currentPage) setCurrentPage((p) => Math.max(1, p - 1));
                else setCurrentPage((p) => p + 1);
              }}
              className="rounded-md border border-pq-neutral-200"
            />
          )}
        </div>
      )}
    </AppShell>
  );
}
