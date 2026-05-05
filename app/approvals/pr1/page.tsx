'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { useAuth } from '@/context/AuthContext';
import { fetchApprovalQueue, canActOnStep } from '@/lib/approvals';
import type { PR1ApprovalQueueRow } from '@/types/approvals';
import {
  SquareCheck as CheckSquare,
  ClipboardList,
  Clock,
  Lock,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { format } from 'date-fns';
import { getPriorityColors } from '@/lib/utils';

export default function PR1ApprovalsPage() {
  const { profile } = useAuth();
  const [pr1Queue, setPR1Queue] = useState<PR1ApprovalQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchApprovalQueue()
      .then(setPR1Queue)
      .catch(() => setError('Failed to load PR1 approval queue.'))
      .finally(() => setLoading(false));
  }, []);

  const canActPR1 = (row: PR1ApprovalQueueRow) =>
    profile ? canActOnStep(profile, row.step_position_required) : false;

  const actionablePR1 = pr1Queue.filter(canActPR1);
  const totalReadonly = pr1Queue.length - actionablePR1.length;

  return (
    <AppShell title="PR1 Requests">
      <PageHeader
        title="PR1 Requests"
        description="Purchase requests pending your review and approval."
      />

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading queue..." />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">{error}</div>
      ) : pr1Queue.length === 0 ? (
        <div className="bg-white rounded-[4px] border border-[#D8E2FF]">
          <EmptyState
            title="No pending PR1 approvals"
            description="Purchase requests routed for approval will appear here."
            icon={CheckSquare}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="Total Pending" value={pr1Queue.length} color="slate" icon={ClipboardList} />
            <StatCard label="Awaiting My Action" value={actionablePR1.length} color="amber" icon={Clock} />
            <StatCard label="Pending Other Steps" value={totalReadonly} color="slate" icon={Lock} />
          </div>

          {/* Actionable */}
          {actionablePR1.length > 0 && (
            <Section title="Awaiting My Action" accent="amber">
              <PR1QueueTable rows={actionablePR1} canAct={() => true} />
            </Section>
          )}

          {/* Read-only */}
          {totalReadonly > 0 && (
            <Section
              title="Pending Other Steps"
              accent="slate"
              subtitle="These are awaiting a different signatory before you can act."
            >
              <PR1QueueTable rows={pr1Queue.filter(r => !canActPR1(r))} canAct={() => false} />
            </Section>
          )}
        </div>
      )}
    </AppShell>
  );
}

// ─── PR1 queue table ──────────────────────────────────────────────────────────

function PR1QueueTable({
  rows,
  canAct,
}: {
  rows: PR1ApprovalQueueRow[];
  canAct: (row: PR1ApprovalQueueRow) => boolean;
}) {
  return (
    <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden mb-3">
      <div className="px-5 py-2.5 border-b border-[#D8E2FF] bg-[#F7F9FC] flex items-center gap-2">
        <FileText className="w-3.5 h-3.5 text-[#BFC7D5]" />
        <span className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">PR1 — Purchase Requests</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#D8E2FF] bg-[#F7F9FC]/50">
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">PR1 No.</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Requestor</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Department</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Purpose</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Date Required</th>
              <th className="text-center px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide w-24">Priority</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Current Step</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#D8E2FF]">
            {rows.map((row) => {
              const active = canAct(row);
              return (
                <tr key={row.instance_id} className={`transition-colors ${active ? 'hover:bg-[#F7F9FC]' : 'opacity-60'}`}>
                  <td className="px-5 py-3.5 font-mono font-semibold text-[#0F1F3A]">{row.pr1_number}</td>
                  <td className="px-5 py-3.5 text-[#0F1F3A]">{row.requisitioner_name_snapshot}</td>
                  <td className="px-5 py-3.5 text-[#40527A]">{row.department_name_snapshot}</td>
                  <td className="px-5 py-3.5 text-[#40527A] max-w-[180px] truncate">{row.purpose}</td>
                  <td className="px-5 py-3.5 text-[#40527A] text-xs">{format(new Date(row.date_required), 'MMM d, yyyy')}</td>
                  <td className="px-5 py-3.5 text-center">
                    <PriorityBadge priority={row.priority} />
                  </td>
                  <td className="px-5 py-3.5">
                    <StepBadge label={`Step ${row.current_step}: ${row.step_position_required}`} active={active} />
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {active ? (
                      <Link href={`/approvals/${row.instance_id}`} className="inline-flex items-center gap-1.5 text-[#1E4BFF] hover:text-[#0F1F3A] text-xs font-semibold transition">
                        <ArrowRight className="w-3.5 h-3.5" /> Review
                      </Link>
                    ) : (
                      <Link href={`/approvals/${row.instance_id}`} className="inline-flex items-center gap-1.5 text-[#BFC7D5] hover:text-[#40527A] text-xs font-medium transition">
                        View
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Section({
  title, subtitle, accent, children,
}: {
  title: string; subtitle?: string; accent: 'amber' | 'slate'; children: React.ReactNode;
}) {
  const bar = accent === 'amber' ? 'bg-[#1E4BFF]' : 'bg-[#D8E2FF]';
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-1 h-5 rounded-full ${bar}`} />
        <div>
          <h2 className="text-sm font-semibold text-[#0F1F3A]">{title}</h2>
          {subtitle && <p className="text-xs text-[#40527A]">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function PriorityBadge({ priority }: { priority?: string }) {
  const colors = getPriorityColors(priority);
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
      {colors.label}
    </span>
  );
}

function StepBadge({ label, active }: { label: string; active: boolean }) {
  if (active) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0F1F3A] bg-[#F7F9FC] border border-[#D8E2FF] rounded-full px-2.5 py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[#1E4BFF] animate-pulse" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#40527A] bg-[#F7F9FC] border border-[#D8E2FF] rounded-full px-2.5 py-1">
      <Lock className="w-3 h-3" />
      {label}
    </span>
  );
}

function StatCard({
  label, value, color, icon: Icon,
}: {
  label: string; value: number; color: 'amber' | 'slate'; icon: React.ElementType;
}) {
  const styles = { amber: 'bg-[#F7F9FC] border-[#D8E2FF] text-[#0F1F3A]', slate: 'bg-white border-[#D8E2FF] text-[#0F1F3A]' };
  const iconStyles = { amber: 'text-[#40527A]', slate: 'text-[#BFC7D5]' };
  return (
    <div className={`rounded-[4px] border px-5 py-4 flex items-center gap-4 ${styles[color]}`}>
      <Icon className={`w-5 h-5 shrink-0 ${iconStyles[color]}`} />
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs font-medium opacity-80">{label}</p>
      </div>
    </div>
  );
}
