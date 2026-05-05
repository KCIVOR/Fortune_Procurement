'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import StatusChip from '@/components/shared/StatusChip';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { fetchMyPR1s } from '@/lib/pr1';
import type { PR1Request } from '@/types/pr1';
import { PR1_STATUS_LABELS } from '@/types/pr1';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { FileText, Plus, Eye, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { getPriorityColors } from '@/lib/utils';

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

function PriorityBadge({ priority }: { priority: string }) {
  const colors = getPriorityColors(priority);

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
      {colors.label}
    </span>
  );
}

export default function PR1ListPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<PR1Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (!profile) return;
    if (profile.role !== 'employee') {
      router.push('/dashboard');
      return;
    }
    setLoading(true);
    const offset = (currentPage - 1) * rowsPerPage;
    fetchMyPR1s(profile.id, { limit: rowsPerPage, offset })
      .then((result) => {
        setRequests(result.requests);
        setTotalCount(result.total_count);
      })
      .catch(() => setError('Failed to load requests.'))
      .finally(() => setLoading(false));
  }, [profile, currentPage, rowsPerPage, router]);

  return (
    <AppShell title="My Requests">
      <PageHeader
        title="Purchase Requests (PR1)"
        description="Create and track your purchase requisitions."
        action={
          <Link
            href="/pr1/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition"
          >
            <Plus className="w-4 h-4" />
            New PR1
          </Link>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading requests..." />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">{error}</div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-[4px] border border-[#D8E2FF]">
          <EmptyState
            title="No purchase requests yet"
            description="Your submitted PR1s will appear here. Click 'New PR1' to get started."
            icon={FileText}
          />
        </div>
      ) : (
        <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#D8E2FF] bg-[#F7F9FC]">
                <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">PR1 No.</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Purpose</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Date Required</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Submitted</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide w-24">Priority</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D8E2FF]">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-[#F7F9FC] transition-colors">
                  <td className="px-5 py-3.5 font-mono font-medium text-[#0F1F3A]">{r.pr1_number}</td>
                  <td className="px-5 py-3.5 text-[#40527A] max-w-xs truncate">{r.purpose || '—'}</td>
                  <td className="px-5 py-3.5 text-[#40527A]">
                    {r.date_required ? format(new Date(r.date_required), 'MMM d, yyyy') : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-[#40527A]">
                    {r.submitted_at ? (
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {format(new Date(r.submitted_at), 'MMM d, yyyy')}
                      </span>
                    ) : (
                      <span className="text-[#BFC7D5] italic">Not yet</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    <PriorityBadge priority={r.priority} />
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusChip
                      status={STATUS_MAP[r.status] || 'pending'}
                      label={PR1_STATUS_LABELS[r.status]}
                      size="sm"
                    />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/pr1/${r.id}`}
                      className="inline-flex items-center gap-1.5 text-[#1E4BFF] hover:text-[#0F1F3A] text-xs font-medium transition"
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

        {/* Pagination Controls */}
        {requests.length > 0 && (
          <div className="bg-white rounded-lg border border-[#E5EAFF] p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-[#40527A]">
                Showing {Math.min((currentPage - 1) * rowsPerPage + 1, totalCount)}–{Math.min(currentPage * rowsPerPage, totalCount)} of {totalCount} requests
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || loading}
                  className="px-3 py-1 text-xs font-medium text-[#40527A] bg-[#F7F9FC] border border-[#D8E2FF] rounded hover:bg-[#E5EAFF] disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Previous
                </button>
                <div className="text-xs text-[#40527A] font-medium">
                  Page {currentPage} of {Math.ceil(totalCount / rowsPerPage)}
                </div>
                <button
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={currentPage >= Math.ceil(totalCount / rowsPerPage) || loading}
                  className="px-3 py-1 text-xs font-medium text-[#40527A] bg-[#F7F9FC] border border-[#D8E2FF] rounded hover:bg-[#E5EAFF] disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      )}
    </AppShell>
  );
}
