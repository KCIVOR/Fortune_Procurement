'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import StatusChip from '@/components/shared/StatusChip';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { getProductReviewQueueForProcurement } from '@/lib/supplier-products';
import type { ProductQueueRow } from '@/lib/supplier-products';
import { format } from 'date-fns';
import { PackageSearch, ArrowRight } from 'lucide-react';

// ─── Status helpers ───────────────────────────────────────────────────────────

function productChip(status: string): { variant: StatusVariant; label: string } {
  const map: Record<string, { variant: StatusVariant; label: string }> = {
    draft:        { variant: 'draft',     label: 'Draft' },
    submitted:    { variant: 'pending',   label: 'Submitted' },
    under_review: { variant: 'in_review', label: 'Under Procurement Review' },
    pending_tsqa: { variant: 'in_review', label: 'Under Technical Evaluation' },
    verified:     { variant: 'validated', label: 'Verified' },
    rejected:     { variant: 'rejected',  label: 'Rejected' },
    inactive:     { variant: 'cancelled', label: 'Inactive' },
    withdrawn:    { variant: 'cancelled', label: 'Withdrawn' },
  };
  return map[status] ?? { variant: 'draft', label: status };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductReviewQueuePage() {
  const [rows, setRows]       = useState<ProductQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    getProductReviewQueueForProcurement()
      .then(setRows)
      .catch((err: unknown) =>
        setError((err as Error)?.message || 'Failed to load product review queue.')
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell title="Product Review">
      <PageHeader
        title="Supplier Product Review"
        description="Review products submitted by suppliers for procurement verification. Verify directly or create an RSE for TSQA evaluation."
      />

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading product queue…" />
        </div>
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title="No products pending review"
            description="Supplier product submissions will appear here when they are ready for Procurement review."
            icon={PackageSearch}
          />
        </div>
      ) : (
        <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
          {/* Column headers */}
          <div className="hidden md:grid grid-cols-[1fr_1fr_140px_120px] gap-4 px-5 py-2.5 bg-pq-neutral-50 border-b border-pq-neutral-200">
            <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Product</p>
            <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Supplier</p>
            <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Status</p>
            <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Submitted</p>
          </div>
          <div className="divide-y divide-pq-neutral-200">
            {rows.map(row => (
              <ProductQueueRowItem key={row.id} row={row} />
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ─── Product queue row ────────────────────────────────────────────────────────

function ProductQueueRowItem({ row }: { row: ProductQueueRow }) {
  const chip = productChip(row.status);

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-pq-neutral-50 transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="font-medium text-sm text-pq-neutral-900 truncate">
            {row.product_name}
          </span>
          <StatusChip status={chip.variant} label={chip.label} size="sm" />
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {row.supplier_full_name && (
            <span className="text-xs text-pq-neutral-400">{row.supplier_full_name}</span>
          )}
          {row.product_code && (
            <span className="text-xs text-pq-neutral-400">#{row.product_code}</span>
          )}
          {row.category && (
            <span className="text-xs text-pq-neutral-400">{row.category}</span>
          )}
          {row.submitted_at && (
            <span className="text-xs text-pq-neutral-400">
              {format(new Date(row.submitted_at), 'MMM d, yyyy')}
            </span>
          )}
        </div>
      </div>

      <Link
        href={`/accreditation/products/${row.id}`}
        className="shrink-0 flex items-center gap-1 text-xs font-semibold text-pq-neutral-500 hover:text-pq-neutral-900 transition"
      >
        Review
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
