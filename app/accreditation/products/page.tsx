'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import StatusChip from '@/components/shared/StatusChip';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig, TabFilter } from '@/components/shared/FilterBar.types';
import PaginationControls from '@/components/shared/PaginationControls';
import { Skeleton } from '@/components/ui/skeleton';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { getAllProductsForProcurement } from '@/lib/supplier-products';
import type { ProductQueueRow } from '@/lib/supplier-products';
import { format } from 'date-fns';
import { PackageSearch, ArrowRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    expired:      { variant: 'cancelled', label: 'Expired' },
  };
  return map[status] ?? { variant: 'draft', label: status };
}

// ─── Filter tab definitions ───────────────────────────────────────────────────

type FilterKey = 'verified' | 'inactive' | 'rejected' | 'all';

const PAGE_SIZE = 20;

function getFilteredRows(rows: ProductQueueRow[], filter: FilterKey): ProductQueueRow[] {
  switch (filter) {
    case 'verified':
      return rows.filter(r => r.status === 'verified');
    case 'inactive':
      return rows.filter(r => r.status === 'inactive');
    case 'rejected':
      return rows.filter(r => r.status === 'rejected');
    case 'all':
    default:
      return rows;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductCatalogPage() {
  const [allRows, setAllRows] = useState<ProductQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [activeTab, setActiveTab] = useState<FilterKey>('verified');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    setError('');
    getAllProductsForProcurement()
      .then(setAllRows)
      .catch((err: unknown) =>
        setError((err as Error)?.message || 'Failed to load product catalog.')
      )
      .finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => ({
    verified: allRows.filter(r => r.status === 'verified').length,
    inactive: allRows.filter(r => r.status === 'inactive').length,
    rejected: allRows.filter(r => r.status === 'rejected').length,
    all:      allRows.length,
  }), [allRows]);

  const filteredRows = useMemo(() => {
    let rows = getFilteredRows(allRows, activeTab);
    if (typeFilter !== 'all') {
      rows = rows.filter(r => (r.item_type ?? 'goods') === typeFilter);
    }
    if (appliedSearch.trim()) {
      const searchLower = appliedSearch.toLowerCase();
      rows = rows.filter(r =>
        r.product_name.toLowerCase().includes(searchLower) ||
        (r.supplier_full_name && r.supplier_full_name.toLowerCase().includes(searchLower)) ||
        (r.product_code && r.product_code.toLowerCase().includes(searchLower)) ||
        (r.category && r.category.toLowerCase().includes(searchLower))
      );
    }
    return rows;
  }, [allRows, activeTab, typeFilter, appliedSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginatedRows = filteredRows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const tabs: TabFilter[] = [
    { value: 'verified', label: `Verified (${counts.verified})` },
    { value: 'inactive', label: `Inactive (${counts.inactive})` },
    { value: 'rejected', label: `Rejected (${counts.rejected})` },
    { value: 'all',      label: `All (${counts.all})` },
  ];

  const handleClear = () => {
    setSearch('');
    setAppliedSearch('');
    setTypeFilter('all');
    setActiveTab('verified');
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, typeFilter, appliedSearch]);

  return (
    <AppShell title="Product Catalog">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <PageHeader
          title="Product Catalog"
          description="Verified catalog products for raw-material suppliers. Deactivated products cannot be offered on new quotes."
          className="mb-0"
        />
        <Button
          asChild
          className="shrink-0 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-xs font-medium"
        >
          <Link href="/accreditation/products/new">
            <Plus className="w-4 h-4 mr-2" />
            Add product
          </Link>
        </Button>
      </div>

      {!loading && !error && (
        <FilterBar
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={(value) => setActiveTab(value as FilterKey)}
          filters={[
            {
              type: 'search',
              id: 'product-search',
              label: 'Search',
              placeholder: 'Search by product name, supplier, code, or category...',
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
          ] as FilterConfig[]}
          onApply={() => { setAppliedSearch(search); setCurrentPage(1); }}
          onClear={handleClear}
          loading={loading}
          resultCount={filteredRows.length}
          resultLabel="product"
          className="mb-4"
        />
      )}

      {loading ? (
        <ProductCatalogSkeleton />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
          {error}
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title={
              activeTab === 'verified'
                ? 'No verified products'
                : activeTab === 'inactive'
                  ? 'No inactive products'
                  : activeTab === 'rejected'
                    ? 'No rejected products'
                    : 'No products'
            }
            description={
              activeTab === 'verified'
                ? 'Add a verified catalog product for a raw-material supplier to get started.'
                : 'No products match this filter.'
            }
            icon={PackageSearch}
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
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Supplier</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Category</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Status</th>
                    <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Submitted</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {paginatedRows.map(row => (
                    <ProductCatalogRowItem key={row.id} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            totalCount={filteredRows.length}
            entityLabel="products"
            loading={loading}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </AppShell>
  );
}

function ProductCatalogRowItem({ row }: { row: ProductQueueRow }) {
  const chip = productChip(row.status);

  return (
    <tr className="hover:bg-pq-neutral-50 transition">
      <td className="px-5 py-3.5 font-medium text-pq-neutral-900 max-w-[180px] truncate">{row.product_name}</td>
      <td className="px-5 py-3.5 text-pq-neutral-500 text-xs whitespace-nowrap">{row.supplier_full_name ?? '—'}</td>
      <td className="px-5 py-3.5 text-pq-neutral-400 text-xs">{row.category ?? '—'}</td>
      <td className="px-5 py-3.5">
        <StatusChip status={chip.variant} label={chip.label} size="sm" />
      </td>
      <td className="px-5 py-3.5 text-pq-neutral-400 text-xs whitespace-nowrap">
        {row.submitted_at ? format(new Date(row.submitted_at), 'MMM d, yyyy') : '—'}
      </td>
      <td className="px-5 py-3.5 text-right">
        <Link
          href={`/accreditation/products/${row.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-pq-neutral-500 hover:text-pq-neutral-900 transition"
        >
          View
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </td>
    </tr>
  );
}

function ProductCatalogSkeleton() {
  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden" aria-busy="true" aria-label="Loading product catalog">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50/50">
              {['Product', 'Supplier', 'Category', 'Status', 'Submitted', ''].map((h, i) => (
                <th key={i} className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">
                  {h && <Skeleton className="h-3 w-16" />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-pq-neutral-200">
            {Array.from({ length: 5 }, (_, i) => (
              <tr key={i}>
                <td className="px-5 py-3.5"><Skeleton className="h-4 w-40" /></td>
                <td className="px-5 py-3.5"><Skeleton className="h-3 w-28" /></td>
                <td className="px-5 py-3.5"><Skeleton className="h-3 w-20" /></td>
                <td className="px-5 py-3.5"><Skeleton className="h-5 w-28 rounded-full" /></td>
                <td className="px-5 py-3.5"><Skeleton className="h-3 w-24" /></td>
                <td className="px-5 py-3.5"><Skeleton className="h-4 w-14" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
