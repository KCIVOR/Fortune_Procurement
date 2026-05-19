'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import PaginationControls from '@/components/shared/PaginationControls';
import { fetchPR2s } from '@/lib/pr2';
import type { PR2Request } from '@/types/pr2';
import { PR2_STATUS_LABELS, type PR2Status } from '@/types/pr2';
import { format } from 'date-fns';
import { ClipboardList, ArrowRight, Building2, CalendarDays } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUS_STYLES: Record<string, string> = {
  draft:                   'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200',
  pending_phase1_approval: 'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
  phase1_approved:         'bg-pq-primary-50 text-pq-primary-700 border-pq-primary-200',
  pending_phase2_approval: 'bg-orange-50 text-orange-700 border-orange-200',
  phase2_approved:         'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
  cancelled:               'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
};

export default function PR2ListPage() {
  const [pr2s, setPR2s] = useState<PR2Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    const offset = (currentPage - 1) * rowsPerPage;
    fetchPR2s({
      limit:  rowsPerPage,
      offset,
      status: selectedStatus,
      search: appliedSearch.trim() || undefined,
    })
      .then((result) => {
        setPR2s(result.pr2s);
        setTotalCount(result.total_count);
      })
      .catch(() => setError('Failed to load purchase requests.'))
      .finally(() => setLoading(false));
  }, [currentPage, rowsPerPage, selectedStatus, appliedSearch]);

  const totalPages = Math.ceil(totalCount / rowsPerPage);

  return (
    <AppShell title="Purchase Requests">
      <PageHeader
        title="Purchase Requests (PR2)"
        description="Procurement purchase requests generated from completed canvassing."
      />

      <div className="bg-white rounded-md border border-pq-neutral-200 p-4 mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor="pr2-search" className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
            Search
          </Label>
          <div className="flex gap-2">
            <input
              id="pr2-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setAppliedSearch(search); setCurrentPage(1); } }}
              placeholder="PR2 number or purpose..."
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
          <Label htmlFor="pr2-status" className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
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
            <SelectTrigger id="pr2-status" className="text-sm">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(Object.keys(PR2_STATUS_LABELS) as PR2Status[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {PR2_STATUS_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
            <div className="px-6 py-4 border-b border-pq-neutral-200 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-pq-neutral-900">
                {totalCount} purchase request{totalCount !== 1 ? 's' : ''}
              </h2>
            </div>
            <div className="divide-y divide-pq-neutral-200">
              {pr2s.map(pr2 => (
                <Link
                  key={pr2.id}
                  href={`/pr2/${pr2.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-pq-neutral-50 transition group"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-pq-neutral-50 flex items-center justify-center shrink-0 mt-0.5">
                      <ClipboardList className="w-4 h-4 text-pq-neutral-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-sm font-semibold text-pq-neutral-900">
                          {pr2.pr2_number}
                        </span>
                        <span className={`inline-flex text-xs font-semibold border rounded-full px-2 py-0.5 ${STATUS_STYLES[pr2.status] ?? STATUS_STYLES.draft}`}>
                          {PR2_STATUS_LABELS[pr2.status]}
                        </span>
                      </div>
                      <p className="text-sm text-pq-neutral-500 truncate">{pr2.purpose}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="inline-flex items-center gap-1 text-xs text-pq-neutral-400">
                          <Building2 className="w-3 h-3" />
                          {pr2.department_name_snapshot}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-pq-neutral-400">
                          <CalendarDays className="w-3 h-3" />
                          {format(new Date(pr2.date_required), 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-pq-neutral-400 group-hover:text-pq-neutral-500 shrink-0 transition" />
                </Link>
              ))}
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
