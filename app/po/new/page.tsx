'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import PaginationControls from '@/components/shared/PaginationControls';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import { StatCard } from '@/components/shared/StatCard';
import { useAuth } from '@/context/AuthContext';
import {
  fetchPOGenerationCandidates,
  fetchSuggestedPOSequence,
  fetchSupplierPaymentTermsBySupplierId,
  generatePOFromPR2,
} from '@/lib/po';
import type { POFormValues, POGenerationCandidate } from '@/types/po';
import { WAREHOUSE_OPTIONS, PO_OTHER_OPTION } from '@/types/po';
import PaymentTermsSelect from '@/components/shared/PaymentTermsSelect';
import {
  ChevronLeft, Building2, Package,
  RefreshCw, ShoppingCart, TriangleAlert as AlertTriangle,
  CircleCheck as CheckCircle2, DollarSign, Clock, FileText, Plus,
} from 'lucide-react';

export default function PONewPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPR2 = searchParams.get('pr2');
  const preselectedSupplier = searchParams.get('supplier');

  const currentYear = new Date().getFullYear();
  const poPrefix = `PO-${currentYear}-`;

  const [candidates, setCandidates] = useState<POGenerationCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<POGenerationCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [poNumberError, setPONumberError] = useState('');
  const [suggestedSequence, setSuggestedSequence] = useState<string | null>(null);

  // Filter states
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const [form, setForm] = useState<POFormValues>({
    po_number:        poPrefix,
    po_date:          new Date().toISOString().slice(0, 10),
    delivery_address: '',
    warehouse:        '',
    payment_terms:    '',
    packing:          '',
    remarks:          '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [warehouseSel, setWarehouseSel] = useState('');
  const [warehouseCustom, setWarehouseCustom] = useState('');
  const [paymentTermsPrefilled, setPaymentTermsPrefilled] = useState(false);

  const setPONumber = useCallback((val: string) => {
    let suffix = val;
    if (val.startsWith(poPrefix)) {
      suffix = val.slice(poPrefix.length);
    } else if (val.includes('-') && /^[A-Z]+/.test(val)) {
      const parts = val.split('-');
      suffix = parts[parts.length - 1];
    }
    suffix = suffix.replace(/\D/g, '');
    const finalValue = poPrefix + suffix;
    setForm(f => ({ ...f, po_number: finalValue }));
    setPONumberError('');
  }, [poPrefix]);

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchPOGenerationCandidates();
      setCandidates(rows);

      if (preselectedPR2 && preselectedSupplier) {
        const m = rows.find(
          c => c.pr2_id === preselectedPR2 && c.supplier_id === preselectedSupplier
        );
        if (m?.has_po && m.existing_po_id) {
          router.replace(`/po/${m.existing_po_id}`);
          return;
        }
        if (m && !m.has_po) setSelectedCandidate(m);
      } else if (preselectedPR2) {
        const pending = rows.find(c => c.pr2_id === preselectedPR2 && !c.has_po);
        if (pending) setSelectedCandidate(pending);
      }
    } catch {
      setError('Failed to load approved PR2s.');
    } finally {
      setLoading(false);
    }
  }, [preselectedPR2, preselectedSupplier, router]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  useEffect(() => {
    const yearMatch = poPrefix.match(/^PO-(\d{4})-/i);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : currentYear;
    let cancelled = false;

    fetchSuggestedPOSequence(year)
      .then((suffix) => {
        if (cancelled) return;
        setSuggestedSequence(suffix);
        setForm((f) => {
          const currentSuffix = f.po_number.slice(poPrefix.length).trim();
          if (currentSuffix) return f;
          return { ...f, po_number: `${poPrefix}${suffix}` };
        });
      })
      .catch(() => {
        if (!cancelled) setSuggestedSequence(null);
      });

    return () => {
      cancelled = true;
    };
  }, [poPrefix, currentYear]);

  useEffect(() => {
    const candidate = selectedCandidate;
    if (!candidate || candidate.has_po) return;

    let cancelled = false;
    setForm((prev) => ({ ...prev, payment_terms: '' }));
    setPaymentTermsPrefilled(false);

    (async () => {
      try {
        const terms = await fetchSupplierPaymentTermsBySupplierId(candidate.supplier_id);
        if (cancelled || !terms) return;
        setForm((prev) => ({ ...prev, payment_terms: terms }));
        setPaymentTermsPrefilled(true);
      } catch {
        /* leave payment_terms empty for manual entry */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCandidate?.candidateKey]);

  // Computed stats
  const stats = useMemo(() => {
    const pending = candidates.filter(c => !c.has_po).length;
    const created = candidates.filter(c => c.has_po).length;
    return { pending, created, total: candidates.length };
  }, [candidates]);

  // Filtered candidates based on search and status
  const filteredCandidates = useMemo(() => {
    let result = candidates;

    // Filter by status
    if (selectedStatus === 'pending') {
      result = result.filter(c => !c.has_po);
    } else if (selectedStatus === 'created') {
      result = result.filter(c => c.has_po);
    }

    // Filter by search
    if (appliedSearch.trim()) {
      const searchLower = appliedSearch.toLowerCase();
      result = result.filter(c =>
        c.pr2_number.toLowerCase().includes(searchLower) ||
        c.supplier_name_snapshot.toLowerCase().includes(searchLower) ||
        c.department_name_snapshot.toLowerCase().includes(searchLower) ||
        c.purpose.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [candidates, selectedStatus, appliedSearch]);

  // Pagination
  const totalPages = Math.ceil(filteredCandidates.length / rowsPerPage);
  const paginatedCandidates = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredCandidates.slice(start, start + rowsPerPage);
  }, [filteredCandidates, currentPage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !selectedCandidate || selectedCandidate.has_po) return;

    const poSuffix = form.po_number.slice(poPrefix.length).trim();
    if (!poSuffix) { setPONumberError('PO number suffix is required.'); return; }
    if (!form.po_date)                 { setError('PO date is required.'); return; }
    if (!form.warehouse.trim())        { setError('Warehouse is required.'); return; }
    if (!form.payment_terms.trim())    { setError('Payment terms are required.'); return; }
    if (!form.delivery_address.trim()) { setError('Delivery address is required.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const poId = await generatePOFromPR2(
        selectedCandidate.pr2_id,
        selectedCandidate.supplier_id,
        form,
        profile
      );
      router.push(`/po/${poId}`);
    } catch (e: unknown) {
      setError((e as Error)?.message ?? 'Failed to generate PO.');
      setSubmitting(false);
    }
  };

  // Filter configuration
  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'candidate-search',
      label: 'Search',
      placeholder: 'PR2 number, supplier, department...',
      value: search,
      onChange: (value) => setSearch(value as string),
    },
    {
      type: 'select',
      id: 'candidate-status',
      label: 'Status',
      placeholder: 'All',
      value: selectedStatus,
      onChange: (value) => {
        setSelectedStatus(value as string);
        setCurrentPage(1);
      },
      options: [
        { value: 'all', label: 'All Candidates' },
        { value: 'pending', label: 'Pending (No PO)' },
        { value: 'created', label: 'Already Created' },
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

  const handleSelectCandidate = (candidate: POGenerationCandidate) => {
    if (candidate.has_po) return;
    setSelectedCandidate(candidate);
    // Scroll to form section
    setTimeout(() => {
      document.getElementById('po-form-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <AppShell title="Generate Purchase Order">
      <div className="mb-4">
        <Link href="/po" className="inline-flex items-center gap-1 text-xs text-pq-neutral-500 hover:text-pq-neutral-900 transition">
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to Purchase Orders
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-pq-neutral-900">Generate Purchase Order</h1>
          <p className="text-sm text-pq-neutral-500 mt-0.5">
            Select an approved PR2 and supplier group, then fill in PO details.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Pending"
          value={stats.pending}
          accent="amber"
          icon={<Clock className="w-5 h-5" />}
        />
        <StatCard
          label="Already Created"
          value={stats.created}
          accent="green"
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
        <StatCard
          label="Total Candidates"
          value={stats.total}
          accent="blue"
          icon={<ShoppingCart className="w-5 h-5" />}
        />
      </div>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onApply={handleApply}
        onClear={handleClear}
        loading={loading}
        resultCount={filteredCandidates.length}
        resultLabel="candidate"
        className="mb-6"
      />

      {loading ? (
        <TableSkeleton rows={5} cols={5} />
      ) : filteredCandidates.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title="No PO candidates found"
            description={
              appliedSearch || selectedStatus !== 'all'
                ? 'Try adjusting your filters.'
                : 'You need phase 2–approved PR2s with line-level supplier awards to generate POs.'
            }
            icon={ShoppingCart}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Candidates Table */}
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="px-6 py-3 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-pq-neutral-400" />
              <span className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                Step 1 — Select Approved PR2 &amp; Supplier
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pq-neutral-200 bg-pq-neutral-25">
                    <th className="px-6 py-3 text-left text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">PR2 #</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Supplier</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Department</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Amount</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {paginatedCandidates.map(c => (
                    <tr
                      key={c.candidateKey}
                      className={`transition ${
                        c.has_po
                          ? 'bg-pq-neutral-50 opacity-70'
                          : selectedCandidate?.candidateKey === c.candidateKey
                            ? 'bg-pq-primary-50'
                            : 'hover:bg-pq-neutral-50'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-mono font-bold text-pq-neutral-900">{c.pr2_number}</span>
                          <span className="text-xs text-pq-neutral-500 truncate max-w-[200px]">{c.purpose}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Package className="w-3.5 h-3.5 text-pq-neutral-400 shrink-0" />
                          <span className="text-pq-neutral-900">{c.supplier_name_snapshot}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-pq-neutral-400 shrink-0" />
                          <span className="text-pq-neutral-700">{c.department_name_snapshot}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="font-bold text-pq-neutral-900">
                            ₱{c.grand_total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                          </span>
                          <span className="text-xs text-pq-neutral-400">{c.item_count} item{c.item_count !== 1 ? 's' : ''}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {c.has_po ? (
                          <Link
                            href={`/po/${c.existing_po_id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-pq-primary-600 hover:text-pq-neutral-900 bg-pq-neutral-100 hover:bg-pq-neutral-200 rounded-md transition"
                          >
                            <FileText className="w-3 h-3" />
                            View PO
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSelectCandidate(c)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                              selectedCandidate?.candidateKey === c.candidateKey
                                ? 'bg-pq-primary-600 text-white'
                                : 'bg-pq-primary-600 hover:bg-pq-neutral-900 text-white'
                            }`}
                          >
                            <Plus className="w-3 h-3" />
                            {selectedCandidate?.candidateKey === c.candidateKey ? 'Selected' : 'Select'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {filteredCandidates.length > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={rowsPerPage}
              totalCount={filteredCandidates.length}
              entityLabel="candidates"
              loading={loading}
              onPageChange={setCurrentPage}
              className="rounded-md border border-pq-neutral-200"
            />
          )}
        </div>
      )}

      {/* Step 2 — PO Details Form */}
      {selectedCandidate && !selectedCandidate.has_po && (
        <form id="po-form-section" onSubmit={handleSubmit} className="mt-6 space-y-6">
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-pq-neutral-200 bg-pq-neutral-50">
              <h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                Step 2 — PO Details, Warehouse &amp; Terms
              </h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">

              <div className="md:col-span-1">
                <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                  PO Number <span className="text-pq-danger-600">*</span>
                </label>
                <div className={`flex items-center border rounded-md overflow-hidden transition ${
                  poNumberError ? 'border-red-300 bg-pq-danger-100' : 'border-pq-neutral-200'
                } focus-within:ring-2 focus-within:ring-[#1E4BFF] focus-within:border-transparent`}>
                  <div className="px-3 py-2.5 bg-pq-neutral-50 border-r border-pq-neutral-200 text-sm font-mono text-pq-neutral-400 whitespace-nowrap pointer-events-none select-none">
                    {poPrefix}
                  </div>
                  <input
                    type="text"
                    value={form.po_number.startsWith(poPrefix) ? form.po_number.slice(poPrefix.length) : form.po_number}
                    onChange={e => setPONumber(poPrefix + e.target.value)}
                    placeholder={suggestedSequence ?? '0001'}
                    className="flex-1 px-3 py-2.5 border-0 text-sm font-mono focus:outline-none bg-inherit"
                  />
                </div>
                {poNumberError && (
                  <p className="mt-1 text-xs text-pq-danger-600">{poNumberError}</p>
                )}
                <p className="text-xs text-pq-neutral-400 mt-1">
                  {suggestedSequence
                    ? `Suggested: ${poPrefix}${suggestedSequence} — you may edit this number. Must be unique across all purchase orders.`
                    : 'Enter a 4-digit sequence (e.g. 0001) or use the suggested value when it loads. Must be unique across all purchase orders.'}
                </p>
              </div>

              <div className="md:col-span-1">
                <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                  PO Date <span className="text-pq-danger-600">*</span>
                </label>
                <input
                  type="date"
                  value={form.po_date}
                  onChange={e => setForm(f => ({ ...f, po_date: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition bg-white"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                  Warehouse <span className="text-pq-danger-600">*</span>
                </label>
                <select
                  value={warehouseSel}
                  onChange={e => {
                    const sel = e.target.value;
                    setWarehouseSel(sel);
                    setForm(f => ({
                      ...f,
                      warehouse: sel === PO_OTHER_OPTION ? warehouseCustom.trim() : sel,
                    }));
                  }}
                  required={warehouseSel !== PO_OTHER_OPTION}
                  className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition bg-white"
                >
                  <option value="">Select warehouse...</option>
                  {WAREHOUSE_OPTIONS.map(w => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
                {warehouseSel === PO_OTHER_OPTION && (
                  <input
                    type="text"
                    value={warehouseCustom}
                    onChange={e => {
                      const custom = e.target.value;
                      setWarehouseCustom(custom);
                      setForm(f => ({ ...f, warehouse: custom.trim() }));
                    }}
                    placeholder="Enter warehouse name..."
                    required
                    className="mt-2 w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition"
                  />
                )}
              </div>

              <div className="md:col-span-1">
                <label
                  htmlFor="payment_terms"
                  className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5"
                >
                  Payment Terms <span className="text-pq-danger-600">*</span>
                </label>
                <PaymentTermsSelect
                  id="payment_terms"
                  value={form.payment_terms}
                  onChange={(value) => {
                    setPaymentTermsPrefilled(false);
                    setForm((f) => ({ ...f, payment_terms: value }));
                  }}
                />
                {paymentTermsPrefilled && form.payment_terms.trim() && (
                  <p className="text-xs text-pq-primary-600 mt-1.5">
                    Prefilled from supplier profile — you may override for this PO.
                  </p>
                )}
                {!paymentTermsPrefilled && !form.payment_terms.trim() && selectedCandidate && (
                  <p className="text-xs text-pq-neutral-400 mt-1.5">
                    No default on supplier profile. Select terms or choose Other.
                  </p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                  Delivery Address <span className="text-pq-danger-600">*</span>
                </label>
                <textarea
                  rows={2}
                  value={form.delivery_address}
                  onChange={e => setForm(f => ({ ...f, delivery_address: e.target.value }))}
                  placeholder="Full delivery address..."
                  required
                  className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition resize-none"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                  Packing Instructions
                </label>
                <input
                  type="text"
                  value={form.packing}
                  onChange={e => setForm(f => ({ ...f, packing: e.target.value }))}
                  placeholder="e.g. Standard carton, palletized..."
                  className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                  Remarks
                </label>
                <input
                  type="text"
                  value={form.remarks}
                  onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                  placeholder="Optional notes..."
                  className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:border-transparent transition"
                />
              </div>
            </div>
          </div>

          {/* PO Summary */}
          <div className="bg-pq-neutral-50 rounded-md border border-pq-neutral-200 p-5">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-4 h-4 text-pq-neutral-500" />
              <h3 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">PO Summary</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-pq-neutral-500">PR2 Reference</p>
                <p className="font-mono font-bold text-pq-neutral-900 mt-0.5">{selectedCandidate.pr2_number}</p>
              </div>
              <div>
                <p className="text-xs text-pq-neutral-500">Supplier</p>
                <p className="font-medium text-pq-neutral-900 mt-0.5">{selectedCandidate.supplier_name_snapshot}</p>
              </div>
              <div>
                <p className="text-xs text-pq-neutral-500">Items</p>
                <p className="font-medium text-pq-neutral-900 mt-0.5">{selectedCandidate.item_count}</p>
              </div>
              <div>
                <p className="text-xs text-pq-neutral-500">Grand Total</p>
                <p className="font-bold text-pq-neutral-900 mt-0.5">
                  ₱{selectedCandidate.grand_total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-pq-danger-100 border border-pq-danger-100 text-pq-danger-600 text-sm rounded-md px-4 py-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 justify-end">
            <button
              type="button"
              onClick={() => setSelectedCandidate(null)}
              className="px-4 py-2 text-sm text-pq-neutral-500 hover:text-pq-neutral-900 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</>
              ) : (
                <><ShoppingCart className="w-4 h-4" /> Generate Purchase Order</>
              )}
            </button>
          </div>
        </form>
      )}
    </AppShell>
  );
}
