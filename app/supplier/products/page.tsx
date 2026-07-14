'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import StatusChip from '@/components/shared/StatusChip';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import PaginationControls from '@/components/shared/PaginationControls';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { getMySupplierProducts } from '@/lib/supplier-products';
import type { SupplierProduct } from '@/types/database';
import { format } from 'date-fns';
import { Package, ArrowRight, CheckCircle2, Circle } from 'lucide-react';

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
    expired:      { variant: 'cancelled', label: 'Expired' },
  };
  return map[status] ?? { variant: 'draft', label: status };
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'pending_tsqa', label: 'Under Technical Evaluation' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
];

const PAGE_SIZE = 20;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupplierProductsPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [search, setSearch]     = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter]     = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const isRawMatSupplier =
    profile?.role === 'supplier' && profile.supplier_supply_type === 'raw_material';
  const accessDenied =
    !!profile && profile.role === 'supplier' && profile.supplier_supply_type !== 'raw_material';

  useEffect(() => {
    if (accessDenied) {
      router.replace('/dashboard');
    }
  }, [accessDenied, router]);

  useEffect(() => {
    if (!profile || !isRawMatSupplier) return;
    setLoading(true);
    setError('');
    getMySupplierProducts(profile)
      .then(setProducts)
      .catch((err: unknown) => setError((err as Error)?.message || 'Failed to load products.'))
      .finally(() => setLoading(false));
  }, [profile, isRawMatSupplier]);

  // Filter products based on search, status, and type
  const filteredProducts = products.filter((p) => {
    const matchesSearch = !appliedSearch.trim() ||
      p.product_name.toLowerCase().includes(appliedSearch.toLowerCase()) ||
      (p.product_code && p.product_code.toLowerCase().includes(appliedSearch.toLowerCase())) ||
      (p.category && p.category.toLowerCase().includes(appliedSearch.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    const matchesType   = typeFilter === 'all' || (p.item_type ?? 'goods') === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleApply = () => {
    setAppliedSearch(search);
    setCurrentPage(1);
  };

  const handleClear = () => {
    setSearch('');
    setAppliedSearch('');
    setStatusFilter('all');
    setTypeFilter('all');
    setCurrentPage(1);
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [appliedSearch, statusFilter, typeFilter]);

  if (!profile || accessDenied) {
    return (
      <AppShell title="Product Catalog">
        <div className="space-y-6">
          <PageHeader
            title="Product Catalog"
            description="View products Procurement has added to your catalog."
          />
          {accessDenied ? (
            <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-6">
              <h3 className="font-semibold text-red-900 mb-2">Access Denied</h3>
              <p className="text-sm text-pq-danger-600">
                The product catalog is only available to raw-material suppliers. Redirecting…
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48">
              <LoadingState message="Loading…" />
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Product Catalog">
      <PageHeader
        title="Product Catalog"
        description="View-only catalog of products Procurement has added for your account. Contact Procurement to request changes."
      />

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading products…" />
        </div>
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
          {error}
        </div>
      ) : (
        <>
          <FilterBar
            filters={[
              {
                type: 'search',
                id: 'product-search',
                label: 'Search',
                placeholder: 'Search by name, code, or category…',
                value: search,
                onChange: (value) => setSearch(value as string),
              },
              {
                type: 'select',
                id: 'product-type',
                label: 'Type',
                placeholder: 'All types',
                value: typeFilter,
                onChange: (value) => setTypeFilter(value as string),
                options: [
                  { value: 'all',      label: 'All types' },
                  { value: 'goods',    label: 'Goods' },
                  { value: 'services', label: 'Services' },
                ],
              },
              {
                type: 'select',
                id: 'product-status',
                label: 'Status',
                placeholder: 'All statuses',
                value: statusFilter,
                onChange: (value) => setStatusFilter(value as string),
                options: STATUS_OPTIONS,
              },
            ] as FilterConfig[]}
            onApply={handleApply}
            onClear={handleClear}
            loading={loading}
            resultCount={filteredProducts.length}
            resultLabel="product"
            className="mb-5"
          />

          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-md border border-pq-neutral-200">
              <EmptyState
                title={appliedSearch || statusFilter !== 'all' ? 'No products match your filters' : 'No products yet'}
                description={appliedSearch || statusFilter !== 'all'
                  ? 'Try adjusting your search or status filter.'
                  : 'Procurement has not added any products to your catalog yet.'}
                icon={Package}
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50/50">
                        <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Product</th>
                        <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Type</th>
                        <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Status</th>
                        <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Can Offer</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-pq-neutral-200">
                      {paginatedProducts.map(product => (
                        <ProductRow key={product.id} product={product} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={PAGE_SIZE}
                totalCount={filteredProducts.length}
                entityLabel="products"
                loading={loading}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

// ─── Product row ─────────────────────────────────────────────────────────────

function ProductRow({ product }: { product: SupplierProduct }) {
  const chip      = productChip(product.status);
  const canOffer  = product.status === 'verified';
  const isService = (product.item_type ?? 'goods') === 'services';

  const dateNote = product.verified_at
    ? <span className="text-pq-success-600">Verified {format(new Date(product.verified_at), 'MMM d, yyyy')}</span>
    : product.rejected_at
    ? <span className="text-pq-danger-600">Rejected {format(new Date(product.rejected_at), 'MMM d, yyyy')}</span>
    : product.submitted_at
    ? <span className="text-pq-neutral-400">Submitted {format(new Date(product.submitted_at), 'MMM d, yyyy')}</span>
    : null;

  return (
    <tr className="hover:bg-pq-neutral-50 transition">
      <td className="px-5 py-3.5">
        <span className="font-medium text-sm text-pq-neutral-900 block truncate max-w-[200px]">{product.product_name}</span>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {!isService && product.product_code && (
            <span className="text-xs text-pq-neutral-400">#{product.product_code}</span>
          )}
          {product.category && <span className="text-xs text-pq-neutral-400">{product.category}</span>}
          {dateNote && <span className="text-xs">{dateNote}</span>}
        </div>
      </td>
      <td className="px-5 py-3.5">
        <span className={`inline-flex text-xs font-semibold border rounded-full px-2.5 py-0.5 ${
          isService ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'
        }`}>
          {isService ? 'Services' : 'Goods'}
        </span>
      </td>
      <td className="px-5 py-3.5">
        <StatusChip status={chip.variant} label={chip.label} size="sm" />
      </td>
      <td className="px-5 py-3.5">
        {canOffer ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded-full px-2.5 py-1">
            <CheckCircle2 className="w-3 h-3 shrink-0" />
            Can Offer
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-pq-neutral-400 bg-pq-neutral-50 border border-pq-neutral-200 rounded-full px-2.5 py-1">
            <Circle className="w-3 h-3 shrink-0" />
            Not Verified
          </span>
        )}
      </td>
      <td className="px-5 py-3.5 text-right">
        <Link href={`/supplier/products/${product.id}`} className="inline-flex items-center gap-1 text-xs font-semibold text-pq-neutral-500 hover:text-pq-neutral-900 transition">
          View <ArrowRight className="w-3.5 h-3.5 shrink-0" />
        </Link>
      </td>
    </tr>
  );
}
