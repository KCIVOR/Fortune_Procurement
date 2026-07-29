'use client';

import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import { DetailPageSkeleton } from '@/components/shared/structural-skeletons';
import { useAuth } from '@/context/AuthContext';
import {
  fetchRfqDetail,
  buildQuoteMatrix,
  assignSuppliers,
  addExternalVendorToRfq,
  removeExternalVendorFromRfq,
  submitSupplierQuotation,
  fetchQuoteIdForSupplierItem,
  uploadRfqQuoteAttachment,
  deleteRfqQuoteAttachment,
  issueRfq,
  closeRfq,
  reopenRfq,
  saveItemSelection,
  clearItemSelection,
} from '@/lib/canvassing';
import type { RfqQuoteAttachment } from '@/types/canvassing';
import { fetchPR2ByRfqId } from '@/lib/pr2';
import { fetchRfqApprovalInstanceForRfq } from '@/lib/rfq-approvals';
import type { RfqDetailView, QuoteMatrixRow, CanvassSupplierCandidate } from '@/types/canvassing';
import {
  SUPPLY_TYPE_FILTER_OPTIONS,
  matchesSupplyTypeFilter,
  type SupplyTypeFilter,
} from '@/lib/supplier-supply-type';
import { UserPlus, SendHorizontal as Send, CircleCheck as CheckCircle2, Circle as XCircle, Users, Trophy, CalendarDays, FileText, Building2, TriangleAlert as AlertTriangle, CheckCheck, CircleDot, Loader as Loader2, Replace, Clock, ClipboardList, MessageSquare, Mail, Info, Store, Trash2, X, Paperclip, RotateCcw } from 'lucide-react';
import RelatedRecords from '@/components/shared/RelatedRecords';
import { PR1AttachmentsGallery } from '@/components/pr1/PR1AttachmentsSection';
import RawMaterialBadge from '@/components/shared/RawMaterialBadge';
import RequestorRemarks from '@/components/shared/RequestorRemarks';
import QuoteAttachmentPills from '@/components/rfq/QuoteAttachmentPills';
import JustificationModal, { type JustificationContext } from '@/components/canvassing/JustificationModal';
import { format } from 'date-fns';
import DetailBackButton from '@/components/shared/DetailBackButton';
import DetailHeaderLayout from '@/components/shared/DetailHeaderLayout';
import DetailTitleRow from '@/components/shared/DetailTitleRow';
import DetailInfoField from '@/components/shared/DetailInfoField';
import type { FilterConfig } from '@/components/shared/FilterBar.types';
import AssignSuppliersModal from '@/components/canvassing/AssignSuppliersModal';
import { toast } from 'sonner';
import { formatRfqForViber } from '@/lib/viber-utils';
import { db } from '@/lib/supabase';
import { authFetch } from '@/lib/authenticated-fetch';
import { canViewCommercialPricing, formatCommercialAmount } from '@/lib/price-visibility';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';



const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200',
  open:      'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
  closed:    'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
  cancelled: 'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', open: 'Open', closed: 'Closed', cancelled: 'Cancelled',
};
const SUPPLIER_STATUS_COLOR: Record<string, string> = {
  invited:   'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
  submitted: 'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
  declined:  'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
};

export default function RfqDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const { handleBack } = useBackNavigation();

  const [detail, setDetail] = useState<RfqDetailView | null>(null);
  const [matrix, setMatrix] = useState<QuoteMatrixRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [actionError, setActionError] = useState('');
  const [working, setWorking] = useState(false);
  const [existingPR2Id, setExistingPR2Id] = useState<string | null>(null);
  const [rfqApproval, setRfqApproval] = useState<{
    id: string;
    status: string;
    current_step: number;
  } | null>(null);

  // Supplier assignment panel
  const [assigning, setAssigning]       = useState(false);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());
  const [supplierSearch, setSupplierSearch] = useState('');
  const [appliedSupplierSearch, setAppliedSupplierSearch] = useState('');
  const [accreditationFilter, setAccreditationFilter] = useState('all');
  const [appliedAccreditationFilter, setAppliedAccreditationFilter] = useState('all');
  const [supplyTypeFilter, setSupplyTypeFilter] = useState<SupplyTypeFilter>('all');
  const [appliedSupplyTypeFilter, setAppliedSupplyTypeFilter] = useState<SupplyTypeFilter>('all');
  const [supplierPage, setSupplierPage] = useState(1);
  const supplierRowsPerPage = 20;

  // Phase 7 (Raw Mats): justification modal state.
  const [justificationCtx, setJustificationCtx] =
    useState<JustificationContext | null>(null);
  const [justificationBusy, setJustificationBusy] = useState(false);

  // External vendor: Procurement-entered quote modal state.
  const [extQuote, setExtQuote] = useState<{
    pr1ItemId: string;
    rfqSupplierId: string;
    itemDescription: string;
    unitPrice: string;
    quotedDescription: string;
    leadTimeDays: string;
    remarks: string;
    existingAttachments: RfqQuoteAttachment[];
    pendingFiles: File[];
    vatType: 'vat_inclusive' | 'vat_exclusive' | null;
    isVatRegistered: boolean;
  } | null>(null);
  const [extQuoteBusy, setExtQuoteBusy] = useState(false);
  const [extQuoteError, setExtQuoteError] = useState('');

  const openExternalQuoteModal = (args: {
    pr1ItemId: string;
    rfqSupplierId: string;
    itemDescription: string;
    existing: { unit_price: number; quoted_description: string; lead_time_days: number; remarks?: string | null; attachments?: RfqQuoteAttachment[]; vat_type?: 'vat_inclusive' | 'vat_exclusive' | null } | null;
  }) => {
    setExtQuoteError('');
    setExtQuote({
      pr1ItemId: args.pr1ItemId,
      rfqSupplierId: args.rfqSupplierId,
      itemDescription: args.itemDescription,
      unitPrice: args.existing ? String(args.existing.unit_price) : '',
      quotedDescription: args.existing?.quoted_description ?? args.itemDescription,
      leadTimeDays: args.existing ? String(args.existing.lead_time_days) : '',
      remarks: args.existing?.remarks ?? '',
      existingAttachments: args.existing?.attachments ?? [],
      pendingFiles: [],
      vatType: args.existing?.vat_type ?? null,
      isVatRegistered: false,
    });

    // Rev #1: resolve whether this external vendor is VAT-registered (async,
    // since it requires a lookup through rfq_suppliers -> profiles).
    (async () => {
      const { data: rs } = await db
        .from('rfq_suppliers')
        .select('supplier_id')
        .eq('id', args.rfqSupplierId)
        .maybeSingle();
      if (!rs?.supplier_id) return;
      const { data: p } = await db
        .from('profiles')
        .select('is_vat_registered')
        .eq('id', rs.supplier_id)
        .maybeSingle();
      setExtQuote(prev => (prev && prev.rfqSupplierId === args.rfqSupplierId
        ? { ...prev, isVatRegistered: Boolean(p?.is_vat_registered) }
        : prev));
    })();
  };

  const handleSaveExternalQuote = async () => {
    if (!extQuote || !detail) return;
    const price = Number(extQuote.unitPrice);
    const lead = Number(extQuote.leadTimeDays);
    if (!extQuote.quotedDescription.trim()) { setExtQuoteError('Description is required.'); return; }
    if (!Number.isFinite(price) || price <= 0) { setExtQuoteError('Enter a valid unit price.'); return; }
    if (!Number.isFinite(lead) || lead < 0) { setExtQuoteError('Enter a valid lead time.'); return; }
    if (extQuote.isVatRegistered && !extQuote.vatType) {
      setExtQuoteError('Select VAT-Inclusive or VAT-Exclusive for this vendor.');
      return;
    }

    setExtQuoteBusy(true);
    setExtQuoteError('');
    try {
      const isPr2Item = Boolean(detail?.rfq && !detail.rfq.pr1_id);
      const itemId = extQuote.pr1ItemId;

      await submitSupplierQuotation(extQuote.rfqSupplierId, [{
        pr1_item_id:        isPr2Item ? null : itemId,
        pr2_item_id:        isPr2Item ? itemId : null,
        quoted_description: extQuote.quotedDescription.trim(),
        is_alternative:     false,
        unit_price:         price,
        lead_time_days:     lead,
        remarks:            extQuote.remarks.trim(),
        response_status:    'quoted',
        vat_type:           extQuote.isVatRegistered ? extQuote.vatType : null,
      }]);

      if (extQuote.pendingFiles.length > 0) {
        const rfqItemQuoteId = await fetchQuoteIdForSupplierItem(
          extQuote.rfqSupplierId,
          itemId,
        );
        if (rfqItemQuoteId) {
          for (const file of extQuote.pendingFiles) {
            await uploadRfqQuoteAttachment({
              rfqId:          detail.rfq.id,
              rfqSupplierId:  extQuote.rfqSupplierId,
              rfqItemQuoteId,
              pr1ItemId:      isPr2Item ? null : itemId,
              pr2ItemId:      isPr2Item ? itemId : null,
              file,
            });
          }
        }
      }

      setExtQuote(null);
      setLoading(true);
      load();
    } catch (e: any) {
      setExtQuoteError(e.message ?? 'Failed to save quote.');
    } finally {
      setExtQuoteBusy(false);
    }
  };

  const load = useCallback(() => {
    if (!id) return;
    Promise.all([
      fetchRfqDetail(id),
      fetchPR2ByRfqId(id),
      fetchRfqApprovalInstanceForRfq(id),
    ])
      .then(([d, pr2, approval]) => {
        if (!d) { setError('RFQ not found.'); return; }
        setDetail(d);
        setMatrix(buildQuoteMatrix(d));
        setExistingPR2Id(pr2?.id ?? d.rfq.pr2_id ?? null);
        setRfqApproval(approval);
      })
      .catch(() => setError('Failed to load RFQ.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  if (loading) return (
    <AppShell title="RFQ Detail">
      <DetailPageSkeleton />
    </AppShell>
  );

  if (error || !detail) return (
    <AppShell title="RFQ Detail">
      <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
        {error || 'RFQ not found.'}
      </div>
    </AppShell>
  );

  const { rfq, pr1, items, suppliers, allSuppliers } = detail;
  const isGoodsOrServices = (pr1.request_type ?? 'goods') === 'goods' || pr1.request_type === 'services';
  const isRawMaterial = pr1.request_type === 'raw_material';
  // PR2-native (no pr1_id): Raw Material or a Planning-direct Services PR2 —
  // `pr1` here actually holds the PR2's fields in that case (see
  // fetchRfqDetail), so "PR1 Number"/"PR1 Details" labels would be wrong for
  // a Planning-direct Services RFQ too, not just Raw Material.
  const isPr2Native = !rfq.pr1_id;
  // Services Workflow Alignment Phase 4: Services now creates its PR2 before
  // RFQ (same as Goods) and goes through RFQ_APPROVAL identically — same
  // reopen/close-label/PR2-link UI as Goods/Raw Material, not the old
  // "no approval, just Generate PR2" legacy branch this used to fall into.
  const followsApprovalFlow = isGoodsOrServices || isRawMaterial;
  const isOpen   = rfq.status === 'open';
  const isDraft  = rfq.status === 'draft';
  const isClosed = rfq.status === 'closed';
  const canViewPrices = canViewCommercialPricing(profile);

  const assignedIds = new Set(suppliers.map(s => s.supplier_id));
  const availableSuppliers = allSuppliers.filter(s => !assignedIds.has(s.id));

  const filteredAvailableSuppliers = availableSuppliers.filter(c => {
    const term = appliedSupplierSearch.trim().toLowerCase();
    if (term) {
      const matchName = c.full_name.toLowerCase().includes(term);
      const matchEmail = (c.email ?? '').toLowerCase().includes(term);
      if (!matchName && !matchEmail) return false;
    }
    if (!matchesAccreditationFilter(c, appliedAccreditationFilter)) return false;
    return matchesSupplyTypeFilter(c.supplier_supply_type, appliedSupplyTypeFilter);
  });
  const supplierTotalCount = filteredAvailableSuppliers.length;
  const supplierTotalPages = Math.max(1, Math.ceil(supplierTotalCount / supplierRowsPerPage));
  const paginatedAvailableSuppliers = filteredAvailableSuppliers.slice(
    (supplierPage - 1) * supplierRowsPerPage,
    supplierPage * supplierRowsPerPage,
  );

  const supplierModalFilters: FilterConfig[] = [
    {
      type: 'search',
      id: 'supplier-search',
      label: 'Search',
      placeholder: 'Supplier name or email…',
      value: supplierSearch,
      onChange: (value) => setSupplierSearch(value as string),
    },
    {
      type: 'select',
      id: 'supplier-accreditation',
      label: 'Accreditation',
      placeholder: 'All accreditation',
      value: accreditationFilter,
      onChange: (value) => setAccreditationFilter(value as string),
      options: [
        { value: 'all', label: 'All accreditation' },
        { value: 'accredited', label: 'Accredited' },
        { value: 'pending', label: 'Pending accreditation' },
        { value: 'rejected', label: 'Rejected' },
        { value: 'withdrawn', label: 'Withdrawn' },
        { value: 'none', label: 'No accreditation' },
      ],
    },
    {
      type: 'select',
      id: 'supplier-supply-type',
      label: 'Supply type',
      placeholder: 'All supply types',
      value: supplyTypeFilter,
      onChange: (value) => setSupplyTypeFilter(value as SupplyTypeFilter),
      options: SUPPLY_TYPE_FILTER_OPTIONS,
      // Phase 3 (Raw Mats): locked to raw_material for raw-material RFQs —
      // server-side assignSuppliers() also enforces this, this just keeps
      // the UI from suggesting a choice that will be rejected.
      disabled: pr1.request_type === 'raw_material',
    },
  ];

  const openAssignModal = () => {
    setSupplierSearch('');
    setAppliedSupplierSearch('');
    setAccreditationFilter('all');
    setAppliedAccreditationFilter('all');
    // Note: pr1.request_type uses 'services' (plural); the supply-type filter
    // enum uses 'service' (singular) — deliberately different vocabularies.
    const defaultSupplyType: SupplyTypeFilter =
      pr1.request_type === 'raw_material' ? 'raw_material'
      : pr1.request_type === 'services' ? 'service'
      : 'all';
    setSupplyTypeFilter(defaultSupplyType);
    setAppliedSupplyTypeFilter(defaultSupplyType);
    setSupplierPage(1);
    setAssigning(true);
  };

  const closeAssignModal = () => {
    setAssigning(false);
    setSelectedIds(new Set());
    setSupplierSearch('');
    setAppliedSupplierSearch('');
    setAccreditationFilter('all');
    setAppliedAccreditationFilter('all');
    setSupplyTypeFilter('all');
    setAppliedSupplyTypeFilter('all');
    setSupplierPage(1);
  };

  const handleSupplierFilterApply = () => {
    setAppliedSupplierSearch(supplierSearch);
    setAppliedAccreditationFilter(accreditationFilter);
    setAppliedSupplyTypeFilter(supplyTypeFilter);
    setSupplierPage(1);
  };

  const handleSupplierFilterClear = () => {
    setSupplierSearch('');
    setAppliedSupplierSearch('');
    setAccreditationFilter('all');
    setAppliedAccreditationFilter('all');
    setSupplyTypeFilter('all');
    setAppliedSupplyTypeFilter('all');
    setSupplierPage(1);
  };

  // TODO(close/finalize): If every supplier marks `no_quote` on a line, Procurement may need a
  // future "No Award / Re-canvass" path — today, closing still expects a winner per item.
  const allItemsSelected = matrix.length > 0 && matrix.every(r => r.selected_rfq_supplier_id !== null);
  const submittedSuppliers = suppliers.filter(s => s.status === 'submitted').length;
  const pendingSubstitutes = matrix.reduce((sum, row) =>
    sum + row.quotes.filter(q => q.is_alternative && q.unit_price > 0 && q.substitute_decision === null).length
  , 0);

  const handleAssign = async () => {
    if (!profile || selectedIds.size === 0) return;
    setWorking(true);
    setActionError('');
    try {
      await assignSuppliers(rfq.id, Array.from(selectedIds), allSuppliers, profile);
      closeAssignModal();
      setLoading(true);
      load();
    } catch (e: any) {
      setActionError(e.message ?? 'Failed to assign suppliers.');
    } finally {
      setWorking(false);
    }
  };

  const handleAddExternalVendor = async (vendorName: string) => {
    if (!profile) return;
    setWorking(true);
    setActionError('');
    try {
      await addExternalVendorToRfq(rfq.id, vendorName, profile);
      closeAssignModal();
      setLoading(true);
      load();
    } catch (e: any) {
      setActionError(e.message ?? 'Failed to add external vendor.');
    } finally {
      setWorking(false);
    }
  };

  const handleRemoveExternalVendor = async (rfqSupplierId: string) => {
    if (!profile) return;
    setWorking(true);
    setActionError('');
    try {
      await removeExternalVendorFromRfq(rfqSupplierId);
      setLoading(true);
      load();
    } catch (e: any) {
      setActionError(e.message ?? 'Failed to remove external vendor.');
    } finally {
      setWorking(false);
    }
  };

  const handleIssue = async () => {
    if (!profile) return;
    setWorking(true);
    setActionError('');
    try {
      await issueRfq(rfq.id, profile);
      setLoading(true);
      load();
    } catch (e: any) {
      setActionError(e.message ?? 'Failed to issue RFQ.');
    } finally {
      setWorking(false);
    }
  };

  const handleClose = async () => {
    if (!profile) return;
    setWorking(true);
    setActionError('');
    try {
      await closeRfq(rfq.id, rfq.pr1_id, profile);
      setLoading(true);
      load();
    } catch (e: any) {
      setActionError(e.message ?? 'Failed to close RFQ.');
    } finally {
      setWorking(false);
    }
  };

  const handleReopen = async () => {
    if (!profile) return;
    setWorking(true);
    setActionError('');
    try {
      await reopenRfq(rfq.id, profile);
      setLoading(true);
      load();
    } catch (e: any) {
      setActionError(e.message ?? 'Failed to reopen RFQ.');
    } finally {
      setWorking(false);
    }
  };

  const handleViewPR2 = async () => {
    if (!profile || !existingPR2Id) return;
    router.push(`/pr2/${existingPR2Id}`);
  };



  const rfqApprovalApproved = rfqApproval?.status === 'approved';
  const rfqApprovalPending = rfqApproval?.status === 'active';

  const handleCopyForViber = (supplierAssignmentId?: string) => {
    if (!detail) return;
    const text = formatRfqForViber(detail.rfq, detail.pr1, detail.items, supplierAssignmentId);
    navigator.clipboard.writeText(text)
      .then(() => toast.success('RFQ summary copied for Viber!'))
      .catch(() => toast.error('Failed to copy to clipboard.'));
  };

  const handleSendEmail = async (supplierAssignmentId?: string) => {
    if (!detail) return;
    setWorking(true);
    try {
      const targets = supplierAssignmentId 
        ? detail.suppliers.filter(s => s.id === supplierAssignmentId)
        : detail.suppliers;
      
      // External vendors have no supplier account / email — exclude them.
      const supplierUserIds = targets
        .map(s => s.supplier_id)
        .filter((id): id is string => !!id);
      const { data: profiles } = await db
        .from('profiles')
        .select('id, email')
        .in('id', supplierUserIds);

      const emailMap = Object.fromEntries(
        ((profiles ?? []) as { id: string; email: string | null }[]).map(p => [p.id, p.email])
      );
      const emailTargets = targets
        .filter(s => s.supplier_id && emailMap[s.supplier_id])
        .map(s => ({
          email: emailMap[s.supplier_id as string],
          actionUrl: `/supplier/quotations/${s.id}`
        }));

      if (emailTargets.length === 0) {
        toast.error('No email addresses found for selected supplier(s).');
        return;
      }

      const res = await authFetch('/api/rfq/send-email', {
        method: 'POST',
        body: JSON.stringify({
          rfqId: detail.rfq.id,
          rfqNumber: detail.rfq.rfq_number,
          department: detail.pr1.department_name_snapshot,
          purpose: detail.pr1.purpose,
          deadline: detail.rfq.deadline,
          supplierEmails: emailTargets.map(t => t.email),
          actionUrls: emailTargets.map(t => t.actionUrl),
        }),
      });

      const contentType = res.headers.get('content-type');
      if (!res.ok) {
        if (contentType && contentType.includes('application/json')) {
          const data = await res.json();
          const firstError = data.results?.find((r: any) => r.error)?.error?.message || data.error;
          throw new Error(firstError || 'Failed to send email.');
        } else {
          // It's likely an HTML error page from the server
          const htmlError = await res.text();
          console.error('Server HTML Error:', htmlError);
          throw new Error(`Server Error (${res.status}): Please check your terminal logs.`);
        }
      }

      toast.success(supplierAssignmentId ? 'Email sent to supplier!' : 'Emails sent to all suppliers!');
    } catch (e: any) {
      toast.error(e.message || 'Failed to send email.');
    } finally {
      setWorking(false);
    }
  };




  const handleSelectWinner = async (pr1ItemId: string, rfqSupplierId: string) => {
    if (!profile || isClosed) return;
    setActionError('');
    try {
      const matrixRow = matrix.find(r => r.item.id === pr1ItemId);
      if (matrixRow?.selected_rfq_supplier_id === rfqSupplierId) {
        await clearItemSelection(rfq.id, pr1ItemId, profile);
        setLoading(true);
        load();
        return;
      }

      const result = await saveItemSelection(rfq.id, pr1ItemId, rfqSupplierId, '', profile);
      if (result.ok) {
        setLoading(true);
        load();
        return;
      }
      // Phase 7 (Raw Mats): unverified/manual quote on a raw-mats line —
      // open the justification modal. The same call is replayed once the
      // modal submits with a valid justification.
      const supplier = matrixRow?.quotes.find(q => q.rfq_supplier_id === rfqSupplierId);
      setJustificationCtx({
        ...result.context,
        itemDescription: matrixRow?.item.description ?? '',
        supplierName:    supplier?.supplier_name ?? '',
      });
    } catch (e: any) {
      setActionError(e.message ?? 'Failed to save selection.');
    }
  };

  // Phase 7 (Raw Mats): re-invoke selection with the typed justification.
  const handleJustificationSubmit = async (justification: string) => {
    if (!profile || !justificationCtx) return;
    setActionError('');
    setJustificationBusy(true);
    try {
      const result = await saveItemSelection(
        justificationCtx.rfqId,
        justificationCtx.pr1ItemId,
        justificationCtx.rfqSupplierId,
        '',
        profile,
        justification,
      );
      if (!result.ok) {
        // Modal-side validation should already prevent this branch, but be
        // explicit so we never silently swallow a second-call rejection.
        setActionError(
          'Justification was rejected by the server. Please write a longer reason.',
        );
        return;
      }
      setJustificationCtx(null);
      setLoading(true);
      load();
    } catch (e: any) {
      setActionError(e.message ?? 'Failed to save selection.');
    } finally {
      setJustificationBusy(false);
    }
  };

  const handleJustificationCancel = () => {
    if (justificationBusy) return;
    setJustificationCtx(null);
  };

  return (
    <AppShell title="RFQ Detail">
      <DetailBackButton className="mb-2" onClick={() => handleBack({ role: profile?.role })} />

      {/* Header */}
      <DetailHeaderLayout
        left={
          <div>
            <DetailTitleRow mb>
              <h1 className="text-2xl font-bold text-pq-neutral-900 font-mono">{rfq.rfq_number}</h1>
              <span className={`inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-1 ${STATUS_BADGE[rfq.status]}`}>
                {STATUS_LABEL[rfq.status]}
              </span>
              <RequestTypeBadge type={pr1.request_type ?? 'goods'} />
            </DetailTitleRow>
            <p className="text-sm text-pq-neutral-500">
              {isPr2Native ? 'PR2' : 'PR1'} <span className="font-semibold text-pq-neutral-900">{pr1.pr1_number}</span>
              {' '}· {pr1.department_name_snapshot} · {pr1.purpose}
            </p>
            {isClosed && existingPR2Id && (
              <p className="text-xs text-pq-neutral-400 italic mt-1">
                {followsApprovalFlow
                  ? rfqApprovalApproved
                    ? 'RFQ approved — procurement may create PO from the linked PR2.'
                    : rfqApprovalPending
                      ? 'RFQ closed — pending Director approval.'
                      : isPr2Native
                        ? 'Linked PR2 was created directly by Planning.'
                        : 'Linked PR2 was created at warehouse validation.'
                  : 'A PR2 has already been generated from this RFQ — it can no longer be reopened.'}
              </p>
            )}
          </div>
        }
        right={
          <div className="flex items-center gap-2 shrink-0">
            {isClosed && existingPR2Id && (
              <ActionButton
                icon={ClipboardList}
                label="View PR2"
                color="emerald"
                onClick={handleViewPR2}
                disabled={working}
              />
            )}

            {isClosed && !followsApprovalFlow && !existingPR2Id && (
              <ActionButton
                icon={RotateCcw}
                label="Reopen RFQ"
                color="amber"
                onClick={handleReopen}
                disabled={working}
              />
            )}
            {isClosed && followsApprovalFlow && !rfqApprovalApproved && (
              <ActionButton
                icon={RotateCcw}
                label="Reopen RFQ"
                color="amber"
                onClick={handleReopen}
                disabled={working}
              />
            )}
            {isDraft && suppliers.length >= 2 && (
              <ActionButton
                icon={Send}
                label="Issue RFQ"
                color="blue"
                onClick={handleIssue}
                disabled={working}
              />
            )}
            {isOpen && allItemsSelected && (
              <ActionButton
                icon={CheckCheck}
                label={followsApprovalFlow ? 'Close & Submit for Approval' : 'Close & Finalise'}
                color="emerald"
                onClick={handleClose}
                disabled={working}
              />
            )}
            {(isDraft || isOpen) && (
              <ActionButton
                icon={Mail}
                label="Send Email"
                color="slate"
                onClick={() => handleSendEmail()}
                disabled={working}
              />
            )}
            {(isDraft || isOpen) && (
              <ActionButton
                icon={MessageSquare}
                label="Copy for Viber"
                color="slate"
                onClick={() => handleCopyForViber()}
                disabled={working}
              />
            )}
            {(isDraft || isOpen) && (
              <ActionButton
                icon={UserPlus}
                label="Canvass Supplier"
                color="slate"
                onClick={openAssignModal}
                disabled={working || availableSuppliers.length === 0}
              />
            )}

          </div>
        }
      />

      {actionError && (
        <div className="flex items-center gap-2 bg-pq-danger-100 border border-pq-danger-100 text-pq-danger-600 text-sm rounded-md px-4 py-3 mb-4">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {actionError}
        </div>
      )}

      {/* Related Records */}
      {profile && (
        <div className="mb-4">
          <RelatedRecords baseType="RFQ" baseId={rfq.id} role={profile.role} currentDocType="RFQ" />
        </div>
      )}

      {/* Guidance banners */}
      {isDraft && suppliers.length < 2 && (
        <div className="flex items-start gap-3 bg-pq-warning-100 border border-pq-warning-100 rounded-md px-5 py-4 mb-6">
          <AlertTriangle className="w-4 h-4 text-pq-warning-600 mt-0.5 shrink-0" />
          <p className="text-sm text-pq-warning-600">Assign at least 2 suppliers before you can issue this RFQ.</p>
        </div>
      )}
      {isDraft && suppliers.length >= 2 && (
        <div className="flex items-start gap-3 bg-pq-primary-50 border border-pq-primary-200 rounded-md px-5 py-4 mb-6">
          <CircleDot className="w-4 h-4 text-pq-primary-600 mt-0.5 shrink-0" />
          <p className="text-sm text-pq-primary-600">Ready to issue. Click &ldquo;Issue RFQ&rdquo; to open it to suppliers.</p>
        </div>
      )}
      {isOpen && !allItemsSelected && submittedSuppliers > 0 && (
        <div className="flex items-start gap-3 bg-pq-warning-100 border border-pq-warning-100 rounded-md px-5 py-4 mb-6">
          <AlertTriangle className="w-4 h-4 text-pq-warning-600 mt-0.5 shrink-0" />
          <p className="text-sm text-pq-warning-600">Select a winning supplier for each item below, then close the RFQ.</p>
        </div>
      )}
      {isOpen && pendingSubstitutes > 0 && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-md px-5 py-4 mb-6">
          <Replace className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-orange-800">
              {pendingSubstitutes} substitute quote{pendingSubstitutes !== 1 ? 's' : ''} awaiting requestor decision
            </p>
            <p className="text-xs text-orange-700 mt-0.5">
              Supplier(s) proposed alternatives. You cannot select these as winners until the requestor accepts them.
            </p>
          </div>
        </div>
      )}
      {isClosed && (
        <div className="flex items-start gap-3 bg-pq-success-100 border border-pq-success-100 rounded-md px-5 py-4 mb-6">
          <CheckCircle2 className="w-4 h-4 text-pq-success-600 mt-0.5 shrink-0" />
          <p className="text-sm text-pq-success-600">Canvassing complete. Winning suppliers have been selected for all items.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: PR1 summary + suppliers */}
        <div className="space-y-4">
          {/* PR1 info card */}
          <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-3">
            <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">{isPr2Native ? 'PR2 Details' : 'PR1 Details'}</h2>
            <DetailInfoField
              icon={<FileText className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label={isPr2Native ? 'PR2 Number' : 'PR1 Number'}
              value={pr1.pr1_number}
              labelTone="muted"
              labelSpacing="compact"
              valueClassName="font-mono font-semibold"
            />
            <DetailInfoField
              icon={<Building2 className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Department"
              value={pr1.department_name_snapshot}
              labelTone="muted"
              labelSpacing="compact"
            />
            <DetailInfoField
              icon={<FileText className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Purpose"
              value={pr1.purpose}
              labelTone="muted"
              labelSpacing="compact"
            />
            {rfq.deadline && (
              <DetailInfoField
                icon={<CalendarDays className="w-3.5 h-3.5 text-pq-neutral-400" />}
                label="RFQ Deadline"
                value={format(new Date(rfq.deadline), 'MMM d, yyyy')}
                labelTone="muted"
                labelSpacing="compact"
              />
            )}
            {rfq.notes && (
              <div>
                <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-pq-neutral-900">{rfq.notes}</p>
              </div>
            )}
          </div>

          {/* Items list */}
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-pq-neutral-200">
              <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">Items ({items.length})</h2>
            </div>
            <div className="divide-y divide-pq-neutral-200">
              {items.map(item => (
                <div key={item.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-baseline gap-2 min-w-0 flex-1">
                      <span className="text-xs text-pq-neutral-400 w-4 shrink-0">{item.item_order}.</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-pq-neutral-900">{item.description}</p>
                          <RawMaterialBadge isRawMaterial={item.is_raw_material} size="sm" />
                        </div>
                        <p className="text-xs text-pq-neutral-400 mt-0.5">
                          {item.item_code && <span className="font-mono">{item.item_code} · </span>}
                          {item.quantity_requested} {item.unit_of_measure}
                        </p>
                        {item.remarks && (
                          <RequestorRemarks text={item.remarks} />
                        )}
                      </div>
                    </div>
                    {item.attachments && item.attachments.length > 0 && (
                      <div className="shrink-0">
                        <PR1AttachmentsGallery attachments={item.attachments} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Suppliers */}
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-pq-neutral-200">
              <Users className="w-4 h-4 text-pq-neutral-400" />
              <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">Suppliers ({suppliers.length})</h2>
            </div>
            {suppliers.length === 0 ? (
              <p className="text-xs text-pq-neutral-400 px-5 py-4">No suppliers assigned yet.</p>
            ) : (
              <div className="divide-y divide-pq-neutral-200 max-h-[400px] overflow-y-auto">
                {suppliers.map(s => (
                  <div key={s.id} className="px-5 py-3 flex items-center justify-between hover:bg-pq-neutral-50 group transition">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium text-pq-neutral-900">{s.supplier_name_snapshot}</p>
                        {s.is_external && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                            <Store className="w-2.5 h-2.5 shrink-0" />
                            External
                          </span>
                        )}
                      </div>
                      <span className={`inline-block mt-1 text-[10px] font-medium border rounded-full px-2 py-0.5 ${SUPPLIER_STATUS_COLOR[s.status]}`}>
                        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                      </span>
                    </div>
                    {/* External vendors have no email/portal — Procurement enters the quote directly. */}
                    {s.is_external ? (
                      rfq.status === 'draft' && (
                        <button
                          onClick={() => handleRemoveExternalVendor(s.id)}
                          disabled={working}
                          className="p-2 text-pq-neutral-400 hover:text-pq-danger-600 hover:bg-pq-danger-50 rounded-full transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Remove external vendor"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleSendEmail(s.id)}
                          className="p-2 text-pq-neutral-400 hover:text-pq-primary-600 hover:bg-pq-neutral-200 rounded-full transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Resend email to this supplier"
                          disabled={working}
                        >
                          <Mail className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCopyForViber(s.id)}
                          className="p-2 text-pq-neutral-400 hover:text-pq-primary-600 hover:bg-pq-neutral-200 rounded-full transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Copy personal link for Viber"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>


                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: quotation comparison matrix */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-pq-neutral-200 flex-wrap">
              <Trophy className="w-4 h-4 text-pq-neutral-400" />
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-pq-neutral-900">Quotation Comparison</h2>
                <p className="text-[10px] text-pq-neutral-400 mt-0.5">
                  Verified catalog product on the quote line = Can Award (after substitute approval if applicable). Pending / missing link = not awardable.
                </p>
              </div>
              <span className="text-xs text-pq-neutral-400 ml-auto shrink-0">
                {submittedSuppliers}/{suppliers.length} suppliers responded
              </span>
            </div>

            {suppliers.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-pq-neutral-400">Assign suppliers to begin collecting quotations.</p>
              </div>
            ) : matrix.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-pq-neutral-400">No items found for this PR1.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-sm w-max min-w-full table-fixed">
                  <colgroup>
                    <col className="w-[200px]" />
                    {suppliers.map(s => (
                      <col key={s.id} className="w-[220px]" />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="bg-pq-neutral-50 border-b border-pq-neutral-200">
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-pq-neutral-500">Item</th>
                      {suppliers.map(s => (
                        <th key={s.id} className="text-left px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 border-l border-pq-neutral-200">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{s.supplier_name_snapshot}</span>
                            {s.is_external && (
                              <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5">
                                <Store className="w-2.5 h-2.5" />
                                Ext
                              </span>
                            )}
                            <span className={`shrink-0 text-xs border rounded-full px-1.5 py-0.5 ${SUPPLIER_STATUS_COLOR[s.status]}`}>
                              {s.status === 'submitted' ? '✓' : '…'}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pq-neutral-200">
                    {matrix.map(row => (
                      <MatrixRow
                        key={row.item.id}
                        row={row}
                        suppliers={suppliers}
                        canSelect={isOpen && !isClosed}
                        canViewPrices={canViewPrices}
                        requestType={pr1.request_type ?? 'goods'}
                        onSelect={handleSelectWinner}
                        onEnterExternalQuote={openExternalQuoteModal}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <AssignSuppliersModal
        open={assigning}
        working={working}
        actionError={actionError}
        hasRegisteredSuppliers={allSuppliers.length > 0}
        allAlreadyAssigned={availableSuppliers.length === 0 && allSuppliers.length > 0}
        filteredCount={supplierTotalCount}
        paginatedSuppliers={paginatedAvailableSuppliers}
        filters={supplierModalFilters}
        onApplyFilters={handleSupplierFilterApply}
        onClearFilters={handleSupplierFilterClear}
        supplierPage={supplierPage}
        supplierTotalPages={supplierTotalPages}
        supplierRowsPerPage={supplierRowsPerPage}
        selectedIds={selectedIds}
        onToggleSupplier={(id, selected) => {
          const next = new Set(selectedIds);
          selected ? next.add(id) : next.delete(id);
          setSelectedIds(next);
        }}
        onPageChange={setSupplierPage}
        onClose={closeAssignModal}
        onAssign={handleAssign}
        onAddExternalVendor={handleAddExternalVendor}
      />

      {/* Phase 7 (Raw Mats): justification capture for awarding an
          unverified or manual-entry quote on a raw-mats line. */}
      <JustificationModal
        open={justificationCtx !== null}
        context={justificationCtx}
        busy={justificationBusy}
        onSubmit={handleJustificationSubmit}
        onCancel={handleJustificationCancel}
      />

      {/* External vendor — Procurement-entered quote */}
      {extQuote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full max-w-md rounded-md border border-pq-neutral-200 shadow-lg overflow-hidden">
            <header className="px-5 py-4 border-b border-pq-neutral-200 flex items-center gap-2">
              <Store className="w-4 h-4 text-amber-600 shrink-0" />
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-pq-neutral-900">External vendor quote</h2>
                <p className="text-xs text-pq-neutral-500 truncate">{extQuote.itemDescription}</p>
              </div>
            </header>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-pq-neutral-600 mb-1">Quoted description / specification</label>
                <input
                  type="text"
                  value={extQuote.quotedDescription}
                  onChange={e => setExtQuote(prev => prev && { ...prev, quotedDescription: e.target.value })}
                  disabled={extQuoteBusy}
                  className="w-full h-9 rounded-md border border-pq-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-pq-primary-600/30"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-pq-neutral-600 mb-1">Unit price</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={extQuote.unitPrice}
                    onChange={e => setExtQuote(prev => prev && { ...prev, unitPrice: e.target.value })}
                    disabled={extQuoteBusy}
                    className="w-full h-9 rounded-md border border-pq-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-pq-primary-600/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-pq-neutral-600 mb-1">Lead time (days)</label>
                  <input
                    type="number" min="0" step="1"
                    value={extQuote.leadTimeDays}
                    onChange={e => setExtQuote(prev => prev && { ...prev, leadTimeDays: e.target.value })}
                    disabled={extQuoteBusy}
                    className="w-full h-9 rounded-md border border-pq-neutral-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-pq-primary-600/30"
                  />
                </div>
              </div>
              {extQuote.isVatRegistered && (
                <div>
                  <label className="block text-xs font-semibold text-pq-neutral-600 mb-1">VAT Type</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setExtQuote(prev => prev && { ...prev, vatType: 'vat_inclusive' })}
                      disabled={extQuoteBusy}
                      className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
                        extQuote.vatType === 'vat_inclusive'
                          ? 'bg-pq-primary-50 text-pq-primary-700 border-pq-primary-200'
                          : 'bg-white text-pq-neutral-500 border-pq-neutral-200 hover:border-pq-neutral-300'
                      }`}
                    >
                      VAT-Inclusive
                    </button>
                    <button
                      type="button"
                      onClick={() => setExtQuote(prev => prev && { ...prev, vatType: 'vat_exclusive' })}
                      disabled={extQuoteBusy}
                      className={`flex-1 px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
                        extQuote.vatType === 'vat_exclusive'
                          ? 'bg-pq-primary-50 text-pq-primary-700 border-pq-primary-200'
                          : 'bg-white text-pq-neutral-500 border-pq-neutral-200 hover:border-pq-neutral-300'
                      }`}
                    >
                      VAT-Exclusive
                    </button>
                  </div>
                </div>
              )}
              {/* Notes / Remarks */}
              <div>
                <label className="block text-xs font-semibold text-pq-neutral-600 mb-1">
                  Notes / Remarks <span className="font-normal text-pq-neutral-400">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={extQuote.remarks}
                  onChange={e => setExtQuote(prev => prev && { ...prev, remarks: e.target.value })}
                  disabled={extQuoteBusy}
                  placeholder="Delivery terms, brand, warranty, etc."
                  className="w-full rounded-md border border-pq-neutral-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pq-primary-600/30 resize-none"
                />
              </div>
              {/* File attachments */}
              <div>
                <label className="block text-xs font-semibold text-pq-neutral-600 mb-1">
                  <span className="inline-flex items-center gap-1">
                    <Paperclip className="w-3.5 h-3.5" />
                    Attachments
                    <span className="font-normal text-pq-neutral-400">
                      (JPEG, PNG, PDF, max 10 MB · {Math.max(0, 3 - extQuote.existingAttachments.length - extQuote.pendingFiles.length)} of 3 slots remaining)
                    </span>
                  </span>
                </label>
                {/* Already-saved attachments */}
                {extQuote.existingAttachments.length > 0 && (
                  <ul className="mb-2 space-y-1">
                    {extQuote.existingAttachments.map(att => (
                      <li key={att.id} className="flex items-center justify-between text-xs text-pq-neutral-700 bg-pq-neutral-50 border border-pq-neutral-200 rounded px-2 py-1">
                        <span className="truncate mr-2">{att.file_name}</span>
                        <button
                          type="button"
                          disabled={extQuoteBusy}
                          onClick={async () => {
                            try {
                              await deleteRfqQuoteAttachment(att.id, att.storage_path, profile?.id);
                              setExtQuote(prev => prev && {
                                ...prev,
                                existingAttachments: prev.existingAttachments.filter(a => a.id !== att.id),
                              });
                            } catch (e: any) {
                              setExtQuoteError(e.message ?? 'Failed to remove attachment.');
                            }
                          }}
                          className="shrink-0 text-pq-neutral-400 hover:text-pq-danger-600 transition disabled:opacity-40"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {/* New files not yet uploaded */}
                {extQuote.pendingFiles.length > 0 && (
                  <ul className="mb-2 space-y-1">
                    {extQuote.pendingFiles.map((f, i) => (
                      <li key={i} className="flex items-center justify-between text-xs text-pq-neutral-700 bg-pq-primary-50 border border-pq-primary-200 rounded px-2 py-1">
                        <span className="truncate mr-2">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => setExtQuote(prev => prev && { ...prev, pendingFiles: prev.pendingFiles.filter((_, j) => j !== i) })}
                          className="shrink-0 text-pq-neutral-400 hover:text-pq-danger-600 transition"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {extQuote.existingAttachments.length + extQuote.pendingFiles.length < 3 && (
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    disabled={extQuoteBusy}
                    onChange={e => {
                      const incoming = Array.from(e.target.files ?? []);
                      setExtQuote(prev => {
                        if (!prev) return prev;
                        const slots = 3 - prev.existingAttachments.length - prev.pendingFiles.length;
                        const combined = [...prev.pendingFiles, ...incoming].slice(0, slots);
                        return { ...prev, pendingFiles: combined };
                      });
                      e.currentTarget.value = '';
                    }}
                    className="block w-full text-sm text-pq-neutral-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-pq-neutral-100 file:text-pq-neutral-700 hover:file:bg-pq-neutral-200 cursor-pointer"
                  />
                )}
              </div>
              {extQuoteError && <p className="text-xs text-pq-danger-600">{extQuoteError}</p>}
            </div>
            <footer className="px-5 py-3 border-t border-pq-neutral-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExtQuote(null)}
                disabled={extQuoteBusy}
                className="px-4 py-2 text-sm text-pq-neutral-500 hover:text-pq-neutral-900 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveExternalQuote}
                disabled={extQuoteBusy}
                className="px-4 py-2 text-sm font-semibold bg-pq-primary-600 hover:bg-pq-neutral-900 text-white rounded-md transition disabled:opacity-50 flex items-center gap-2"
              >
                {extQuoteBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                Save quote
              </button>
            </footer>
          </div>
        </div>
      )}


    </AppShell>
  );
}

function matchesAccreditationFilter(
  c: CanvassSupplierCandidate,
  filter: string,
): boolean {
  if (filter === 'all') return true;
  const st = c.accreditation_status;
  switch (filter) {
    case 'accredited':
      return st === 'approved';
    case 'pending':
      return (
        st === 'submitted' ||
        st === 'under_review' ||
        st === 'draft' ||
        st === 'missing_documents'
      );
    case 'rejected':
      return st === 'rejected';
    case 'withdrawn':
      return st === 'withdrawn';
    case 'none':
      return !st;
    default:
      return true;
  }
}

// ─── Matrix row ───────────────────────────────────────────────────────────────

function MatrixRow({
  row,
  suppliers,
  canSelect,
  canViewPrices,
  requestType,
  onSelect,
  onEnterExternalQuote,
}: {
  row: QuoteMatrixRow;
  suppliers: { id: string; supplier_name_snapshot: string; status: string; is_external?: boolean }[];
  canSelect: boolean;
  canViewPrices: boolean;
  requestType: 'goods' | 'services' | 'raw_material';
  onSelect: (pr1ItemId: string, rfqSupplierId: string) => void;
  onEnterExternalQuote: (args: {
    pr1ItemId: string;
    rfqSupplierId: string;
    itemDescription: string;
    existing: { unit_price: number; quoted_description: string; lead_time_days: number; remarks?: string | null; attachments?: RfqQuoteAttachment[]; vat_type?: 'vat_inclusive' | 'vat_exclusive' | null } | null;
  }) => void;
}) {
  // Catalog products are only ever categorized 'goods' | 'services' — raw
  // material requests are catalogued as 'goods', so compare against that.
  const catalogRequestType = requestType === 'raw_material' ? 'goods' : requestType;
  return (
    <tr className="hover:bg-pq-neutral-50 transition">
      <td className="px-3 py-2.5 align-top">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-pq-neutral-900 text-xs leading-snug">{row.item.description}</p>
              <RawMaterialBadge isRawMaterial={row.item.is_raw_material} size="sm" />
            </div>
            <p className="text-xs text-pq-neutral-400 mt-0.5">
              {row.item.quantity_requested} {row.item.unit_of_measure}
            </p>
            {row.item.remarks && (
              <RequestorRemarks text={row.item.remarks} />
            )}
          </div>
          {row.item.attachments && row.item.attachments.length > 0 && (
            <div className="shrink-0 mt-0.5">
              <PR1AttachmentsGallery attachments={row.item.attachments} />
            </div>
          )}
        </div>
      </td>
      {suppliers.map(supplier => {
        const quote      = row.quotes.find(q => q.rfq_supplier_id === supplier.id);
        const isSelected = row.selected_rfq_supplier_id === supplier.id;

        const explicitNoQuote = quote?.response_status === 'no_quote';

        // Phase 7: catalog product state
        const hasProduct    = !!quote?.supplier_product_id;
        const isVerified    = quote?.supplier_product_status === 'verified';
        const isWithdrawn   = quote?.supplier_product_status === 'withdrawn';

        // Phase 6 (Raw Mats): verification pill metadata for the comparison cell.
        // Pill is emphasised on raw-mats rows; quietly informational elsewhere.
        const verification = quote?.verification_status;
        const isRawMats    = row.item.is_raw_material === true;

        return (
          <td
            key={supplier.id}
            className={`px-3 py-2.5 align-top border-l border-pq-neutral-200 ${isSelected ? 'bg-pq-success-100' : ''}`}
          >
            {!quote?.quote_id ? (
              supplier.is_external && canSelect ? (
                <button
                  type="button"
                  onClick={() => onEnterExternalQuote({
                    pr1ItemId: row.item.id,
                    rfqSupplierId: supplier.id,
                    itemDescription: row.item.description,
                    existing: null,
                  })}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 hover:bg-amber-100 transition"
                >
                  <Store className="w-3 h-3" />
                  Enter quote
                </button>
              ) : (
                <p className="text-xs text-pq-neutral-400 italic">No quote</p>
              )
            ) : explicitNoQuote ? (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-rose-700">No Quote</p>
                <p className="text-xs text-pq-neutral-500 leading-snug">
                  {quote.no_quote_reason?.trim() || '—'}
                </p>
                {canSelect && (
                  <p className="text-xs font-semibold text-pq-warning-600">
                    Can Award: No
                  </p>
                )}
              </div>
            ) : quote.unit_price === 0 ? (
              <p className="text-xs text-pq-neutral-400 italic">No quote</p>
            ) : (
              <div className="space-y-1.5">
                {(() => {
                  const productName = quote.supplier_product_name?.trim() ?? '';
                  const quotedDesc  = quote.quoted_description?.trim() ?? '';
                  const showQuotedDesc =
                    quotedDesc.length > 0 &&
                    quotedDesc.toLowerCase() !== productName.toLowerCase();

                  return (
                    <>
                      <div className="flex flex-wrap items-center gap-1">
                        {hasProduct && isVerified ? (
                          <span
                            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded px-1.5 py-0.5"
                            title="Supplier linked a verified catalog product."
                          >
                            <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate max-w-[140px]">
                              {productName || 'Verified product'}
                            </span>
                            {quote.supplier_product_code && (
                              <span className="font-mono text-pq-success-700/80">
                                {quote.supplier_product_code}
                              </span>
                            )}
                          </span>
                        ) : hasProduct && !isVerified ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-pq-warning-700 bg-pq-warning-100 border border-pq-warning-200 rounded px-1.5 py-0.5">
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate max-w-[120px]">
                              {productName || 'Proposed product'}
                            </span>
                            {isWithdrawn ? (
                              <span>· Withdrawn</span>
                            ) : (
                              <span className="capitalize">
                                · {(quote.supplier_product_status ?? 'pending').replace(/_/g, ' ')}
                              </span>
                            )}
                          </span>
                        ) : verification === 'manual' ? (
                          <span
                            className={`inline-flex items-center gap-0.5 text-[10px] font-semibold border rounded px-1.5 py-0.5 ${
                              isRawMats
                                ? 'bg-pq-warning-100 text-pq-warning-700 border-pq-warning-200'
                                : 'bg-pq-neutral-50 text-pq-neutral-600 border-pq-neutral-200'
                            }`}
                          >
                            <Info className="w-2.5 h-2.5 shrink-0" />
                            Manual entry
                          </span>
                        ) : verification === 'unverified' ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-pq-neutral-50 text-pq-neutral-600 border border-pq-neutral-200 rounded px-1.5 py-0.5">
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                            Unverified product
                          </span>
                        ) : null}

                        {quote.is_alternative && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
                            Alt.
                          </span>
                        )}
                        {quote.is_alternative && quote.substitute_decision === 'accepted' && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded px-1.5 py-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Accepted
                          </span>
                        )}
                        {quote.is_alternative && quote.substitute_decision === 'rejected' && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5">
                            <XCircle className="w-2.5 h-2.5" /> Rejected
                          </span>
                        )}
                        {quote.is_alternative && quote.substitute_decision === null && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-pq-warning-600 bg-pq-warning-100 border border-pq-warning-100 rounded px-1.5 py-0.5">
                            <Clock className="w-2.5 h-2.5" /> Pending
                          </span>
                        )}
                      </div>

                      {hasProduct && !isVerified && !isWithdrawn && quote.supplier_product_id && (
                        <Link
                          href={`/accreditation/products/${quote.supplier_product_id}`}
                          className="inline-block text-[10px] text-pq-warning-700 underline font-medium hover:text-pq-neutral-900 transition"
                        >
                          Review product →
                        </Link>
                      )}

                      {quote.supplier_product_item_type !== null &&
                        quote.supplier_product_item_type !== catalogRequestType && (
                          <p className="text-[10px] font-semibold text-pq-warning-700 flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                            Type mismatch — supplier offered{' '}
                            <span className={`mx-0.5 rounded px-1 py-px ${
                              quote.supplier_product_item_type === 'services'
                                ? 'bg-purple-50 text-purple-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}>
                              {quote.supplier_product_item_type === 'services' ? 'Services' : 'Goods'}
                            </span>
                            for a{' '}
                            <span className={`mx-0.5 rounded px-1 py-px ${
                              catalogRequestType === 'services'
                                ? 'bg-purple-50 text-purple-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}>
                              {catalogRequestType === 'services' ? 'Services' : 'Goods'}
                            </span>
                            request
                          </p>
                        )}

                      {showQuotedDesc && (
                        <p className="text-xs text-pq-neutral-500 leading-snug">{quotedDesc}</p>
                      )}
                    </>
                  );
                })()}

                <div className="text-xs text-pq-neutral-500 leading-snug">
                  <p
                    className={`font-bold text-sm ${
                      quote.substitute_decision === 'rejected'
                        ? 'text-pq-neutral-400 line-through'
                        : 'text-pq-neutral-900'
                    }`}
                  >
                    {formatCommercialAmount(quote.unit_price, canViewPrices)}
                    {canViewPrices && (
                      <span className="text-xs font-normal text-pq-neutral-400">
                        {' '}/ {row.item.unit_of_measure}
                      </span>
                    )}
                  </p>
                  <p>
                    Total {formatCommercialAmount(quote.total_price, canViewPrices)}
                    {' · '}Lead {quote.lead_time_days}d
                  </p>
                </div>
                {quote.remarks && (
                  <p className="text-xs text-pq-neutral-400 italic leading-snug">&ldquo;{quote.remarks}&rdquo;</p>
                )}

                {quote.attachments && quote.attachments.length > 0 && (
                  <QuoteAttachmentPills attachments={quote.attachments} />
                )}

                {/* Phase 7 (Raw Mats): Can Award indicator
                    - "Yes" when verified or non-raw-mats unverified/manual.
                    - "Yes (with justification)" for raw-mats unverified/manual.
                    - "No" only when withdrawn or alternative-not-accepted. */}
                {canSelect && (() => {
                  const altBlocked     = quote.is_alternative && quote.substitute_decision !== 'accepted';
                  const awardBlocked   = altBlocked || isWithdrawn;
                  const needsJust      = !awardBlocked && isRawMats &&
                    (verification === 'unverified' || verification === 'manual');
                  const tone = awardBlocked
                    ? 'text-pq-warning-600'
                    : needsJust
                      ? 'text-pq-warning-700'
                      : 'text-pq-success-600';
                  const label = awardBlocked
                    ? 'No'
                    : needsJust
                      ? 'Yes (with justification)'
                      : 'Yes';
                  return (
                    <p className={`text-xs font-semibold ${tone}`}>
                      Can Award: {label}
                    </p>
                  );
                })()}

                {/* Select button — Phase 7 (Raw Mats):
                    - Withdrawn product → blocked.
                    - Alternative not accepted → blocked.
                    - Raw-mats + unverified/manual → clickable; the parent
                      handler opens the justification modal.
                    - Everything else → clickable, awarded directly. */}
                {canSelect && (() => {
                  const altBlocked   = quote.is_alternative && quote.substitute_decision !== 'accepted';
                  const awardBlocked = altBlocked || isWithdrawn;
                  const needsJust    = !awardBlocked && isRawMats &&
                    (verification === 'unverified' || verification === 'manual');

                  const tooltip = altBlocked
                    ? (quote.substitute_decision === null
                        ? 'Requestor has not yet decided on this substitute.'
                        : 'Requestor rejected this substitute.')
                    : isWithdrawn
                      ? 'Supplier withdrew this catalog product. Cannot award.'
                      : needsJust
                        ? 'Raw material line — awarding will require a written justification.'
                        : '';

                  return (
                    <button
                      type="button"
                      onClick={() => (isSelected || !awardBlocked) && onSelect(row.item.id, supplier.id)}
                      disabled={!isSelected && awardBlocked}
                      title={isSelected ? 'Click to clear this selection' : tooltip}
                      className={`mt-2 w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-md border shadow-sm transition ${
                        isSelected
                          ? 'bg-pq-success-600 text-white border-pq-success-600 hover:bg-pq-success-700 hover:border-pq-success-700'
                          : awardBlocked
                            ? 'bg-pq-neutral-50 text-pq-neutral-400 border-pq-neutral-200 cursor-not-allowed shadow-none'
                            : needsJust
                              ? 'bg-amber-50 text-amber-800 border-amber-400 hover:bg-amber-500 hover:text-white hover:border-amber-500'
                              : 'bg-white text-pq-success-700 border-pq-success-600 hover:bg-pq-success-600 hover:text-white hover:border-pq-success-600'
                      }`}
                    >
                      {isSelected ? (
                        <><CheckCircle2 className="w-3 h-3" /> Selected</>
                      ) : altBlocked && quote.substitute_decision === null ? (
                        <><Clock className="w-3 h-3" /> Awaiting decision</>
                      ) : altBlocked && quote.substitute_decision === 'rejected' ? (
                        <><XCircle className="w-3 h-3" /> Rejected</>
                      ) : isWithdrawn ? (
                        <><AlertTriangle className="w-3 h-3" /> Withdrawn</>
                      ) : needsJust ? (
                        <><AlertTriangle className="w-3 h-3" /> Award (justify)</>
                      ) : (
                        <><Trophy className="w-3 h-3" /> Select</>
                      )}
                    </button>
                  );
                })()}
                {!canSelect && isSelected && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-pq-success-600 bg-pq-success-100 rounded-md px-2 py-1">
                    <CheckCircle2 className="w-3 h-3" /> Winner
                  </span>
                )}
                {/* External vendor — Procurement may revise the quote it entered.
                    Editing a selected line re-evaluates via the unselect trigger. */}
                {supplier.is_external && canSelect && (
                  <button
                    type="button"
                    onClick={() => onEnterExternalQuote({
                      pr1ItemId: row.item.id,
                      rfqSupplierId: supplier.id,
                      itemDescription: row.item.description,
                      existing: {
                        unit_price: quote.unit_price,
                        quoted_description: quote.quoted_description,
                        lead_time_days: quote.lead_time_days,
                        remarks: quote.remarks ?? null,
                        attachments: quote.attachments ?? [],
                        vat_type: quote.vat_type ?? null,
                      },
                    })}
                    className="mt-1 ml-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:text-amber-900 underline transition"
                  >
                    <Store className="w-3 h-3" /> Edit quote
                  </button>
                )}
              </div>
            )}
          </td>
        );
      })}
    </tr>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function ActionButton({
  icon: Icon,
  label,
  color,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  color: 'blue' | 'emerald' | 'slate' | 'amber';
  onClick: () => void;
  disabled?: boolean;
}) {
  const cls = {
    blue:    'bg-pq-primary-600 hover:bg-pq-neutral-900 text-white',
    emerald: 'bg-pq-success-600 hover:bg-pq-success-600 text-white',
    slate:   'bg-white border border-pq-neutral-200 text-pq-neutral-900 hover:bg-pq-neutral-50',
    amber:   'bg-amber-500 hover:bg-amber-600 text-white',
  }[color];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-md transition disabled:opacity-40 ${cls}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
