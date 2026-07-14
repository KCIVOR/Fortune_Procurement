'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import PageHeader from '@/components/shared/PageHeader';
import PaginationControls from '@/components/shared/PaginationControls';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import SupplierAccountsTable from '@/components/procurement/SupplierAccountsTable';
import CreateSupplierModal from '@/components/procurement/CreateSupplierModal';
import BulkImportSupplierModal from '@/components/procurement/BulkImportSupplierModal';
import { Button } from '@/components/ui/button';
import { listSupplierAccountsWithCount } from '@/lib/procurement-suppliers';
import type { SupplierAccount } from '@/lib/procurement-suppliers';
import { SUPPLY_TYPE_FILTER_OPTIONS } from '@/lib/supplier-supply-type';
import { Plus, Upload } from 'lucide-react';

function canManageSuppliers(role: string | undefined): boolean {
  return role === 'procurement' || role === 'admin';
}

export default function SupplierAccountsPage() {
  const { profile, loading: authLoading } = useAuth();
  const [suppliers, setSuppliers] = useState<SupplierAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedAccreditation, setSelectedAccreditation] = useState<
    'all' | 'approved' | 'pending' | 'none' | 'rejected'
  >('all');
  const [selectedSupplyType, setSelectedSupplyType] = useState<'all' | 'raw_material' | 'normal' | 'service'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    if (!profile) {
      setError('Not authenticated');
      setIsLoading(false);
      return;
    }

    if (!canManageSuppliers(profile.role)) {
      setError('Access denied. Procurement role required.');
      setIsLoading(false);
      return;
    }

    loadData();
  }, [
    authLoading,
    profile,
    currentPage,
    rowsPerPage,
    appliedSearch,
    selectedStatus,
    selectedAccreditation,
    selectedSupplyType,
  ]);

  async function loadData() {
    try {
      setIsLoading(true);
      setError(null);

      const offset = (currentPage - 1) * rowsPerPage;
      const result = await listSupplierAccountsWithCount({
        search: appliedSearch || undefined,
        status: selectedStatus,
        accreditation: selectedAccreditation,
        supply_type: selectedSupplyType,
        limit: rowsPerPage,
        offset,
      });

      setSuppliers(result.suppliers);
      setTotalCount(result.total_count);
    } catch (err) {
      console.error('Error loading supplier accounts:', err);
      setError('Failed to load supplier accounts');
    } finally {
      setIsLoading(false);
    }
  }

  function handleApplyFilters() {
    setAppliedSearch(search);
    setCurrentPage(1);
  }

  function handleClearFilters() {
    setSearch('');
    setAppliedSearch('');
    setSelectedStatus('all');
    setSelectedAccreditation('all');
    setSelectedSupplyType('all');
    setCurrentPage(1);
  }

  function handleNextPage() {
    const totalPages = Math.ceil(totalCount / rowsPerPage);
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  }

  function handlePreviousPage() {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  }

  if (authLoading) {
    return (
      <AppShell title="Supplier Accounts">
        <LoadingState message="Loading..." />
      </AppShell>
    );
  }

  if (error === 'Access denied. Procurement role required.') {
    return (
      <AppShell title="Supplier Accounts">
        <div className="space-y-6">
          <PageHeader
            title="Supplier Accounts"
            description="Manage supplier login accounts for RFQ, accreditation, and purchase order workflows."
          />
          <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Access Denied</h3>
            <p className="text-sm text-pq-danger-600">
              You do not have permission to view supplier accounts. Only procurement staff can access this feature.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error && error !== 'Access denied. Procurement role required.') {
    return (
      <AppShell title="Supplier Accounts">
        <div className="space-y-6">
          <PageHeader
            title="Supplier Accounts"
            description="Manage supplier login accounts for RFQ, accreditation, and purchase order workflows."
          />
          <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Error</h3>
            <p className="text-sm text-pq-danger-600">{error}</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Supplier Accounts">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageHeader
            title="Supplier Accounts"
            description="Manage supplier login accounts for RFQ, accreditation, and purchase order workflows."
          />
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              onClick={() => setIsBulkImportOpen(true)}
              className="text-xs font-medium"
            >
              <Upload className="w-4 h-4 mr-2" />
              Bulk Import
            </Button>
            <Button
              onClick={() => setIsCreateModalOpen(true)}
              className="bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-xs font-medium"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Supplier
            </Button>
          </div>
        </div>

        <FilterBar
          filters={[
            {
              type: 'search',
              id: 'supplier-search',
              label: 'Search',
              placeholder: 'Search by company name or email...',
              value: search,
              onChange: (value) => setSearch(value as string),
            },
            {
              type: 'select',
              id: 'supplier-status',
              label: 'Status',
              placeholder: 'All statuses',
              value: selectedStatus,
              onChange: (value) => setSelectedStatus(value as 'all' | 'active' | 'inactive'),
              options: [
                { value: 'all', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ],
            },
            {
              type: 'select',
              id: 'supplier-accreditation',
              label: 'Accreditation',
              placeholder: 'All accreditation',
              value: selectedAccreditation,
              onChange: (value) =>
                setSelectedAccreditation(
                  value as 'all' | 'approved' | 'pending' | 'none' | 'rejected',
                ),
              options: [
                { value: 'all', label: 'All accreditation' },
                { value: 'approved', label: 'Accredited' },
                { value: 'pending', label: 'Pending review' },
                { value: 'none', label: 'No application' },
                { value: 'rejected', label: 'Rejected / withdrawn' },
              ],
            },
            {
              type: 'select',
              id: 'supplier-supply-type',
              label: 'Supply type',
              placeholder: 'All supply types',
              value: selectedSupplyType,
              onChange: (value) =>
                setSelectedSupplyType(
                  value as 'all' | 'raw_material' | 'normal' | 'service',
                ),
              options: SUPPLY_TYPE_FILTER_OPTIONS,
            },
          ] as FilterConfig[]}
          onApply={handleApplyFilters}
          onClear={handleClearFilters}
          loading={isLoading}
          resultCount={totalCount}
          resultLabel="supplier account"
        />

        <SupplierAccountsTable suppliers={suppliers} isLoading={isLoading} />

        {totalCount > 0 && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={Math.ceil(totalCount / rowsPerPage)}
            pageSize={rowsPerPage}
            totalCount={totalCount}
            entityLabel="supplier accounts"
            loading={isLoading}
            onPageChange={(page) => {
              if (page < currentPage) handlePreviousPage();
              else handleNextPage();
            }}
            className="space-y-4"
          />
        )}

        <CreateSupplierModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSupplierCreated={() => {
            setCurrentPage(1);
            loadData();
          }}
        />

        <BulkImportSupplierModal
          isOpen={isBulkImportOpen}
          onClose={() => setIsBulkImportOpen(false)}
          onImportComplete={() => {
            setCurrentPage(1);
            loadData();
          }}
        />
      </div>
    </AppShell>
  );
}
