'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import { fetchPR2s } from '@/lib/pr2';
import type { PR2Request } from '@/types/pr2';
import { PR2_STATUS_LABELS } from '@/types/pr2';
import { format } from 'date-fns';
import { ClipboardList, ArrowRight, Building2, CalendarDays } from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  draft:                   'bg-[#F7F9FC] text-[#40527A] border-[#D8E2FF]',
  pending_phase1_approval: 'bg-amber-50 text-amber-700 border-amber-200',
  phase1_approved:         'bg-blue-50 text-blue-700 border-blue-200',
  pending_phase2_approval: 'bg-orange-50 text-orange-700 border-orange-200',
  phase2_approved:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled:               'bg-red-50 text-red-600 border-red-200',
};

export default function PR2ListPage() {
  const [pr2s, setPR2s] = useState<PR2Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPR2s()
      .then(setPR2s)
      .catch(() => setError('Failed to load purchase requests.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="Purchase Requests">
      <PageHeader
        title="Purchase Requests (PR2)"
        description="Procurement purchase requests generated from completed canvassing."
      />

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading purchase requests..." />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">{error}</div>
      ) : pr2s.length === 0 ? (
        <div className="bg-white rounded-[4px] border border-[#D8E2FF]">
          <EmptyState
            title="No purchase requests yet"
            description="Generate a PR2 from a completed canvassing RFQ."
            icon={ClipboardList}
          />
        </div>
      ) : (
        <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D8E2FF] flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#0F1F3A]">
              {pr2s.length} purchase request{pr2s.length !== 1 ? 's' : ''}
            </h2>
          </div>
          <div className="divide-y divide-[#D8E2FF]">
            {pr2s.map(pr2 => (
              <Link
                key={pr2.id}
                href={`/pr2/${pr2.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-[#F7F9FC] transition group"
              >
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-8 h-8 rounded-[4px] bg-[#F7F9FC] flex items-center justify-center shrink-0 mt-0.5">
                    <ClipboardList className="w-4 h-4 text-[#40527A]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-mono text-sm font-semibold text-[#0F1F3A]">
                        {pr2.pr2_number}
                      </span>
                      <span className={`inline-flex text-xs font-semibold border rounded-full px-2 py-0.5 ${STATUS_STYLES[pr2.status] ?? STATUS_STYLES.draft}`}>
                        {PR2_STATUS_LABELS[pr2.status]}
                      </span>
                    </div>
                    <p className="text-sm text-[#40527A] truncate">{pr2.purpose}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="inline-flex items-center gap-1 text-xs text-[#BFC7D5]">
                        <Building2 className="w-3 h-3" />
                        {pr2.department_name_snapshot}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-[#BFC7D5]">
                        <CalendarDays className="w-3 h-3" />
                        {format(new Date(pr2.date_required), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#BFC7D5] group-hover:text-[#40527A] shrink-0 transition" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}
