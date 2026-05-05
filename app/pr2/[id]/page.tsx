'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import { useAuth } from '@/context/AuthContext';
import { fetchPR2ById, savePR2Items, calcPR2GrandTotal } from '@/lib/pr2';
import { submitPR2ForApproval, canActOnPR2Step, fetchPR2ApprovalDetail } from '@/lib/pr2-approvals';
import { fetchPOByPR2Id } from '@/lib/po';
import { supabase } from '@/lib/supabase';
import type { PR2WithItems, PR2Item } from '@/types/pr2';
import type { PR2ApprovalDetail, ApprovalActionRecord, WorkflowStep } from '@/types/approvals';
import { PR2_STATUS_LABELS } from '@/types/pr2';
import { format } from 'date-fns';
import { ChevronLeft, FileText, Building2, CalendarDays, User, Printer, Package, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Pencil, Save, X as XIcon, RefreshCw, Send, ArrowRight, ShoppingCart, ClipboardList, Lock, RotateCcw, Circle as XCircle, CheckCheck } from 'lucide-react';
import RelatedRecords from '@/components/shared/RelatedRecords';

const STATUS_STYLES: Record<string, string> = {
  draft:                   'bg-[#F7F9FC] text-[#40527A] border-[#D8E2FF]',
  pending_phase1_approval: 'bg-amber-50 text-amber-700 border-amber-200',
  phase1_approved:         'bg-blue-50 text-blue-700 border-blue-200',
  pending_phase2_approval: 'bg-orange-50 text-orange-700 border-orange-200',
  phase2_approved:         'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled:               'bg-red-50 text-red-600 border-red-200',
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
  lead_time_days:   number;
  total_price:      number;
  remarks:          string;
  pr1_item_id:      string | null;
  selected_rfq_supplier_id: string | null;
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
    remarks:          item.remarks ?? '',
    pr1_item_id:      item.pr1_item_id,
    selected_rfq_supplier_id: item.selected_rfq_supplier_id,
  };
}

export default function PR2DetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const { handleBack } = useBackNavigation();

  const [pr2, setPR2] = useState<PR2WithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approvalDetail, setApprovalDetail] = useState<PR2ApprovalDetail | null>(null);

  const [editing, setEditing] = useState(false);
  const [editItems, setEditItems] = useState<EditableItem[]>([]);
  const [editRemarks, setEditRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

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
      fetchPOByPR2Id(id).then(po => setExistingPOId(po?.id ?? null)).catch(() => null),
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
      .then(([data]) => {
        if (!data) { setError('PR2 not found.'); return; }
        setPR2(data);
        setEditItems(data.items.map(toEditableItem));
        setEditRemarks(data.remarks ?? '');
      })
      .catch(() => setError('Failed to load PR2.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

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

  const handleQtyChange = (idx: number, field: 'qty_on_hand' | 'qty_incoming', val: string) => {
    setEditItems(prev => {
      const next = [...prev];
      const item = { ...next[idx] };
      item[field] = Number(val) || 0;
      item.quantity_to_purchase = Math.max(0, item.quantity_requested - item.qty_on_hand - item.qty_incoming);
      item.total_price = item.unit_price * item.quantity_to_purchase;
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
  const [existingPOId, setExistingPOId] = useState<string | null>(null);

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
  const canEdit = isProcurement && pr2?.status === 'draft';

  if (loading) return (
    <AppShell title="PR2 Detail">
      <div className="flex items-center justify-center h-64">
        <LoadingState message="Loading PR2..." />
      </div>
    </AppShell>
  );

  if (error || !pr2) return (
    <AppShell title="PR2 Detail">
      <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">
        {error || 'PR2 not found.'}
      </div>
    </AppShell>
  );

  const displayItems = editing ? editItems : pr2.items.map(toEditableItem);
  const grandTotal = calcPR2GrandTotal(displayItems);

  const userCanActNow = !!(
    profile &&
    activeInstanceId &&
    activeStepRole &&
    activeStepPosition &&
    canActOnPR2Step(profile, activeStepRole, activeStepPosition)
  );

  return (
    <AppShell title={`PR2 ${pr2.pr2_number}`}>
      <div className="mb-2">
        <button onClick={() => handleBack({ role: profile?.role })} className="inline-flex items-center gap-1 text-xs text-[#40527A] hover:text-[#0F1F3A] transition">
          <ChevronLeft className="w-3.5 h-3.5" />
          Back
        </button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-[#0F1F3A] font-mono">{pr2.pr2_number}</h1>
            <span className={`inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-1 ${STATUS_STYLES[pr2.status] ?? STATUS_STYLES.draft}`}>
              {PR2_STATUS_LABELS[pr2.status]}
            </span>
          </div>
          <p className="text-sm text-[#40527A]">
            {pr2.department_name_snapshot} · {pr2.purpose}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canEdit && !editing && (
            <button
              onClick={handleEditToggle}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#D8E2FF] text-[#0F1F3A] text-sm font-semibold rounded-[4px] hover:bg-[#F7F9FC] transition"
            >
              <Pencil className="w-4 h-4" />
              Edit Inventory
            </button>
          )}
          {canEdit && !editing && (
            <button
              onClick={handleSubmitForApproval}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition disabled:opacity-50"
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
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#D8E2FF] text-[#40527A] text-sm font-semibold rounded-[4px] hover:bg-[#F7F9FC] transition"
              >
                <XIcon className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition disabled:opacity-50"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </>
          )}
          <Link
            href={`/pr2/${pr2.id}/print`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-[4px] transition"
          >
            <Printer className="w-4 h-4" />
            Print
          </Link>
        </div>
      </div>

      {(saveError || submitError) && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-[4px] px-4 py-3 mb-4">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {saveError || submitError}
        </div>
      )}

      {/* Action required banner for procurement actors */}
      {userCanActNow && activeInstanceId && (
        <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-[4px] px-5 py-4 mb-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800">Your action is required</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {activeStepLabel} — {activeStepPosition}
              </p>
            </div>
          </div>
          <Link
            href={`/approvals/pr2/${activeInstanceId}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-[4px] transition shrink-0"
          >
            Review & Act
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* PO banner — shown when PR2 is fully approved */}
      {pr2.status === 'phase2_approved' && existingPOId && (
        <div className="flex items-center justify-between gap-4 bg-emerald-50 border border-emerald-200 rounded-[4px] px-5 py-4 mb-4">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-5 h-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Purchase Order generated</p>
              <p className="text-xs text-emerald-700 mt-0.5">A PO has already been created for this PR2.</p>
            </div>
          </div>
          <Link
            href={`/po/${existingPOId}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-[4px] transition shrink-0"
          >
            View PO
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
      {pr2.status === 'phase2_approved' && !existingPOId && profile?.position === 'Buyer' && (
        <div className="flex items-center justify-between gap-4 bg-blue-50 border border-blue-200 rounded-[4px] px-5 py-4 mb-4">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800">Ready for Purchase Order</p>
              <p className="text-xs text-blue-700 mt-0.5">This PR2 is fully approved. Generate a PO to proceed.</p>
            </div>
          </div>
          <Link
            href={`/po/new?pr2=${pr2.id}`}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition shrink-0"
          >
            Generate PO
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {editing && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-[4px] px-5 py-4 mb-6">
          <Pencil className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-800">
            Enter current Qty on Hand and Qty In-Transit for each item. Quantity to Purchase is calculated automatically.
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
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-5 space-y-4">
            <h2 className="text-xs font-bold text-[#40527A] uppercase tracking-wide">PR2 Details</h2>

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
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-5">
            <h2 className="text-xs font-bold text-[#40527A] uppercase tracking-wide mb-3">Remarks</h2>
            {editing ? (
              <textarea
                value={editRemarks}
                onChange={e => setEditRemarks(e.target.value)}
                rows={3}
                placeholder="Optional procurement remarks..."
                className="w-full text-sm border border-[#D8E2FF] rounded-[4px] px-3 py-2 text-[#0F1F3A] placeholder-[#BFC7D5] focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            ) : (
              <p className="text-sm text-[#0F1F3A]">{pr2.remarks || <span className="text-[#BFC7D5] italic">None</span>}</p>
            )}
          </div>

          {/* Grand total */}
          <div className="bg-slate-900 rounded-[4px] p-5">
            <p className="text-xs font-bold text-[#BFC7D5] uppercase tracking-wide mb-1">Grand Total</p>
            <p className="text-2xl font-bold text-white">
              ₱{grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-[#BFC7D5] mt-1">{displayItems.length} item{displayItems.length !== 1 ? 's' : ''}</p>
          </div>

        {/* Items table */}
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#D8E2FF]">
              <Package className="w-4 h-4 text-[#BFC7D5]" />
              <h2 className="text-sm font-semibold text-[#0F1F3A]">Items ({pr2.items.length})</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#F7F9FC] border-b border-[#D8E2FF]">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#40527A] w-6">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#40527A]">Description</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-[#40527A] w-14">Unit</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[#40527A] w-16">Req.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[#40527A] w-20">SOH</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[#40527A] w-20">In-Transit</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[#40527A] w-20">To Buy</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[#40527A]">Supplier</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[#40527A] w-24">Unit Price</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[#40527A] w-28">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8E2FF]">
                  {displayItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-[#F7F9FC] transition">
                      <td className="px-4 py-3 text-xs text-[#BFC7D5]">{item.item_order}</td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-[#0F1F3A]">{item.description}</p>
                        {item.quoted_description && item.quoted_description !== item.description && (
                          <p className="text-xs text-[#BFC7D5] mt-0.5">Quote: {item.quoted_description}</p>
                        )}
                        {item.is_alternative && (
                          <span className="inline-block mt-1 text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
                            Alt. item
                          </span>
                        )}
                        {item.lead_time_days > 0 && (
                          <p className="text-xs text-[#BFC7D5] mt-0.5">Lead: {item.lead_time_days}d</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-center text-[#40527A]">{item.unit_of_measure}</td>
                      <td className="px-4 py-3 text-right text-sm text-[#0F1F3A]">{item.quantity_requested}</td>

                      {/* Editable inventory fields */}
                      <td className="px-4 py-3 text-right">
                        {editing ? (
                          <input
                            type="number"
                            min="0"
                            value={editItems[idx].qty_on_hand}
                            onChange={e => handleQtyChange(idx, 'qty_on_hand', e.target.value)}
                            className="w-16 text-right text-sm border border-[#D8E2FF] rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="text-sm text-[#0F1F3A]">{item.qty_on_hand}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editing ? (
                          <input
                            type="number"
                            min="0"
                            value={editItems[idx].qty_incoming}
                            onChange={e => handleQtyChange(idx, 'qty_incoming', e.target.value)}
                            className="w-16 text-right text-sm border border-[#D8E2FF] rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <span className="text-sm text-[#0F1F3A]">{item.qty_incoming}</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <span className={`text-sm font-semibold ${item.quantity_to_purchase === 0 ? 'text-[#BFC7D5]' : 'text-[#0F1F3A]'}`}>
                          {item.quantity_to_purchase}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-[#0F1F3A]">{item.supplier_name_snapshot}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-[#0F1F3A]">
                        ₱{item.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-[#0F1F3A]">
                          ₱{(item.unit_price * item.quantity_to_purchase).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#F7F9FC] border-t-2 border-[#D8E2FF]">
                    <td colSpan={9} className="px-4 py-3 text-right text-sm font-semibold text-[#0F1F3A]">
                      Grand Total
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-[#0F1F3A]">
                      ₱{grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Ready for approval notice */}
          {pr2.status === 'draft' && !editing && isProcurement && (
            <div className="mt-4 flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-[4px] px-5 py-4">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">PR2 is ready for approval routing</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Review the inventory figures above, then click "Submit for Approval" to start Phase 1.
                </p>
              </div>
            </div>
          )}
          {pr2.status === 'pending_phase1_approval' && (
            <div className="mt-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-[4px] px-5 py-4">
              <Send className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Awaiting Phase 1 Approval</p>
                <p className="text-xs text-amber-700 mt-0.5">This PR2 is routing through Phase 1 signatories.</p>
              </div>
            </div>
          )}
          {pr2.status === 'phase1_approved' && (
            <div className="mt-4 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-[4px] px-5 py-4">
              <CheckCircle2 className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-800">Phase 1 Approved — Awaiting Phase 2</p>
                <p className="text-xs text-blue-700 mt-0.5">Phase 2 routing has been automatically started.</p>
              </div>
            </div>
          )}
          {pr2.status === 'pending_phase2_approval' && (
            <div className="mt-4 flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-[4px] px-5 py-4">
              <Send className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-800">Awaiting Phase 2 Approval</p>
                <p className="text-xs text-orange-700 mt-0.5">This PR2 is routing through Phase 2 signatories.</p>
              </div>
            </div>
          )}
          {pr2.status === 'phase2_approved' && (
            <div className="mt-4 flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-[4px] px-5 py-4">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Fully Approved</p>
                <p className="text-xs text-emerald-700 mt-0.5">Both approval phases complete. Ready for Purchase Order.</p>
              </div>
            </div>
          )}
        </div>

        {/* Right column: Approval Timeline */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-20">
            {approvalDetail ? (
              <div className="space-y-4">
                {/* Phase 1 timeline */}
                <PhaseTimeline
                  phaseLabel="Phase 1 Approval"
                  phaseSubLabel="PR2 Phase 1 — Procurement & Department Chain"
                  steps={approvalDetail.phase1_steps}
                  actions={approvalDetail.phase1_actions}
                  currentStep={approvalDetail.phase1_current_step}
                  instanceStatus={approvalDetail.phase1_instance_status}
                />

                {/* Phase 2 timeline */}
                {(approvalDetail.phase2_instance_id || approvalDetail.phase2_steps.length > 0) && (
                  <PhaseTimeline
                    phaseLabel="Phase 2 Approval"
                    phaseSubLabel="PR2 Phase 2 — Buyer Chain"
                    steps={approvalDetail.phase2_steps}
                    actions={approvalDetail.phase2_actions}
                    currentStep={approvalDetail.phase2_current_step ?? 1}
                    instanceStatus={approvalDetail.phase2_instance_status ?? 'active'}
                    notStarted={!approvalDetail.phase2_instance_id}
                  />
                )}
              </div>
            ) : (
              <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-5">
                <p className="text-sm text-[#BFC7D5]">Approval timeline will appear once submitted for approval.</p>
              </div>
            )}
          </div>
        </div>
      </div>
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
        <Icon className="w-3.5 h-3.5 text-[#BFC7D5]" />
        <p className="text-xs font-semibold text-[#BFC7D5] uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-sm text-[#0F1F3A] ${mono ? 'font-mono font-semibold' : 'font-medium'}`}>{value}</p>
    </div>
  );
}

function PhaseTimeline({
  phaseLabel,
  phaseSubLabel,
  steps,
  actions,
  currentStep,
  instanceStatus,
  notStarted,
}: {
  phaseLabel: string;
  phaseSubLabel: string;
  steps: WorkflowStep[];
  actions: ApprovalActionRecord[];
  currentStep: number;
  instanceStatus: string;
  notStarted?: boolean;
}) {
  return (
    <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
      <div className="px-6 py-4 border-b border-[#D8E2FF]">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-3.5 h-3.5 text-[#BFC7D5]" />
          <div>
            <h2 className="text-xs font-semibold text-[#0F1F3A] uppercase tracking-wide">{phaseLabel}</h2>
            <p className="text-xs text-[#BFC7D5] mt-0.5">{phaseSubLabel}</p>
          </div>
          {notStarted && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-[#BFC7D5] bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] px-2.5 py-1">
              <Lock className="w-3 h-3" />
              Not started
            </span>
          )}
          {!notStarted && instanceStatus === 'approved' && (
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
              <CheckCircle2 className="w-3 h-3" /> Complete
            </span>
          )}
          {!notStarted && instanceStatus === 'active' && (
            <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-[#0F1F3A] bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] px-2.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1E4BFF] animate-pulse" />
              In Progress
            </span>
          )}
        </div>
      </div>
      <div className="p-6">
        {notStarted ? (
          <p className="text-sm text-[#BFC7D5] italic">Phase 2 begins automatically after Phase 1 is fully approved.</p>
        ) : (
          <WorkflowTimeline
            steps={steps}
            actions={actions}
            currentStep={currentStep}
            instanceStatus={instanceStatus}
          />
        )}
      </div>
    </div>
  );
}

function WorkflowTimeline({
  steps,
  actions,
  currentStep,
  instanceStatus,
}: {
  steps: WorkflowStep[];
  actions: ApprovalActionRecord[];
  currentStep: number;
  instanceStatus: string;
}) {
  return (
    <ol className="relative space-y-0">
      {steps.map((step, idx) => {
        const action = actions.find(a => a.step_order === step.step_order);
        const isComplete = !!action;
        const isCurrent = !isComplete && step.step_order === currentStep && instanceStatus === 'active';
        const isPending = !isComplete && !isCurrent;

        return (
          <li key={step.step_order} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 ${
                  isComplete
                    ? action!.action === 'approved'
                      ? 'bg-emerald-600 border-emerald-600'
                      : action!.action === 'rejected'
                        ? 'bg-red-600 border-red-600'
                        : 'bg-orange-500 border-orange-500'
                    : isCurrent
                      ? 'bg-[#F7F9FC] border-[#1E4BFF]'
                      : 'bg-[#F7F9FC] border-[#D8E2FF]'
                }`}
              >
                {isComplete ? (
                  action!.action === 'approved' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  ) : action!.action === 'rejected' ? (
                    <XCircle className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5 text-white" />
                  )
                ) : isCurrent ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1E4BFF] animate-pulse" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-[#BFC7D5]" />
                )}
              </div>
              {idx < steps.length - 1 && (
                <div className={`w-0.5 flex-1 my-1 min-h-[24px] ${isComplete ? 'bg-[#D8E2FF]' : 'bg-[#D8E2FF]'}`} />
              )}
            </div>

            <div className="pb-5 flex-1 min-w-0">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-sm font-semibold text-[#0F1F3A]">
                  Step {step.step_order}: {step.position_required}
                </span>
                <span className="text-xs text-[#BFC7D5]">{step.action_label}</span>
                {step.is_final && <span className="text-xs text-[#BFC7D5] italic">· Final</span>}
              </div>

              {isComplete && (
                <div className="mt-1.5 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <ActionPill action={action!.action} />
                    <span className="text-xs text-[#40527A] font-medium">{action!.actor_name_snapshot}</span>
                    <span className="text-xs text-[#BFC7D5]">· {format(new Date(action!.acted_at), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                  {action!.remarks && (
                    <p className="text-xs text-[#40527A] italic ml-0.5">"{action!.remarks}"</p>
                  )}
                </div>
              )}
              {isCurrent && <p className="mt-1 text-xs text-[#1E4BFF] font-medium">Awaiting action</p>}
              {isPending && <p className="mt-1 text-xs text-[#BFC7D5]">Not yet reached</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ActionPill({ action }: { action: string }) {
  if (action === 'approved')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
        <CheckCircle2 className="w-3 h-3" /> Approved
      </span>
    );
  if (action === 'rejected')
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
        <XCircle className="w-3 h-3" /> Rejected
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
      <RotateCcw className="w-3 h-3" /> Revision Requested
    </span>
  );
}
