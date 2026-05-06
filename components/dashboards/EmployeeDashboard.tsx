'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import type { UserProfile } from '@/types/auth';
import type { PR1Request } from '@/types/pr1';
import { PR1_STATUS_LABELS } from '@/types/pr1';
import type { StatusVariant } from '@/components/shared/StatusChip';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import StatusChip from '@/components/shared/StatusChip';
import LoadingState from '@/components/shared/LoadingState';
import { fetchPendingSubstituteCount } from '@/lib/canvassing';
import { fetchMyPR1s } from '@/lib/pr1';
import PriorityChip from '@/components/shared/PriorityChip';
import {
  FileText,
  Clock,
  CircleCheck as CheckCircle2,
  Circle as XCircle,
  Replace,
  ArrowRight,
  Eye,
} from 'lucide-react';

const STATUS_MAP: Record<string, StatusVariant> = {
  draft:              'draft',
  pending_warehouse:  'pending',
  pending_approval:   'in_review',
  resolved_internal:  'validated',
  approved:           'approved',
  rejected:           'rejected',
  cancelled:          'cancelled',
};

interface Props { profile: UserProfile; }

export default function EmployeeDashboard({ profile }: Props) {
  const [pendingSubs, setPendingSubs] = useState(0);
  const [requests, setRequests] = useState<PR1Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchPendingSubstituteCount(profile.id).then(setPendingSubs).catch(() => {}),
      fetchMyPR1s(profile.id).then((result) => setRequests(result.requests)).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [profile.id]);

  const totalRequests = requests.length;
  const pendingApproval = requests.filter(r => r.status === 'pending_approval').length;
  const approved = requests.filter(r => r.status === 'approved').length;
  const rejected = requests.filter(r => r.status === 'rejected').length;

  const stats = [
    { label: 'Total Requests',   value: totalRequests.toString(), icon: FileText     },
    { label: 'Pending Approval', value: pendingApproval.toString(), icon: Clock        },
    { label: 'Approved',         value: approved.toString(), icon: CheckCircle2 },
    { label: 'Rejected',         value: rejected.toString(), icon: XCircle      },
  ];

  const recentRequests = requests.slice(0, 5);

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${profile.full_name.split(' ')[0]}`}
        description="Track and manage your purchase requests from here."
        action={
          <a
            href="/pr1/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition"
          >
            <FileText className="w-4 h-4" />
            New PR1
          </a>
        }
      />

      {pendingSubs > 0 && (
        <Link
          href="/substitutes"
          className="flex items-center gap-4 bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] px-5 py-4 mb-6 transition group"
        >
          <div className="w-10 h-10 rounded-[4px] bg-white border border-[#D8E2FF] text-[#40527A] flex items-center justify-center shrink-0">
            <Replace className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#0F1F3A]">
              {pendingSubs} substitute item{pendingSubs !== 1 ? 's' : ''} awaiting your decision
            </p>
            <p className="text-xs text-[#40527A] mt-0.5">
              A supplier proposed an alternative to what you requested. Review before procurement finalises selection.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#1E4BFF] group-hover:text-[#0F1F3A] transition">
            Review now <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      )}

      {/* Recent Requests — primary section */}
      <div className="bg-white rounded-[4px] border border-[#D8E2FF] mb-4">
        <div className="px-5 py-4 border-b border-[#D8E2FF]">
          <h2 className="text-sm font-semibold text-[#0F1F3A]">Recent Requests</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <LoadingState message="Loading requests..." />
          </div>
        ) : recentRequests.length === 0 ? (
          <EmptyState
            title="No requests yet"
            description="Create your first Purchase Request to get started."
            icon={FileText}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#D8E2FF] bg-[#F7F9FC]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">PR1 No.</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Purpose</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Submitted</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Priority</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E2FF]">
                {recentRequests.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F7F9FC] transition-colors">
                    <td className="px-5 py-3.5 font-mono font-medium text-[#0F1F3A]">{r.pr1_number}</td>
                    <td className="px-5 py-3.5 text-[#40527A] max-w-xs truncate">{r.purpose || '—'}</td>
                    <td className="px-5 py-3.5 text-[#40527A]">
                      {r.submitted_at ? format(new Date(r.submitted_at), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <PriorityChip priority={r.priority} />
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusChip
                        status={STATUS_MAP[r.status] ?? 'draft'}
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
        )}
      </div>

      {/* Stats — secondary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-[4px] border border-[#D8E2FF] p-3 flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-[4px] shrink-0 bg-[#F7F9FC] text-[#40527A]">
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-[#0F1F3A] leading-tight">{stat.value}</p>
                <p className="text-xs text-[#40527A] leading-tight">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

