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
  issueRfq,
  closeRfq,
  saveItemSelection,
} from '@/lib/canvassing';
import { generatePR2FromRfq, fetchPR2ByRfqId } from '@/lib/pr2';
import type { RfqDetailView, QuoteMatrixRow, CanvassSupplierCandidate } from '@/types/canvassing';
import { UserPlus, SendHorizontal as Send, CircleCheck as CheckCircle2, Circle as XCircle, Users, Trophy, CalendarDays, FileText, Building2, TriangleAlert as AlertTriangle, CheckCheck, CircleDot, Loader as Loader2, Replace, Clock, ClipboardList, MessageSquare, Mail, Info, BadgeCheck } from 'lucide-react';
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
  const isOpen   = rfq.status === 'open';
  const isDraft  = rfq.status === 'draft';
  const isClosed = rfq.status === 'closed';

  const assignedIds = new Set(suppliers.map(s => s.supplier_id));
  const availableSuppliers = allSuppliers.filter(s => !assignedIds.has(s.id));

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
      
      const emailMap = Object.fromEntries(
        ((profiles ?? []) as { id: string; email: string | null }[]).map(p => [p.id, p.email])
      );
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
              <h1 className="text-2xl font-bold text-pq-neutral-900 font-mono">{rfq.rfq_number}</h1>
              <span className={`inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-1 ${STATUS_BADGE[rfq.status]}`}>
                {STATUS_LABEL[rfq.status]}
              </span>
            </DetailTitleRow>
            <p className="text-sm text-pq-neutral-500">
              PR1 <span className="font-semibold text-pq-neutral-900">{pr1.pr1_number}</span>
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
            <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">PR1 Details</h2>
            <DetailInfoField
              icon={<FileText className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="PR1 Number"
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
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs text-pq-neutral-400 w-4 shrink-0">{item.item_order}.</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-pq-neutral-900">{item.description}</p>
                      <p className="text-xs text-pq-neutral-400 mt-0.5">
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
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-pq-neutral-200">
              <Users className="w-4 h-4 text-pq-neutral-400" />
              <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">Suppliers ({suppliers.length})</h2>
            </div>
            {suppliers.length === 0 ? (
              <p className="text-xs text-pq-neutral-400 px-5 py-4">No suppliers assigned yet.</p>
            ) : (
              <div className="divide-y divide-pq-neutral-200">
                {suppliers.map(s => (
                  <div key={s.id} className="px-5 py-3 flex items-center justify-between hover:bg-pq-neutral-50 group transition">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-pq-neutral-900">{s.supplier_name_snapshot}</p>
                      <span className={`inline-block mt-1 text-[10px] font-medium border rounded-full px-2 py-0.5 ${SUPPLIER_STATUS_COLOR[s.status]}`}>
                        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                      </span>
                    </div>
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
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-pq-neutral-50 border-b border-pq-neutral-200">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-pq-neutral-500 w-1/3">Item</th>
                      {suppliers.map(s => (
                        <th key={s.id} className="text-left px-4 py-3 text-xs font-semibold text-pq-neutral-500 min-w-[160px]">
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
                  <tbody className="divide-y divide-pq-neutral-200">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-md w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-pq-neutral-200 shadow-lg">
            <div className="px-6 py-4 border-b border-pq-neutral-200 shrink-0">
              <h2 className="text-lg font-semibold text-pq-neutral-900">Canvass Suppliers</h2>
              <p className="text-xs text-pq-neutral-500 mt-1">
                Select suppliers to invite. Review accreditation and product readiness before assigning.
              </p>
            </div>
            <div className="px-6 py-3 bg-pq-warning-100/80 border-b border-amber-100 shrink-0">
              <div className="flex gap-2 text-xs text-pq-warning-600">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Warnings are informational only.</p>
                  <p>
                    Supplier quote awardability is enforced later when winners are chosen: linked catalog
                    products must be verified. Suppliers without verified products may still be invited.
                  </p>
                </div>
              </div>
            </div>
            <div className="px-6 py-2 border-b border-pq-neutral-200 shrink-0 flex gap-2 text-[11px] text-pq-neutral-500">
              <Info className="w-3.5 h-3.5 shrink-0 text-pq-neutral-400" />
              <p>
                Suppliers without verified products may still be invited, but their quote items cannot be
                awarded until a verified product is linked on the quotation.
              </p>
            </div>
            <div className="flex-1 min-h-0 overflow-auto">
              {availableSuppliers.length === 0 ? (
                <p className="text-sm text-pq-neutral-400 text-center py-10 px-6">
                  {allSuppliers.length === 0
                    ? 'No supplier users are registered in the system.'
                    : 'All suppliers are already assigned to this RFQ.'}
                </p>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="sticky top-0 bg-pq-neutral-50 border-b border-pq-neutral-200 z-10">
                    <tr className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide">
                      <th className="w-10 px-3 py-2.5" aria-label="Select" />
                      <th className="px-3 py-2.5">Supplier</th>
                      <th className="px-3 py-2.5 hidden md:table-cell">Email</th>
                      <th className="px-3 py-2.5 min-w-[120px]">Accreditation</th>
                      <th className="px-3 py-2.5 text-center min-w-[6rem]">Verified products</th>
                      <th className="px-3 py-2.5 text-center min-w-[7rem] hidden sm:table-cell">
                        Pending validation
                      </th>
                      <th className="px-3 py-2.5 text-center min-w-[4.5rem] hidden sm:table-cell">
                        Rejected
                      </th>
                      <th className="px-3 py-2.5 text-center min-w-[5rem] hidden lg:table-cell">
                        Withdrawn
                      </th>
                      <th className="px-3 py-2.5 min-w-[160px]">Readiness</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pq-neutral-200">
                    {availableSuppliers.map(c => {
                      const checked = selectedIds.has(c.id);
                      const acc = accreditationLabelForCandidate(c);
                      const readiness = readinessForCandidate(c);
                      return (
                        <tr
                          key={c.id}
                          className={`hover:bg-pq-neutral-50/80 ${checked ? 'bg-pq-primary-50/50' : ''}`}
                        >
                          <td className="px-3 py-2.5 align-top">
                            <input
                              type="checkbox"
                              checked={checked}
                              aria-label={`Select ${c.full_name}`}
                              onChange={() => {
                                const next = new Set(selectedIds);
                                checked ? next.delete(c.id) : next.add(c.id);
                                setSelectedIds(next);
                              }}
                              className="w-4 h-4 rounded border-pq-neutral-200 text-pq-primary-600 mt-1"
                            />
                          </td>
                          <td className="px-3 py-2.5 align-top font-medium text-pq-neutral-900">
                            {c.full_name}
                          </td>
                          <td className="px-3 py-2.5 align-top text-xs text-pq-neutral-500 hidden md:table-cell">
                            {c.email && c.email.trim() !== '' ? c.email : '—'}
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
                          <td className="px-3 py-2.5 align-top text-center tabular-nums">
                            {c.verified_product_count}
                          </td>
                          <td className="px-3 py-2.5 align-top text-center tabular-nums hidden sm:table-cell">
                            {c.pending_product_count}
                          </td>
                          <td className="px-3 py-2.5 align-top text-center tabular-nums hidden sm:table-cell">
                            {c.rejected_product_count}
                          </td>
                          <td className="px-3 py-2.5 align-top text-center tabular-nums hidden lg:table-cell">
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
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {actionError && (
              <p className="text-sm text-pq-danger-600 px-6 py-2 border-t border-pq-neutral-200">{actionError}</p>
            )}
            <div className="px-6 py-4 flex items-center justify-end gap-3 border-t border-pq-neutral-200 shrink-0 bg-white">
              <button
                type="button"
                onClick={() => { setAssigning(false); setSelectedIds(new Set()); }}
                disabled={working}
                className="px-4 py-2 text-sm text-pq-neutral-500 hover:text-pq-neutral-900 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssign}
                disabled={working || selectedIds.size === 0}
                className="px-5 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition disabled:opacity-50 flex items-center gap-2"
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
  if (c.verified_product_count > 0) {
    nodes.push(
      <span
        key="verified"
        className={`${chip} text-pq-success-600 bg-white border-pq-success-100`}
      >
        Has Verified Products
      </span>,
    );
  } else {
    nodes.push(
      <span
        key="no-verified"
        className={`${chip} text-pq-neutral-500 bg-white border-pq-neutral-200`}
      >
        No Verified Products
      </span>,
    );
  }
  if (c.pending_product_count > 0) {
    nodes.push(
      <span
        key="pending-val"
        className={`${chip} text-pq-warning-600 bg-white border-pq-warning-100`}
      >
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
    <tr className="hover:bg-pq-neutral-50 transition">
      <td className="px-4 py-3 align-top">
        <p className="font-medium text-pq-neutral-900 text-xs">{row.item.description}</p>
        <p className="text-xs text-pq-neutral-400 mt-0.5">
          {row.item.quantity_requested} {row.item.unit_of_measure}
        </p>
      </td>
      {suppliers.map(supplier => {
        const quote      = row.quotes.find(q => q.rfq_supplier_id === supplier.id);
        const isSelected = row.selected_rfq_supplier_id === supplier.id;

        const explicitNoQuote = quote?.response_status === 'no_quote';

        // Phase 7: catalog product state
        const hasProduct    = !!quote?.supplier_product_id;
        const isVerified    = quote?.supplier_product_status === 'verified';
        const isWithdrawn   = quote?.supplier_product_status === 'withdrawn';
        const canAward      = !explicitNoQuote && hasProduct && isVerified;

        return (
          <td
            key={supplier.id}
            className={`px-4 py-3 align-top border-l border-pq-neutral-200 ${isSelected ? 'bg-pq-success-100' : ''}`}
          >
            {!quote ? (
              <p className="text-xs text-pq-neutral-400 italic">No quote</p>
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
              <div className="space-y-1">
                {/* Alternative item badges */}
                {quote.is_alternative && (
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="inline-block text-xs font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
                      Alt. item
                    </span>
                    {quote.substitute_decision === 'accepted' && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded px-1.5 py-0.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Accepted
                      </span>
                    )}
                    {quote.substitute_decision === 'rejected' && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5">
                        <XCircle className="w-2.5 h-2.5" /> Rejected
                      </span>
                    )}
                    {quote.substitute_decision === null && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-pq-warning-600 bg-pq-warning-100 border border-pq-warning-100 rounded px-1.5 py-0.5">
                        <Clock className="w-2.5 h-2.5" /> Pending
                      </span>
                    )}
                  </div>
                )}

                {/* Phase 7/8: catalog product line */}
                {hasProduct && isVerified ? (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded px-1.5 py-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      {quote.supplier_product_name ?? 'Verified product'}
                    </span>
                    {quote.supplier_product_code && (
                      <span className="text-xs font-mono text-pq-neutral-400">
                        {quote.supplier_product_code}
                      </span>
                    )}
                  </div>
                ) : hasProduct && !isVerified ? (
                  // Phase 8: proposed product pending validation
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-xs text-pq-warning-600 bg-pq-warning-100 border border-pq-warning-100 rounded px-1.5 py-0.5 flex-wrap">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span className="font-medium">
                        {quote.supplier_product_name ?? 'Proposed product'}
                        {quote.supplier_product_code ? ` (${quote.supplier_product_code})` : ''}
                      </span>
                      {isWithdrawn ? (
                        <span className="text-pq-warning-600 font-semibold">— Withdrawn — Cannot Award</span>
                      ) : (
                        <span className="text-pq-warning-600 capitalize">
                          — {(quote.supplier_product_status ?? 'pending').replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-pq-warning-600">
                      <span>
                        {isWithdrawn
                          ? 'Supplier withdrew this catalog product — quote stays visible; cannot award.'
                          : 'Pending validation — cannot award yet.'}
                      </span>
                      {quote.supplier_product_id && (
                        <Link
                          href={`/accreditation/products/${quote.supplier_product_id}`}
                          className="underline font-medium hover:text-pq-neutral-900 transition"
                        >
                          Review →
                        </Link>
                      )}
                    </div>
                  </div>
                ) : (
                  // No catalog product at all (old/legacy quote)
                  <div className="flex items-center gap-1 text-xs text-pq-warning-600">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    <span className="font-medium">No catalog product — Cannot Award</span>
                  </div>
                )}

                <p className="text-xs text-pq-neutral-500 leading-snug">{quote.quoted_description || '—'}</p>
                <p
                  className={`text-sm font-bold ${
                    quote.substitute_decision === 'rejected'
                      ? 'text-pq-neutral-400 line-through'
                      : 'text-pq-neutral-900'
                  }`}
                >
                  ₱{quote.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  <span className="text-xs font-normal text-pq-neutral-400">
                    {' '}/ {row.item.unit_of_measure}
                  </span>
                </p>
                <p className="text-xs text-pq-neutral-400">
                  Total: ₱{quote.total_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-pq-neutral-400">Lead: {quote.lead_time_days}d</p>
                {quote.remarks && (
                  <p className="text-xs text-pq-neutral-400 italic">&ldquo;{quote.remarks}&rdquo;</p>
                )}

                {/* Phase 7: Can Award indicator */}
                {canSelect && (
                  <p className={`text-xs font-semibold ${canAward ? 'text-pq-success-600' : 'text-pq-warning-600'}`}>
                    Can Award: {canAward ? 'Yes' : 'No'}
                  </p>
                )}

                {/* Select button — blocked if no verified product */}
                {canSelect && (() => {
                  const altBlocked     = quote.is_alternative && quote.substitute_decision !== 'accepted';
                  const productBlocked = !canAward;
                  const blocked        = altBlocked || productBlocked;

                  const tooltip = altBlocked
                    ? (quote.substitute_decision === null
                        ? 'Requestor has not yet decided on this substitute.'
                        : quote.substitute_decision === 'rejected'
                          ? 'Requestor rejected this substitute.'
                          : '')
                    : productBlocked
                      ? isWithdrawn
                        ? 'Supplier withdrew this catalog product. Cannot award.'
                        : 'Supplier has not linked a verified catalog product to this quote. Cannot award.'
                      : '';

                  return (
                    <button
                      onClick={() => !blocked && onSelect(row.item.id, supplier.id)}
                      disabled={blocked}
                      title={tooltip}
                      className={`mt-1.5 inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md transition ${
                        isSelected
                          ? 'bg-pq-success-600 text-white'
                          : blocked
                            ? 'bg-pq-neutral-50 text-pq-neutral-400 cursor-not-allowed'
                            : 'bg-pq-neutral-50 text-pq-neutral-500 hover:bg-pq-success-100 hover:text-pq-success-600'
                      }`}
                    >
                      {isSelected ? (
                        <><CheckCircle2 className="w-3 h-3" /> Selected</>
                      ) : altBlocked && quote.substitute_decision === null ? (
                        <><Clock className="w-3 h-3" /> Awaiting decision</>
                      ) : altBlocked && quote.substitute_decision === 'rejected' ? (
                        <><XCircle className="w-3 h-3" /> Rejected</>
                      ) : productBlocked ? (
                        <><AlertTriangle className="w-3 h-3" /> No catalog product</>
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
    blue:    'bg-pq-primary-600 hover:bg-pq-neutral-900 text-white',
    emerald: 'bg-pq-success-600 hover:bg-pq-success-600 text-white',
    slate:   'bg-white border border-pq-neutral-200 text-pq-neutral-900 hover:bg-pq-neutral-50',
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
