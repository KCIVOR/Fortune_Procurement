'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { ClipboardList, PackageSearch } from 'lucide-react';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TSQADashboardPage() {
  const { profile } = useAuth();
  const router      = useRouter();

  useEffect(() => {
    if (profile && profile.role !== 'tsqa' && profile.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [profile, router]);

  return (
    <AppShell title="TSQA Dashboard">
      <PageHeader
        title="TSQA Dashboard"
        description="Technical and Scientific Quality Assurance — goods receipt QA queue."
        action={
          <Link
            href="/tsqa/grn"
            className="flex items-center gap-1.5 px-4 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition"
          >
            <ClipboardList className="w-4 h-4" />
            View GRN QA Queue
          </Link>
        }
      />

      <div className="bg-white rounded-md border border-pq-neutral-200 p-10 text-center">
        <PackageSearch className="w-6 h-6 text-pq-neutral-400 mx-auto mb-2" />
        <p className="text-sm text-pq-neutral-500">
          Goods receipts pending QA review appear in the GRN QA Queue.
        </p>
        <Link
          href="/tsqa/grn"
          className="inline-block mt-3 text-xs text-pq-primary-600 hover:text-pq-neutral-900 font-medium transition"
        >
          Go to GRN QA Queue →
        </Link>
      </div>
    </AppShell>
  );
}
