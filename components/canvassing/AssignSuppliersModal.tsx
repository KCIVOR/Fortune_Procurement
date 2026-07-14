'use client';

import { useEffect, useState, type ReactNode } from 'react';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import PaginationControls from '@/components/shared/PaginationControls';
import type { CanvassSupplierCandidate } from '@/types/canvassing';
import { supplyTypeLabel } from '@/lib/supplier-supply-type';
import {
  AlertTriangle,
  BadgeCheck,
  Info,
  Loader2,
  Store,
  X,
} from 'lucide-react';

export interface AssignSuppliersModalProps {
  open: boolean;
  working: boolean;
  actionError: string;
  hasRegisteredSuppliers: boolean;
  allAlreadyAssigned: boolean;
  filteredCount: number;
  paginatedSuppliers: CanvassSupplierCandidate[];
  filters: FilterConfig[];
  onApplyFilters: () => void;
  onClearFilters: () => void;
  supplierPage: number;
  supplierTotalPages: number;
  supplierRowsPerPage: number;
  selectedIds: Set<string>;
  onToggleSupplier: (id: string, selected: boolean) => void;
  onPageChange: (page: number) => void;
  onClose: () => void;
  onAssign: () => void;
  /** Add an external vendor (e.g. Shopee) with no supplier account. */
  onAddExternalVendor: (vendorName: string) => void;
}

export default function AssignSuppliersModal({
  open,
  working,
  actionError,
  hasRegisteredSuppliers,
  allAlreadyAssigned,
  filteredCount,
  paginatedSuppliers,
  filters,
  onApplyFilters,
  onClearFilters,
  supplierPage,
  supplierTotalPages,
  supplierRowsPerPage,
  selectedIds,
  onToggleSupplier,
  onPageChange,
  onClose,
  onAssign,
  onAddExternalVendor,
}: AssignSuppliersModalProps) {
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  const [externalName, setExternalName] = useState('');

  useEffect(() => {
    if (!open) {
      setGuidelinesOpen(false);
      setExternalName('');
    }
  }, [open]);

  if (!open) return null;

  const showEmptyRegistry = !hasRegisteredSuppliers;
  const showAllAssigned = hasRegisteredSuppliers && allAlreadyAssigned;
  const showNoFilterMatches =
    hasRegisteredSuppliers && !allAlreadyAssigned && filteredCount === 0;
  const showList = filteredCount > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-suppliers-title"
    >
      <div className="bg-white w-full max-w-5xl max-h-[min(92dvh,920px)] flex flex-col overflow-hidden border-pq-neutral-200 shadow-lg rounded-t-2xl sm:rounded-md sm:border">
        <header className="shrink-0 z-10 bg-white px-4 sm:px-6 py-3 sm:py-4 border-b border-pq-neutral-200 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h2
              id="assign-suppliers-title"
              className="text-base sm:text-lg font-semibold text-pq-neutral-900"
            >
              Canvass Suppliers
            </h2>
            <p className="text-xs text-pq-neutral-500 mt-1">
              Select suppliers to invite. Review accreditation and product readiness before assigning.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="shrink-0 p-2 -mr-1 text-pq-neutral-400 hover:text-pq-neutral-900 hover:bg-pq-neutral-100 rounded-md transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain">
        <div className="border-b border-pq-neutral-200">
            <button
              type="button"
              onClick={() => setGuidelinesOpen(v => !v)}
              className="w-full px-4 sm:px-6 py-2.5 flex items-center justify-between gap-2 text-left text-xs font-medium text-pq-warning-700 bg-pq-warning-100/60 hover:bg-pq-warning-100/80 transition"
              aria-expanded={guidelinesOpen}
            >
              <span className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
                <span className="truncate">Awarding guidelines (informational)</span>
              </span>
              <span className="text-pq-neutral-500 shrink-0 text-[10px] uppercase tracking-wide">
                {guidelinesOpen ? 'Hide' : 'Show'}
              </span>
            </button>
            {guidelinesOpen && (
              <>
                <div className="px-4 sm:px-6 py-2.5 bg-pq-warning-100/80 border-b border-amber-100">
                  <div className="flex gap-2 text-[11px] sm:text-xs text-pq-warning-600">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="space-y-1 min-w-0">
                      <p className="font-semibold">Warnings are informational only.</p>
                      <p>
                        Awarding rules: verified catalog products can be selected directly; for
                        <strong> raw-material lines</strong>, an unverified product or manual entry
                        can still be awarded with a written justification. Suppliers without verified
                        products may always be invited.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="px-4 sm:px-6 py-2 flex gap-2 text-[11px] text-pq-neutral-500 border-b border-pq-neutral-200">
                  <Info className="w-3.5 h-3.5 shrink-0 text-pq-neutral-400 mt-0.5" />
                  <p className="min-w-0">
                    Suppliers without verified products may still be invited, but their quote items cannot be
                    awarded until a verified product is linked on the quotation.
                  </p>
                </div>
              </>
            )}
          </div>

          <FilterBar
            filters={filters}
            onApply={onApplyFilters}
            onClear={onClearFilters}
            resultCount={filteredCount}
            resultLabel="supplier"
            compact
            className="border-0 border-b border-pq-neutral-200 rounded-none shadow-none"
          />

          {showEmptyRegistry && (
            <p className="text-sm text-pq-neutral-400 text-center py-10 px-4 sm:px-6">
              No supplier users are registered in the system.
            </p>
          )}
          {showAllAssigned && (
            <p className="text-sm text-pq-neutral-400 text-center py-10 px-4 sm:px-6">
              All suppliers are already assigned to this RFQ.
            </p>
          )}
          {showNoFilterMatches && (
            <p className="text-sm text-pq-neutral-400 text-center py-10 px-4 sm:px-6">
              No suppliers match your filters. Try adjusting search or accreditation.
            </p>
          )}

          {showList && (
            <>
              <ul className="lg:hidden divide-y divide-pq-neutral-200">
                {paginatedSuppliers.map(c => (
                  <SupplierAssignCard
                    key={c.id}
                    candidate={c}
                    checked={selectedIds.has(c.id)}
                    onToggle={onToggleSupplier}
                  />
                ))}
              </ul>

              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm text-left">
                  <thead className="bg-pq-neutral-50 border-b border-pq-neutral-200">
                    <tr className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide">
                      <th className="w-10 px-3 py-2.5" aria-label="Select" />
                      <th className="px-3 py-2.5 min-w-[8rem]">Supplier</th>
                      <th className="px-3 py-2.5 min-w-[10rem]">Email</th>
                      <th className="px-3 py-2.5 min-w-[6rem]">Supply type</th>
                      <th className="px-3 py-2.5 min-w-[7rem]">Accreditation</th>
                      <th className="px-3 py-2.5 text-center whitespace-nowrap text-blue-600">Goods ✓</th>
                      <th className="px-3 py-2.5 text-center whitespace-nowrap text-purple-600">Services ✓</th>
                      <th className="px-3 py-2.5 text-center whitespace-nowrap">Pending</th>
                      <th className="px-3 py-2.5 text-center whitespace-nowrap hidden xl:table-cell">
                        Rejected
                      </th>
                      <th className="px-3 py-2.5 text-center whitespace-nowrap hidden xl:table-cell">
                        Withdrawn
                      </th>
                      <th className="px-3 py-2.5 min-w-[8rem]">Readiness</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pq-neutral-200">
                    {paginatedSuppliers.map(c => (
                      <SupplierAssignTableRow
                        key={c.id}
                        candidate={c}
                        checked={selectedIds.has(c.id)}
                        onToggle={onToggleSupplier}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {filteredCount > 0 && (
            <PaginationControls
              currentPage={supplierPage}
              totalPages={supplierTotalPages}
              pageSize={supplierRowsPerPage}
              totalCount={filteredCount}
              entityLabel="suppliers"
              onPageChange={onPageChange}
              className="border-0 border-t border-pq-neutral-200 rounded-none shadow-none"
            />
          )}

        <div className="px-4 sm:px-6 py-3 border-t border-pq-neutral-200 bg-pq-neutral-50/60">
          <div className="flex items-center gap-2 mb-1.5">
            <Store className="w-4 h-4 text-pq-neutral-500 shrink-0" />
            <p className="text-xs font-semibold text-pq-neutral-700">Add external vendor</p>
          </div>
          <p className="text-[11px] text-pq-neutral-500 mb-2">
            For off-system sellers (e.g. Shopee, Lazada, a walk-in store). No account needed —
            Procurement enters the quote on their behalf.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={externalName}
              onChange={e => setExternalName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && externalName.trim() && !working) {
                  onAddExternalVendor(externalName.trim());
                }
              }}
              disabled={working}
              placeholder="Vendor name (e.g. Shopee — ABC Store)"
              className="flex-1 h-9 rounded-md border border-pq-neutral-200 bg-white px-3 text-sm text-pq-neutral-900 placeholder:text-pq-neutral-400 focus:outline-none focus:ring-2 focus:ring-pq-primary-600/30"
            />
            <button
              type="button"
              onClick={() => externalName.trim() && onAddExternalVendor(externalName.trim())}
              disabled={working || !externalName.trim()}
              className="shrink-0 px-4 h-9 text-sm font-semibold rounded-md border border-pq-neutral-200 bg-white text-pq-neutral-700 hover:bg-pq-neutral-100 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {working && <Loader2 className="w-4 h-4 animate-spin" />}
              Add vendor
            </button>
          </div>
        </div>

        {actionError && (
          <p className="text-sm text-pq-danger-600 px-4 sm:px-6 py-2 border-t border-pq-neutral-200">
            {actionError}
          </p>
        )}
        </div>

        <footer className="shrink-0 z-10 bg-white px-4 sm:px-6 py-3 sm:py-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pb-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 border-t border-pq-neutral-200">
          <button
            type="button"
            onClick={onClose}
            disabled={working}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm text-pq-neutral-500 hover:text-pq-neutral-900 border border-pq-neutral-200 sm:border-0 rounded-md transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onAssign}
            disabled={working || selectedIds.size === 0}
            className="w-full sm:w-auto px-5 py-2.5 sm:py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {working && <Loader2 className="w-4 h-4 animate-spin" />}
            Assign {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </button>
        </footer>
      </div>
    </div>
  );
}

function SupplierAssignCard({
  candidate: c,
  checked,
  onToggle,
}: {
  candidate: CanvassSupplierCandidate;
  checked: boolean;
  onToggle: (id: string, selected: boolean) => void;
}) {
  const acc = accreditationLabelForCandidate(c);
  const readiness = readinessForCandidate(c);

  return (
    <li>
      <label
        className={`flex gap-3 p-4 cursor-pointer transition ${
          checked ? 'bg-pq-primary-50/50' : 'hover:bg-pq-neutral-50/80'
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onToggle(c.id, e.target.checked)}
          className="w-4 h-4 mt-1 shrink-0 rounded border-pq-neutral-200 text-pq-primary-600"
          aria-label={`Select ${c.full_name}`}
        />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <p className="font-medium text-pq-neutral-900 text-sm break-words">{c.full_name}</p>
            {c.email?.trim() ? (
              <p className="text-xs text-pq-neutral-500 break-all mt-0.5">{c.email}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-1">
            <span className="inline-flex items-center text-[10px] font-medium border rounded px-1.5 py-0.5 text-pq-neutral-700 bg-white border-pq-neutral-200">
              {supplyTypeLabel(c.supplier_supply_type)}
            </span>
            <span
              className={`inline-flex items-center gap-0.5 text-[10px] font-medium border rounded px-1.5 py-0.5 ${acc.className}`}
            >
              {acc.icon}
              {acc.label}
            </span>
            {productInventoryBadges(c)}
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-pq-neutral-600">
            <div>
              <dt className="text-pq-neutral-400">Verified Goods</dt>
              <dd className="font-medium tabular-nums text-blue-700">{c.verified_goods_count}</dd>
            </div>
            <div>
              <dt className="text-pq-neutral-400">Verified Services</dt>
              <dd className="font-medium tabular-nums text-purple-700">{c.verified_service_count}</dd>
            </div>
            <div>
              <dt className="text-pq-neutral-400">Pending</dt>
              <dd className="font-medium tabular-nums">{c.pending_product_count}</dd>
            </div>
            <div>
              <dt className="text-pq-neutral-400">Rejected</dt>
              <dd className="font-medium tabular-nums">{c.rejected_product_count}</dd>
            </div>
          </dl>
          <div className="text-xs space-y-0.5">
            {readiness.lines.map((line, i) => (
              <p
                key={i}
                className={
                  readiness.level === 'ok'
                    ? 'text-pq-success-600 font-medium'
                    : 'text-pq-warning-600'
                }
              >
                {line}
              </p>
            ))}
          </div>
        </div>
      </label>
    </li>
  );
}

function SupplierAssignTableRow({
  candidate: c,
  checked,
  onToggle,
}: {
  candidate: CanvassSupplierCandidate;
  checked: boolean;
  onToggle: (id: string, selected: boolean) => void;
}) {
  const acc = accreditationLabelForCandidate(c);
  const readiness = readinessForCandidate(c);

  return (
    <tr className={`hover:bg-pq-neutral-50/80 ${checked ? 'bg-pq-primary-50/50' : ''}`}>
      <td className="px-3 py-2.5 align-top">
        <input
          type="checkbox"
          checked={checked}
          aria-label={`Select ${c.full_name}`}
          onChange={e => onToggle(c.id, e.target.checked)}
          className="w-4 h-4 rounded border-pq-neutral-200 text-pq-primary-600 mt-1"
        />
      </td>
      <td className="px-3 py-2.5 align-top font-medium text-pq-neutral-900">
        <span className="break-words">{c.full_name}</span>
      </td>
      <td className="px-3 py-2.5 align-top text-xs text-pq-neutral-500 hidden lg:table-cell">
        <span className="break-all">{c.email?.trim() ? c.email : '—'}</span>
      </td>
      <td className="px-3 py-2.5 align-top text-xs text-pq-neutral-700 whitespace-nowrap">
        {supplyTypeLabel(c.supplier_supply_type)}
      </td>
      <td className="px-3 py-2.5 align-top">
        <div className="flex flex-wrap gap-1">
          <span
            className={`inline-flex items-center gap-0.5 text-[10px] font-medium border rounded px-1.5 py-0.5 ${acc.className}`}
          >
            {acc.icon}
            {acc.label}
          </span>
          {productInventoryBadges(c)}
        </div>
      </td>
      <td className="px-3 py-2.5 align-top text-center tabular-nums text-blue-700">{c.verified_goods_count}</td>
      <td className="px-3 py-2.5 align-top text-center tabular-nums text-purple-700">{c.verified_service_count}</td>
      <td className="px-3 py-2.5 align-top text-center tabular-nums hidden lg:table-cell">
        {c.pending_product_count}
      </td>
      <td className="px-3 py-2.5 align-top text-center tabular-nums hidden xl:table-cell">
        {c.rejected_product_count}
      </td>
      <td className="px-3 py-2.5 align-top text-center tabular-nums hidden xl:table-cell">
        {c.withdrawn_product_count}
      </td>
      <td className="px-3 py-2.5 align-top text-xs">
        <div className="space-y-1">
          {readiness.lines.map((line, i) => (
            <p
              key={i}
              className={
                readiness.level === 'ok'
                  ? 'text-pq-success-600 font-medium'
                  : 'text-pq-warning-600'
              }
            >
              {line}
            </p>
          ))}
        </div>
      </td>
    </tr>
  );
}

function accreditationLabelForCandidate(c: CanvassSupplierCandidate): {
  label: string;
  className: string;
  icon: ReactNode;
} {
  const st = c.accreditation_status;
  if (!st) {
    return {
      label: 'No Accreditation',
      className: 'text-pq-neutral-500 bg-pq-neutral-50 border-pq-neutral-200',
      icon: null,
    };
  }
  switch (st) {
    case 'approved':
      return {
        label: 'Accredited',
        className: 'text-pq-success-600 bg-pq-success-100 border-pq-success-100',
        icon: <BadgeCheck className="w-3 h-3 shrink-0" aria-hidden />,
      };
    case 'submitted':
    case 'under_review':
    case 'draft':
      return {
        label: 'Pending Accreditation',
        className: 'text-pq-warning-600 bg-pq-warning-100 border-pq-warning-100',
        icon: null,
      };
    case 'missing_documents':
      return {
        label: 'Missing Documents',
        className: 'text-pq-warning-600 bg-pq-warning-100 border-pq-warning-100',
        icon: null,
      };
    case 'rejected':
      return {
        label: 'Rejected',
        className: 'text-pq-danger-600 bg-pq-danger-100 border-pq-danger-100',
        icon: null,
      };
    case 'withdrawn':
      return {
        label: 'Withdrawn',
        className: 'text-pq-neutral-500 bg-pq-neutral-100 border-pq-neutral-200',
        icon: null,
      };
    default:
      return {
        label: st.replace(/_/g, ' '),
        className: 'text-pq-neutral-500 bg-pq-neutral-50 border-pq-neutral-200',
        icon: null,
      };
  }
}

function productInventoryBadges(c: CanvassSupplierCandidate) {
  const chip =
    'inline-flex items-center text-[10px] font-medium border rounded px-1.5 py-0.5';
  const nodes: ReactNode[] = [];
  if (c.verified_goods_count > 0) {
    nodes.push(
      <span key="vg" className={`${chip} text-blue-700 bg-white border-blue-200`}>
        {c.verified_goods_count} Verified {c.verified_goods_count === 1 ? 'Good' : 'Goods'}
      </span>,
    );
  }
  if (c.verified_service_count > 0) {
    nodes.push(
      <span key="vs" className={`${chip} text-purple-700 bg-white border-purple-200`}>
        {c.verified_service_count} Verified {c.verified_service_count === 1 ? 'Service' : 'Services'}
      </span>,
    );
  }
  if (c.verified_product_count === 0) {
    nodes.push(
      <span key="no-verified" className={`${chip} text-pq-neutral-500 bg-white border-pq-neutral-200`}>
        No Verified Products
      </span>,
    );
  }
  if (c.pending_product_count > 0) {
    nodes.push(
      <span key="pending-val" className={`${chip} text-pq-warning-600 bg-white border-pq-warning-100`}>
        Pending Validation
      </span>,
    );
  }
  return nodes;
}

function readinessForCandidate(c: CanvassSupplierCandidate): {
  level: 'ok' | 'warn';
  lines: string[];
} {
  const approved = c.accreditation_status === 'approved';
  if (approved && c.verified_product_count > 0) {
    return { level: 'ok', lines: ['Ready'] };
  }
  const lines: string[] = [];
  if (!c.accreditation_status) {
    lines.push('Not accredited');
  } else if (!approved) {
    if (c.accreditation_status === 'rejected') lines.push('Accreditation rejected');
    else if (c.accreditation_status === 'withdrawn') lines.push('Accreditation withdrawn');
    else lines.push('Not accredited');
  }
  if (c.verified_product_count === 0) {
    lines.push('No verified products');
  }
  if (c.pending_product_count > 0) {
    lines.push('Pending validation');
  }
  if (lines.length === 0) {
    lines.push('Review accreditation and catalog');
  }
  return { level: 'warn', lines };
}
