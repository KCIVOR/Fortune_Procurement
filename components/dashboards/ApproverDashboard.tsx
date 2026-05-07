'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { UserProfile } from '@/types/auth';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4 mt-1">
        {statCards.map((stat) => {
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

      <div className="bg-white rounded-[4px] border border-[#D8E2FF] mb-4">
        <div className="px-5 py-4 border-b border-[#D8E2FF] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#0F1F3A]">Pending Approvals</h2>
            <p className="text-xs text-[#40527A] mt-0.5">Documents awaiting your signature</p>
          </div>
          {queue.length > 0 && (
            <Link href="/approvals" className="text-xs text-[#1E4BFF] hover:text-[#0F1F3A] font-medium transition">
              View all
            </Link>
          )}
        </div>

        {loading ? (
          <div className="py-10 flex justify-center">
            <LoadingState message="Loading..." />
          </div>
        ) : queue.length === 0 ? (
          <EmptyState
            title="No pending approvals"
            description="Documents routed to you for approval will appear here."
            icon={CheckSquare}
          />
        ) : (
          <div className="divide-y divide-[#D8E2FF]">
            {queue.slice(0, 5).map(row => {
              const active = canActOnStep(profile, row.step_position_required);
              return (
                <div
                  key={row.instance_id}
                  className={`flex items-center gap-4 px-5 py-4 transition-colors ${active ? 'hover:bg-[#F7F9FC]' : 'opacity-60'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[#0F1F3A] font-mono">{row.pr1_number}</span>
                      <span className="text-xs text-[#40527A]">·</span>
                      <span className="text-xs text-[#40527A]">{row.requisitioner_name_snapshot}</span>
                      <span className="text-xs text-[#BFC7D5]">{row.department_name_snapshot}</span>
                    </div>
                    <p className="text-xs text-[#40527A] mt-0.5 truncate">{row.purpose}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <PriorityChip priority={row.priority} />
                      <span className="text-xs text-[#BFC7D5]">·</span>
                      <span className="text-xs text-[#BFC7D5]">
                        Required by {format(new Date(row.date_required), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    {active ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#0F1F3A] bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] px-2 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#1E4BFF] animate-pulse" />
                        Step {row.current_step}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-[#BFC7D5] bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] px-2 py-0.5">
                        <Lock className="w-3 h-3" />
                        Step {row.current_step}
                      </span>
                    )}
                    <Link
                      href={`/approvals/${row.instance_id}`}
                      className={`inline-flex items-center gap-1 text-xs font-medium transition ${active ? 'text-[#1E4BFF] hover:text-[#0F1F3A]' : 'text-[#BFC7D5] hover:text-[#40527A]'
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
    </div>
  );
}
