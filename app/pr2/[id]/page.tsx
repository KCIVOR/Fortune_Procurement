'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import { DetailPageSkeleton } from '@/components/shared/structural-skeletons';
import { useAuth } from '@/context/AuthContext';
import { fetchPR2ById, savePR2Items, calcPR2VatBreakdown, updatePR2ItemRawMaterial } from '@/lib/pr2';
import { getPr2PrintUrl } from '@/lib/pr2-classification';
import { computeLineVat } from '@/lib/vat';
import { submitPR2ForApproval, canActOnPR2Step, fetchPR2ApprovalDetail } from '@/lib/pr2-approvals';
import { fetchPOsByPR2Id } from '@/lib/po';
import { supabase } from '@/lib/supabase';
import type { PR2WithItems, PR2Item } from '@/types/pr2';
import type { PR1Attachment } from '@/types/pr1';
import type { PORequest } from '@/types/po';
import type { PR2ApprovalDetail } from '@/types/approvals';
import { PR2_STATUS_LABELS } from '@/types/pr2';
import { format } from 'date-fns';
import { FileText, Building2, CalendarDays, User, Package, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Pencil, Save, X as XIcon, RefreshCw, Send, ArrowRight, ShoppingCart, FlaskConical, Store } from 'lucide-react';
import RelatedRecords from '@/components/shared/RelatedRecords';
import RawMaterialBadge from '@/components/shared/RawMaterialBadge';
import RequestorRemarks from '@/components/shared/RequestorRemarks';
import WarehouseQtyOverrideNote from '@/components/shared/WarehouseQtyOverrideNote';
import DetailBackButton from '@/components/shared/DetailBackButton';
import DetailHeaderLayout from '@/components/shared/DetailHeaderLayout';
import DetailTitleRow from '@/components/shared/DetailTitleRow';
import DetailPrintButton from '@/components/shared/DetailPrintButton';
import DetailTableCard from '@/components/shared/DetailTableCard';
import { PR1AttachmentsGallery } from '@/components/pr1/PR1AttachmentsSection';
import QuoteAttachmentPills from '@/components/rfq/QuoteAttachmentPills';
import { canViewCommercialPricing, formatCommercialAmount } from '@/lib/price-visibility';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';
import PriorityChip from '@/components/shared/PriorityChip';
import PrioritySelector from '@/components/shared/PrioritySelector';
import { canUpdatePR1Priority, updatePR1Priority } from '@/lib/pr1';
import { fetchRfqDetail, buildQuoteMatrix } from '@/lib/canvassing';
import {
  fetchRfqApprovalDetail,
  fetchRfqApprovalInstanceForRfq,
  canActOnRfqStep,
  type RfqApprovalDetail,
} from '@/lib/rfq-approvals';
import type { RfqDetailView, QuoteMatrixRow } from '@/types/canvassing';
import CanvassingComparisonPanel from '@/components/canvassing/CanvassingComparisonPanel';
import ApprovalPhaseTimeline from '@/components/approvals/ApprovalPhaseTimeline';
import RfqApprovalPanel from '@/components/approvals/RfqApprovalPanel';

const STATUS_STYLES: Record<string, string> = {
  draft:              'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200',
  pending_approval:   'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
  approved:           'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
  revision_requested: 'bg-orange-50 text-orange-700 border-orange-200',
  rejected:           'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
  cancelled:          'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
};

interface EditableItem {
  id:               string;
  item_order:       number;
  item_code:        string;
  description:      string;
  unit_of_measure:  string;
  quantity_requested: number;
  qty_on_hand:      number;
  qty_incoming:     number;
  quantity_to_purchase: number;
  supplier_name_snapshot: string;
  quoted_description: string;
  is_alternative:   boolean;
  unit_price:       number;
  lead_time_days:   string;
  total_price:      number;
  vat_type?:        'vat_inclusive' | 'vat_exclusive' | null;
  vat_rate_applied?: number | null;
  remarks:          string;
  pr1_item_id:      string | null;
  selected_rfq_supplier_id: string | null;
  // Phase 9 (Raw Mats): forwarded from the PR2Item snapshot for badge / panel rendering.
  is_raw_material?: boolean;
  attachments?: PR1Attachment[];
  quote_justification?: string | null;
  quote_attachments?: import('@/types/canvassing').RfqQuoteAttachment[];
  pr1_remarks_snapshot?: string | null;
  pr1_quantity_requested_snapshot?: number | null;
  quantity_override_reason_snapshot?: string | null;
  quantity_overridden_by_name_snapshot?: string | null;
}

function toEditableItem(item: PR2Item): EditableItem {
  return {
    id:               item.id,
    item_order:       item.item_order,
    item_code:        item.item_code,
    description:      item.description,
    unit_of_measure:  item.unit_of_measure,
    quantity_requested: Number(item.quantity_requested),
    qty_on_hand:      Number(item.qty_on_hand),
    qty_incoming:     Number(item.qty_incoming),
    quantity_to_purchase: Number(item.quantity_to_purchase),
    supplier_name_snapshot: item.supplier_name_snapshot,
    quoted_description: item.quoted_description,
    is_alternative:   item.is_alternative,
    unit_price:       Number(item.unit_price),
    lead_time_days:   item.lead_time_days,
    total_price:      Number(item.total_price),
    vat_type:         item.vat_type ?? null,
    vat_rate_applied: item.vat_rate_applied ?? null,
    remarks:          item.remarks ?? '',
    pr1_item_id:      item.pr1_item_id,
    selected_rfq_supplier_id: item.selected_rfq_supplier_id,
    is_raw_material:  item.is_raw_material === true,
    attachments:      item.attachments as PR1Attachment[] | undefined,
    quote_justification: item.quote_justification ?? null,
    quote_attachments: item.quote_attachments,
    pr1_remarks_snapshot: item.pr1_remarks_snapshot ?? null,
    pr1_quantity_requested_snapshot: item.pr1_quantity_requested_snapshot ?? null,
    quantity_override_reason_snapshot: item.quantity_override_reason_snapshot ?? null,
    quantity_overridden_by_name_snapshot: item.quantity_overridden_by_name_snapshot ?? null,
  };
}

export default function PR2DetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const rfqApprovalParam = searchParams.get('rfqApproval');
  const { profile } = useAuth();
  const router = useRouter();
  const { handleBack } = useBackNavigation();

  const [pr2, setPR2] = useState<PR2WithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approvalDetail, setApprovalDetail] = useState<PR2ApprovalDetail | null>(null);
  const [rfqDetail, setRfqDetail] = useState<RfqDetailView | null>(null);
  const [rfqMatrix, setRfqMatrix] = useState<QuoteMatrixRow[]>([]);
  const [rfqApprovalDetail, setRfqApprovalDetail] = useState<RfqApprovalDetail | null>(null);
  const [rfqApprovalInstanceId, setRfqApprovalInstanceId] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<EditableItem[]>([]);
  const [editRemarks, setEditRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [priorityUpdating, setPriorityUpdating] = useState(false);
  const [priorityError, setPriorityError] = useState('');

  const load = useCallback(() => {
    if (!id) return;
    const db = supabase as any;
    Promise.all([
      fetchPR2ById(id),
      db.from('approval_instances')
        .select('id, workflow_id, current_step, status')
        .eq('document_type', 'PR2')
        .eq('document_id', id)
        .eq('status', 'active')
        .maybeSingle()
        .then(async ({ data: inst }: any) => {
          if (!inst) { setActiveInstanceId(null); setActiveStepPosition(null); setActiveStepRole(null); setActiveStepLabel(null); return; }
          const { data: step } = await db
            .from('approval_steps')
            .select('role_required, position_required, action_label')
            .eq('workflow_id', inst.workflow_id)
            .eq('step_order', inst.current_step)
            .maybeSingle();
          setActiveInstanceId(inst.id);
          setActiveStepRole(step?.role_required ?? null);
          setActiveStepPosition(step?.position_required ?? null);
          setActiveStepLabel(step?.action_label ?? null);
        }),
      fetchPOsByPR2Id(id).catch(() => []),
      (async () => {
        try {
          const inst = await db.from('approval_instances')
            .select('id')
            .eq('document_type', 'PR2')
            .eq('document_id', id)
            .maybeSingle();
          if (inst.data?.id) {
            const detail = await fetchPR2ApprovalDetail(inst.data.id);
            setApprovalDetail(detail);
          }
        } catch { }
      })(),
    ])
      .then(async ([data, _, pos]) => {
        if (!data) { setError('PR2 not found.'); return; }
        setPR2(data);
        setEditItems(data.items.map(toEditableItem));
        setEditRemarks(data.remarks ?? '');
        const poList = Array.isArray(pos) ? (pos as PORequest[]) : [];
        setExistingPOs(poList);
        const rsIds = Array.from(
          new Set(
            data.items
              .map(i => i.selected_rfq_supplier_id)
              .filter((id): id is string => Boolean(id))
          )
        );
        let pending = false;
        if (rsIds.length > 0) {
          const { data: rs } = await db.from('rfq_suppliers').select('id, supplier_id, is_external').in('id', rsIds);
          const uniqueProfileIds = new Set<string>(
            (rs ?? [])
              .map((r: { supplier_id: string | null }) => r.supplier_id)
              .filter((id: string | null): id is string => Boolean(id))
          );
          const poSids = new Set<string>(
            poList.map(p => p.supplier_id).filter((id: string | null): id is string => Boolean(id))
          );
          pending = Array.from(uniqueProfileIds).some(sid => !poSids.has(sid));
          setExternalRfqIds(new Set<string>(
            (rs ?? [])
              .filter((r: any) => r.is_external)
              .map((r: any) => r.id as string)
          ));
        }
        setHasPendingPOGroups(pending);

        if (data.rfq_id) {
          try {
            const [rfqDetailRes, rfqInst] = await Promise.all([
              fetchRfqDetail(data.rfq_id),
              fetchRfqApprovalInstanceForRfq(data.rfq_id),
            ]);
            setRfqDetail(rfqDetailRes);
            setRfqMatrix(rfqDetailRes ? buildQuoteMatrix(rfqDetailRes) : []);
            const approvalInstanceId = rfqApprovalParam ?? rfqInst?.id ?? null;
            if (approvalInstanceId) {
              setRfqApprovalInstanceId(approvalInstanceId);
              const rfqApproval = await fetchRfqApprovalDetail(approvalInstanceId);
              setRfqApprovalDetail(rfqApproval);
            } else {
              setRfqApprovalInstanceId(null);
              setRfqApprovalDetail(null);
            }
          } catch {
            setRfqDetail(null);
            setRfqMatrix([]);
            setRfqApprovalInstanceId(null);
            setRfqApprovalDetail(null);
          }
        } else {
          setRfqDetail(null);
          setRfqMatrix([]);
          setRfqApprovalInstanceId(null);
          setRfqApprovalDetail(null);
        }
      })
      .catch(() => setError('Failed to load PR2.'))
      .finally(() => setLoading(false));
  }, [id, rfqApprovalParam]);

  useEffect(load, [load]);

  useEffect(() => {
    if (!rfqApprovalParam || !rfqApprovalDetail) return;
    const timer = window.setTimeout(() => {
      document.getElementById('rfq-approval-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [rfqApprovalParam, rfqApprovalDetail]);

  const handleEditToggle = () => {
    if (!pr2) return;
    setEditItems(pr2.items.map(toEditableItem));
    setEditRemarks(pr2.remarks ?? '');
    setSaveError('');
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setSaveError('');
  };

  // Phase 10 (Raw Mats): procurement override of the snapshot flag on a
  // single PR2 line. Persists immediately (independent from the bulk
  // inventory save) and writes an audit log entry server-side.
  const handleToggleRawMaterial = async (idx: number, next: boolean) => {
    if (!profile || !pr2) return;
    const item = editItems[idx];
    if (!item) return;
    // Optimistic update so the toggle feels responsive.
    setEditItems(prev =>
      prev.map((it, i) => (i === idx ? { ...it, is_raw_material: next } : it)),
    );
    setSaveError('');
    try {
      await updatePR2ItemRawMaterial(pr2.id, item.id, next, profile);
      // Refresh the source-of-truth so the next cancel/reset reflects the
      // committed value.
      load();
    } catch (e: any) {
      // Roll back the optimistic flip.
      setEditItems(prev =>
        prev.map((it, i) => (i === idx ? { ...it, is_raw_material: !next } : it)),
      );
      setSaveError(e?.message ?? 'Failed to override raw-material flag.');
    }
  };

  const handleQtyChange = (idx: number, field: 'quantity_to_purchase', val: string) => {
    setEditItems(prev => {
      const next = [...prev];
      const item = { ...next[idx] };
      item[field] = Number(val) || 0;
      item.total_price = computeLineVat(
        item.unit_price,
        item.quantity_to_purchase,
        item.vat_type != null,
        item.vat_type ?? null,
        item.vat_rate_applied ?? 0
      ).total;
      next[idx] = item;
      return next;
    });
  };

  const handleRemarksChange = (idx: number, val: string) => {
    setEditItems(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], remarks: val };
      return next;
    });
  };

  const handleSave = async () => {
    if (!profile || !pr2) return;
    setSaving(true);
    setSaveError('');
    try {
      await savePR2Items(pr2.id, editItems.map(i => ({ ...i, remarks: i.remarks })), editRemarks, profile);
      setEditing(false);
      setLoading(true);
      load();
    } catch (e: any) {
      setSaveError(e.message ?? 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
  const [activeStepPosition, setActiveStepPosition] = useState<string | null>(null);
  const [activeStepRole, setActiveStepRole] = useState<string | null>(null);
  const [activeStepLabel, setActiveStepLabel] = useState<string | null>(null);
  const [existingPOs, setExistingPOs] = useState<PORequest[]>([]);
  const [hasPendingPOGroups, setHasPendingPOGroups] = useState(false);
  const [externalRfqIds, setExternalRfqIds] = useState(new Set<string>());

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleSubmitForApproval = async () => {
    if (!profile || !pr2) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await submitPR2ForApproval(pr2.id, profile);
      setLoading(true);
      load();
    } catch (e: any) {
      setSubmitError(e.message ?? 'Failed to submit for approval.');
    } finally {
      setSubmitting(false);
    }
  };

  const isProcurement = profile?.role === 'procurement';
  const canEdit = isProcurement && pr2?.status === 'draft' && pr2?.pr1_id !== null;

  if (loading) return (
    <AppShell title="PR2 Detail">
      <DetailPageSkeleton />
    </AppShell>
  );

  if (error || !pr2) return (
    <AppShell title="PR2 Detail">
      <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
        {error || 'PR2 not found.'}
      </div>
    </AppShell>
  );

  const displayItems = editing ? editItems : pr2.items.map(toEditableItem);
  const canViewPrices = canViewCommercialPricing(profile);
  const vatBreakdown = canViewPrices ? calcPR2VatBreakdown(displayItems) : null;

  const canUpdatePriority = profile && canUpdatePR1Priority(profile, pr2.requisitioner_id);
  const handlePriorityChange = async (newPriority: 'normal' | 'medium' | 'high') => {
    if (!pr2.pr1_id || !profile || newPriority === pr2.pr1_priority) return;
    setPriorityUpdating(true);
    setPriorityError('');
    try {
      await updatePR1Priority(pr2.pr1_id, newPriority, profile);
      setPR2({ ...pr2, pr1_priority: newPriority });
    } catch (err) {
      setPriorityError(err instanceof Error ? err.message : 'Failed to update priority.');
    } finally {
      setPriorityUpdating(false);
    }
  };

  const userCanActNow = !!(
    profile &&
    activeInstanceId &&
    activeStepRole &&
    activeStepPosition &&
    canActOnPR2Step(profile, activeStepRole, activeStepPosition)
  );

  const rfqApprovalStep = rfqApprovalDetail?.steps.find(
    s => s.step_order === rfqApprovalDetail.current_step,
  ) ?? null;

  const userCanActRfqApproval = !!(
    profile &&
    rfqApprovalDetail &&
    rfqApprovalDetail.instance_status === 'active' &&
    rfqApprovalStep &&
    canActOnRfqStep(
      profile,
      rfqApprovalStep.role_required,
      rfqApprovalStep.position_required,
      rfqApprovalDetail.department_id,
    )
  );

  const showCanvassing = !!rfqDetail;
  const isProcurementEditor = profile?.role === 'procurement';

  return (
    <AppShell title={`PR2 ${pr2.pr2_number}`}>
      <DetailBackButton className="mb-2" onClick={() => handleBack({ role: profile?.role })} />

      {/* Header */}
      <DetailHeaderLayout
        left={
          <div>
            <DetailTitleRow mb>
              <h1 className="text-2xl font-bold text-pq-neutral-900 font-mono">{pr2.pr2_number}</h1>
              <span className={`inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-1 ${STATUS_STYLES[pr2.status] ?? STATUS_STYLES.draft}`}>
                {PR2_STATUS_LABELS[pr2.status]}
              </span>
              <RequestTypeBadge type={pr2.request_type ?? 'goods'} />
              {canUpdatePriority ? (
                <PrioritySelector
                  value={pr2.pr1_priority ?? 'normal'}
                  onChange={handlePriorityChange}
                  isUpdating={priorityUpdating}
                />
              ) : (
                <PriorityChip priority={pr2.pr1_priority ?? 'normal'} />
              )}
            </DetailTitleRow>
            {priorityError && (
              <p className="text-xs text-pq-danger-600 mb-1">{priorityError}</p>
            )}
            <p className="text-sm text-pq-neutral-500">
              {pr2.department_name_snapshot} · {pr2.purpose}
            </p>
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
                Edit PR2
              </button>
            )}
            {canEdit && !editing && (
              <button
                onClick={handleSubmitForApproval}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
              >
                {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Submit for Approval
              </button>
            )}
            {editing && (
              <>
                <button
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-pq-neutral-200 text-pq-neutral-500 text-sm font-semibold rounded-md hover:bg-pq-neutral-50 transition"
                >
                  <XIcon className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
              </>
            )}
            <DetailPrintButton
              href={getPr2PrintUrl(pr2.id, pr2.request_type)}
              label="Print"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-pq-neutral-800 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition"
            />
          </div>
        }
      />

      {(saveError || submitError) && (
        <div className="flex items-center gap-2 bg-pq-danger-100 border border-pq-danger-100 text-pq-danger-600 text-sm rounded-md px-4 py-3 mb-4">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {saveError || submitError}
        </div>
      )}

      {/* Action required banner for PR2 approvers */}
      {userCanActNow && activeInstanceId && (
        <div className="flex items-center justify-between gap-4 bg-pq-warning-100 border border-pq-warning-100 rounded-md px-5 py-4 mb-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-pq-warning-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-pq-warning-600">Your action is required</p>
              <p className="text-xs text-pq-warning-600 mt-0.5">
                {activeStepLabel} — {activeStepPosition}
              </p>
            </div>
          </div>
          <Link
            href={`/approvals/pr2/${activeInstanceId}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-md transition shrink-0"
          >
            Review & Act
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Action required banner for RFQ canvassing approval */}
      {userCanActRfqApproval && rfqApprovalDetail && (
        <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-md px-5 py-4 mb-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">RFQ canvassing approval required</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {rfqApprovalStep?.action_label} — {rfqApprovalStep?.position_required}
              </p>
            </div>
          </div>
          <a
            href="#rfq-approval-panel"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-md transition shrink-0"
          >
            Review Canvassing
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      )}

      {/* PO banners — fully approved PR2 (may be multiple suppliers) */}
      {pr2.status === 'approved' && existingPOs.length > 0 && (
        <div className="space-y-3 mb-4">
          {existingPOs.map(po => (
            <div
              key={po.id}
              className="flex items-center justify-between gap-4 bg-pq-success-100 border border-pq-success-100 rounded-md px-5 py-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <ShoppingCart className="w-5 h-5 text-pq-success-600 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-pq-success-600">Purchase Order</p>
                  <p className="text-xs text-pq-success-600 mt-0.5 truncate">
                    {po.po_number} · {po.supplier_name_snapshot}
                  </p>
                </div>
              </div>
              <Link
                href={`/po/${po.id}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-pq-success-600 hover:bg-pq-success-600 text-white text-sm font-semibold rounded-md transition shrink-0"
              >
                View PO
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      )}
      {pr2.status === 'approved' && hasPendingPOGroups && profile?.position === 'Buyer' && (
        <div className="flex items-center justify-between gap-4 bg-pq-primary-50 border border-pq-primary-200 rounded-md px-5 py-4 mb-4">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-5 h-5 text-pq-primary-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-pq-primary-600">
                {existingPOs.length > 0 ? 'Generate remaining Purchase Orders' : 'Ready for Purchase Order'}
              </p>
              <p className="text-xs text-pq-primary-700 mt-0.5">
                {existingPOs.length > 0
                  ? 'One or more awarded suppliers still need a PO for this PR2.'
                  : 'This PR2 is fully approved. Generate a PO for each awarded supplier.'}
              </p>
            </div>
          </div>
          <Link
            href={`/po/new?pr2=${pr2.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition shrink-0"
          >
            Generate PO
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {editing && (
        <div className="flex items-start gap-3 bg-pq-primary-50 border border-pq-primary-200 rounded-md px-5 py-4 mb-6">
          <Pencil className="w-4 h-4 text-pq-primary-600 mt-0.5 shrink-0" />
          <p className="text-sm text-pq-primary-600">
            Review and adjust the Quantity to Purchase for each item if needed. SOH and In-Transit are set by warehouse validation and are read-only.
          </p>
        </div>
      )}

      {/* Related Records */}
      {profile && (
        <div className="mb-4">
          <RelatedRecords baseType="PR2" baseId={pr2.id} role={profile.role} currentDocType="PR2" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: metadata and items */}
        <div className="lg:col-span-2 space-y-6">
          {/* PR2 Details summary */}
          <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-4">
            <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">PR2 Details</h2>

            <Field icon={FileText} label="PR2 Number"  value={pr2.pr2_number}     mono />
            <Field icon={FileText} label="PR1 Ref."    value={pr2.pr1_number_snapshot} mono />
            <Field icon={FileText} label="RFQ Ref."    value={pr2.rfq_number_snapshot} mono />
            <Field icon={User}     label="Requisitioner" value={pr2.requisitioner_name_snapshot} />
            <Field icon={Building2} label="Department" value={pr2.department_name_snapshot} />
            <Field icon={FileText} label="Purpose"     value={pr2.purpose} />
            <Field icon={CalendarDays} label="Date Required" value={format(new Date(pr2.date_required), 'MMM d, yyyy')} />
            <Field icon={CalendarDays} label="Generated"    value={format(new Date(pr2.generated_at), 'MMM d, yyyy')} />
          </div>

          {/* Remarks */}
          <div className="bg-white rounded-md border border-pq-neutral-200 p-5">
            <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide mb-3">Remarks</h2>
            {editing ? (
              <textarea
                value={editRemarks}
                onChange={e => setEditRemarks(e.target.value)}
                rows={3}
                placeholder="Optional procurement remarks..."
                className="w-full text-sm border border-pq-neutral-200 rounded-md px-3 py-2 text-pq-neutral-900 placeholder-[#BFC7D5] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            ) : (
              <p className="text-sm text-pq-neutral-900">{pr2.remarks || <span className="text-pq-neutral-400 italic">None</span>}</p>
            )}
          </div>

          {/* Grand total */}
          <div className="bg-pq-neutral-900 rounded-md p-5">
            {vatBreakdown && vatBreakdown.vatAmount > 0 ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm text-pq-neutral-400">
                  <span>Subtotal</span>
                  <span>{formatCommercialAmount(vatBreakdown.subtotal, canViewPrices)}</span>
                </div>
                <div className="flex items-center justify-between text-sm text-pq-neutral-400">
                  <span>VAT</span>
                  <span>{formatCommercialAmount(vatBreakdown.vatAmount, canViewPrices)}</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-pq-neutral-700">
                  <p className="text-xs font-bold text-pq-neutral-400 uppercase tracking-wide">Total</p>
                  <p className="text-2xl font-bold text-white">
                    {formatCommercialAmount(vatBreakdown.total, canViewPrices)}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold text-pq-neutral-400 uppercase tracking-wide mb-1">Grand Total</p>
                <p className="text-2xl font-bold text-white">
                  {formatCommercialAmount(vatBreakdown?.total ?? 0, canViewPrices)}
                </p>
              </>
            )}
            <p className="text-xs text-pq-neutral-400 mt-1">{displayItems.length} item{displayItems.length !== 1 ? 's' : ''}</p>
          </div>

        {/* Items table */}
          <DetailTableCard
            title={
              <div className="flex items-center gap-3">
                <Package className="w-4 h-4 text-pq-neutral-400" />
                <h2 className="text-sm font-semibold text-pq-neutral-900">Items ({pr2.items.length})</h2>
              </div>
            }
            headerClassName="px-5 py-3.5"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] table-fixed text-sm">
                <thead>
                  <tr className="bg-pq-neutral-50 border-b border-pq-neutral-200">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-pq-neutral-500 w-[2%]">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-pq-neutral-500 w-[15%]">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-pq-neutral-500 w-[13%]">Remarks</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-pq-neutral-500 w-[13%]">Warehouse Notes</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-pq-neutral-500 w-[4%]">Unit</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-pq-neutral-500 w-[4%]">Req.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-pq-neutral-500 w-[4%]">SOH</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-pq-neutral-500 w-[6%]">In-Transit</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-pq-neutral-500 w-[4%]">To Buy</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-pq-neutral-500 w-[8%]">Supplier</th>
                    {canViewPrices ? (
                      <>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-pq-neutral-500 w-[7%]">Unit Price</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-pq-neutral-500 w-[8%]">Total</th>
                      </>
                    ) : (
                      <th className="px-4 py-3 text-center text-xs font-semibold text-pq-neutral-500 w-[15%]">Pricing</th>
                    )}
                    <th className="px-4 py-3 text-center text-xs font-semibold text-pq-neutral-500 w-[12%]">Attachments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {displayItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-pq-neutral-50 transition">
                      <td className="px-4 py-3 text-xs text-pq-neutral-400">{item.item_order}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-pq-neutral-900">{item.description}</p>
                          {editing && canEdit ? (
                            <button
                              type="button"
                              onClick={() => handleToggleRawMaterial(idx, !(item.is_raw_material === true))}
                              title={
                                item.is_raw_material
                                  ? 'Click to remove raw-material classification on this PR2 line.'
                                  : 'Click to mark this PR2 line as raw material.'
                              }
                              className={`inline-flex items-center gap-1 rounded-full border font-semibold uppercase tracking-wide whitespace-nowrap px-2 py-0.5 text-[11px] transition ${
                                item.is_raw_material
                                  ? 'bg-pq-primary-50 text-pq-primary-700 border-pq-primary-200 hover:bg-pq-primary-100'
                                  : 'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200 hover:bg-pq-neutral-100'
                              }`}
                            >
                              <FlaskConical className="w-3 h-3" />
                              {item.is_raw_material ? 'Raw Mat.' : 'Mark raw'}
                            </button>
                          ) : (
                            <RawMaterialBadge isRawMaterial={item.is_raw_material} size="sm" />
                          )}
                        </div>
                        {item.quoted_description && item.quoted_description !== item.description && (
                          <p className="text-xs text-pq-neutral-400 mt-0.5">Quote: {item.quoted_description}</p>
                        )}
                        {item.is_alternative && (
                          <span className="inline-block mt-1 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
                            Alt. item
                          </span>
                        )}
                        {item.quote_justification && (
                          <p className="text-xs text-pq-warning-700 mt-1 flex items-start gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>
                              <strong>Award justification:</strong> {item.quote_justification}
                            </span>
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.pr1_remarks_snapshot ? (
                          <RequestorRemarks text={item.pr1_remarks_snapshot} />
                        ) : (
                          <span className="text-xs text-pq-neutral-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.pr1_quantity_requested_snapshot != null &&
                          item.pr1_quantity_requested_snapshot !== item.quantity_requested && (
                            <WarehouseQtyOverrideNote
                              originalQty={item.pr1_quantity_requested_snapshot}
                              currentQty={item.quantity_requested}
                              reason={item.quantity_override_reason_snapshot}
                              overriddenBy={item.quantity_overridden_by_name_snapshot}
                            />
                          )}
                        {item.lead_time_days && (
                          <p className="text-xs text-pq-neutral-400 mt-0.5">Lead: {item.lead_time_days}</p>
                        )}
                        {!(item.pr1_quantity_requested_snapshot != null &&
                          item.pr1_quantity_requested_snapshot !== item.quantity_requested) &&
                          !item.lead_time_days && (
                            <span className="text-xs text-pq-neutral-300">—</span>
                          )}
                      </td>
                      <td className="px-4 py-3 text-xs text-center text-pq-neutral-500">{item.unit_of_measure}</td>
                      <td className="px-4 py-3 text-right text-sm text-pq-neutral-900">{item.quantity_requested}</td>

                      {/* SOH and In-Transit — read-only; set by warehouse validation */}
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-pq-neutral-900">{item.qty_on_hand}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm text-pq-neutral-900">{item.qty_incoming}</span>
                      </td>

                      <td className="px-4 py-3 text-right">
                        {editing ? (
                          <input
                            type="number"
                            min="0"
                            max={undefined}
                            value={editItems[idx].quantity_to_purchase}
                            onChange={e => handleQtyChange(idx, 'quantity_to_purchase', e.target.value)}
                            className="w-16 text-right text-sm border border-pq-neutral-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <span className={`text-sm font-semibold ${item.quantity_to_purchase === 0 ? 'text-pq-neutral-400' : 'text-pq-neutral-900'}`}>
                            {item.quantity_to_purchase}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-pq-neutral-900">{item.supplier_name_snapshot}</p>
                        {item.selected_rfq_supplier_id && externalRfqIds.has(item.selected_rfq_supplier_id) && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold
                            text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-0.5">
                            <Store className="w-2.5 h-2.5 shrink-0" />
                            External vendor
                          </span>
                        )}
                      </td>
                      {canViewPrices ? (
                        <>
                          <td className="px-4 py-3 text-right text-sm text-pq-neutral-900">
                            {formatCommercialAmount(item.unit_price, true)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-sm font-semibold text-pq-neutral-900">
                              {formatCommercialAmount(item.total_price, true)}
                            </span>
                          </td>
                        </>
                      ) : (
                        <td colSpan={2} className="px-4 py-3 text-center text-xs text-pq-neutral-400">
                          {formatCommercialAmount(0, false)}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5 items-start min-w-0">
                          {(item.attachments?.length ?? 0) > 0 && (
                            <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                              <span className="text-[10px] font-semibold text-pq-neutral-400 uppercase tracking-wide w-9 shrink-0">Req.</span>
                              <PR1AttachmentsGallery attachments={item.attachments!} />
                            </div>
                          )}
                          {(item.quote_attachments?.length ?? 0) > 0 && (
                            <div className="flex items-center flex-wrap gap-1.5 min-w-0">
                              <span className="text-[10px] font-semibold text-pq-neutral-400 uppercase tracking-wide w-9 shrink-0">Quote</span>
                              <QuoteAttachmentPills attachments={item.quote_attachments!} />
                            </div>
                          )}
                          {(item.attachments?.length ?? 0) === 0 && (item.quote_attachments?.length ?? 0) === 0 && (
                            <span className="text-xs text-pq-neutral-300">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {canViewPrices && (
                  <tfoot>
                    {vatBreakdown && vatBreakdown.vatAmount > 0 && (
                      <>
                        <tr className="bg-pq-neutral-50 border-t-2 border-pq-neutral-200">
                          <td colSpan={11} className="px-4 py-3 text-right text-sm text-pq-neutral-500">
                            Subtotal
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-pq-neutral-500">
                            {formatCommercialAmount(vatBreakdown.subtotal, true)}
                          </td>
                          <td className="px-4 py-3"></td>
                        </tr>
                        <tr className="bg-pq-neutral-50">
                          <td colSpan={11} className="px-4 py-3 text-right text-sm text-pq-neutral-500">
                            VAT
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-pq-neutral-500">
                            {formatCommercialAmount(vatBreakdown.vatAmount, true)}
                          </td>
                          <td className="px-4 py-3"></td>
                        </tr>
                      </>
                    )}
                    <tr className="bg-pq-neutral-50 border-t-2 border-pq-neutral-200">
                      <td colSpan={11} className="px-4 py-3 text-right text-sm font-semibold text-pq-neutral-900">
                        Grand Total
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-pq-neutral-900">
                        {formatCommercialAmount(vatBreakdown?.total ?? 0, true)}
                      </td>
                      <td className="px-4 py-3"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </DetailTableCard>

          {/* Ready for approval notice */}
          {pr2.status === 'draft' && !editing && isProcurement && (
            <div className="mt-4 flex items-start gap-3 bg-pq-success-100 border border-pq-success-100 rounded-md px-5 py-4">
              <CheckCircle2 className="w-4 h-4 text-pq-success-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-pq-success-600">PR2 is ready for approval routing</p>
                <p className="text-xs text-pq-success-600 mt-0.5">
                  Review the inventory figures above, then click &ldquo;Submit for Approval&rdquo;.
                </p>
              </div>
            </div>
          )}
          {pr2.status === 'pending_approval' && (
            <div className="mt-4 flex items-start gap-3 bg-pq-warning-100 border border-pq-warning-100 rounded-md px-5 py-4">
              <Send className="w-4 h-4 text-pq-warning-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-pq-warning-600">Awaiting Approval</p>
                <p className="text-xs text-pq-warning-600 mt-0.5">This PR2 is routing through approval signatories.</p>
              </div>
            </div>
          )}
          {pr2.status === 'approved' && (
            <div className="mt-4 flex items-start gap-3 bg-pq-success-100 border border-pq-success-100 rounded-md px-5 py-4">
              <CheckCircle2 className="w-4 h-4 text-pq-success-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-pq-success-600">Approved</p>
                <p className="text-xs text-pq-success-600 mt-0.5">All approvals complete. Ready for Purchase Order.</p>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Approval Timeline + RFQ approval */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-20 space-y-4">
            {approvalDetail ? (
              <ApprovalPhaseTimeline
                phaseLabel="Approval"
                phaseSubLabel="PR2 Approval Chain"
                steps={approvalDetail.phase1_steps}
                actions={approvalDetail.phase1_actions}
                currentStep={approvalDetail.phase1_current_step}
                instanceStatus={approvalDetail.phase1_instance_status}
                preparer={approvalDetail.preparer}
              />
            ) : (
              <div className="bg-white rounded-md border border-pq-neutral-200 p-5">
                <p className="text-sm text-pq-neutral-400">Approval timeline will appear once submitted for approval.</p>
              </div>
            )}

            {rfqApprovalDetail && rfqApprovalInstanceId && profile && (
              <RfqApprovalPanel
                detail={rfqApprovalDetail}
                profile={profile}
                instanceId={rfqApprovalInstanceId}
                onCompleted={() => {
                  setLoading(true);
                  load();
                }}
              />
            )}
          </div>
        </div>
      </div>

      {showCanvassing && rfqDetail && (
        <div className="mt-8 pt-6 border-t border-pq-neutral-200">
          <CanvassingComparisonPanel
            detail={rfqDetail}
            matrix={rfqMatrix}
            canViewPrices={canViewPrices}
            editHref={isProcurementEditor && pr2.rfq_id ? `/rfq/${pr2.rfq_id}` : null}
          />
        </div>
      )}
    </AppShell>
  );
}

function Field({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="w-3.5 h-3.5 text-pq-neutral-400" />
        <p className="text-xs font-semibold text-pq-neutral-400 uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-sm text-pq-neutral-900 ${mono ? 'font-mono font-semibold' : 'font-medium'}`}>{value}</p>
    </div>
  );
}
