'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { StatCard } from '@/components/shared/StatCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { UserProfile } from '@/types/auth';
import type { PR2Request } from '@/types/pr2';
import { PR2_STATUS_LABELS } from '@/types/pr2';
import type { StatusVariant } from '@/components/shared/StatusChip';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import StatusChip from '@/components/shared/StatusChip';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import { fetchMyRawMaterialPR2s } from '@/lib/pr2-planning';
import { KPI_GRID_CLASS } from '@/components/shared/kpi-grid';
import PriorityChip from '@/components/shared/PriorityChip';
import {
  ClipboardList,
  Clock,
  CircleCheck as CheckCircle2,
  Circle as XCircle,
  Plus,
  Eye,
} from 'lucide-react';

const STATUS_MAP: Record<string, StatusVariant> = {
  draft:              'draft',
  pending_approval:   'in_review',
  approved:           'approved',
  revision_requested: 'in_review',
  rejected:           'rejected',
  cancelled:          'cancelled',
};

interface Props { profile: UserProfile; }

export default function PlanningDashboard({ profile }: Props) {
  const [requests, setRequests] = useState<PR2Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyRawMaterialPR2s(profile.id, { requestType: 'all' })
      .then((result) => setRequests(result.requests))
      .catch(() => { })
      .finally(() => setLoading(false));
  }, [profile.id]);

  const totalRequests   = requests.length;
  const pendingApproval = requests.filter(r => r.status === 'pending_approval').length;
  const approved        = requests.filter(r => r.status === 'approved').length;
  const rejected        = requests.filter(r => r.status === 'rejected').length;

  const stats = [
    { label: 'Total Requests',   value: totalRequests.toString(),   icon: ClipboardList },
    { label: 'Pending Approval', value: pendingApproval.toString(), icon: Clock },
    { label: 'Approved',         value: approved.toString(),        icon: CheckCircle2 },
    { label: 'Rejected',         value: rejected.toString(),        icon: XCircle },
  ];

  const recentRequests = requests.slice(0, 5);

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${profile.full_name.split(' ')[0]}`}
        description="Track and manage your Raw Material and Services requisitions from here."
        action={
          <Link
            href="/planning/pr2/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition"
          >
            <Plus className="w-4 h-4" />
            New Request
          </Link>
        }
      />

      <div className={`${KPI_GRID_CLASS} mb-4 mt-1`}>
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
            description="Create your first Raw Material or Services request to get started."
            icon={ClipboardList}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                  <TableHead className="px-5 py-3 text-xs font-semibold text-pq-neutral-500">PR2 No.</TableHead>
                  <TableHead className="px-5 py-3 text-xs font-semibold text-pq-neutral-500">Purpose</TableHead>
                  <TableHead className="px-5 py-3 text-xs font-semibold text-pq-neutral-500">Type</TableHead>
                  <TableHead className="px-5 py-3 text-xs font-semibold text-pq-neutral-500">Priority</TableHead>
                  <TableHead className="px-5 py-3 text-xs font-semibold text-pq-neutral-500">Status</TableHead>
                  <TableHead className="px-5 py-3 text-right" />
                </TableRow>
              </TableHeader>
              <TableBody className="bg-pq-white">
                {recentRequests.map((r) => (
                  <TableRow key={r.id} className="hover:bg-pq-neutral-50 border-b border-pq-neutral-200 transition">
                    <TableCell className="px-5 py-3.5 font-mono font-medium text-pq-neutral-900">{r.pr2_number}</TableCell>
                    <TableCell className="px-5 py-3.5 text-pq-neutral-500 max-w-xs truncate">{r.purpose || '—'}</TableCell>
                    <TableCell className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        r.request_type === 'raw_material'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}>
                        {r.request_type === 'raw_material' ? 'Raw Material' : 'Services'}
                      </span>
                    </TableCell>
                    <TableCell className="px-5 py-3.5">
                      <PriorityChip priority={r.priority ?? 'normal'} />
                    </TableCell>
                    <TableCell className="px-5 py-3.5">
                      <StatusChip
                        status={STATUS_MAP[r.status] ?? 'draft'}
                        label={PR2_STATUS_LABELS[r.status]}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell className="px-5 py-3.5 text-right">
                      <Link
                        href={`/planning/pr2/${r.id}`}
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
