'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import PaginationControls from '@/components/shared/PaginationControls';
import { useAuth } from '@/context/AuthContext';
import { fetchSubstitutesForRequestor } from '@/lib/canvassing';
import type { SubstituteReviewBundle } from '@/types/canvassing';
import { ArrowRight, Replace, CircleCheck as CheckCircle2, Circle as XCircle, Clock } from 'lucide-react';

export default function SubstitutesIndexPage() {
  const { profile } = useAuth();
  const [bundles, setBundles] = useState<SubstituteReviewBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    if (!profile) return;
    fetchSubstitutesForRequestor(profile.id)
      .then(setBundles)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profile]);

  const totalPending = bundles.reduce(
    (sum, b) => sum + b.substitutes.filter(s => s.decision === null).length,
    0
  );

  const totalPages = Math.ceil(bundles.length / pageSize);
  const bundlePage = bundles.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <AppShell title="Substitute Review">
      <PageHeader
        title="Substitute Item Review"
        description="Suppliers sometimes offer alternatives to what you requested. Review and decide before procurement finalises selection."
      />

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading substitutes..." />
        </div>
      ) : bundles.length === 0 ? (
        <div className="bg-white rounded-[4px] border border-[#D8E2FF]">
          <EmptyState
            title="No substitutes to review"
            description="When a supplier proposes an alternative item for one of your PR1s, it will appear here."
            icon={Replace}
          />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard
              label="Pending Decision"
              value={totalPending}
              tone="amber"
              icon={Clock}
            />
            <StatCard
              label="Accepted"
              value={bundles.reduce((s, b) => s + b.substitutes.filter(x => x.decision === 'accepted').length, 0)}
              tone="emerald"
              icon={CheckCircle2}
            />
            <StatCard
              label="Rejected"
              value={bundles.reduce((s, b) => s + b.substitutes.filter(x => x.decision === 'rejected').length, 0)}
              tone="rose"
              icon={XCircle}
            />
          </div>

          <div className="space-y-3">
            {bundlePage.map(bundle => {
              const pending = bundle.substitutes.filter(s => s.decision === null).length;
              const total   = bundle.substitutes.length;

              return (
                <Link
                  key={bundle.pr1.id}
                  href={`/substitutes/${bundle.pr1.id}`}
                  className="block bg-white rounded-[4px] border border-[#D8E2FF] hover:border-[#0F1F3A] transition"
                >
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className={`w-10 h-10 rounded-[4px] flex items-center justify-center shrink-0 ${
                      pending > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                      <Replace className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-sm font-bold text-[#0F1F3A]">{bundle.pr1.pr1_number}</span>
                        {pending > 0 ? (
                          <span className="text-xs font-semibold border rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 border-amber-200">
                            {pending} pending
                          </span>
                        ) : (
                          <span className="text-xs font-semibold border rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 border-emerald-200">
                            All decided
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-[#40527A] truncate">{bundle.pr1.purpose}</p>
                      <p className="text-xs text-[#BFC7D5] mt-0.5">
                        {bundle.pr1.department_name_snapshot} · {total} substitute{total !== 1 ? 's' : ''} offered
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-[#BFC7D5] shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>

          {bundles.length > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={Math.max(1, totalPages)}
              pageSize={pageSize}
              totalCount={bundles.length}
              entityLabel="PR1 bundles"
              loading={loading}
              onPageChange={(page) => {
                if (page < currentPage) setCurrentPage(p => Math.max(1, p - 1));
                else setCurrentPage(p => Math.min(Math.max(1, totalPages), p + 1));
              }}
            />
          )}
        </div>
      )}
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: 'amber' | 'emerald' | 'rose';
  icon: React.ElementType;
}) {
  const colorClass = {
    amber:   'text-amber-600 bg-amber-50',
    emerald: 'text-emerald-600 bg-emerald-50',
    rose:    'text-rose-600 bg-rose-50',
  }[tone];

  return (
    <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-4">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-[4px] mb-3 ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-[#0F1F3A]">{value}</p>
      <p className="text-xs text-[#40527A] mt-0.5">{label}</p>
    </div>
  );
}
