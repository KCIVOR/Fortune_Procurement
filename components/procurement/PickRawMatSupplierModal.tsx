'use client';

import { useEffect, useMemo, useState } from 'react';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import PaginationControls from '@/components/shared/PaginationControls';
import type { SupplierAccount, SupplierAccreditationStatus } from '@/lib/procurement-suppliers';
import { Check, X } from 'lucide-react';

const PAGE_SIZE = 8;

const ACCRED_LABELS: Record<SupplierAccreditationStatus, string> = {
  none: 'None',
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  missing_documents: 'Missing docs',
  approved: 'Accredited',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

function accreditationClass(status: SupplierAccreditationStatus): string {
  switch (status) {
    case 'approved':
      return 'bg-pq-success-100 text-pq-success-600';
    case 'submitted':
    case 'under_review':
    case 'missing_documents':
      return 'bg-pq-warning-100 text-pq-warning-700';
    case 'rejected':
    case 'withdrawn':
      return 'bg-pq-danger-100 text-pq-danger-600';
    default:
      return 'bg-pq-neutral-100 text-pq-neutral-500';
  }
}

export interface PickRawMatSupplierModalProps {
  open: boolean;
  suppliers: SupplierAccount[];
  selectedId: string;
  onClose: () => void;
  onConfirm: (supplierId: string) => void;
}

export default function PickRawMatSupplierModal({
  open,
  suppliers,
  selectedId,
  onClose,
  onConfirm,
}: PickRawMatSupplierModalProps) {
  const [draftId, setDraftId] = useState(selectedId);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [appliedStatus, setAppliedStatus] = useState('all');
  const [accredFilter, setAccredFilter] = useState('all');
  const [appliedAccred, setAppliedAccred] = useState('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!open) return;
    setDraftId(selectedId);
    setSearch('');
    setAppliedSearch('');
    setStatusFilter('all');
    setAppliedStatus('all');
    setAccredFilter('all');
    setAppliedAccred('all');
    setPage(1);
  }, [open, selectedId]);

  const filtered = useMemo(() => {
    const q = appliedSearch.trim().toLowerCase();
    return suppliers.filter(s => {
      const matchesSearch =
        !q ||
        s.full_name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q);
      const matchesStatus =
        appliedStatus === 'all' ||
        (appliedStatus === 'active' && s.active) ||
        (appliedStatus === 'inactive' && !s.active);
      const matchesAccred =
        appliedAccred === 'all' ||
        (appliedAccred === 'approved' && s.accreditation_status === 'approved') ||
        (appliedAccred === 'pending' &&
          ['submitted', 'under_review', 'missing_documents'].includes(s.accreditation_status)) ||
        (appliedAccred === 'none' &&
          (s.accreditation_status === 'none' || s.accreditation_status === 'draft')) ||
        (appliedAccred === 'rejected' &&
          (s.accreditation_status === 'rejected' || s.accreditation_status === 'withdrawn'));
      return matchesSearch && matchesStatus && matchesAccred;
    });
  }, [suppliers, appliedSearch, appliedStatus, appliedAccred]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'search',
      label: 'Search',
      placeholder: 'Search name or email…',
      value: search,
      onChange: v => setSearch(String(v)),
    },
    {
      type: 'select',
      id: 'status',
      label: 'Account',
      value: statusFilter,
      onChange: v => setStatusFilter(String(v)),
      options: [
        { value: 'all', label: 'All accounts' },
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
    {
      type: 'select',
      id: 'accreditation',
      label: 'Accreditation',
      value: accredFilter,
      onChange: v => setAccredFilter(String(v)),
      options: [
        { value: 'all', label: 'All accreditation' },
        { value: 'approved', label: 'Accredited' },
        { value: 'pending', label: 'Pending' },
        { value: 'none', label: 'None / draft' },
        { value: 'rejected', label: 'Rejected / withdrawn' },
      ],
    },
  ];

  function handleApply() {
    setAppliedSearch(search);
    setAppliedStatus(statusFilter);
    setAppliedAccred(accredFilter);
    setPage(1);
  }

  function handleClear() {
    setSearch('');
    setAppliedSearch('');
    setStatusFilter('all');
    setAppliedStatus('all');
    setAccredFilter('all');
    setAppliedAccred('all');
    setPage(1);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pick-raw-mat-supplier-title"
    >
      <div className="bg-white w-full max-w-5xl max-h-[min(92dvh,920px)] flex flex-col overflow-hidden border-pq-neutral-200 shadow-lg rounded-t-2xl sm:rounded-md sm:border">
        <header className="shrink-0 z-10 bg-white px-4 sm:px-6 py-3 sm:py-4 border-b border-pq-neutral-200 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2
              id="pick-raw-mat-supplier-title"
              className="text-base sm:text-lg font-semibold text-pq-neutral-900"
            >
              Select raw mat supplier
            </h2>
            <p className="text-xs text-pq-neutral-500 mt-1">
              Choose the raw mat supplier this verified catalog product will belong to.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-2 -mr-1 text-pq-neutral-400 hover:text-pq-neutral-900 hover:bg-pq-neutral-100 rounded-md transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
          <FilterBar
            filters={filters}
            onApply={handleApply}
            onClear={handleClear}
            resultCount={filtered.length}
            resultLabel="supplier"
            compact
            className="border-0 border-b border-pq-neutral-200 rounded-none shadow-none"
          />

          {suppliers.length === 0 ? (
            <p className="text-sm text-pq-neutral-400 text-center py-10 px-4 sm:px-6">
              No raw-material suppliers found. Set a supplier&apos;s supply type to Raw mat first.
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-pq-neutral-400 text-center py-10 px-4 sm:px-6">
              No suppliers match your filters. Try adjusting search or accreditation.
            </p>
          ) : (
            <>
              <ul className="lg:hidden divide-y divide-pq-neutral-200">
                {pageRows.map(s => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setDraftId(s.id)}
                      className={`w-full text-left px-4 py-3 transition ${
                        draftId === s.id ? 'bg-pq-primary-50' : 'hover:bg-pq-neutral-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                            draftId === s.id
                              ? 'border-pq-primary-600 bg-pq-primary-600 text-white'
                              : 'border-pq-neutral-300'
                          }`}
                        >
                          {draftId === s.id && <Check className="w-3 h-3" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-pq-neutral-900 truncate">
                            {s.full_name}
                          </p>
                          <p className="text-xs text-pq-neutral-500 font-mono truncate">{s.email}</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${accreditationClass(s.accreditation_status)}`}
                            >
                              {ACCRED_LABELS[s.accreditation_status]}
                            </span>
                            <span className="text-[10px] text-pq-neutral-500">
                              {s.product_count} product{s.product_count === 1 ? '' : 's'}
                            </span>
                            <span
                              className={`text-[10px] font-medium ${
                                s.active ? 'text-pq-success-600' : 'text-pq-neutral-400'
                              }`}
                            >
                              {s.active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm text-left">
                  <thead className="bg-pq-neutral-50 border-b border-pq-neutral-200">
                    <tr className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide">
                      <th className="w-10 px-3 py-2.5" aria-label="Select" />
                      <th className="px-3 py-2.5">Supplier</th>
                      <th className="px-3 py-2.5">Email</th>
                      <th className="px-3 py-2.5">Accreditation</th>
                      <th className="px-3 py-2.5 text-center">Products</th>
                      <th className="px-3 py-2.5">Account</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pq-neutral-200">
                    {pageRows.map(s => {
                      const selected = draftId === s.id;
                      return (
                        <tr
                          key={s.id}
                          className={`cursor-pointer transition ${
                            selected ? 'bg-pq-primary-50' : 'hover:bg-pq-neutral-50'
                          }`}
                          onClick={() => setDraftId(s.id)}
                        >
                          <td className="px-3 py-2.5">
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                                selected
                                  ? 'border-pq-primary-600 bg-pq-primary-600 text-white'
                                  : 'border-pq-neutral-300'
                              }`}
                            >
                              {selected && <Check className="w-3 h-3" />}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-pq-neutral-900">
                            {s.full_name}
                          </td>
                          <td className="px-3 py-2.5 text-xs font-mono text-pq-neutral-500">
                            {s.email}
                          </td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded text-[10px] font-medium ${accreditationClass(s.accreditation_status)}`}
                            >
                              {ACCRED_LABELS[s.accreditation_status]}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center text-pq-neutral-700">
                            {s.product_count}
                          </td>
                          <td className="px-3 py-2.5">
                            {s.active ? (
                              <span className="text-xs font-medium text-pq-success-600">Active</span>
                            ) : (
                              <span className="text-xs font-medium text-pq-neutral-400">Inactive</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <PaginationControls
                currentPage={safePage}
                totalPages={totalPages}
                pageSize={PAGE_SIZE}
                totalCount={filtered.length}
                entityLabel="suppliers"
                onPageChange={setPage}
                className="border-0 border-t border-pq-neutral-200 rounded-none shadow-none"
              />
            </>
          )}
        </div>

        <footer className="shrink-0 z-10 bg-white px-4 sm:px-6 py-3 sm:py-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 border-t border-pq-neutral-200">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm text-pq-neutral-500 hover:text-pq-neutral-900 border border-pq-neutral-200 sm:border-0 rounded-md transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => draftId && onConfirm(draftId)}
            disabled={!draftId}
            className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
          >
            Select supplier
          </button>
        </footer>
      </div>
    </div>
  );
}
