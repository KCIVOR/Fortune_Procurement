'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import StatusChip from '@/components/shared/StatusChip';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import PaginationControls from '@/components/shared/PaginationControls';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { fetchMyPR1s } from '@/lib/pr1';
import type { PR1Request } from '@/types/pr1';
import { PR1_STATUS_LABELS, type PR1Status } from '@/types/pr1';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { FileText, Plus, Eye, Clock } from 'lucide-react';
import { format } from 'date-fns';
import PriorityChip from '@/components/shared/PriorityChip';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_MAP: Record<string, StatusVariant> = {
  draft:                'draft',
  pending_warehouse:    'pending',
  pending_approval:     'in_review',
  resolved_internal:    'validated',
  revision_requested:   'in_review',
  for_canvassing:       'approved',
  canvassing_complete:  'approved',
  approved:             'approved',
  rejected:             'rejected',
  cancelled:            'cancelled',
};

export default function PR1ListPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<PR1Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  useEffect(() => {
    if (!profile) return;
    if (profile.role !== 'employee') {
      router.push('/dashboard');
      return;
    }
    setLoading(true);
    const offset = (currentPage - 1) * rowsPerPage;
    fetchMyPR1s(profile.id, {
      limit:  rowsPerPage,
      offset,
      status: selectedStatus,
      search: appliedSearch.trim() || undefined,
    })
      .then((result) => {
        setRequests(result.requests);
        setTotalCount(result.total_count);
      })
      .catch(() => setError('Failed to load requests.'))
      .finally(() => setLoading(false));
  }, [profile, currentPage, rowsPerPage, router, selectedStatus, appliedSearch]);

  return (
    <AppShell title="My Requests">
      <PageHeader
        title="Purchase Requests (PR1)"
        description="Create and track your purchase requisitions."
        action={
          <Link
            href="/pr1/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition"
          >
            <Plus className="w-4 h-4" />
            New PR1
          </Link>
        }
      />

      <div className="bg-white rounded-md border border-pq-neutral-200 p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="pr1-search" className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
            Search
          </Label>
          <div className="flex gap-2">
            <input
              id="pr1-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setAppliedSearch(search); setCurrentPage(1); } }}
              placeholder="PR1 number or purpose..."
              disabled={loading}
              className="flex-1 px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition disabled:opacity-50"
            />
            <button
              onClick={() => { setAppliedSearch(search); setCurrentPage(1); }}
              disabled={loading}
              className="px-3 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-xs font-semibold rounded-md transition disabled:opacity-50 whitespace-nowrap"
            >
              Apply
            </button>
            <button
              onClick={() => { setSearch(''); setAppliedSearch(''); setCurrentPage(1); }}
              disabled={loading}
              className="px-3 py-2 text-xs font-medium text-pq-neutral-500 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md hover:bg-pq-neutral-200 disabled:opacity-50 transition whitespace-nowrap"
            >
              Clear
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pr1-status" className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
            Status
          </Label>
          <Select
            value={selectedStatus}
            onValueChange={(s) => {
              setSelectedStatus(s);
              setCurrentPage(1);
            }}
            disabled={loading}
          >
            <SelectTrigger id="pr1-status" className="text-sm">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(PR1_STATUS_LABELS) as PR1Status[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {PR1_STATUS_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={7} />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">{error}</div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title="No purchase requests yet"
            description={
              appliedSearch.trim() || selectedStatus !== 'all'
                ? 'No requests match your filters. Try adjusting search or status.'
                : "Your submitted PR1s will appear here. Click 'New PR1' to get started."
            }
            icon={FileText}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">PR1 No.</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Purpose</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Date Required</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Submitted</th>
                  <th className="text-center px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide w-24">Priority</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-pq-neutral-200">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-pq-neutral-50 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-medium text-pq-neutral-900">{r.pr1_number}</td>
                    <td className="px-5 py-3.5 text-pq-neutral-500 max-w-xs truncate">{r.purpose || '—'}</td>
                    <td className="px-5 py-3.5 text-pq-neutral-500">
                      {r.date_required ? format(new Date(r.date_required), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-pq-neutral-500">
                      {r.submitted_at ? (
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {format(new Date(r.submitted_at), 'MMM d, yyyy')}
                        </span>
                      ) : (
                        <span className="text-pq-neutral-400 italic">Not yet</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <PriorityChip priority={r.priority || 'normal'} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusChip
                        status={(r.lifecycle_display_chip ?? STATUS_MAP[r.status]) || 'pending'}
                        label={r.lifecycle_display_label ?? PR1_STATUS_LABELS[r.status]}
                        size="sm"
                      />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/pr1/${r.id}`}
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
