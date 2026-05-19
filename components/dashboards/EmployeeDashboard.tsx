'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { StatCard } from '@/components/shared/StatCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { UserProfile } from '@/types/auth';
import type { PR1Request } from '@/types/pr1';
import { PR1_STATUS_LABELS } from '@/types/pr1';
import type { StatusVariant } from '@/components/shared/StatusChip';
import PageHeader from '@/components/shared/PageHeader';
import { useModuleVisibility } from '@/hooks/use-module-visibility';
import EmptyState from '@/components/shared/EmptyState';
import StatusChip from '@/components/shared/StatusChip';
import LoadingState from '@/components/shared/LoadingState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
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
  draft: 'draft',
  pending_warehouse: 'pending',
  pending_approval: 'in_review',
  resolved_internal: 'validated',
  approved: 'approved',
  rejected: 'rejected',
  cancelled: 'cancelled',
};

interface Props { profile: UserProfile; }

export default function EmployeeDashboard({ profile }: Props) {
  const { isModuleVisible, rulesLoading } = useModuleVisibility(profile);
  const [pendingSubs, setPendingSubs] = useState(0);
  const [requests, setRequests] = useState<PR1Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchPendingSubstituteCount(profile.id).then(setPendingSubs).catch(() => { }),
      fetchMyPR1s(profile.id).then((result) => setRequests(result.requests)).catch(() => { }),
    ]).finally(() => setLoading(false));
  }, [profile.id]);

  const totalRequests = requests.length;
  const pendingApproval = requests.filter(r => r.status === 'pending_approval').length;
  const approved = requests.filter(r => r.status === 'approved').length;
  const rejected = requests.filter(r => r.status === 'rejected').length;

  const stats = [
    { label: 'Total Requests', value: totalRequests.toString(), icon: FileText },
    { label: 'Pending Approval', value: pendingApproval.toString(), icon: Clock },
    { label: 'Approved', value: approved.toString(), icon: CheckCircle2 },
    { label: 'Rejected', value: rejected.toString(), icon: XCircle },
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition"
          >
            <FileText className="w-4 h-4" />
            New PR1
          </a>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 mt-1">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const lowerLabel = stat.label.toLowerCase();
          const accent = lowerLabel.includes('approved')
            ? 'green'
            : lowerLabel.includes('rejected')
            ? 'red'
            : lowerLabel.includes('pending')
            ? 'amber'
            : 'blue';

          return (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={<Icon className="w-5 h-5" />}
              accent={accent}
              isLoading={loading}
            />
          );
        })}
      </div>

      {rulesLoading ? (
        <div
          className="h-[4.75rem] mb-4 rounded-md border border-pq-neutral-200 bg-pq-neutral-50 animate-pulse"
          aria-hidden
        />
      ) : null}
      {!rulesLoading && isModuleVisible('substitute_review') && pendingSubs > 0 && (
        <Link
          href="/substitutes"
          className="flex items-center gap-4 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md px-5 py-4 mb-4 transition group"
        >
          <div className="w-10 h-10 rounded-md bg-white border border-pq-neutral-200 text-pq-neutral-500 flex items-center justify-center shrink-0">
            <Replace className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-pq-neutral-900">
              {pendingSubs} substitute item{pendingSubs !== 1 ? 's' : ''} awaiting your decision
            </p>
            <p className="text-xs text-pq-neutral-500 mt-0.5">
              A supplier proposed an alternative to what you requested. Review before procurement finalises selection.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-pq-primary-600 group-hover:text-pq-neutral-900 transition">
            Review now <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      )}

      {/* Recent Requests */}
      <div className="bg-white rounded-md border border-pq-neutral-200 mb-4">
        <div className="px-5 py-4 border-b border-pq-neutral-200">
          <h2 className="text-sm font-semibold text-pq-neutral-900">Recent Requests</h2>
        </div>
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={3} cols={5} showHeader={false} />
          </div>
        ) : recentRequests.length === 0 ? (
          <EmptyState
            title="No requests yet"
            description="Create your first Purchase Request to get started."
            icon={FileText}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                  <TableHead className="px-5 py-3 text-xs font-semibold text-pq-neutral-500">PR1 No.</TableHead>
                  <TableHead className="px-5 py-3 text-xs font-semibold text-pq-neutral-500">Purpose</TableHead>
                  <TableHead className="px-5 py-3 text-xs font-semibold text-pq-neutral-500">Submitted</TableHead>
                  <TableHead className="px-5 py-3 text-xs font-semibold text-pq-neutral-500">Priority</TableHead>
                  <TableHead className="px-5 py-3 text-xs font-semibold text-pq-neutral-500">Status</TableHead>
                  <TableHead className="px-5 py-3 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody className="bg-pq-white">
                {recentRequests.map((r) => (
                  <TableRow key={r.id} className="hover:bg-pq-neutral-50 border-b border-pq-neutral-200 transition">
                    <TableCell className="px-5 py-3.5 font-mono font-medium text-pq-neutral-900">{r.pr1_number}</TableCell>
                    <TableCell className="px-5 py-3.5 text-pq-neutral-500 max-w-xs truncate">{r.purpose || '—'}</TableCell>
                    <TableCell className="px-5 py-3.5 text-pq-neutral-500">
                      {r.submitted_at ? format(new Date(r.submitted_at), 'MMM d, yyyy') : '—'}
                    </TableCell>
                    <TableCell className="px-5 py-3.5">
                      <PriorityChip priority={r.priority} />
                    </TableCell>
                    <TableCell className="px-5 py-3.5">
                      <StatusChip
                        status={STATUS_MAP[r.status] ?? 'draft'}
                        label={PR1_STATUS_LABELS[r.status]}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell className="px-5 py-3.5 text-right">
                      <Link
                        href={`/pr1/${r.id}`}
                        className="inline-flex items-center gap-1.5 text-pq-primary-600 hover:text-pq-neutral-900 text-xs font-medium transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

