'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClipboardList, Plus, Eye } from 'lucide-react';
import { format } from 'date-fns';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import PaginationControls from '@/components/shared/PaginationControls';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import StatusChip from '@/components/shared/StatusChip';
import type { StatusVariant } from '@/components/shared/StatusChip';
import PriorityChip from '@/components/shared/PriorityChip';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';
import { useAuth } from '@/context/AuthContext';
import { canRequestRawMaterials } from '@/lib/raw-material-access';
import { fetchMyRawMaterialPR2s, PR2_LIFECYCLE_FILTER_OPTIONS } from '@/lib/pr2-planning';
import type { PR2Request } from '@/types/pr2';
import { PR2_STATUS_LABELS } from '@/types/pr2';

const STATUS_MAP: Record<string, StatusVariant> = {
  draft:                'draft',
  pending_approval:     'in_review',
  approved:             'approved',
  revision_requested:   'in_review',
  rejected:             'rejected',
  cancelled:            'cancelled',
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  ...PR2_LIFECYCLE_FILTER_OPTIONS,
];

export default function RawMaterialPR2ListPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<PR2Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [dateRange, setDateRange] = useState<[string, string]>(['', '']);
  const [appliedDateRange, setAppliedDateRange] = useState<[string, string]>(['', '']);

  useEffect(() => {
    if (!profile) return;
    if (!canRequestRawMaterials(profile)) {
      router.push('/dashboard');
      return;
    }
    setLoading(true);
    const offset = (currentPage - 1) * rowsPerPage;
    fetchMyRawMaterialPR2s(profile.id, {
      limit:       rowsPerPage,
      offset,
      status:      selectedStatus,
      priority:    selectedPriority,
      search:      appliedSearch.trim() || undefined,
      dateFrom:    appliedDateRange[0] || undefined,
      dateTo:      appliedDateRange[1] || undefined,
      requestType: 'all',
    })
      .then((result) => {
        setRequests(result.requests);
        setTotalCount(result.total_count);
      })
      .catch(() => setError('Failed to load requests.'))
      .finally(() => setLoading(false));
  }, [profile, router, currentPage, rowsPerPage, selectedStatus, selectedPriority, appliedSearch, appliedDateRange]);

  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'raw-pr2-search',
      label: 'Search',
      placeholder: 'PR2 number or purpose...',
      value: search,
      onChange: (value) => setSearch(value as string),
    },
    {
      type: 'select',
      id: 'raw-pr2-status',
      label: 'Status',
      placeholder: 'All statuses',
      value: selectedStatus,
      onChange: (value) => {
        setSelectedStatus(value as string);
        setCurrentPage(1);
      },
      options: STATUS_OPTIONS,
    },
    {
      type: 'select',
      id: 'raw-pr2-priority',
      label: 'Priority',
      placeholder: 'All priorities',
      value: selectedPriority,
      onChange: (value) => {
        setSelectedPriority(value as string);
        setCurrentPage(1);
      },
      options: [
        { value: 'all',    label: 'All Priorities' },
        { value: 'normal', label: 'Normal' },
        { value: 'medium', label: 'Medium' },
        { value: 'high',   label: 'High' },
      ],
    },
    {
      type: 'dateRange',
      id: 'raw-pr2-date',
      label: 'Date Created',
      value: dateRange,
      onChange: (val) => setDateRange(val as [string, string]),
    },
  ];

  const handleApply = () => {
    setAppliedSearch(search);
    setAppliedDateRange(dateRange);
    setCurrentPage(1);
  };

  const handleClear = () => {
    setSearch('');
    setAppliedSearch('');
    setSelectedStatus('all');
    setSelectedPriority('all');
    setDateRange(['', '']);
    setAppliedDateRange(['', '']);
    setCurrentPage(1);
  };

  return (
    <AppShell title="My Requests">
      <PageHeader
        title="My Requests"
        description="Create and track your Raw Material and Services PR2 requisitions."
        action={
          <Link
            href="/planning/pr2/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition"
          >
            <Plus className="w-4 h-4" />
            New Request
          </Link>
        }
      />

      <FilterBar
        filters={filters}
        onApply={handleApply}
        onClear={handleClear}
        loading={loading}
        resultCount={totalCount}
        resultLabel="request"
        className="mb-4"
      />

      {loading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">{error}</div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title="No requests yet"
            description={
              appliedSearch.trim() || selectedStatus !== 'all' || selectedPriority !== 'all'
                ? 'No requests match your filters. Try adjusting search or filters.'
                : "Your submitted PR2s (Raw Material and Services) will appear here. Click 'New Request' to get started."
            }
            icon={ClipboardList}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">PR2 No.</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Type</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Priority</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Purpose</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Date Required</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {requests.map((r) => (
                    <tr key={r.id} className="hover:bg-pq-neutral-50 transition-colors">
                      <td className="px-5 py-3.5 font-mono font-medium text-pq-neutral-900">{r.pr2_number}</td>
                      <td className="px-5 py-3.5">
                        <RequestTypeBadge type={r.request_type as 'raw_material' | 'services'} />
                      </td>
                      <td className="px-5 py-3.5">
                        <PriorityChip priority={r.priority ?? 'normal'} />
                      </td>
                      <td className="px-5 py-3.5 text-pq-neutral-500 max-w-xs truncate">{r.purpose || '—'}</td>
                      <td className="px-5 py-3.5 text-pq-neutral-500">
                        {r.date_required ? format(new Date(r.date_required), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusChip
                          status={(r.lifecycle_display_chip ?? STATUS_MAP[r.status]) || 'pending'}
                          label={r.lifecycle_display_label ?? PR2_STATUS_LABELS[r.status]}
                          size="sm"
                        />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={`/planning/pr2/${r.id}`}
                          className="inline-flex items-center gap-1.5 text-pq-primary-600 hover:text-pq-neutral-900 text-xs font-medium transition"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
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
              totalPages={Math.ceil(totalCount / rowsPerPage)}
              pageSize={rowsPerPage}
              totalCount={totalCount}
              entityLabel="requests"
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
