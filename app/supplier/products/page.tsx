'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import StatusChip from '@/components/shared/StatusChip';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { getMySupplierProducts } from '@/lib/supplier-products';
import type { SupplierProduct } from '@/types/database';
import { format } from 'date-fns';
import { Package, Plus, ArrowRight, CheckCircle2, Circle } from 'lucide-react';

// ─── Status helpers ───────────────────────────────────────────────────────────

function productChip(status: string): { variant: StatusVariant; label: string } {
  const map: Record<string, { variant: StatusVariant; label: string }> = {
    draft:        { variant: 'draft',     label: 'Draft' },
    submitted:    { variant: 'pending',   label: 'Submitted' },
    under_review: { variant: 'in_review', label: 'Under Review' },
    pending_tsqa: { variant: 'in_review', label: 'Under Technical Evaluation' },
    verified:     { variant: 'validated', label: 'Verified' },
    rejected:     { variant: 'rejected',  label: 'Rejected' },
    inactive:     { variant: 'cancelled', label: 'Inactive' },
    withdrawn:    { variant: 'cancelled', label: 'Withdrawn' },
  };
  return map[status] ?? { variant: 'draft', label: status };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupplierProductsPage() {
  const { profile } = useAuth();
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    setError('');
    getMySupplierProducts(profile)
      .then(setProducts)
      .catch((err: unknown) => setError((err as Error)?.message || 'Failed to load products.'))
      .finally(() => setLoading(false));
  }, [profile]);

  return (
    <AppShell title="Product Catalog">
      <PageHeader
        title="Product Catalog"
        description="Manage the products you offer. Submit products for Procurement verification before they can be offered in procurement."
        action={
          <Link
            href="/supplier/products/new"
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </Link>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading products…" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">
          {error}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-[4px] border border-[#D8E2FF]">
          <EmptyState
            title="No products yet"
            description="Add products for validation before offering them in procurement."
            icon={Package}
            action={
              <Link
                href="/supplier/products/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition"
              >
                <Plus className="w-4 h-4" />
                Add Your First Product
              </Link>
            }
          />
        </div>
      ) : (
        <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
          {/* Column headers — desktop only; grid must match ProductRow */}
          <div className="hidden md:grid md:grid-cols-[minmax(0,1fr)_140px_132px_5rem] md:items-center gap-4 px-5 py-2.5 bg-[#F7F9FC] border-b border-[#D8E2FF]">
            <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Product</p>
            <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Status</p>
            <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Can Offer</p>
            <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide text-right">View</p>
          </div>
          <div className="divide-y divide-[#D8E2FF]">
            {products.map(product => (
              <ProductRow key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ─── Product row ─────────────────────────────────────────────────────────────

function ProductRow({ product }: { product: SupplierProduct }) {
  const chip      = productChip(product.status);
  const canOffer  = product.status === 'verified';

  return (
    <div className="grid grid-cols-1 gap-3 px-5 py-4 hover:bg-[#F7F9FC] transition md:grid-cols-[minmax(0,1fr)_140px_132px_5rem] md:gap-4 md:items-center">
      {/* Product — name + meta only (status lives in its own column on md+) */}
      <div className="min-w-0">
        <div className="mb-0.5 min-w-0">
          <span className="font-medium text-sm text-[#0F1F3A] truncate block">
            {product.product_name}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {product.product_code && (
            <span className="text-xs text-[#BFC7D5]">#{product.product_code}</span>
          )}
          {product.category && (
            <span className="text-xs text-[#BFC7D5]">{product.category}</span>
          )}
          {product.submitted_at && !product.verified_at && !product.rejected_at && (
            <span className="text-xs text-[#BFC7D5]">
              Submitted {format(new Date(product.submitted_at), 'MMM d, yyyy')}
            </span>
          )}
          {product.verified_at && (
            <span className="text-xs text-emerald-600">
              Verified {format(new Date(product.verified_at), 'MMM d, yyyy')}
            </span>
          )}
          {product.rejected_at && (
            <span className="text-xs text-red-500">
              Rejected {format(new Date(product.rejected_at), 'MMM d, yyyy')}
            </span>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center">
        <StatusChip status={chip.variant} label={chip.label} size="sm" />
      </div>

      {/* Can Offer */}
      <div className="flex items-center">
        {canOffer ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            Can Offer
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#BFC7D5] bg-[#F7F9FC] border border-[#D8E2FF] rounded-full px-2.5 py-1">
            <Circle className="w-3 h-3 shrink-0" />
            Not Verified
          </span>
        )}
      </div>

      {/* View */}
      <div className="flex items-center md:justify-end">
        <Link
          href={`/supplier/products/${product.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#40527A] hover:text-[#0F1F3A] transition whitespace-nowrap"
        >
          View
          <ArrowRight className="w-3.5 h-3.5 shrink-0" />
        </Link>
      </div>
    </div>
  );
}
