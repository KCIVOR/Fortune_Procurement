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
import { fetchMyApprovalHistoryPaged } from '@/lib/approval-history';
import type {
  ApprovalHistoryDocumentFilter,
  ApprovalHistoryRow,
} from '@/types/approvals';
import { History, Eye, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';
import type { AppRole } from '@/types/auth';

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

const ACTION_BADGE: Record<string, string> = {
  approved:           'bg-emerald-50 text-emerald-800 border-emerald-200',
  rejected:           'bg-red-50 text-red-700 border-red-200',
  revision_requested: 'bg-amber-50 text-amber-800 border-amber-200',
};

const INSTANCE_BADGE: Record<string, string> = {
  active:    'bg-blue-50 text-blue-700 border-blue-200',
  approved:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected:  'bg-red-50 text-red-600 border-red-200',
  cancelled: 'bg-[#F7F9FC] text-[#40527A] border-[#D8E2FF]',
};

export default function ApprovalsHistoryPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [documentType, setDocumentType] = useState<ApprovalHistoryDocumentFilter>('all');
  const [rows, setRows]               = useState<ApprovalHistoryRow[]>([]);
  const [totalCount, setTotalCount]    = useState(0);
  const [loading, setLoading]          = useState(true);
  const [error, setError]             = useState('');
  const [currentPage, setCurrentPage]  = useState(1);
  const rowsPerPage = 20;

  useEffect(() => {
    if (!profile) return;
    if (!canAccessApprovalHistory(profile.role)) {
      router.replace('/dashboard');
      return;
    }
    setLoading(true);
    setError('');
    const offset = (currentPage - 1) * rowsPerPage;

    fetchMyApprovalHistoryPaged({
      actorId:      profile.id,
      documentType,
      limit:        rowsPerPage,
      offset,
    })
      .then((page) => {
        setRows(page.rows);
        setTotalCount(page.total_count);
      })
      .catch(() => setError('Failed to load approval history.'))
      .finally(() => setLoading(false));
  }, [profile, router, documentType, currentPage, rowsPerPage]);

  const setTabAndResetPage = (t: ApprovalHistoryDocumentFilter) => {
    setDocumentType(t);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / rowsPerPage) || 1;

  if (!profile) {
    return (
      <AppShell title="Approval History">
        <div className="flex justify-center py-24">
          <LoadingState message="Loading..." />
        </div>
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

      <div className="flex gap-2 flex-wrap mb-5">
        {TABS.map((t) => {
          const active = documentType === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTabAndResetPage(t.value)}
              disabled={loading}
              className={`inline-flex items-center px-3 py-1.5 rounded-[4px] text-xs font-semibold border transition ${
                active
                  ? 'bg-[#0F1F3A] text-white border-[#0F1F3A]'
                  : 'bg-white text-[#40527A] border-[#D8E2FF] hover:border-[#0F1F3A] hover:bg-[#F7F9FC]'
              } disabled:opacity-50`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700 mb-4">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-24">
          <LoadingState message="Loading history..." />
        </div>
      ) : totalCount === 0 ? (
        <div className="bg-white rounded-[4px] border border-[#D8E2FF]">
          <EmptyState
            title="No signed actions yet"
            description="When you approve, reject, or request revision on a PR1, PR2, or PO, it will appear here."
            icon={History}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#D8E2FF] bg-[#F7F9FC]">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Type</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Document</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Your action</th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Step</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Signed</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Workflow</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Remarks</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8E2FF]">
                  {rows.map((r) => (
                    <tr key={r.approval_action_id} className="hover:bg-[#F7F9FC]">
                      <td className="px-5 py-3.5 font-medium text-[#40527A]">{r.document_type}</td>
                      <td className="px-5 py-3.5 font-mono font-semibold text-[#0F1F3A]">{r.document_number}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex text-xs font-semibold border rounded-full px-2 py-0.5 capitalize ${ACTION_BADGE[r.action] ?? 'bg-[#F7F9FC] text-[#40527A] border-[#D8E2FF]'}`}>
                          {r.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center text-[#40527A]">{r.step_order}</td>
                      <td className="px-5 py-3.5 text-[#40527A] whitespace-nowrap">
                        {format(new Date(r.acted_at), 'MMM d, yyyy h:mm a')}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex text-xs font-semibold border rounded-full px-2 py-0.5 capitalize ${INSTANCE_BADGE[r.instance_status] ?? INSTANCE_BADGE.active}`}>
                          {r.instance_status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[#40527A] max-w-[200px] truncate" title={r.remarks ?? undefined}>
                        {r.remarks ?? '—'}
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
              entityLabel="actions"
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
