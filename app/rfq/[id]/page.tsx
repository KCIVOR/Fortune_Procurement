'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import { useAuth } from '@/context/AuthContext';
import {
  fetchRfqDetail,
  buildQuoteMatrix,
  assignSuppliers,
  issueRfq,
  closeRfq,
  saveItemSelection,
} from '@/lib/canvassing';
import { generatePR2FromRfq, fetchPR2ByRfqId } from '@/lib/pr2';
import type { RfqDetailView, QuoteMatrixRow } from '@/types/canvassing';
import { UserPlus, SendHorizontal as Send, CircleCheck as CheckCircle2, Circle as XCircle, Users, Trophy, CalendarDays, FileText, Building2, TriangleAlert as AlertTriangle, CheckCheck, CircleDot, Loader as Loader2, Replace, Clock, ClipboardList, MessageSquare, Mail } from 'lucide-react';
import RelatedRecords from '@/components/shared/RelatedRecords';
import { format } from 'date-fns';
import DetailBackButton from '@/components/shared/DetailBackButton';
import DetailHeaderLayout from '@/components/shared/DetailHeaderLayout';
import DetailTitleRow from '@/components/shared/DetailTitleRow';
import DetailInfoField from '@/components/shared/DetailInfoField';
import { toast } from 'sonner';
import { formatRfqForViber } from '@/lib/viber-utils';
import { db } from '@/lib/supabase';



const STATUS_BADGE: Record<string, string> = {
  draft:     'bg-[#F7F9FC] text-[#40527A] border-[#D8E2FF]',
  open:      'bg-amber-50 text-amber-700 border-amber-200',
  closed:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-red-50 text-red-600 border-red-200',
};
const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft', open: 'Open', closed: 'Closed', cancelled: 'Cancelled',
};
const SUPPLIER_STATUS_COLOR: Record<string, string> = {
  invited:   'bg-amber-50 text-amber-700 border-amber-200',
  submitted: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  declined:  'bg-red-50 text-red-600 border-red-200',
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

  // Supplier assignment panel
  const [assigning, setAssigning]       = useState(false);
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    if (!id) return;
    Promise.all([
      fetchRfqDetail(id),
      fetchPR2ByRfqId(id),
    ])
      .then(([d, pr2]) => {
        if (!d) { setError('RFQ not found.'); return; }
        setDetail(d);
        setMatrix(buildQuoteMatrix(d));
        setExistingPR2Id(pr2?.id ?? null);
      })
      .catch(() => setError('Failed to load RFQ.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  if (loading) return (
    <AppShell title="RFQ Detail">
      <div className="flex items-center justify-center h-64">
        <LoadingState message="Loading RFQ..." />
      </div>
    </AppShell>
  );

  if (error || !detail) return (
    <AppShell title="RFQ Detail">
      <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">
        {error || 'RFQ not found.'}
      </div>
    </AppShell>
  );

  const { rfq, pr1, items, suppliers, allSuppliers } = detail;
  const isOpen   = rfq.status === 'open';
  const isDraft  = rfq.status === 'draft';
  const isClosed = rfq.status === 'closed';

  const assignedIds = new Set(suppliers.map(s => s.supplier_id));
  const availableSuppliers = allSuppliers.filter(s => !assignedIds.has(s.id));

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
      await assignSuppliers(rfq.id, Array.from(selectedIds), allSuppliers);
      setAssigning(false);
      setSelectedIds(new Set());
      setLoading(true);
      load();
    } catch (e: any) {
      setActionError(e.message ?? 'Failed to assign suppliers.');
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

  const handleGeneratePR2 = async () => {
    if (!profile) return;
    if (existingPR2Id) { router.push(`/pr2/${existingPR2Id}`); return; }
    setWorking(true);
    setActionError('');
    try {
      const pr2Id = await generatePR2FromRfq(rfq.id, profile);
      router.push(`/pr2/${pr2Id}`);
    } catch (e: any) {
      setActionError(e.message ?? 'Failed to generate PR2.');
    } finally {
      setWorking(false);
    }
  };

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
      
      const supplierUserIds = targets.map(s => s.supplier_id);
      const { data: profiles } = await db
        .from('profiles')
        .select('id, email')
        .in('id', supplierUserIds);
      
      const emailMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.email]));
      const emailTargets = targets
        .filter(s => emailMap[s.supplier_id])
        .map(s => ({
          email: emailMap[s.supplier_id],
          actionUrl: `/supplier/quotations/${s.id}`
        }));

      if (emailTargets.length === 0) {
        toast.error('No email addresses found for selected supplier(s).');
        return;
      }

      const res = await fetch('/api/rfq/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      if (!res.ok) {
        const data = await res.json();
        const firstError = data.results?.find((r: any) => r.error)?.error?.message;
        throw new Error(firstError || 'Failed to send email.');
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
      await saveItemSelection(rfq.id, pr1ItemId, rfqSupplierId, '', profile);
      setLoading(true);
      load();
    } catch (e: any) {
      setActionError(e.message ?? 'Failed to save selection.');
    }
  };

  return (
    <AppShell title="RFQ Detail">
      <DetailBackButton className="mb-2" onClick={() => handleBack({ role: profile?.role })} />

      {/* Header */}
      <DetailHeaderLayout
        left={
          <div>
            <DetailTitleRow mb>
              <h1 className="text-2xl font-bold text-[#0F1F3A] font-mono">{rfq.rfq_number}</h1>
              <span className={`inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-1 ${STATUS_BADGE[rfq.status]}`}>
                {STATUS_LABEL[rfq.status]}
              </span>
            </DetailTitleRow>
            <p className="text-sm text-[#40527A]">
              PR1 <span className="font-semibold text-[#0F1F3A]">{pr1.pr1_number}</span>
              {' '}· {pr1.department_name_snapshot} · {pr1.purpose}
            </p>
          </div>
        }
        right={
          <div className="flex items-center gap-2 shrink-0">
            {isClosed && (
              <ActionButton
                icon={ClipboardList}
                label={existingPR2Id ? 'View PR2' : 'Generate PR2'}
                color="emerald"
                onClick={handleGeneratePR2}
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
                label="Close & Finalise"
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
                onClick={() => setAssigning(true)}
                disabled={working || availableSuppliers.length === 0}
              />
            )}

          </div>
        }
      />

      {actionError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-[4px] px-4 py-3 mb-4">
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
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-[4px] px-5 py-4 mb-6">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">Assign at least 2 suppliers before you can issue this RFQ.</p>
        </div>
      )}
      {isDraft && suppliers.length >= 2 && (
        <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-[4px] px-5 py-4 mb-6">
          <CircleDot className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-800">Ready to issue. Click "Issue RFQ" to open it to suppliers.</p>
        </div>
      )}
      {isOpen && !allItemsSelected && submittedSuppliers > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-[4px] px-5 py-4 mb-6">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">Select a winning supplier for each item below, then close the RFQ.</p>
        </div>
      )}
      {isOpen && pendingSubstitutes > 0 && (
        <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-[4px] px-5 py-4 mb-6">
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
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-[4px] px-5 py-4 mb-6">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <p className="text-sm text-emerald-800">Canvassing complete. Winning suppliers have been selected for all items.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: PR1 summary + suppliers */}
        <div className="space-y-4">
          {/* PR1 info card */}
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-5 space-y-3">
            <h2 className="text-xs font-bold text-[#40527A] uppercase tracking-wide">PR1 Details</h2>
            <DetailInfoField
              icon={<FileText className="w-3.5 h-3.5 text-[#BFC7D5]" />}
              label="PR1 Number"
              value={pr1.pr1_number}
              labelTone="muted"
              labelSpacing="compact"
              valueClassName="font-mono font-semibold"
            />
            <DetailInfoField
              icon={<Building2 className="w-3.5 h-3.5 text-[#BFC7D5]" />}
              label="Department"
              value={pr1.department_name_snapshot}
              labelTone="muted"
              labelSpacing="compact"
            />
            <DetailInfoField
              icon={<FileText className="w-3.5 h-3.5 text-[#BFC7D5]" />}
              label="Purpose"
              value={pr1.purpose}
              labelTone="muted"
              labelSpacing="compact"
            />
            {rfq.deadline && (
              <DetailInfoField
                icon={<CalendarDays className="w-3.5 h-3.5 text-[#BFC7D5]" />}
                label="RFQ Deadline"
                value={format(new Date(rfq.deadline), 'MMM d, yyyy')}
                labelTone="muted"
                labelSpacing="compact"
              />
            )}
            {rfq.notes && (
              <div>
                <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-[#0F1F3A]">{rfq.notes}</p>
              </div>
            )}
          </div>

          {/* Items list */}
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#D8E2FF]">
              <h2 className="text-xs font-bold text-[#40527A] uppercase tracking-wide">Items ({items.length})</h2>
            </div>
            <div className="divide-y divide-[#D8E2FF]">
              {items.map(item => (
                <div key={item.id} className="px-5 py-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-[#BFC7D5] w-4 shrink-0">{item.item_order}.</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0F1F3A]">{item.description}</p>
                      <p className="text-xs text-[#BFC7D5] mt-0.5">
                        {item.item_code && <span className="font-mono">{item.item_code} · </span>}
                        {item.quantity_requested} {item.unit_of_measure}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Suppliers */}
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#D8E2FF]">
              <Users className="w-4 h-4 text-[#BFC7D5]" />
              <h2 className="text-xs font-bold text-[#40527A] uppercase tracking-wide">Suppliers ({suppliers.length})</h2>
            </div>
            {suppliers.length === 0 ? (
              <p className="text-xs text-[#BFC7D5] px-5 py-4">No suppliers assigned yet.</p>
            ) : (
              <div className="divide-y divide-[#D8E2FF]">
                {suppliers.map(s => (
                  <div key={s.id} className="px-5 py-3 flex items-center justify-between hover:bg-[#F7F9FC] group transition">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#0F1F3A]">{s.supplier_name_snapshot}</p>
                      <span className={`inline-block mt-1 text-[10px] font-medium border rounded-full px-2 py-0.5 ${SUPPLIER_STATUS_COLOR[s.status]}`}>
                        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleSendEmail(s.id)}
                        className="p-2 text-[#BFC7D5] hover:text-[#1E4BFF] hover:bg-[#E5EAFF] rounded-full transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Resend email to this supplier"
                        disabled={working}
                      >
                        <Mail className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleCopyForViber(s.id)}
                        className="p-2 text-[#BFC7D5] hover:text-[#1E4BFF] hover:bg-[#E5EAFF] rounded-full transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Copy personal link for Viber"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </div>
                  </div>


                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: quotation comparison matrix */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#D8E2FF]">
              <Trophy className="w-4 h-4 text-[#BFC7D5]" />
              <h2 className="text-sm font-semibold text-[#0F1F3A]">Quotation Comparison</h2>
              <span className="text-xs text-[#BFC7D5] ml-auto">
                {submittedSuppliers}/{suppliers.length} suppliers responded
              </span>
            </div>

            {suppliers.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-[#BFC7D5]">Assign suppliers to begin collecting quotations.</p>
              </div>
            ) : matrix.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-[#BFC7D5]">No items found for this PR1.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F7F9FC] border-b border-[#D8E2FF]">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[#40527A] w-1/3">Item</th>
                      {suppliers.map(s => (
                        <th key={s.id} className="text-left px-4 py-3 text-xs font-semibold text-[#40527A] min-w-[160px]">
                          <div className="flex items-center gap-1.5">
                            {s.supplier_name_snapshot}
                            <span className={`text-xs border rounded-full px-1.5 py-0.5 ${SUPPLIER_STATUS_COLOR[s.status]}`}>
                              {s.status === 'submitted' ? '✓' : '…'}
                            </span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8E2FF]">
                    {matrix.map(row => (
                      <MatrixRow
                        key={row.item.id}
                        row={row}
                        suppliers={suppliers}
                        canSelect={isOpen && !isClosed}
                        onSelect={handleSelectWinner}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Assign suppliers panel */}
      {assigning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[4px] w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-[#D8E2FF]">
              <h2 className="text-base font-semibold text-[#0F1F3A]">Canvass Supplier</h2>
              <p className="text-xs text-[#40527A] mt-0.5">Select 2–3 suppliers for this RFQ</p>
            </div>
            <div className="p-4 max-h-72 overflow-y-auto space-y-1">
              {availableSuppliers.length === 0 ? (
                <p className="text-sm text-[#BFC7D5] text-center py-4">All suppliers already assigned.</p>
              ) : (
                availableSuppliers.map(s => {
                  const checked = selectedIds.has(s.id);
                  return (
                    <label key={s.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-[#F7F9FC] cursor-pointer transition">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          const next = new Set(selectedIds);
                          checked ? next.delete(s.id) : next.add(s.id);
                          setSelectedIds(next);
                        }}
                        className="w-4 h-4 rounded border-[#D8E2FF] text-[#1E4BFF]"
                      />
                      <span className="text-sm font-medium text-[#0F1F3A]">{s.full_name}</span>
                    </label>
                  );
                })
              )}
            </div>
            {actionError && (
              <p className="text-sm text-red-600 px-6 pb-2">{actionError}</p>
            )}
            <div className="px-6 pb-5 flex items-center justify-end gap-3 border-t border-[#D8E2FF] pt-4">
              <button
                onClick={() => { setAssigning(false); setSelectedIds(new Set()); }}
                disabled={working}
                className="px-4 py-2 text-sm text-[#40527A] hover:text-[#0F1F3A] transition"
              >
                Cancel
              </button>
              <button
                onClick={handleAssign}
                disabled={working || selectedIds.size === 0}
                className="px-5 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition disabled:opacity-50 flex items-center gap-2"
              >
                {working && <Loader2 className="w-4 h-4 animate-spin" />}
                Assign {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ─── Matrix row ───────────────────────────────────────────────────────────────

function MatrixRow({
  row,
  suppliers,
  canSelect,
  onSelect,
}: {
  row: QuoteMatrixRow;
  suppliers: { id: string; supplier_name_snapshot: string; status: string }[];
  canSelect: boolean;
  onSelect: (pr1ItemId: string, rfqSupplierId: string) => void;
}) {
  return (
    <tr className="hover:bg-[#F7F9FC] transition">
      <td className="px-4 py-3 align-top">
        <p className="font-medium text-[#0F1F3A] text-xs">{row.item.description}</p>
        <p className="text-xs text-[#BFC7D5] mt-0.5">
          {row.item.quantity_requested} {row.item.unit_of_measure}
        </p>
      </td>
      {suppliers.map(supplier => {
        const quote = row.quotes.find(q => q.rfq_supplier_id === supplier.id);
        const isSelected = row.selected_rfq_supplier_id === supplier.id;

        return (
          <td key={supplier.id} className={`px-4 py-3 align-top border-l border-[#D8E2FF] ${isSelected ? 'bg-emerald-50' : ''}`}>
            {!quote || quote.unit_price === 0 ? (
              <p className="text-xs text-[#BFC7D5] italic">No quote</p>
            ) : (
              <div className="space-y-1">
                {quote.is_alternative && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="inline-block text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
                      Alt. item
                    </span>
                    {quote.substitute_decision === 'accepted' && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Accepted
                      </span>
                    )}
                    {quote.substitute_decision === 'rejected' && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5">
                        <XCircle className="w-2.5 h-2.5" /> Rejected
                      </span>
                    )}
                    {quote.substitute_decision === null && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                        <Clock className="w-2.5 h-2.5" /> Pending
                      </span>
                    )}
                  </div>
                )}
                <p className="text-xs text-[#40527A] leading-snug">{quote.quoted_description || '—'}</p>
                <p className={`text-sm font-bold ${quote.substitute_decision === 'rejected' ? 'text-[#BFC7D5] line-through' : 'text-[#0F1F3A]'}`}>
                  ₱{quote.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  <span className="text-xs font-normal text-[#BFC7D5]"> / {row.item.unit_of_measure}</span>
                </p>
                <p className="text-xs text-[#BFC7D5]">
                  Total: ₱{quote.total_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-[#BFC7D5]">Lead: {quote.lead_time_days}d</p>
                {quote.remarks && <p className="text-xs text-[#BFC7D5] italic">"{quote.remarks}"</p>}

                {canSelect && (() => {
                  const blocked = quote.is_alternative && quote.substitute_decision !== 'accepted';
                  const tooltip = quote.is_alternative
                    ? (quote.substitute_decision === null
                        ? 'Requestor has not yet decided on this substitute.'
                        : quote.substitute_decision === 'rejected'
                          ? 'Requestor rejected this substitute.'
                          : '')
                    : '';
                  return (
                    <button
                      onClick={() => !blocked && onSelect(row.item.id, supplier.id)}
                      disabled={blocked}
                      title={tooltip}
                      className={`mt-1.5 inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md transition ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : blocked
                            ? 'bg-[#F7F9FC] text-[#BFC7D5] cursor-not-allowed'
                            : 'bg-[#F7F9FC] text-[#40527A] hover:bg-emerald-100 hover:text-emerald-700'
                      }`}
                    >
                      {isSelected ? (
                        <><CheckCircle2 className="w-3 h-3" /> Selected</>
                      ) : blocked && quote.substitute_decision === null ? (
                        <><Clock className="w-3 h-3" /> Awaiting decision</>
                      ) : blocked && quote.substitute_decision === 'rejected' ? (
                        <><XCircle className="w-3 h-3" /> Rejected</>
                      ) : (
                        <><Trophy className="w-3 h-3" /> Select</>
                      )}
                    </button>
                  );
                })()}
                {!canSelect && isSelected && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-md px-2 py-1">
                    <CheckCircle2 className="w-3 h-3" /> Winner
                  </span>
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
  color: 'blue' | 'emerald' | 'slate';
  onClick: () => void;
  disabled?: boolean;
}) {
  const cls = {
    blue:    'bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white',
    emerald: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    slate:   'bg-white border border-[#D8E2FF] text-[#0F1F3A] hover:bg-[#F7F9FC]',
  }[color];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-[4px] transition disabled:opacity-40 ${cls}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}
