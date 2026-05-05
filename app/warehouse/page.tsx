'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { fetchWarehouseQueue } from '@/lib/warehouse';
import type { PR1QueueRow } from '@/types/warehouse';
import { PackageSearch, ClipboardCheck, Clock, CircleCheck as CheckCircle2, Circle as XCircle, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

export default function WarehouseQueuePage() {
  const [queue, setQueue] = useState<PR1QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWarehouseQueue()
      .then(setQueue)
      .catch(() => setError('Failed to load queue.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="Warehouse Queue">
      <PageHeader
        title="Warehouse Validation Queue"
        description="Review incoming purchase requests and validate stock availability."
      />

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading queue..." />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">{error}</div>
      ) : queue.length === 0 ? (
        <div className="bg-white rounded-[4px] border border-[#D8E2FF]">
          <EmptyState
            title="No items pending validation"
            description="PR1s submitted by employees will appear here once routed to the warehouse."
            icon={PackageSearch}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Stats row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
            <StatCard
              label="Pending Review"
              value={queue.filter(r => !r.validation_decision).length}
              color="amber"
              icon={Clock}
            />
            <StatCard
              label="Marked Sufficient"
              value={queue.filter(r => r.validation_decision === 'sufficient').length}
              color="emerald"
              icon={CheckCircle2}
            />
            <StatCard
              label="Insufficient — Pending Approval"
              value={queue.filter(r => r.validation_decision === 'insufficient').length}
              color="blue"
              icon={ArrowRight}
            />
          </div>

          {/* Queue table */}
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#D8E2FF] bg-[#F7F9FC]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">PR1 No.</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Requestor</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Department</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Purpose</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Priority</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Date Required</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Submitted</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Validation</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E2FF]">
                {queue.map((row) => (
                  <tr key={row.id} className="hover:bg-[#F7F9FC] transition-colors">
                    <td className="px-5 py-3.5 font-mono font-semibold text-[#0F1F3A]">{row.pr1_number}</td>
                    <td className="px-5 py-3.5 text-[#0F1F3A]">{row.requisitioner_name_snapshot}</td>
                    <td className="px-5 py-3.5 text-[#40527A]">{row.department_name_snapshot}</td>
                    <td className="px-5 py-3.5 text-[#40527A] max-w-[180px] truncate">{row.purpose || '—'}</td>
                    <td className="px-5 py-3.5">
                      <PriorityBadge priority={row.priority} />
                    </td>
                    <td className="px-5 py-3.5 text-[#40527A]">
                      {row.date_required ? format(new Date(row.date_required), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-[#40527A] text-xs">
                      {row.submitted_at ? format(new Date(row.submitted_at), 'MMM d, yyyy') : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <ValidationBadge decision={row.validation_decision} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/warehouse/${row.id}`}
                        className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-xs font-medium transition"
                      >
                        <ClipboardCheck className="w-3.5 h-3.5" />
                        {row.validation_decision ? 'Review' : 'Validate'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: 'amber' | 'emerald' | 'blue';
  icon: React.ElementType;
}) {
  const colors = {
    amber:   'bg-amber-50 border-amber-200 text-amber-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    blue:    'bg-blue-50 border-blue-200 text-blue-700',
  };
  const iconColors = {
    amber:   'text-amber-500',
    emerald: 'text-emerald-500',
    blue:    'text-blue-500',
  };

  return (
    <div className={`rounded-[4px] border px-5 py-4 flex items-center gap-4 ${colors[color]}`}>
      <Icon className={`w-5 h-5 shrink-0 ${iconColors[color]}`} />
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs font-medium opacity-80">{label}</p>
      </div>
    </div>
  );
}

function ValidationBadge({ decision }: { decision: string | null }) {
  if (!decision) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Pending
      </span>
    );
  }
  if (decision === 'sufficient') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
        <CheckCircle2 className="w-3 h-3" />
        Sufficient
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1">
      <XCircle className="w-3 h-3" />
      Insufficient
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority || priority === 'normal') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
        Normal
      </span>
    );
  }
  if (priority === 'medium') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        Medium
      </span>
    );
  }
  if (priority === 'high') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
        High
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
      Normal
    </span>
  );
}
