'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { DetailPageSkeleton } from '@/components/shared/structural-skeletons';
import LoadingState from '@/components/shared/LoadingState';
import { useAuth } from '@/context/AuthContext';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import { fetchTSQAGRNById, approveGRNItemQA, rejectGRNItemQA } from '@/lib/grn-tsqa';
import type { GRNWithItems } from '@/types/grn';
import { GRN_STATUS_LABELS } from '@/types/grn';
import { format } from 'date-fns';
import RawMaterialBadge from '@/components/shared/RawMaterialBadge';
import DetailBackButton from '@/components/shared/DetailBackButton';
import DetailHeaderLayout from '@/components/shared/DetailHeaderLayout';
import DetailTitleRow from '@/components/shared/DetailTitleRow';
import DetailTableCard from '@/components/shared/DetailTableCard';
import {
  CheckCircle2, TriangleAlert as AlertTriangle,
  ClipboardList, XCircle,
} from 'lucide-react';

export default function TSQAGRNDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const { handleBack } = useBackNavigation();

  const [grn, setGRN] = useState<GRNWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [rejectingItemId, setRejectingItemId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submittingReject, setSubmittingReject] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    fetchTSQAGRNById(id)
      .then((g) => {
        if (!g) { setError('GRN not found or not eligible for QA.'); return; }
        setGRN(g);
      })
      .catch(() => setError('Failed to load GRN.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (profile && profile.role !== 'tsqa' && profile.role !== 'admin') {
      router.replace('/dashboard');
      return;
    }
    load();
  }, [profile, router, load]);

  const handleApprove = async (itemId: string) => {
    if (!profile || !grn) return;
    setApprovingId(itemId);
    setActionError('');
    try {
      await approveGRNItemQA(itemId, profile);
      const stillUnresolved = grn.items.some(
        (i) => i.requires_qa && i.id !== itemId && (i.qa_status === 'pending' || i.qa_status === 'rejected'),
      );
      if (!stillUnresolved) {
        router.push('/tsqa/grn?qa_complete=1');
        return;
      }
      setLoading(true);
      load();
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Failed to approve item.');
    } finally {
      setApprovingId(null);
    }
  };

  const openReject = (itemId: string) => {
    setActionError('');
    setRejectReason('');
    setRejectingItemId(itemId);
  };

  const cancelReject = () => {
    setRejectingItemId(null);
    setRejectReason('');
  };

  const handleReject = async () => {
    if (!profile || !rejectingItemId) return;
    if (!rejectReason.trim()) {
      setActionError('A rejection reason is required.');
      return;
    }
    setSubmittingReject(true);
    setActionError('');
    try {
      await rejectGRNItemQA(rejectingItemId, rejectReason, profile);
      setRejectingItemId(null);
      setRejectReason('');
      setLoading(true);
      load();
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Failed to reject item.');
    } finally {
      setSubmittingReject(false);
    }
  };

  if (loading) {
    return (
      <AppShell title="GRN QA">
        <DetailPageSkeleton />
      </AppShell>
    );
  }

  if (error || !grn) {
    return (
      <AppShell title="GRN QA">
        <DetailBackButton className="mb-3" onClick={() => handleBack({ role: profile?.role, fallbackPath: '/tsqa/grn' })} />
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
          {error || 'GRN not found.'}
        </div>
      </AppShell>
    );
  }

  const pendingItems = grn.items.filter((i) => i.requires_qa && i.qa_status === 'pending');
  const rejectedItems = grn.items.filter((i) => i.requires_qa && i.qa_status === 'rejected');
  const statusLabel = GRN_STATUS_LABELS[grn.status as keyof typeof GRN_STATUS_LABELS] ?? grn.status;

  return (
    <AppShell title={`GRN QA ${grn.grn_number}`}>
      <DetailBackButton className="mb-3" onClick={() => handleBack({ role: profile?.role, fallbackPath: '/tsqa/grn' })} />

      <DetailHeaderLayout
        wrap
        left={
          <div>
            <DetailTitleRow wrap mb>
              <h1 className="text-xl font-bold text-pq-neutral-900 font-mono">{grn.grn_number}</h1>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold border rounded-full px-3 py-1 bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100">
                <ClipboardList className="w-3.5 h-3.5" />
                {statusLabel}
              </span>
            </DetailTitleRow>
            <p className="text-sm text-pq-neutral-500">{grn.supplier_name_snapshot} · PO {grn.po_number_snapshot}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-pq-neutral-400 flex-wrap">
              <span>DR: {grn.dr_no || '—'}</span>
              <span>INV: {grn.inv_no || '—'}</span>
              {grn.dr_date && <span>DR Date: {format(new Date(grn.dr_date), 'MMM d, yyyy')}</span>}
            </div>
          </div>
        }
      />

      {actionError && (
        <div className="flex items-start gap-2 bg-pq-danger-100 border border-pq-danger-100 text-pq-danger-600 text-sm rounded-md px-4 py-3 mb-4">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {actionError}
        </div>
      )}

      {pendingItems.length === 0 && rejectedItems.length === 0 ? (
        <div className="flex items-start gap-3 bg-pq-success-100 border border-pq-success-100 rounded-md px-5 py-4 mb-6">
          <CheckCircle2 className="w-4 h-4 text-pq-success-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-pq-success-600">All QA items approved</p>
            <p className="text-xs text-pq-success-600 mt-0.5">Warehouse may close this GRN when ready.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3 mb-6">
          {pendingItems.length > 0 && (
            <div className="flex items-start gap-3 bg-pq-warning-100 border border-pq-warning-100 rounded-md px-5 py-4">
              <AlertTriangle className="w-4 h-4 text-pq-warning-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-pq-warning-900">{pendingItems.length} item(s) pending QA approval</p>
                <p className="text-xs text-pq-warning-700 mt-0.5">Approve or reject each flagged item after inspection.</p>
              </div>
            </div>
          )}
          {rejectedItems.length > 0 && (
            <div className="flex items-start gap-3 bg-pq-danger-100 border border-pq-danger-100 rounded-md px-5 py-4">
              <XCircle className="w-4 h-4 text-pq-danger-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-pq-danger-600">{rejectedItems.length} item(s) rejected</p>
                <p className="text-xs text-pq-danger-600 mt-0.5">Warehouse has been notified. This GRN cannot be closed until resolved.</p>
              </div>
            </div>
          )}
        </div>
      )}

      <DetailTableCard title="Items for QA Inspection">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase">#</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase">Description</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase">Received</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-500 uppercase">QA Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-pq-neutral-200">
              {grn.items.filter((i) => i.requires_qa).map((item) => (
                <tr key={item.id} className="hover:bg-pq-neutral-50">
                  <td className="px-4 py-3 text-xs text-pq-neutral-400 font-mono">{item.item_order}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-pq-neutral-900">{item.description}</span>
                      <RawMaterialBadge isRawMaterial={item.is_raw_material} size="sm" />
                    </div>
                    {item.item_code && <p className="text-xs text-pq-neutral-400 font-mono">{item.item_code}</p>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm">{item.quantity_received}</td>
                  <td className="px-4 py-3 text-center">
                    {item.qa_status === 'approved' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-pq-success-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approved
                      </span>
                    ) : item.qa_status === 'rejected' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-pq-danger-600">
                        <XCircle className="w-3.5 h-3.5" />
                        Rejected
                      </span>
                    ) : (
                      <span className="text-xs font-semibold text-pq-warning-600">Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex flex-col items-end gap-1.5">
                      {grn.status !== 'closed' && (
                        <div className="inline-flex items-center gap-2">
                          {item.qa_status !== 'rejected' && (
                            <button
                              onClick={() => openReject(item.id)}
                              disabled={approvingId === item.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-pq-danger-600 hover:bg-pq-danger-100 text-pq-danger-600 text-xs font-semibold rounded-md transition disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          )}
                          {item.qa_status !== 'approved' && (
                            <button
                              onClick={() => handleApprove(item.id)}
                              disabled={approvingId === item.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pq-success-600 hover:bg-pq-success-600 text-white text-xs font-semibold rounded-md transition disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {approvingId === item.id ? 'Approving...' : item.qa_status === 'rejected' ? 'Change to Approve' : 'Approve'}
                            </button>
                          )}
                        </div>
                      )}
                      {item.qa_status === 'rejected' && item.qa_rejection_reason && (
                        <p className="text-xs text-pq-danger-600 max-w-[220px] text-right">
                          Reason: {item.qa_rejection_reason}
                        </p>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DetailTableCard>

      {rejectingItemId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-md border border-pq-neutral-200 shadow-lg w-full max-w-md p-5">
            <h3 className="text-sm font-bold text-pq-neutral-900 mb-1">Reject QA item</h3>
            <p className="text-xs text-pq-neutral-500 mb-3">
              Warehouse will be notified. This blocks the GRN from being closed until resolved.
            </p>
            <textarea
              autoFocus
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Reason for rejection..."
              className="w-full text-sm border border-pq-neutral-200 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pq-danger-600/30 focus:border-pq-danger-600"
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={cancelReject}
                disabled={submittingReject}
                className="px-3 py-1.5 text-xs font-semibold text-pq-neutral-500 hover:text-pq-neutral-900 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={submittingReject || !rejectReason.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-pq-danger-600 hover:bg-pq-danger-600 text-white text-xs font-semibold rounded-md transition disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" />
                {submittingReject ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
