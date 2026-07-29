'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import PaginationControls from '@/components/shared/PaginationControls';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig, TabFilter } from '@/components/shared/FilterBar.types';
import { useAuth } from '@/context/AuthContext';
import { fetchMyApprovalHistoryPaged } from '@/lib/approval-history';
import type {
  ApprovalHistoryActionFilter,
  ApprovalHistoryDocumentFilter,
  ApprovalHistoryRow,
} from '@/types/approvals';
import { History, Eye, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import type { AppRole } from '@/types/auth';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';

/** Roles that may view approval-signature history (`approval_actions.actor_id = self`). */
const APPROVAL_HISTORY_ROLES = new Set<AppRole>(['approver', 'procurement']);

function canAccessApprovalHistory(role: AppRole): boolean {
  return APPROVAL_HISTORY_ROLES.has(role);
}

const TABS: { value: ApprovalHistoryDocumentFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'PR1', label: 'PR1' },
  { value: 'PR2', label: 'PR2' },
  { value: 'PO', label: 'PO' },
];

const ACTION_OPTIONS: { value: ApprovalHistoryActionFilter; label: string }[] = [
  { value: 'all', label: 'All actions' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'revision_requested', label: 'Revision requested' },
];

const ACTION_BADGE: Record<string, string> = {
  approved: 'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
  rejected: 'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
  revision_requested: 'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
};

const INSTANCE_BADGE: Record<string, string> = {
  active: 'bg-pq-primary-50 text-pq-primary-700 border-pq-primary-200',
  approved: 'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
  rejected: 'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
  cancelled: 'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200',
};

const SEARCH_DEBOUNCE_MS = 400;

export default function ApprovalsHistoryPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [documentType, setDocumentType] = useState<ApprovalHistoryDocumentFilter>('all');
  const [actionFilter, setActionFilter] = useState<ApprovalHistoryActionFilter>('all');
  const [actedAtFrom, setActedAtFrom] = useState('');
  const [actedAtTo, setActedAtTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [rows, setRows] = useState<ApprovalHistoryRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const filterSignature = `${documentType}|${actionFilter}|${actedAtFrom}|${actedAtTo}|${debouncedSearch}`;
  const filterSignatureRef = useRef<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    if (!canAccessApprovalHistory(profile.role)) {
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

    fetchMyApprovalHistoryPaged({
      actorId: profile.id,
      documentType,
      limit: rowsPerPage,
      offset,
      action: actionFilter,
      actedAtFrom: actedAtFrom.trim() || null,
      actedAtTo: actedAtTo.trim() || null,
      search: debouncedSearch || null,
    })
      .then((page) => {
        setRows(page.rows);
        setTotalCount(page.total_count);
      })
      .catch(() => setError('Failed to load approval history.'))
      .finally(() => setLoading(false));
  }, [
    profile,
    router,
    filterSignature,
    documentType,
    currentPage,
    rowsPerPage,
    actionFilter,
    actedAtFrom,
    actedAtTo,
    debouncedSearch,
  ]);

  const setTabAndResetPage = (t: ApprovalHistoryDocumentFilter) => {
    setDocumentType(t);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setDocumentType('all');
    setActionFilter('all');
    setActedAtFrom('');
    setActedAtTo('');
    setSearchInput('');
    setDebouncedSearch('');
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / rowsPerPage) || 1;

  if (!profile) {
    return (
      <AppShell title="Approval History">
        <TableSkeleton rows={5} cols={8} />
      </AppShell>
    );
  }

  if (!canAccessApprovalHistory(profile.role)) {
    return null;
  }

  return (
    <AppShell title="Approval History">
      <PageHeader
        title="Approval History"
        description="Purchase requests you have approved, rejected, or marked for revision."
      />

      <FilterBar
        tabs={TABS.map((t) => ({ value: t.value, label: t.label }))}
        activeTab={documentType}
        onTabChange={(value) => setTabAndResetPage(value as ApprovalHistoryDocumentFilter)}
        filters={[
          {
            type: 'search',
            id: 'approval-history-search',
            label: 'Search',
            placeholder: 'Search document number or remarks…',
            value: searchInput,
            onChange: (value) => setSearchInput(value as string),
          },
          {
            type: 'select',
            id: 'approval-history-action',
            label: 'Your Action',
            placeholder: 'Select action',
            value: actionFilter,
            onChange: (value) => setActionFilter(value as ApprovalHistoryActionFilter),
            options: ACTION_OPTIONS,
          },
          {
            type: 'dateRange',
            id: 'approval-history-date',
            label: 'Signed',
            value: [actedAtFrom, actedAtTo],
            onChange: (value) => {
              const [from, to] = value as [string, string];
              setActedAtFrom(from);
              setActedAtTo(to);
            },
          },
        ]}
        onClear={clearFilters}
        loading={loading}
        resultCount={!error ? totalCount : undefined}
        resultLabel="action"
        className="mb-5"
      />

      {error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600 mb-4">
          {error}
        </div>
      ) : null}

      {loading ? (
        <TableSkeleton rows={5} cols={8} />
      ) : totalCount === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title="No signed actions yet"
            description="When you approve, reject, or request revision on a PR1, PR2, or PO, it will appear here."
            icon={History}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Type</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Document</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Your action</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Step</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Signed</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Workflow</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Remarks</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {rows.map((r) => (
                    <tr key={r.approval_action_id} className="hover:bg-pq-neutral-50">
                      <td className="px-5 py-3.5 font-medium text-pq-neutral-500">
                        <div className="flex items-center gap-1.5">
                          <span>{r.document_type}</span>
                          {r.request_type && <RequestTypeBadge type={r.request_type} />}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono font-semibold text-pq-neutral-900">{r.document_number}</td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex text-xs font-semibold border rounded-full px-2 py-0.5 capitalize ${ACTION_BADGE[r.action] ?? 'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200'}`}
                        >
                          {r.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center text-pq-neutral-500">{r.step_order}</td>
                      <td className="px-5 py-3.5 text-pq-neutral-500 whitespace-nowrap">
                        {format(new Date(r.acted_at), 'MMM d, yyyy h:mm a')}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex text-xs font-semibold border rounded-full px-2 py-0.5 capitalize ${INSTANCE_BADGE[r.instance_status] ?? INSTANCE_BADGE.active}`}
                        >
                          {r.instance_status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-pq-neutral-500 max-w-[200px] truncate" title={r.remarks ?? undefined}>
                        {r.remarks ?? '—'}
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
              entityLabel="actions"
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
