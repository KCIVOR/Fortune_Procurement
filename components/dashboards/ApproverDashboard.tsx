'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { StatCard } from '@/components/shared/StatCard';
import type { UserProfile } from '@/types/auth';
import PageHeader from '@/components/shared/PageHeader';
import { ApproverDashboardVisibilitySkeleton } from '@/components/shared/module-visibility-skeletons';
import { useModuleVisibility } from '@/hooks/use-module-visibility';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { DashboardQueueSkeleton } from '@/components/shared/structural-skeletons';
import { fetchApprovalQueue, fetchApproverStats, canActOnStep } from '@/lib/approvals';
import type { PR1ApprovalQueueRow } from '@/types/approvals';
import PriorityChip from '@/components/shared/PriorityChip';
import {
  SquareCheck as CheckSquare,
  Clock,
  CircleCheck as CheckCircle2,
  Circle as XCircle,
  ArrowRight,
  Lock,
} from 'lucide-react';
import { format } from 'date-fns';

interface Props { profile: UserProfile; }

export default function ApproverDashboard({ profile }: Props) {
  const { isModuleVisible, rulesLoading } = useModuleVisibility(profile);
  const showApprovalQueue = isModuleVisible('approval_queue');
  const [queue, setQueue] = useState<PR1ApprovalQueueRow[]>([]);
  const [stats, setStats] = useState({
    awaitingAction: 0, approvedThisWeek: 0, rejectedThisWeek: 0, totalProcessed: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchApprovalQueue(),
      fetchApproverStats(profile.id),
    ]).then(([q, s]) => {
      setQueue(q);
      setStats(s);
    }).finally(() => setLoading(false));
  }, [profile.id]);

  const statCards = [
    { label: 'Awaiting My Action', value: stats.awaitingAction, icon: Clock },
    { label: 'Approved This Week', value: stats.approvedThisWeek, icon: CheckCircle2 },
    { label: 'Rejected This Week', value: stats.rejectedThisWeek, icon: XCircle },
    { label: 'Total Processed', value: stats.totalProcessed, icon: CheckSquare },
  ];

  return (
    <div>
      <PageHeader
        title={`${profile.position} — ${profile.full_name.split(' ')[0]}`}
        description={`${profile.department} · Approval queue`}
      />

      {rulesLoading ? (
        <ApproverDashboardVisibilitySkeleton />
      ) : showApprovalQueue ? (
      <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 mt-1">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          const lowerLabel = stat.label.toLowerCase();
          const accent = lowerLabel.includes('rejected')
            ? 'red'
            : lowerLabel.includes('approved') || lowerLabel.includes('processed')
            ? 'green'
            : lowerLabel.includes('awaiting') || lowerLabel.includes('pending')
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

      <div className="bg-white rounded-md border border-pq-neutral-200 mb-4">
        <div className="px-5 py-4 border-b border-pq-neutral-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-pq-neutral-900">Pending Approvals</h2>
            <p className="text-xs text-pq-neutral-500 mt-0.5">Documents awaiting your signature</p>
          </div>
          {queue.length > 0 && (
            <Link href="/approvals" className="text-xs text-pq-primary-600 hover:text-pq-neutral-900 font-medium transition">
              View all
            </Link>
          )}
        </div>

        {loading ? (
          <DashboardQueueSkeleton rows={3} />
        ) : queue.length === 0 ? (
          <EmptyState
            title="No pending approvals"
            description="Documents routed to you for approval will appear here."
            icon={CheckSquare}
          />
        ) : (
          <div className="divide-y divide-pq-neutral-200">
            {queue.slice(0, 5).map(row => {
              const active = canActOnStep(profile, row.step_position_required);
              return (
                <div
                  key={row.instance_id}
                  className={`flex items-center gap-4 px-5 py-4 transition-colors ${active ? 'hover:bg-pq-neutral-50' : 'opacity-60'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-pq-neutral-900 font-mono">{row.pr1_number}</span>
                      <span className="text-xs text-pq-neutral-500">·</span>
                      <span className="text-xs text-pq-neutral-500">{row.requisitioner_name_snapshot}</span>
                      <span className="text-xs text-pq-neutral-400">{row.department_name_snapshot}</span>
                    </div>
                    <p className="text-xs text-pq-neutral-500 mt-0.5 truncate">{row.purpose}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <PriorityChip priority={row.priority} />
                      <span className="text-xs text-pq-neutral-400">·</span>
                      <span className="text-xs text-pq-neutral-400">
                        Required by {format(new Date(row.date_required), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    {active ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-pq-neutral-900 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md px-2 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-pq-primary-600 animate-pulse" />
                        Step {row.current_step}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-pq-neutral-400 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md px-2 py-0.5">
                        <Lock className="w-3 h-3" />
                        Step {row.current_step}
                      </span>
                    )}
                    <Link
                      href={`/approvals/${row.instance_id}`}
                      className={`inline-flex items-center gap-1 text-xs font-medium transition ${active ? 'text-pq-primary-600 hover:text-pq-neutral-900' : 'text-pq-neutral-400 hover:text-pq-neutral-500'
                        }`}
                    >
                      {active ? <><ArrowRight className="w-3.5 h-3.5" />Review</> : 'View'}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>
      ) : null}
    </div>
  );
}
