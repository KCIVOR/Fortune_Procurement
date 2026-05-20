'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import PaginationControls from '@/components/shared/PaginationControls';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
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
  const [search, setSearch]               = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'pending' | 'decided'>('all');

  useEffect(() => {
    if (!profile) return;
    fetchSubstitutesForRequestor(profile.id)
      .then(setBundles)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profile]);

  // Global stat counts — always from full unfiltered bundles
  const totalPending = bundles.reduce(
    (sum, b) => sum + b.substitutes.filter(s => s.decision === null).length,
    0
  );

  // Client-side filtering
  const filteredBundles = bundles.filter(b => {
    if (selectedStatus === 'pending' && !b.substitutes.some(s => s.decision === null)) return false;
    if (selectedStatus === 'decided' && !b.substitutes.every(s => s.decision !== null)) return false;
    const term = appliedSearch.trim().toLowerCase();
    if (term) {
      const matchesPr1 =
        b.pr1.pr1_number.toLowerCase().includes(term) ||
        b.pr1.purpose.toLowerCase().includes(term);
      const matchesSupplier = b.substitutes.some(s =>
        s.supplier_name.toLowerCase().includes(term)
      );
      if (!matchesPr1 && !matchesSupplier) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredBundles.length / pageSize);
  const bundlePage = filteredBundles.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // Filter configuration for FilterBar
  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'sub-search',
      label: 'Search',
      placeholder: 'PR1 number, purpose, or supplier...',
      value: search,
      onChange: (value) => setSearch(value as string),
    },
    {
      type: 'select',
      id: 'sub-status',
      label: 'Status',
      placeholder: 'All statuses',
      value: selectedStatus,
      onChange: (value) => {
        setSelectedStatus(value as 'all' | 'pending' | 'decided');
        setCurrentPage(1);
      },
      options: [
        { value: 'all', label: 'All statuses' },
        { value: 'pending', label: 'Pending decision' },
        { value: 'decided', label: 'All decided' },
      ],
    },
  ];

  const handleApply = () => {
    setAppliedSearch(search);
    setCurrentPage(1);
  };

  const handleClear = () => {
    setSearch('');
    setAppliedSearch('');
    setSelectedStatus('all');
    setCurrentPage(1);
  };

  return (
    <AppShell title="Substitute Review">
      <PageHeader
        title="Substitute Item Review"
        description="Suppliers sometimes offer alternatives to what you requested. Review and decide before procurement finalises selection."
      />

      {/* Filter bar */}
      <FilterBar
        filters={filters}
        onApply={handleApply}
        onClear={handleClear}
        loading={loading}
        resultCount={filteredBundles.length}
        resultLabel="bundle"
        className="mb-4"
      />

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading substitutes..." />
        </div>
      ) : filteredBundles.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title="No substitutes to review"
            description={
              appliedSearch.trim() || selectedStatus !== 'all'
                ? 'No bundles match your filters. Try adjusting search or status.'
                : 'When a supplier proposes an alternative item for one of your PR1s, it will appear here.'
            }
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
                  className="block bg-white rounded-md border border-pq-neutral-200 hover:border-pq-primary-600 transition"
                >
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className={`w-10 h-10 rounded-md flex items-center justify-center shrink-0 ${
                      pending > 0 ? 'bg-pq-warning-100 text-pq-warning-600' : 'bg-pq-success-100 text-pq-success-600'
                    }`}>
                      <Replace className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-mono text-sm font-bold text-pq-neutral-900">{bundle.pr1.pr1_number}</span>
                        {pending > 0 ? (
                          <span className="text-xs font-semibold border rounded-full px-2 py-0.5 bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100">
                            {pending} pending
                          </span>
                        ) : (
                          <span className="text-xs font-semibold border rounded-full px-2 py-0.5 bg-pq-success-100 text-pq-success-600 border-pq-success-100">
                            All decided
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-pq-neutral-500 truncate">{bundle.pr1.purpose}</p>
                      <p className="text-xs text-pq-neutral-400 mt-0.5">
                        {bundle.pr1.department_name_snapshot} · {total} substitute{total !== 1 ? 's' : ''} offered
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-pq-neutral-400 shrink-0" />
                  </div>
                </Link>
              );
            })}
          </div>

          {filteredBundles.length > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={Math.max(1, totalPages)}
              pageSize={pageSize}
              totalCount={filteredBundles.length}
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
    amber:   'text-pq-warning-600 bg-pq-warning-100',
    emerald: 'text-pq-success-600 bg-pq-success-100',
    rose:    'text-rose-600 bg-rose-50',
  }[tone];

  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 p-4">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-md mb-3 ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-pq-neutral-900">{value}</p>
      <p className="text-xs text-pq-neutral-500 mt-0.5">{label}</p>
    </div>
  );
}
