'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import PaginationControls from '@/components/shared/PaginationControls';
import { useAuth } from '@/context/AuthContext';
import { fetchMyWarehouseValidationHistoryPaged } from '@/lib/warehouse-history';
import { PR1_STATUS_LABELS, type PR1Status } from '@/types/pr1';
import type {
  WarehouseHistoryDecisionFilter,
  WarehouseValidationHistoryRow,
} from '@/types/warehouse';
import { ClipboardList, Eye, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

const DECISION_BADGE: Record<string, string> = {
  sufficient: 'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
  insufficient: 'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
};

const DECISION_OPTIONS: { value: WarehouseHistoryDecisionFilter; label: string }[] = [
  { value: 'all', label: 'All decisions' },
  { value: 'sufficient', label: 'Sufficient' },
  { value: 'insufficient', label: 'Insufficient' },
];

const PR1_STATUS_OPTIONS: { value: PR1Status | 'all'; label: string }[] = [
  { value: 'all', label: 'All PR1 statuses' },
  ...(Object.keys(PR1_STATUS_LABELS) as PR1Status[]).map((s) => ({
    value: s,
    label: PR1_STATUS_LABELS[s],
  })),
];

const SEARCH_DEBOUNCE_MS = 400;

export default function WarehouseHistoryPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [decisionFilter, setDecisionFilter] = useState<WarehouseHistoryDecisionFilter>('all');
  const [pr1StatusFilter, setPr1StatusFilter] = useState<PR1Status | 'all'>('all');
  const [validatedFrom, setValidatedFrom] = useState('');
  const [validatedTo, setValidatedTo] = useState('');
  const [rows, setRows] = useState<WarehouseValidationHistoryRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  const filterSignature = `${decisionFilter}|${pr1StatusFilter}|${validatedFrom}|${validatedTo}|${debouncedSearch}`;
  const filterSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!profile) return;
    if (profile.role !== 'warehouse') {
      router.replace('/dashboard');
      return;
    }

    const filterChanged =
      filterSignatureRef.current !== null && filterSignatureRef.current !== filterSignature;
    let pageForFetch = currentPage;
    if (filterChanged) {
      pageForFetch = 1;
      if (currentPage !== 1) setCurrentPage(1);
    }
    filterSignatureRef.current = filterSignature;

    setLoading(true);
    setError('');
    const offset = (pageForFetch - 1) * rowsPerPage;

    fetchMyWarehouseValidationHistoryPaged({
      validatorId: profile.id,
      limit: rowsPerPage,
      offset,
      search: debouncedSearch || null,
      decision: decisionFilter,
      pr1Status: pr1StatusFilter === 'all' ? null : pr1StatusFilter,
      validatedFrom: validatedFrom.trim() || null,
      validatedTo: validatedTo.trim() || null,
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
  }, [
    profile,
    router,
    filterSignature,
    currentPage,
    rowsPerPage,
    decisionFilter,
    pr1StatusFilter,
    validatedFrom,
    validatedTo,
    debouncedSearch,
  ]);

  const clearFilters = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setDecisionFilter('all');
    setPr1StatusFilter('all');
    setValidatedFrom('');
    setValidatedTo('');
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / rowsPerPage) || 1;

  if (!profile) {
    return (
      <AppShell title="Warehouse History">
        <TableSkeleton rows={5} cols={8} />
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

      <div className="bg-white rounded-md border border-pq-neutral-200 p-4 mb-5 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <label htmlFor="warehouse-history-search" className="block text-xs font-semibold text-pq-neutral-500 mb-1">
              Search
            </label>
            <input
              id="warehouse-history-search"
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="PR1 number, purpose, department, or notes…"
              className="w-full rounded-md border border-pq-neutral-200 px-3 py-2 text-sm text-pq-neutral-900 placeholder:text-pq-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#1E4BFF]/30 focus:border-pq-primary-600"
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="warehouse-history-decision" className="block text-xs font-semibold text-pq-neutral-500 mb-1">
              Decision
            </label>
            <select
              id="warehouse-history-decision"
              value={decisionFilter}
              onChange={(e) => setDecisionFilter(e.target.value as WarehouseHistoryDecisionFilter)}
              className="w-full rounded-md border border-pq-neutral-200 px-3 py-2 text-sm text-pq-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4BFF]/30 focus:border-pq-primary-600"
              disabled={loading}
            >
              {DECISION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={clearFilters}
              disabled={loading}
              className="w-full md:w-auto px-4 py-2 rounded-md border border-pq-neutral-200 text-sm font-semibold text-pq-neutral-500 hover:bg-pq-neutral-50 hover:border-pq-primary-600 transition disabled:opacity-50"
            >
              Clear filters
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-1">
            <label htmlFor="warehouse-history-pr1-status" className="block text-xs font-semibold text-pq-neutral-500 mb-1">
              PR1 status
            </label>
            <select
              id="warehouse-history-pr1-status"
              value={pr1StatusFilter}
              onChange={(e) => setPr1StatusFilter(e.target.value as PR1Status | 'all')}
              className="w-full rounded-md border border-pq-neutral-200 px-3 py-2 text-sm text-pq-neutral-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#1E4BFF]/30 focus:border-pq-primary-600"
              disabled={loading}
            >
              {PR1_STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="warehouse-history-from" className="block text-xs font-semibold text-pq-neutral-500 mb-1">
              Validated from
            </label>
            <input
              id="warehouse-history-from"
              type="date"
              value={validatedFrom}
              onChange={(e) => setValidatedFrom(e.target.value)}
              className="w-full rounded-md border border-pq-neutral-200 px-3 py-2 text-sm text-pq-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#1E4BFF]/30 focus:border-pq-primary-600"
              disabled={loading}
            />
          </div>
          <div>
            <label htmlFor="warehouse-history-to" className="block text-xs font-semibold text-pq-neutral-500 mb-1">
              Validated to
            </label>
            <input
              id="warehouse-history-to"
              type="date"
              value={validatedTo}
              onChange={(e) => setValidatedTo(e.target.value)}
              className="w-full rounded-md border border-pq-neutral-200 px-3 py-2 text-sm text-pq-neutral-900 focus:outline-none focus:ring-2 focus:ring-[#1E4BFF]/30 focus:border-pq-primary-600"
              disabled={loading}
            />
          </div>
        </div>
        {!loading && !error ? (
          <p className="text-xs text-pq-neutral-500">
            <span className="font-semibold text-pq-neutral-900">{totalCount}</span> validation
            {totalCount !== 1 ? 's' : ''} found
          </p>
        ) : null}
      </div>

      {loading ? (
        <TableSkeleton rows={5} cols={8} />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
          {error}
        </div>
      ) : totalCount === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title="No warehouse validations yet."
            description="When you submit a warehouse validation decision, it will appear here."
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
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                      PR1
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                      Purpose
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                      Department
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                      Decision
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                      Validated
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                      PR1 status
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                      Notes
                    </th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {rows.map((r) => (
                    <tr key={r.validation_id} className="hover:bg-pq-neutral-50">
                      <td className="px-5 py-3.5 font-mono font-semibold text-pq-neutral-900">
                        {r.pr1_number}
                      </td>
                      <td className="px-5 py-3.5 text-pq-neutral-500 max-w-[220px]" title={r.purpose}>
                        <span className="line-clamp-2">{r.purpose}</span>
                      </td>
                      <td className="px-5 py-3.5 text-pq-neutral-500">{r.department}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex text-xs font-semibold border rounded-full px-2 py-0.5 capitalize ${
                            DECISION_BADGE[r.decision] ??
                            'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200'
                          }`}
                        >
                          {r.decision}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-pq-neutral-500 whitespace-nowrap">
                        {format(new Date(r.validated_at), 'MMM d, yyyy h:mm a')}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex text-xs font-semibold border rounded px-2 py-0.5 border-pq-neutral-200 bg-pq-neutral-50 text-pq-neutral-500">
                          {PR1_STATUS_LABELS[r.pr1_status as PR1Status] ?? r.pr1_status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-pq-neutral-500 max-w-[200px] truncate" title={r.notes || undefined}>
                        {r.notes?.trim() ? r.notes : '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Link
                          href={r.action_url}
                          className="inline-flex items-center gap-1.5 text-pq-primary-600 hover:text-pq-neutral-900 text-xs font-semibold transition"
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
              className="rounded-md border border-pq-neutral-200"
            />
          )}
        </div>
      )}
    </AppShell>
  );
}
