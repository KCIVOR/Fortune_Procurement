'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import { DetailPageSkeleton } from '@/components/shared/structural-skeletons';
import { useAuth } from '@/context/AuthContext';
import { fetchPOById, calcPOVatBreakdown, updatePODraft } from '@/lib/po';
import {
  submitPOForApproval,
  fetchPOApprovalDetailByPOId,
  canActOnPOStep,
  markExternalPOOrdered,
} from '@/lib/po-approvals';
import { sendPOToSupplier } from '@/lib/po-send';
import type { POWithItems, POApprovalDetail, POApprovalStep, POApprovalAction } from '@/types/po';
import { PO_STATUS_LABELS } from '@/types/po';
import { format } from 'date-fns';
import {
  FileText, Building2, User, CalendarDays,
  Package, Truck, CreditCard, MapPin,
  DollarSign, ClipboardList, Send, CircleCheck as CheckCircle2,
  Circle as XCircle, RotateCcw, Lock, TriangleAlert as AlertTriangle,
  Pencil, Save, X as XIcon, Store, FileCheck2,
} from 'lucide-react';
import RelatedRecords from '@/components/shared/RelatedRecords';
import RawMaterialBadge from '@/components/shared/RawMaterialBadge';
import RequestorRemarks from '@/components/shared/RequestorRemarks';
import WarehouseQtyOverrideNote from '@/components/shared/WarehouseQtyOverrideNote';
import DetailBackButton from '@/components/shared/DetailBackButton';
import DetailHeaderLayout from '@/components/shared/DetailHeaderLayout';
import DetailTitleRow from '@/components/shared/DetailTitleRow';
import DetailPrintButton from '@/components/shared/DetailPrintButton';
import DetailTableCard from '@/components/shared/DetailTableCard';
import DetailInfoField from '@/components/shared/DetailInfoField';
import { canViewCommercialPricing, formatCommercialAmount } from '@/lib/price-visibility';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';
import QuoteAttachmentPills from '@/components/rfq/QuoteAttachmentPills';
import PriorityChip from '@/components/shared/PriorityChip';
import PrioritySelector from '@/components/shared/PrioritySelector';
import { canUpdatePR1Priority, updatePR1Priority } from '@/lib/pr1';
import { fetchComplianceDocsByPO, updatePOItemComplianceRequirement, type ComplianceDocument } from '@/lib/compliance-documents';

const STATUS_STYLES: Record<string, string> = {
  draft:        'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200',
  for_approval: 'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
  approved:     'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
  sent:         'bg-sky-50 text-sky-700 border-sky-200',
  rejected:     'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
  cancelled:    'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
};

export default function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const { handleBack } = useBackNavigation();

  const [po, setPO]                           = useState<POWithItems | null>(null);
  const [approvalDetail, setApprovalDetail]   = useState<POApprovalDetail | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState('');
  const [submitting, setSubmitting]           = useState(false);
  const [submitError, setSubmitError]         = useState('');
  const [editing, setEditing]                 = useState(false);
  const [editForm, setEditForm]               = useState({ po_date: '', delivery_address: '', warehouse: '', payment_terms: '', packing: '', remarks: '' });
  const [saving, setSaving]                   = useState(false);
  const [saveError, setSaveError]             = useState('');

  const [priorityUpdating, setPriorityUpdating] = useState(false);
  const [priorityError, setPriorityError]       = useState('');

  // Compliance docs (informational, services POs only)
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocument[]>([]);
  const [complianceUpdatingId, setComplianceUpdatingId] = useState<string | null>(null);

  const load = () => {
    if (!id) return;
    Promise.all([
      fetchPOById(id),
      fetchPOApprovalDetailByPOId(id).catch(() => null),
    ])
      .then(([data, approval]) => {
        if (!data) { setError('Purchase order not found.'); return; }
        setPO(data);
        setApprovalDetail(approval);
      })
      .catch(() => setError('Failed to load purchase order.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  // Load compliance docs once the PO is loaded (services only, procurement view)
  useEffect(() => {
    if (!po || po.request_type !== 'services' || profile?.role !== 'procurement') return;
    fetchComplianceDocsByPO(po.id)
      .then(setComplianceDocs)
      .catch(() => { /* best-effort — banner still shows, count stays 0 */ });
  }, [po?.id, po?.request_type, profile?.role]);

  const handleSubmitForApproval = async () => {
    if (!po || !profile) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await submitPOForApproval(po.id, profile);
      load();
    } catch (err: any) {
      setSubmitError(err.message ?? 'Failed to submit for approval.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkOrdered = async () => {
    if (!po || !profile) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await markExternalPOOrdered(po.id, profile);
      load();
    } catch (err: any) {
      setSubmitError(err.message ?? 'Failed to mark PO as ordered.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendToSupplier = async () => {
    if (!po || !profile) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await sendPOToSupplier(po.id, profile);
      load();
    } catch (err: any) {
      setSubmitError(err.message ?? 'Failed to send PO to supplier.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditToggle = () => {
    if (!po) return;
    setEditForm({
      po_date:          po.po_date,
      delivery_address: po.delivery_address,
      warehouse:        po.warehouse,
      payment_terms:    po.payment_terms,
      packing:          po.packing,
      remarks:          po.remarks ?? '',
    });
    setSaveError('');
    setEditing(true);
  };

  const handleSave = async () => {
    if (!po) return;
    setSaving(true);
    setSaveError('');
    try {
      await updatePODraft(po.id, editForm);
      setEditing(false);
      load();
    } catch (err: any) {
      setSaveError(err.message ?? 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const canEdit    = (po?.status === 'draft' || po?.status === 'revision_requested') && profile?.role === 'procurement';
  const canManageCompliance =
    po?.request_type === 'services' && (profile?.role === 'procurement' || profile?.role === 'admin');

  const handleToggleCompliance = async (itemId: string, next: boolean) => {
    if (!po || !profile) return;
    setComplianceUpdatingId(itemId);
    try {
      await updatePOItemComplianceRequirement(itemId, next, profile);
      setPO({
        ...po,
        items: po.items.map(i => i.id === itemId ? { ...i, requires_compliance_doc: next } : i),
      });
    } catch {
      // best-effort — table just won't reflect the change; user can retry
    } finally {
      setComplianceUpdatingId(null);
    }
  };
  const isExternal = !po?.supplier_id;
  const canSendToSupplier =
    po?.status === 'approved' &&
    !!po.supplier_id &&
    !po.sent_at &&
    profile?.role === 'procurement';

  if (loading) return (
    <AppShell title="Purchase Order">
      <DetailPageSkeleton />
    </AppShell>
  );

  if (error || !po) return (
    <AppShell title="Purchase Order">
      <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
        {error || 'Purchase order not found.'}
      </div>
    </AppShell>
  );

  const canViewPrices = canViewCommercialPricing(profile);
  const vatBreakdown = canViewPrices ? calcPOVatBreakdown(po.items) : null;

  // Priority edits write through updatePR1Priority(po.pr1_id, ...) — there is
  // no PR2-native equivalent, so a PR2-native PO (no pr1_id) must not show an
  // editor that silently no-ops. Falls back to the read-only PriorityChip below.
  const canUpdatePriority = profile && !!po.pr1_id && canUpdatePR1Priority(profile);
  const handlePriorityChange = async (newPriority: 'normal' | 'medium' | 'high') => {
    if (!po.pr1_id || !profile || newPriority === po.pr1_priority) return;
    setPriorityUpdating(true);
    setPriorityError('');
    try {
      await updatePR1Priority(po.pr1_id, newPriority, profile);
      setPO({ ...po, pr1_priority: newPriority });
    } catch (err) {
      setPriorityError(err instanceof Error ? err.message : 'Failed to update priority.');
    } finally {
      setPriorityUpdating(false);
    }
  };

  return (
    <AppShell title={`PO ${po.po_number}`}>
      <DetailBackButton className="mb-3" onClick={() => handleBack({ role: profile?.role })} />

      {/* Header */}
      <DetailHeaderLayout
        wrap={true}
        left={
          <div>
            <DetailTitleRow wrap mb>
              <h1 className="text-2xl font-bold text-pq-neutral-900 font-mono">{po.po_number}</h1>
              <span className={`inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-1 ${STATUS_STYLES[po.status] ?? STATUS_STYLES.draft}`}>
                {PO_STATUS_LABELS[po.status] ?? po.status}
              </span>
              {!isExternal && (po.status === 'approved' || po.status === 'sent') && (
                po.sent_at ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2.5 py-1 bg-pq-success-100 text-pq-success-600 border-pq-success-100"
                    title={`Sent ${format(new Date(po.sent_at), 'MMMM d, yyyy h:mm a')}`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Sent to Supplier
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2.5 py-1 bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100">
                    <Send className="w-3 h-3" />
                    Not Yet Sent
                  </span>
                )
              )}
              <RequestTypeBadge type={po.request_type ?? 'goods'} />
              {canUpdatePriority ? (
                <PrioritySelector
                  value={po.pr1_priority ?? 'normal'}
                  onChange={handlePriorityChange}
                  isUpdating={priorityUpdating}
                />
              ) : (
                <PriorityChip priority={po.pr1_priority ?? 'normal'} />
              )}
            </DetailTitleRow>
            {priorityError && (
              <p className="text-xs text-pq-danger-600 mb-1">{priorityError}</p>
            )}
            <p className="text-sm text-pq-neutral-500">{po.department_name_snapshot} · {po.purpose}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-pq-neutral-400 font-mono">PR2 Ref: {po.pr2_number_snapshot}</span>
              {po.pr1_number_snapshot && (
                <span className="text-xs text-pq-neutral-400 font-mono">PR1 Ref: {po.pr1_number_snapshot}</span>
              )}
              <span className="text-xs text-pq-neutral-400 font-mono">RFQ Ref: {po.rfq_number_snapshot}</span>
            </div>
          </div>
        }
        right={
          <div className="flex items-center gap-2 shrink-0">
            {canEdit && !editing && (
              <button
                onClick={handleEditToggle}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-pq-neutral-200 text-pq-neutral-900 text-sm font-semibold rounded-md hover:bg-pq-neutral-50 transition"
              >
                <Pencil className="w-4 h-4" />
                Edit PO
              </button>
            )}
            {canEdit && editing && (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-pq-primary-600 hover:bg-pq-primary-700 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-pq-neutral-200 text-pq-neutral-700 text-sm font-semibold rounded-md hover:bg-pq-neutral-50 transition disabled:opacity-50"
                >
                  <XIcon className="w-4 h-4" />
                  Cancel
                </button>
              </>
            )}
            {canEdit && !editing && (
              <button
                onClick={handleSubmitForApproval}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Submitting...' : 'Submit for Approval'}
              </button>
            )}
            {approvalDetail && approvalDetail.instance_status === 'active' && (
              <Link
                href={`/approvals/po/${approvalDetail.instance_id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-pq-warning-100 border border-pq-warning-100 hover:bg-pq-warning-100 text-pq-warning-600 text-sm font-semibold rounded-md transition"
              >
                <ClipboardList className="w-4 h-4" />
                View Approval
              </Link>
            )}
            {canSendToSupplier && (
              <button
                onClick={handleSendToSupplier}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Sending...' : 'Send PO to Supplier'}
              </button>
            )}
            {/* External vendor (no supplier portal): Procurement places the order
                externally, then marks it ordered to start delivery/GRN. */}
            {isExternal && po.status === 'approved' && (
              <button
                onClick={handleMarkOrdered}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
              >
                <Truck className="w-4 h-4" />
                {submitting ? 'Marking...' : 'Mark as Ordered'}
              </button>
            )}
            <DetailPrintButton
              href={`/po/${po.id}/print`}
              label="Print PO"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-pq-neutral-800 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition"
            />
          </div>
        }
      />

      {/* Related Records */}
      {profile && (
        <div className="mb-6">
          <RelatedRecords baseType="PO" baseId={po.id} role={profile.role} currentDocType="PO" />
        </div>
      )}

      {/* External vendor notice */}
      {isExternal && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-md px-5 py-4 mb-6">
          <Store className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            <span className="font-semibold">External vendor — manual order.</span>{' '}
            This PO is for an off-system supplier with no portal account. Place the order directly
            with the vendor, then click <span className="font-semibold">Mark as Ordered</span> once
            confirmed to trigger delivery tracking and GRN.
          </div>
        </div>
      )}

      {/* Compliance docs informational banner (services POs, procurement view) */}
      {po.request_type === 'services' && profile?.role === 'procurement' && (
        <div className="flex items-start gap-3 bg-sky-50 border border-sky-200 rounded-md px-5 py-4 mb-6">
          <FileCheck2 className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
          <div className="text-sm text-sky-800 flex-1">
            <span className="font-semibold">Compliance documentation.</span>{' '}
            This is a services PO. The supplier may be required to upload certification or compliance documents.
          </div>
          {complianceDocs.length > 0 && (
            <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-pq-success-100 text-pq-success-700">
              <CheckCircle2 className="w-3 h-3" />{complianceDocs.length} uploaded
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 auto-rows-max lg:auto-rows-auto">

        {/* Left column: details and items */}
        <div className="lg:col-span-2 space-y-4 order-3 lg:order-none">

          {/* PO Details */}
          <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-4">
            <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">PO Details</h2>
            <DetailInfoField
              layout="inline"
              icon={<FileText className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="PO Number"
              value={po.po_number}
              valueClassName="font-mono font-semibold"
            />
            <DetailInfoField
              layout="inline"
              icon={<FileText className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="PR2 Reference"
              value={po.pr2_number_snapshot}
              valueClassName="font-mono font-semibold"
            />
            {po.pr1_number_snapshot && (
              <DetailInfoField
                layout="inline"
                icon={<FileText className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
                label="PR1 Reference"
                value={po.pr1_number_snapshot}
                valueClassName="font-mono font-semibold"
              />
            )}
            <DetailInfoField
              layout="inline"
              icon={<FileText className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="RFQ Reference"
              value={po.rfq_number_snapshot}
              valueClassName="font-mono font-semibold"
            />
            <DetailInfoField
              layout="inline"
              icon={<CalendarDays className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="PO Date"
              value={format(new Date(po.po_date), 'MMMM d, yyyy')}
            />
            <DetailInfoField
              layout="inline"
              icon={<CalendarDays className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="Date Required"
              value={format(new Date(po.date_required), 'MMMM d, yyyy')}
            />
            <DetailInfoField
              layout="inline"
              icon={<CalendarDays className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="Generated"
              value={format(new Date(po.generated_at), 'MMMM d, yyyy')}
            />
            <DetailInfoField
              layout="inline"
              icon={<User className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="Requisitioner"
              value={po.requisitioner_name_snapshot}
            />
            <DetailInfoField
              layout="inline"
              icon={<Building2 className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="Department"
              value={po.department_name_snapshot}
            />
            <DetailInfoField
              layout="inline"
              icon={<Package className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="Supplier"
              value={
                <span className="inline-flex items-center gap-1.5 flex-wrap">
                  {po.supplier_name_snapshot}
                  {isExternal && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                      <Store className="w-2.5 h-2.5 shrink-0" />
                      External vendor
                    </span>
                  )}
                </span>
              }
            />
          </div>

          {/* Delivery & Terms */}
          <div className={`bg-white rounded-md border p-5 space-y-4 ${editing ? 'border-pq-primary-300 ring-1 ring-pq-primary-200' : 'border-pq-neutral-200'}`}>
            <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">Delivery & Terms</h2>

            {/* PO Date */}
            <div className="flex items-start gap-3">
              <CalendarDays className="w-3.5 h-3.5 text-pq-neutral-400 mt-2.5 shrink-0" />
              <div className="flex-1 grid grid-cols-[120px_1fr] items-center gap-2">
                <span className="text-xs font-semibold text-pq-neutral-500">PO Date</span>
                {editing ? (
                  <input type="date" value={editForm.po_date} onChange={e => setEditForm(f => ({ ...f, po_date: e.target.value }))}
                    className="text-sm border border-pq-neutral-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-pq-primary-400 w-full max-w-xs" />
                ) : (
                  <span className="text-sm text-pq-neutral-900">{format(new Date(po.po_date), 'MMMM d, yyyy')}</span>
                )}
              </div>
            </div>

            {/* Warehouse */}
            <div className="flex items-start gap-3">
              <Truck className="w-3.5 h-3.5 text-pq-neutral-400 mt-2.5 shrink-0" />
              <div className="flex-1 grid grid-cols-[120px_1fr] items-center gap-2">
                <span className="text-xs font-semibold text-pq-neutral-500">Warehouse</span>
                {editing ? (
                  <input type="text" value={editForm.warehouse} onChange={e => setEditForm(f => ({ ...f, warehouse: e.target.value }))}
                    className="text-sm border border-pq-neutral-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-pq-primary-400 w-full" />
                ) : (
                  <span className="text-sm text-pq-neutral-900">{po.warehouse || '—'}</span>
                )}
              </div>
            </div>

            {/* Delivery Address */}
            <div className="flex items-start gap-3">
              <MapPin className="w-3.5 h-3.5 text-pq-neutral-400 mt-2.5 shrink-0" />
              <div className="flex-1 grid grid-cols-[120px_1fr] items-start gap-2">
                <span className="text-xs font-semibold text-pq-neutral-500 mt-1.5">Delivery Address</span>
                {editing ? (
                  <textarea value={editForm.delivery_address} onChange={e => setEditForm(f => ({ ...f, delivery_address: e.target.value }))}
                    rows={2} className="text-sm border border-pq-neutral-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-pq-primary-400 w-full resize-none" />
                ) : (
                  <span className="text-sm text-pq-neutral-900">{po.delivery_address || '—'}</span>
                )}
              </div>
            </div>

            {/* Payment Terms */}
            <div className="flex items-start gap-3">
              <CreditCard className="w-3.5 h-3.5 text-pq-neutral-400 mt-2.5 shrink-0" />
              <div className="flex-1 grid grid-cols-[120px_1fr] items-center gap-2">
                <span className="text-xs font-semibold text-pq-neutral-500">Payment Terms</span>
                {editing ? (
                  <input type="text" value={editForm.payment_terms} onChange={e => setEditForm(f => ({ ...f, payment_terms: e.target.value }))}
                    className="text-sm border border-pq-neutral-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-pq-primary-400 w-full" />
                ) : (
                  <span className="text-sm text-pq-neutral-900">{po.payment_terms || '—'}</span>
                )}
              </div>
            </div>

            {/* Packing */}
            <div className="flex items-start gap-3">
              <ClipboardList className="w-3.5 h-3.5 text-pq-neutral-400 mt-2.5 shrink-0" />
              <div className="flex-1 grid grid-cols-[120px_1fr] items-center gap-2">
                <span className="text-xs font-semibold text-pq-neutral-500">Packing</span>
                {editing ? (
                  <input type="text" value={editForm.packing} onChange={e => setEditForm(f => ({ ...f, packing: e.target.value }))}
                    className="text-sm border border-pq-neutral-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-pq-primary-400 w-full" />
                ) : (
                  <span className="text-sm text-pq-neutral-900">{po.packing || '—'}</span>
                )}
              </div>
            </div>

            {/* Remarks */}
            <div className="flex items-start gap-3">
              <FileText className="w-3.5 h-3.5 text-pq-neutral-400 mt-2.5 shrink-0" />
              <div className="flex-1 grid grid-cols-[120px_1fr] items-start gap-2">
                <span className="text-xs font-semibold text-pq-neutral-500 mt-1.5">Remarks</span>
                {editing ? (
                  <textarea value={editForm.remarks} onChange={e => setEditForm(f => ({ ...f, remarks: e.target.value }))}
                    rows={2} placeholder="Optional" className="text-sm border border-pq-neutral-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-pq-primary-400 w-full resize-none" />
                ) : (
                  <span className="text-sm text-pq-neutral-900">{po.remarks || '—'}</span>
                )}
              </div>
            </div>

            {saveError && (
              <div className="flex items-start gap-2 bg-pq-danger-100 border border-pq-danger-100 text-pq-danger-600 text-sm rounded-md px-4 py-3">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
          </div>

          {/* Grand total card */}
          <div className="bg-pq-primary-600 rounded-md p-5 text-white">
            <div className="flex items-center justify-between">
              <div>
                {vatBreakdown && vatBreakdown.vatAmount > 0 ? (
                  <>
                    <div className="flex items-center gap-4 text-xs text-pq-primary-200">
                      <span>Subtotal: {formatCommercialAmount(vatBreakdown.subtotal, canViewPrices)}</span>
                      <span>VAT: {formatCommercialAmount(vatBreakdown.vatAmount, canViewPrices)}</span>
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-pq-primary-200 mt-2">Total</p>
                  </>
                ) : (
                  <p className="text-xs font-semibold uppercase tracking-wide text-pq-primary-200">Grand Total</p>
                )}
                <p className="text-3xl font-bold mt-1">
                  {formatCommercialAmount(vatBreakdown?.total ?? 0, canViewPrices)}
                </p>
                <p className="text-xs text-pq-primary-200 mt-1">
                  {po.items.length} line item{po.items.length !== 1 ? 's' : ''} · {po.supplier_name_snapshot}
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-blue-400" />
            </div>
          </div>

          {/* Items table */}
          <DetailTableCard
            title={
              <div className="flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-pq-neutral-400" />
                <h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                  Items ({po.items.length})
                </h2>
              </div>
            }
            headerClassName="bg-pq-neutral-50"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-8">#</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-20">Code</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase">Description</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-24">Attachments</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-14">Unit</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-16">Qty</th>
                    {po.request_type === 'services' && (
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-28">Compliance Doc</th>
                    )}
                    {canViewPrices ? (
                      <>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-24">Unit Price</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-24">Total</th>
                      </>
                    ) : (
                      <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase w-24">Pricing</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {po.items.map(item => (
                    <tr key={item.id} className="hover:bg-pq-neutral-50">
                      <td className="px-4 py-3 text-center text-xs text-pq-neutral-400 font-mono">{item.item_order}</td>
                      <td className="px-4 py-3 font-mono text-xs text-pq-neutral-500">{item.item_code || '—'}</td>
                      <td className="px-4 py-3 text-pq-neutral-900 font-medium">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{item.description}</span>
                          <RawMaterialBadge isRawMaterial={item.is_raw_material} size="sm" />
                        </div>
                        {item.quote_justification && (
                          <p className="text-xs text-pq-warning-700 mt-1 flex items-start gap-1 font-normal">
                            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>
                              <strong>Award justification:</strong> {item.quote_justification}
                            </span>
                          </p>
                        )}
                        {item.pr1_remarks_snapshot && (
                          <RequestorRemarks text={item.pr1_remarks_snapshot} />
                        )}
                        {item.pr1_quantity_requested_snapshot != null &&
                          item.pr1_quantity_requested_snapshot !== item.quantity_to_purchase && (
                            <WarehouseQtyOverrideNote
                              originalQty={item.pr1_quantity_requested_snapshot}
                              currentQty={item.quantity_to_purchase}
                              reason={item.quantity_override_reason_snapshot}
                              overriddenBy={item.quantity_overridden_by_name_snapshot}
                            />
                          )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(item.quote_attachments?.length ?? 0) > 0
                          ? <QuoteAttachmentPills attachments={item.quote_attachments!} />
                          : <span className="text-xs text-pq-neutral-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-pq-neutral-500 text-xs">{item.unit_of_measure}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-pq-neutral-900">{item.quantity_to_purchase}</td>
                      {po.request_type === 'services' && (
                        <td className="px-4 py-3 text-center">
                          {canManageCompliance ? (
                            <button
                              type="button"
                              onClick={() => handleToggleCompliance(item.id, !item.requires_compliance_doc)}
                              disabled={complianceUpdatingId === item.id}
                              aria-pressed={item.requires_compliance_doc}
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border transition disabled:opacity-50 disabled:cursor-wait ${
                                item.requires_compliance_doc
                                  ? 'bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100'
                                  : 'bg-white text-pq-neutral-400 border-pq-neutral-200 hover:bg-pq-neutral-50 hover:text-pq-neutral-600'
                              }`}
                            >
                              <FileCheck2 className="w-3 h-3" />
                              {complianceUpdatingId === item.id
                                ? 'Saving…'
                                : item.requires_compliance_doc ? 'Required' : 'Not required'}
                            </button>
                          ) : item.requires_compliance_doc ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                              <FileCheck2 className="w-3 h-3" /> Required
                            </span>
                          ) : (
                            <span className="text-xs text-pq-neutral-300">—</span>
                          )}
                        </td>
                      )}
                      {canViewPrices ? (
                        <>
                          <td className="px-4 py-3 text-right text-xs text-pq-neutral-500">
                            {formatCommercialAmount(item.unit_price, true)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-pq-neutral-900">
                            {formatCommercialAmount(item.total_price, true)}
                          </td>
                        </>
                      ) : (
                        <td className="px-4 py-3 text-center text-xs text-pq-neutral-400">
                          {formatCommercialAmount(0, false)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                {canViewPrices && vatBreakdown && (
                  <tfoot>
                    {vatBreakdown.vatAmount > 0 && (
                      <>
                        <tr className="bg-pq-neutral-50 border-t-2 border-pq-neutral-200">
                          <td colSpan={po.request_type === 'services' ? 8 : 7} className="px-4 py-3 text-right text-xs text-pq-neutral-500">Subtotal</td>
                          <td className="px-4 py-3 text-right text-sm text-pq-neutral-500">{formatCommercialAmount(vatBreakdown.subtotal, true)}</td>
                        </tr>
                        <tr className="bg-pq-neutral-50">
                          <td colSpan={po.request_type === 'services' ? 8 : 7} className="px-4 py-3 text-right text-xs text-pq-neutral-500">VAT</td>
                          <td className="px-4 py-3 text-right text-sm text-pq-neutral-500">{formatCommercialAmount(vatBreakdown.vatAmount, true)}</td>
                        </tr>
                      </>
                    )}
                    <tr className="bg-pq-neutral-50 border-t-2 border-pq-neutral-200">
                      <td colSpan={po.request_type === 'services' ? 8 : 7} className="px-4 py-3 text-right text-xs font-semibold text-pq-neutral-900">Grand Total</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-pq-neutral-900">
                        {formatCommercialAmount(vatBreakdown.total, true)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </DetailTableCard>

          {/* Submit error */}
          {submitError && (
            <div className="flex items-start gap-2 bg-pq-danger-100 border border-pq-danger-100 text-pq-danger-600 text-sm rounded-md px-4 py-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Revision banner — shown when PO was returned for revision */}
          {po.status === 'revision_requested' && approvalDetail && (() => {
            const revisionAction = approvalDetail.actions.find(a => a.action === 'revision_requested');
            return revisionAction ? (
              <div className="bg-pq-warning-50 border border-pq-warning-200 rounded-md px-5 py-4 space-y-1">
                <div className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-pq-warning-600 shrink-0" />
                  <p className="text-sm font-semibold text-pq-warning-700">Revision Requested</p>
                </div>
                <p className="text-xs text-pq-neutral-500">
                  {revisionAction.actor_name_snapshot} · {format(new Date(revisionAction.acted_at), 'MMM d, yyyy h:mm a')}
                </p>
                {revisionAction.remarks && (
                  <p className="text-sm text-pq-neutral-800 mt-1 pl-6">"{revisionAction.remarks}"</p>
                )}
              </div>
            ) : null;
          })()}

          {/* Status note for draft without active approval */}
          {po.status === 'draft' && !approvalDetail && profile?.position === 'Buyer' && (
            <div className="bg-pq-warning-100 border border-pq-warning-100 rounded-md px-5 py-4 text-sm text-pq-warning-600">
              <p className="font-semibold">Ready for Approval</p>
              <p className="text-xs text-pq-warning-600 mt-0.5">
                Click "Submit for Approval" above to start the Buyer → Procurement Manager → Finance Director chain.
              </p>
            </div>
          )}
        </div>

        {/* Right column: Approval Timeline */}
        <div className="lg:col-span-1 order-2 lg:order-none">
          <div className="lg:sticky lg:top-20">
            {approvalDetail ? (
              <ApprovalTimeline approvalDetail={approvalDetail} />
            ) : (
              <div className="bg-white rounded-md border border-pq-neutral-200 p-5">
                <p className="text-sm text-pq-neutral-400">Approval chain will appear once submitted for approval.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ApprovalTimeline({ approvalDetail }: { approvalDetail: POApprovalDetail }) {
  const internalSteps = approvalDetail.steps.filter(s => s.step_order <= 3);
  const internalActions = approvalDetail.actions.filter(a => a.step_order <= 3);

  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-3.5 h-3.5 text-pq-neutral-400" />
          <h3 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Approval Chain</h3>
        </div>
        {approvalDetail.instance_status === 'active' && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-pq-warning-600 bg-pq-warning-100 border border-pq-warning-100 rounded-full px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-pq-warning-1000 animate-pulse" />
            In Progress
          </span>
        )}
        {approvalDetail.instance_status === 'approved' && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded-full px-2.5 py-1">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
        )}
      </div>
      <div className="p-5">
        <ol className="space-y-0">
          {internalSteps.map((step, idx) => {
            const action = internalActions.find(a => a.step_order === step.step_order);
            const isComplete = !!action;
            const isCurrent = !isComplete && step.step_order === approvalDetail.current_step && approvalDetail.instance_status === 'active';

            return (
              <li key={step.step_order} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border-2 ${
                    isComplete
                      ? action!.action === 'approved' ? 'bg-pq-success-600 border-pq-success-600'
                      : action!.action === 'rejected' ? 'bg-pq-danger-600 border-pq-danger-600'
                      : 'bg-orange-500 border-orange-500'
                      : isCurrent ? 'bg-pq-warning-100 border-amber-400'
                      : 'bg-pq-neutral-50 border-pq-neutral-200'
                  }`}>
                    {isComplete ? (
                      action!.action === 'approved' ? <CheckCircle2 className="w-3 h-3 text-white" />
                      : action!.action === 'rejected' ? <XCircle className="w-3 h-3 text-white" />
                      : <RotateCcw className="w-3 h-3 text-white" />
                    ) : isCurrent ? (
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-pq-neutral-400" />
                    )}
                  </div>
                  {idx < internalSteps.length - 1 && (
                    <div className={`w-0.5 flex-1 my-1 min-h-[20px] ${isComplete ? 'bg-emerald-200' : 'bg-pq-neutral-200'}`} />
                  )}
                </div>
                <div className="pb-4 flex-1 min-w-0">
                  <p className="text-xs font-semibold text-pq-neutral-900">Step {step.step_order}: {step.position_required}</p>
                  {isComplete ? (
                    <div className="mt-0.5 space-y-0.5">
                      <span className="text-xs text-pq-neutral-500">{action!.actor_name_snapshot} · {format(new Date(action!.acted_at), 'MMM d, h:mm a')}</span>
                      {action!.remarks && (
                        <p className="text-xs text-pq-neutral-600 italic">"{action!.remarks}"</p>
                      )}
                    </div>
                  ) : isCurrent ? (
                    <p className="text-xs text-pq-warning-600 mt-0.5">Awaiting action</p>
                  ) : (
                    <p className="text-xs text-pq-neutral-400 mt-0.5">Pending</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {approvalDetail.instance_id && (
          <Link
            href={`/approvals/po/${approvalDetail.instance_id}`}
            className="inline-flex items-center gap-1.5 text-xs text-pq-primary-600 hover:text-pq-neutral-900 font-medium mt-2 transition"
          >
            View full approval detail
          </Link>
        )}
      </div>
    </div>
  );
}
