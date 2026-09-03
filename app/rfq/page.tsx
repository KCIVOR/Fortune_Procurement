'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import PaginationControls from '@/components/shared/PaginationControls';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import { fetchCanvassingQueuePaged, fetchCanvassingQueueCounts, createRfq, listProcurementUsers, assignPr1ToBuyer, unassignPr1FromBuyer, assignPr2ToBuyer, unassignPr2FromBuyer, fetchSuggestedRFQSequence, fetchRawMaterialCanvassingQueue, createRfqFromPr2 } from '@/lib/canvassing';
import type { ProcurementUserOption } from '@/lib/canvassing';
import { fetchDepartmentOptions } from '@/lib/pr2';
import { useAuth } from '@/context/AuthContext';
import type { CanvassingQueueRow, RawMaterialCanvassingQueueRow } from '@/types/canvassing';
import { SendHorizontal as SendHorizonal, ArrowRight, Clock, Plus, CalendarDays, Building2, CircleDot, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import PriorityChip from '@/components/shared/PriorityChip';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';
import { StatCard } from '@/components/shared/StatCard';
import { KPI_GRID_CLASS } from '@/components/shared/kpi-grid';

const RFQ_STATUS_LABEL: Record<string, string> = {
  draft:     'Draft',
  open:      'Open',
  closed:    'Closed',
  cancelled: 'Cancelled',
};

const RFQ_STATUS_COLOR: Record<string, string> = {
  draft:     'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200',
  open:      'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
  closed:    'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
  cancelled: 'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
};

export default function RFQQueuePage() {
  const { profile } = useAuth();
  const [rows, setRows]       = useState<CanvassingQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch]               = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedDept, setSelectedDept]   = useState('all');
  const [deptOptions, setDeptOptions]     = useState<{ id: string; name: string }[]>([]);

  const [view, setView] = useState<'awaiting' | 'issued' | 'raw_material'>('awaiting');
  const [viewInitialized, setViewInitialized] = useState(false);
  const [counts, setCounts] = useState<{ awaiting: number; active: number; complete: number; issued: number; planningDirect: number } | null>(null);

  // Phase 3 (Raw Mats): separate queue — PR2-native, no PR1/warehouse step.
  const [rawRows, setRawRows]       = useState<RawMaterialCanvassingQueueRow[]>([]);
  const [rawTotalCount, setRawTotalCount] = useState(0);
  const [rawLoading, setRawLoading] = useState(false);
  const [rawError, setRawError]     = useState('');
  const [creatingRaw, setCreatingRaw] = useState(false);
  const [selectedPr2, setSelectedPr2] = useState<RawMaterialCanvassingQueueRow | null>(null);

  const canFilterByDept = profile?.role === 'admin' || profile?.role === 'procurement';

  const [assignedFilter, setAssignedFilter] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [buyerOptions, setBuyerOptions] = useState<ProcurementUserOption[]>([]);
  const [selectedPriority, setSelectedPriority] = useState('all');

  const [assigning, setAssigning]             = useState<CanvassingQueueRow | null>(null);
  const [selectedBuyerId, setSelectedBuyerId] = useState('');
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [assignError, setAssignError]         = useState('');

  // Planning Direct tab (PR2-native) — separate state, same pattern as above.
  const [assigningRaw, setAssigningRaw]             = useState<RawMaterialCanvassingQueueRow | null>(null);
  const [selectedBuyerIdRaw, setSelectedBuyerIdRaw] = useState('');
  const [assignSubmittingRaw, setAssignSubmittingRaw] = useState(false);
  const [assignErrorRaw, setAssignErrorRaw]         = useState('');

  const [creating, setCreating]       = useState(false);
  const [selectedPr1, setSelectedPr1] = useState<CanvassingQueueRow | null>(null);
  const [deadline, setDeadline]       = useState('');
  const [notes, setNotes]             = useState('');
  const [rfqNumber, setRfqNumber]     = useState('');
  const [suggestedRFQSequence, setSuggestedRFQSequence] = useState<string | null>(null);
  const [submitting, setSubmitting]   = useState(false);
  const [createError, setCreateError] = useState('');

  const currentYear = new Date().getFullYear();
  const rfqPrefix = `RFQ-${currentYear}-`;

  const getRFQSuffix = (full: string) => {
    if (full.startsWith(rfqPrefix)) return full.slice(rfqPrefix.length);
    const match = full.match(/^RFQ-\d{4}-(.*)$/i);
    return match ? match[1] : full;
  };

  const setRFQSuffix = (suffix: string) => {
    const clean = suffix.replace(/^RFQ-\d{4}-/i, '').replace(/\D/g, '');
    setRfqNumber(rfqPrefix + clean);
  };

  useEffect(() => {
    if (!canFilterByDept) return;
    fetchDepartmentOptions()
      .then(setDeptOptions)
      .catch(() => {});
  }, [canFilterByDept]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listProcurementUsers().then(setBuyerOptions).catch(() => {});
  }, []);

  useEffect(() => {
    if (!creating && !creatingRaw) return;
    let cancelled = false;
    fetchSuggestedRFQSequence(currentYear)
      .then((suffix) => {
        if (cancelled) return;
        setSuggestedRFQSequence(suffix);
        setRfqNumber((current) => {
          const hasSuffix = current.startsWith(rfqPrefix) && current.slice(rfqPrefix.length).trim();
          return hasSuffix ? current : `${rfqPrefix}${suffix}`;
        });
      })
      .catch(() => {
        if (!cancelled) setSuggestedRFQSequence(null);
      });
    return () => { cancelled = true; };
  }, [creating, creatingRaw, currentYear, rfqPrefix]);

  const loadCounts = () => {
    fetchCanvassingQueueCounts()
      .then(setCounts)
      .catch(() => {});
  };

  useEffect(loadCounts, []); // eslint-disable-line react-hooks/exhaustive-deps

  // First time counts arrive: if there's nothing awaiting but RFQs exist,
  // open the "RFQ Issued" tab so the user lands on populated content.
  useEffect(() => {
    if (!viewInitialized && counts) {
      if (counts.awaiting === 0 && counts.issued > 0) setView('issued');
      setViewInitialized(true);
    }
  }, [counts, viewInitialized]);

  const load = () => {
    if (view === 'raw_material') return;
    const offset = (currentPage - 1) * rowsPerPage;
    setLoading(true);
    fetchCanvassingQueuePaged({
      limit:  rowsPerPage,
      offset,
      search: appliedSearch.trim() || undefined,
      departmentId: canFilterByDept && selectedDept !== 'all' ? selectedDept : undefined,
      view,
      assignedFilter,
      viewerId: profile?.id,
      priorityFilter: selectedPriority,
    })
      .then(result => {
        setRows(result.rows);
        setTotalCount(result.total_count);
      })
      .catch(() => setError('Failed to load canvassing queue.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (view === 'raw_material') return;
    load();
  }, [currentPage, appliedSearch, selectedDept, canFilterByDept, view, assignedFilter, profile?.id, selectedPriority]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRaw = () => {
    const offset = (currentPage - 1) * rowsPerPage;
    setRawLoading(true);
    setRawError('');
    fetchRawMaterialCanvassingQueue({
      limit: rowsPerPage,
      offset,
      search: appliedSearch.trim() || undefined,
      departmentId: canFilterByDept && selectedDept !== 'all' ? selectedDept : undefined,
      priorityFilter: selectedPriority,
      assignedFilter,
      viewerId: profile?.id,
    })
      .then(result => {
        setRawRows(result.rows);
        setRawTotalCount(result.total_count);
      })
      .catch(() => setRawError('Failed to load Planning-direct queue.'))
      .finally(() => setRawLoading(false));
  };

  // The "Planning Direct" tab badge reads from `counts.planningDirect` (an
  // unfiltered total fetched alongside the other tab badges), so this only
  // needs to run when the tab is actually active.
  useEffect(() => {
    if (view !== 'raw_material') return;
    loadRaw();
  }, [currentPage, appliedSearch, selectedDept, canFilterByDept, view, selectedPriority, assignedFilter, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.ceil(totalCount / rowsPerPage);
  const rawTotalPages = Math.ceil(rawTotalCount / rowsPerPage);
  const displayedTotalCount = view === 'raw_material' ? rawTotalCount : totalCount;
  const displayedTotalPages = view === 'raw_material' ? rawTotalPages : totalPages;

  const handleViewChange = (next: 'awaiting' | 'issued' | 'raw_material') => {
    if (next === view) return;
    setView(next);
    setCurrentPage(1);
    setSearch('');
    setAppliedSearch('');
    setSelectedDept('all');
    setAssignedFilter('all');
    setSelectedPriority('all');
  };

  const handleOpenCreateRaw = (row: RawMaterialCanvassingQueueRow) => {
    setSelectedPr2(row);
    setDeadline('');
    setNotes('');
    setRfqNumber('');
    setSuggestedRFQSequence(null);
    setCreateError('');
    setCreatingRaw(true);
  };

  const handleCreateRaw = async () => {
    if (!selectedPr2 || !profile) return;
    if (!getRFQSuffix(rfqNumber).trim()) {
      setCreateError('RFQ number is required.');
      return;
    }
    setSubmitting(true);
    setCreateError('');
    try {
      const rfqId = await createRfqFromPr2(selectedPr2.pr2_id, deadline || null, notes, profile, rfqNumber);
      setCreatingRaw(false);
      window.location.href = `/rfq/${rfqId}`;
    } catch (e: any) {
      setCreateError(e.message ?? 'Failed to create RFQ.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenCreate = (row: CanvassingQueueRow) => {
    setSelectedPr1(row);
    setDeadline('');
    setNotes('');
    setRfqNumber('');
    setSuggestedRFQSequence(null);
    setCreateError('');
    setCreating(true);
  };

  const handleOpenAssign = (row: CanvassingQueueRow) => {
    setAssigning(row);
    setSelectedBuyerId(row.assigned_buyer_id ?? '');
    setAssignError('');
  };

  const handleAssign = async () => {
    if (!assigning || !profile || !selectedBuyerId) return;
    setAssignSubmitting(true);
    setAssignError('');
    try {
      await assignPr1ToBuyer(assigning.pr1_id, selectedBuyerId, profile);
      setAssigning(null);
      load();
    } catch (e: any) {
      setAssignError(e.message ?? 'Failed to assign PR1.');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleUnassign = async () => {
    if (!assigning || !profile) return;
    setAssignSubmitting(true);
    setAssignError('');
    try {
      await unassignPr1FromBuyer(assigning.pr1_id, profile);
      setAssigning(null);
      load();
    } catch (e: any) {
      setAssignError(e.message ?? 'Failed to remove assignment.');
    } finally {
      setAssignSubmitting(false);
    }
  };

  const handleOpenAssignRaw = (row: RawMaterialCanvassingQueueRow) => {
    setAssigningRaw(row);
    setSelectedBuyerIdRaw(row.assigned_buyer_id ?? '');
    setAssignErrorRaw('');
  };

  const handleAssignRaw = async () => {
    if (!assigningRaw || !profile || !selectedBuyerIdRaw) return;
    setAssignSubmittingRaw(true);
    setAssignErrorRaw('');
    try {
      await assignPr2ToBuyer(assigningRaw.pr2_id, selectedBuyerIdRaw, profile);
      setAssigningRaw(null);
      loadRaw();
    } catch (e: any) {
      setAssignErrorRaw(e.message ?? 'Failed to assign PR2.');
    } finally {
      setAssignSubmittingRaw(false);
    }
  };

  const handleUnassignRaw = async () => {
    if (!assigningRaw || !profile) return;
    setAssignSubmittingRaw(true);
    setAssignErrorRaw('');
    try {
      await unassignPr2FromBuyer(assigningRaw.pr2_id, profile);
      setAssigningRaw(null);
      loadRaw();
    } catch (e: any) {
      setAssignErrorRaw(e.message ?? 'Failed to remove assignment.');
    } finally {
      setAssignSubmittingRaw(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedPr1 || !profile) return;
    if (!getRFQSuffix(rfqNumber).trim()) {
      setCreateError('RFQ number is required.');
      return;
    }
    setSubmitting(true);
    setCreateError('');
    try {
      const rfqId = await createRfq(selectedPr1.pr1_id, deadline || null, notes, profile, rfqNumber);
      setCreating(false);
      setCurrentPage(1);
      loadCounts();
      window.location.href = `/rfq/${rfqId}`;
    } catch (e: any) {
      setCreateError(e.message ?? 'Failed to create RFQ.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter configuration for FilterBar
  const filters: FilterConfig[] = [
    {
      type: 'search',
      id: 'rfq-search',
      label: 'Search',
      placeholder: view === 'raw_material'
        ? 'PR2 number, purpose, department, or requester…'
        : 'PR1 number, purpose, department, requester, or RFQ number…',
      value: search,
      onChange: (value) => setSearch(value as string),
    },
    {
      type: 'select' as const,
      id: 'rfq-assigned',
      label: 'Assigned',
      placeholder: 'All',
      value: assignedFilter,
      onChange: (value: string | [string, string]) => {
        setAssignedFilter(value as 'all' | 'mine' | 'unassigned');
        setCurrentPage(1);
      },
      options: [
        { value: 'all', label: 'All' },
        { value: 'mine', label: 'Assigned to Me' },
        { value: 'unassigned', label: 'Unassigned' },
      ],
    },
    ...(canFilterByDept ? [{
      type: 'select' as const,
      id: 'rfq-dept',
      label: 'Department',
      placeholder: 'All departments',
      value: selectedDept,
      onChange: (value: string | [string, string]) => {
        setSelectedDept(value as string);
        setCurrentPage(1);
      },
      options: [
        { value: 'all', label: 'All departments' },
        ...deptOptions.map(d => ({ value: d.id, label: d.name })),
      ],
    }] : []),
    {
      type: 'select',
      id: 'rfq-priority',
      label: 'Priority',
      placeholder: 'All priorities',
      value: selectedPriority,
      onChange: (value) => {
        setSelectedPriority(value as string);
        setCurrentPage(1);
      },
      options: [
        { value: 'all',    label: 'All Priorities' },
        { value: 'normal', label: 'Normal' },
        { value: 'medium', label: 'Medium' },
        { value: 'high',   label: 'High' },
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
    setSelectedDept('all');
    setAssignedFilter('all');
    setSelectedPriority('all');
    setCurrentPage(1);
  };

  return (
    <AppShell title="Canvassing Queue">
      <PageHeader
        title="Canvassing Queue"
        description="PR1s approved for canvassing. Create and manage RFQs to collect supplier quotations."
      />

      <FilterBar
        filters={filters}
        onApply={handleApply}
        onClear={handleClear}
        loading={view === 'raw_material' ? rawLoading : loading}
        resultCount={displayedTotalCount}
        resultLabel="item"
        className="mb-4"
      />

      {error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">{error}</div>
      ) : (
        <div className="space-y-6">
          <div className={`${KPI_GRID_CLASS} mb-1`}>
            <StatCard
              label="Awaiting RFQ"
              value={counts?.awaiting ?? 0}
              accent="amber"
              icon={<Clock className="w-5 h-5" />}
            />
            <StatCard
              label="Active RFQs"
              value={counts?.active ?? 0}
              accent="blue"
              icon={<CircleDot className="w-5 h-5" />}
            />
            <StatCard
              label="Canvassing Complete"
              value={counts?.complete ?? 0}
              accent="green"
              icon={<CheckCheck className="w-5 h-5" />}
            />
          </div>

          {/* Segmented tabs: action queue vs. issued history */}
          <div className="flex items-center gap-1 border-b border-pq-neutral-200">
            <TabButton
              active={view === 'awaiting'}
              onClick={() => handleViewChange('awaiting')}
              label="Awaiting RFQ"
              count={counts?.awaiting}
              accent="amber"
            />
            <TabButton
              active={view === 'issued'}
              onClick={() => handleViewChange('issued')}
              label="RFQ Issued"
              count={counts?.issued}
              accent="slate"
            />
            <TabButton
              active={view === 'raw_material'}
              onClick={() => handleViewChange('raw_material')}
              label="Planning Direct"
              count={counts?.planningDirect}
              accent="slate"
            />
          </div>

          {view === 'raw_material' ? (
            rawError ? (
              <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">{rawError}</div>
            ) : rawLoading ? (
              <TableSkeleton rows={5} cols={8} />
            ) : rawRows.length === 0 ? (
              <div className="bg-white rounded-md border border-pq-neutral-200">
                <EmptyState
                  title={appliedSearch.trim() ? 'No matching PR2s' : 'No Planning-direct requests ready'}
                  description={
                    appliedSearch.trim()
                      ? 'No queue items match your search. Try different keywords or Clear search.'
                      : 'Approved Raw Material and Services PR2s created directly by Planning, with no RFQ yet, will appear here.'
                  }
                  icon={SendHorizonal}
                />
              </div>
            ) : (
              <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50/50">
                        <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">PR2 No.</th>
                        <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Type</th>
                        <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Priority</th>
                        <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">RFQ No.</th>
                        <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Purpose</th>
                        <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Department</th>
                        <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Date Required</th>
                        <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">RFQ Status</th>
                        <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Assigned To</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-pq-neutral-200">
                      {rawRows.map(row => (
                        <tr key={row.pr2_id} className="hover:bg-pq-neutral-50 transition">
                          <td className="px-5 py-3.5">
                            <span className="font-mono text-xs font-bold text-pq-neutral-900">{row.pr2_number}</span>
                          </td>
                          <td className="px-5 py-3.5">
                            <RequestTypeBadge type={row.request_type} />
                          </td>
                          <td className="px-5 py-3.5">
                            <PriorityChip priority={row.priority ?? 'normal'} />
                          </td>
                          <td className="px-5 py-3.5 font-mono text-xs font-semibold text-pq-primary-600 whitespace-nowrap">
                            {row.rfq_number ?? '—'}
                          </td>
                          <td className="px-5 py-3.5 text-pq-neutral-500 max-w-[200px] truncate">{row.purpose}</td>
                          <td className="px-5 py-3.5 text-pq-neutral-500 text-xs whitespace-nowrap">{row.department_name_snapshot}</td>
                          <td className="px-5 py-3.5 text-pq-neutral-500 text-xs whitespace-nowrap">{format(new Date(row.date_required), 'MMM d, yyyy')}</td>
                          <td className="px-5 py-3.5">
                            {row.rfq_status && (
                              <span className={`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${RFQ_STATUS_COLOR[row.rfq_status] ?? ''}`}>
                                {RFQ_STATUS_LABEL[row.rfq_status] ?? row.rfq_status}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <button
                              onClick={() => handleOpenAssignRaw(row)}
                              className={`inline-flex items-center text-xs font-medium border rounded-full px-2.5 py-0.5 transition ${
                                row.assigned_buyer_name_snapshot
                                  ? 'bg-pq-primary-50 text-pq-primary-700 border-pq-primary-100 hover:border-pq-primary-600'
                                  : 'bg-pq-neutral-50 text-pq-neutral-400 border-pq-neutral-200 hover:border-pq-primary-600 hover:text-pq-neutral-900'
                              }`}
                            >
                              {row.assigned_buyer_name_snapshot ?? 'Unassigned'}
                            </button>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {!row.rfq_id ? (
                              <button
                                onClick={() => handleOpenCreateRaw(row)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-xs font-semibold rounded-md transition"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                Create RFQ
                              </button>
                            ) : (
                              <Link
                                href={`/rfq/${row.rfq_id}`}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-pq-primary-600 hover:text-pq-neutral-900 transition"
                              >
                                Open RFQ
                                <ArrowRight className="w-3.5 h-3.5" />
                              </Link>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : loading ? (
            <TableSkeleton rows={5} cols={9} />
          ) : rows.length === 0 ? (
            <div className="bg-white rounded-md border border-pq-neutral-200">
              <EmptyState
                title={
                  appliedSearch.trim()
                    ? 'No matching PR1s'
                    : view === 'awaiting'
                      ? 'All caught up'
                      : 'No RFQs issued yet'
                }
                description={
                  appliedSearch.trim()
                    ? 'No queue items match your search. Try different keywords or Clear search.'
                    : view === 'awaiting'
                      ? 'No PR1s are waiting for an RFQ. New PR1s approved for canvassing will appear here.'
                      : 'RFQs you create will appear here once issued.'
                }
                icon={SendHorizonal}
              />
            </div>
          ) : (
            <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50/50">
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">PR1 No.</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Type</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Priority</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">RFQ No.</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Purpose</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Department</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Date Required</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">RFQ Status</th>
                      <th className="px-5 py-3 text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide text-left">Assigned To</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pq-neutral-200">
                    {rows.map(row => (
                      <QueueRow key={row.pr1_id} row={row} onCreateRfq={handleOpenCreate} onAssign={handleOpenAssign} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {displayedTotalCount > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={displayedTotalPages}
              pageSize={rowsPerPage}
              totalCount={displayedTotalCount}
              entityLabel="items"
              loading={view === 'raw_material' ? rawLoading : loading}
              onPageChange={(page) => {
                if (page < currentPage) setCurrentPage(p => Math.max(1, p - 1));
                else setCurrentPage(p => Math.min(displayedTotalPages, p + 1));
              }}
            />
          )}
        </div>
      )}

      {creating && selectedPr1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-md w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-pq-neutral-200">
              <h2 className="text-base font-semibold text-pq-neutral-900">Create RFQ</h2>
              <p className="text-xs text-pq-neutral-500 mt-0.5">
                For PR1 <span className="font-mono font-semibold">{selectedPr1.pr1_number}</span>
                {' '}— {selectedPr1.purpose}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                  RFQ Number <span className="text-pq-danger-600">*</span>
                </label>
                <div className="flex items-center border border-pq-neutral-200 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-[#1E4BFF]">
                  <div className="px-3 py-2 bg-pq-neutral-50 border-r border-pq-neutral-200 text-sm font-mono text-pq-neutral-400 whitespace-nowrap select-none">
                    {rfqPrefix}
                  </div>
                  <input
                    type="text"
                    value={getRFQSuffix(rfqNumber)}
                    onChange={(e) => setRFQSuffix(e.target.value)}
                    placeholder={suggestedRFQSequence ?? '0001'}
                    className="flex-1 px-3 py-2 border-0 text-sm font-mono focus:outline-none"
                  />
                </div>
                <p className="mt-1 text-xs text-pq-neutral-400">
                  {suggestedRFQSequence
                    ? `Suggested: ${rfqPrefix}${suggestedRFQSequence} — you may edit this number.`
                    : 'Enter a 4-digit sequence (e.g. 0001).'}
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                  Quotation Deadline <span className="text-pq-neutral-400 font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                  Notes <span className="text-pq-neutral-400 font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Specifications, brand preferences, delivery requirements..."
                  className="w-full px-3 py-2.5 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none"
                />
              </div>
              {createError && (
                <p className="text-sm text-pq-danger-600">{createError}</p>
              )}
            </div>
            <div className="px-6 pb-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setCreating(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm text-pq-neutral-500 hover:text-pq-neutral-900 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={submitting || !getRFQSuffix(rfqNumber).trim()}
                className="px-5 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create RFQ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {creatingRaw && selectedPr2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-md w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-pq-neutral-200">
              <h2 className="text-base font-semibold text-pq-neutral-900">Create RFQ</h2>
              <p className="text-xs text-pq-neutral-500 mt-0.5">
                For PR2 <span className="font-mono font-semibold">{selectedPr2.pr2_number}</span>
                {' '}— {selectedPr2.purpose}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                  RFQ Number <span className="text-pq-danger-600">*</span>
                </label>
                <div className="flex items-center border border-pq-neutral-200 rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-[#1E4BFF]">
                  <div className="px-3 py-2 bg-pq-neutral-50 border-r border-pq-neutral-200 text-sm font-mono text-pq-neutral-400 whitespace-nowrap select-none">
                    {rfqPrefix}
                  </div>
                  <input
                    type="text"
                    value={getRFQSuffix(rfqNumber)}
                    onChange={(e) => setRFQSuffix(e.target.value)}
                    placeholder={suggestedRFQSequence ?? '0001'}
                    className="flex-1 px-3 py-2 border-0 text-sm font-mono focus:outline-none"
                  />
                </div>
                <p className="mt-1 text-xs text-pq-neutral-400">
                  {suggestedRFQSequence
                    ? `Suggested: ${rfqPrefix}${suggestedRFQSequence} — you may edit this number.`
                    : 'Enter a 4-digit sequence (e.g. 0001).'}
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                  Quotation Deadline <span className="text-pq-neutral-400 font-normal normal-case">(optional)</span>
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                  Notes <span className="text-pq-neutral-400 font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Specifications, brand preferences, delivery requirements..."
                  className="w-full px-3 py-2.5 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none"
                />
              </div>
              {createError && (
                <p className="text-sm text-pq-danger-600">{createError}</p>
              )}
            </div>
            <div className="px-6 pb-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setCreatingRaw(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm text-pq-neutral-500 hover:text-pq-neutral-900 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRaw}
                disabled={submitting || !getRFQSuffix(rfqNumber).trim()}
                className="px-5 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create RFQ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {assigning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-md w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-pq-neutral-200">
              <h2 className="text-base font-semibold text-pq-neutral-900">Assign Buyer</h2>
              <p className="text-xs text-pq-neutral-500 mt-0.5">
                For PR1 <span className="font-mono font-semibold">{assigning.pr1_number}</span>
                {' '}— {assigning.purpose}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                  Procurement Staff
                </label>
                <select
                  value={selectedBuyerId}
                  onChange={e => setSelectedBuyerId(e.target.value)}
                  className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF]"
                >
                  <option value="">Select a staff member...</option>
                  {buyerOptions.map(b => (
                    <option key={b.id} value={b.id}>{b.full_name}</option>
                  ))}
                </select>
              </div>
              {assignError && (
                <p className="text-sm text-pq-danger-600">{assignError}</p>
              )}
            </div>
            <div className="px-6 pb-5 flex items-center justify-between gap-3">
              {assigning.assigned_buyer_id ? (
                <button
                  onClick={handleUnassign}
                  disabled={assignSubmitting}
                  className="px-4 py-2 text-sm text-pq-danger-600 hover:text-pq-danger-700 transition disabled:opacity-50"
                >
                  Remove Assignment
                </button>
              ) : <span />}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAssigning(null)}
                  disabled={assignSubmitting}
                  className="px-4 py-2 text-sm text-pq-neutral-500 hover:text-pq-neutral-900 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssign}
                  disabled={assignSubmitting || !selectedBuyerId}
                  className="px-5 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
                >
                  {assignSubmitting ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {assigningRaw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-md w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-pq-neutral-200">
              <h2 className="text-base font-semibold text-pq-neutral-900">Assign Buyer</h2>
              <p className="text-xs text-pq-neutral-500 mt-0.5">
                For PR2 <span className="font-mono font-semibold">{assigningRaw.pr2_number}</span>
                {' '}— {assigningRaw.purpose}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                  Procurement Staff
                </label>
                <select
                  value={selectedBuyerIdRaw}
                  onChange={e => setSelectedBuyerIdRaw(e.target.value)}
                  className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF]"
                >
                  <option value="">Select a staff member...</option>
                  {buyerOptions.map(b => (
                    <option key={b.id} value={b.id}>{b.full_name}</option>
                  ))}
                </select>
              </div>
              {assignErrorRaw && (
                <p className="text-sm text-pq-danger-600">{assignErrorRaw}</p>
              )}
            </div>
            <div className="px-6 pb-5 flex items-center justify-between gap-3">
              {assigningRaw.assigned_buyer_id ? (
                <button
                  onClick={handleUnassignRaw}
                  disabled={assignSubmittingRaw}
                  className="px-4 py-2 text-sm text-pq-danger-600 hover:text-pq-danger-700 transition disabled:opacity-50"
                >
                  Remove Assignment
                </button>
              ) : <span />}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAssigningRaw(null)}
                  disabled={assignSubmittingRaw}
                  className="px-4 py-2 text-sm text-pq-neutral-500 hover:text-pq-neutral-900 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignRaw}
                  disabled={assignSubmittingRaw || !selectedBuyerIdRaw}
                  className="px-5 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
                >
                  {assignSubmittingRaw ? 'Assigning...' : 'Assign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function QueueRow({
  row,
  onCreateRfq,
  onAssign,
}: {
  row: CanvassingQueueRow;
  onCreateRfq: (row: CanvassingQueueRow) => void;
  onAssign: (row: CanvassingQueueRow) => void;
}) {
  return (
    <tr className="hover:bg-pq-neutral-50 transition">
      <td className="px-5 py-3.5">
        <span className="font-mono text-xs font-bold text-pq-neutral-900">{row.pr1_number}</span>
      </td>
      <td className="px-5 py-3.5">
        <RequestTypeBadge type={row.request_type ?? 'goods'} />
      </td>
      <td className="px-5 py-3.5">
        <PriorityChip priority={row.priority || 'normal'} />
      </td>
      <td className="px-5 py-3.5 font-mono text-xs font-semibold text-pq-primary-600 whitespace-nowrap">
        {row.rfq_number ?? '—'}
      </td>
      <td className="px-5 py-3.5 text-pq-neutral-500 max-w-[200px] truncate">{row.purpose}</td>
      <td className="px-5 py-3.5 text-pq-neutral-500 text-xs whitespace-nowrap">{row.department_name_snapshot}</td>
      <td className="px-5 py-3.5 text-pq-neutral-500 text-xs whitespace-nowrap">{format(new Date(row.date_required), 'MMM d, yyyy')}</td>
      <td className="px-5 py-3.5">
        {row.rfq_status && (
          <span className={`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${RFQ_STATUS_COLOR[row.rfq_status] ?? ''}`}>
            {RFQ_STATUS_LABEL[row.rfq_status] ?? row.rfq_status}
          </span>
        )}
      </td>
      <td className="px-5 py-3.5">
        <button
          onClick={() => onAssign(row)}
          className={`inline-flex items-center text-xs font-medium border rounded-full px-2.5 py-0.5 transition ${
            row.assigned_buyer_name_snapshot
              ? 'bg-pq-primary-50 text-pq-primary-700 border-pq-primary-100 hover:border-pq-primary-600'
              : 'bg-pq-neutral-50 text-pq-neutral-400 border-pq-neutral-200 hover:border-pq-primary-600 hover:text-pq-neutral-900'
          }`}
        >
          {row.assigned_buyer_name_snapshot ?? 'Unassigned'}
        </button>
      </td>
      <td className="px-5 py-3.5 text-right">
        {!row.rfq_id ? (
          <button
            onClick={() => onCreateRfq(row)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-xs font-semibold rounded-md transition"
          >
            <Plus className="w-3.5 h-3.5" />
            Create RFQ
          </button>
        ) : (
          <Link
            href={`/rfq/${row.rfq_id}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-pq-primary-600 hover:text-pq-neutral-900 transition"
          >
            Open RFQ
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </td>
    </tr>
  );
}

function TabButton({
  active,
  onClick,
  label,
  count,
  accent,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  accent: 'amber' | 'slate';
}) {
  const badgeClass = active
    ? accent === 'amber'
      ? 'bg-pq-warning-100 text-pq-warning-600'
      : 'bg-pq-primary-50 text-pq-primary-700'
    : 'bg-pq-neutral-100 text-pq-neutral-500';

  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition -mb-px border-b-2 ${
        active
          ? 'border-pq-primary-600 text-pq-neutral-900'
          : 'border-transparent text-pq-neutral-500 hover:text-pq-neutral-900'
      }`}
    >
      {label}
      {typeof count === 'number' && (
        <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${badgeClass}`}>{count}</span>
      )}
    </button>
  );
}
