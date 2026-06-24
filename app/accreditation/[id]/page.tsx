'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import ComplianceTraceability from '@/components/shared/ComplianceTraceability';
import StatusChip from '@/components/shared/StatusChip';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { useAuth } from '@/context/AuthContext';
import {
  getAccreditationById,
  markAccreditationUnderReview,
  requestMissingDocuments,
  approveAccreditation,
  rejectAccreditation,
  revokeAccreditation,
  reopenAccreditationForReview,
} from '@/lib/accreditation';
import {
  getDocumentsByAccreditationId,
  getAccreditationDocumentSignedUrl,
} from '@/lib/accreditation-documents';
import {
  getProductsByAccreditationId,
  type ProductWithRSESummary,
} from '@/lib/rse';
import type { SupplierAccreditation, SupplierDocument } from '@/types/database';
import { format } from 'date-fns';
import {
  ChevronLeft,
  BadgeCheck,
  FileText,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Eye,
  MessageSquare,
  RotateCcw,
  CalendarClock,
} from 'lucide-react';
import { differenceInDays } from 'date-fns';

// ─── Status helpers ───────────────────────────────────────────────────────────

function accreditationChip(status: string): { variant: StatusVariant; label: string } {
  const map: Record<string, { variant: StatusVariant; label: string }> = {
    draft:             { variant: 'draft',     label: 'Draft' },
    submitted:         { variant: 'pending',   label: 'Submitted' },
    under_review:      { variant: 'in_review', label: 'Under Procurement Review' },
    missing_documents: { variant: 'pending',   label: 'Missing Documents Requested' },
    approved:          { variant: 'approved',  label: 'Accredited' },
    rejected:          { variant: 'rejected',  label: 'Rejected' },
    withdrawn:         { variant: 'cancelled', label: 'Withdrawn' },
    expired:           { variant: 'cancelled', label: 'Expired' },
  };
  return map[status] ?? { variant: 'draft', label: status };
}

// ─── Action types ─────────────────────────────────────────────────────────────

type ActionPanel = 'none' | 'missing_docs' | 'approve' | 'reject' | 'revoke' | 'reopen';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccreditationDetailPage() {
  const { id }      = useParams<{ id: string }>();
  const { profile } = useAuth();

  const [accreditation, setAccreditation] = useState<SupplierAccreditation | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');

  const [busy, setBusy]               = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const [activePanel, setActivePanel] = useState<ActionPanel>('none');
  const [noteInput, setNoteInput]     = useState('');

  const [documents, setDocuments]         = useState<SupplierDocument[]>([]);
  const [docsLoading, setDocsLoading]     = useState(false);
  const [linkedProducts, setLinkedProducts] = useState<ProductWithRSESummary[]>([]);

  const loadDocs = useCallback(async (accId: string) => {
    setDocsLoading(true);
    try {
      setDocuments(await getDocumentsByAccreditationId(accId));
    } catch { /* non-blocking */ }
    finally { setDocsLoading(false); }
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const acc = await getAccreditationById(id);
      if (!acc) { setError('Accreditation not found.'); return; }
      setAccreditation(acc);
      const [, products] = await Promise.all([
        loadDocs(acc.id),
        getProductsByAccreditationId(acc.id),
      ]);
      setLinkedProducts(products);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to load accreditation.');
    } finally {
      setLoading(false);
    }
  }, [id, loadDocs]);

  useEffect(() => { load(); }, [load]);

  // ── Action helpers ───────────────────────────────────────────────────────────

  const openPanel = (panel: ActionPanel) => {
    setActivePanel(panel);
    setNoteInput('');
    setActionError('');
    setActionSuccess('');
  };

  const handleMarkUnderReview = async () => {
    if (!profile || !accreditation) return;
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await markAccreditationUnderReview(accreditation.id, profile);
      await load();
      setActionSuccess('Marked as under review.');
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRequestMissingDocs = async () => {
    if (!profile || !accreditation) return;
    if (!noteInput.trim()) { setActionError('Please enter the missing documents note.'); return; }
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await requestMissingDocuments(accreditation.id, noteInput.trim(), profile);
      await load();
      setActivePanel('none');
      setActionSuccess('Missing documents requested. Supplier has been notified.');
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    if (!profile || !accreditation) return;
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await approveAccreditation(accreditation.id, profile, noteInput.trim() || undefined);
      await load();
      setActivePanel('none');
      setActionSuccess('Accreditation approved. Supplier has been notified.');
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!profile || !accreditation) return;
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await rejectAccreditation(accreditation.id, profile, noteInput.trim() || undefined);
      await load();
      setActivePanel('none');
      setActionSuccess('Accreditation rejected. Supplier has been notified.');
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async () => {
    if (!profile || !accreditation) return;
    if (!noteInput.trim()) {
      setActionError('Please enter a reason for revoking accreditation.');
      return;
    }
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await revokeAccreditation(accreditation.id, profile, noteInput.trim());
      await load();
      setActivePanel('none');
      setActionSuccess('Accreditation revoked. Supplier has been notified.');
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleReopen = async () => {
    if (!profile || !accreditation) return;
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await reopenAccreditationForReview(
        accreditation.id,
        profile,
        noteInput.trim() || undefined
      );
      await load();
      setActivePanel('none');
      setActionSuccess('Accreditation reopened for review. Supplier has been notified.');
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const status = accreditation?.status ?? '';
  const canMarkUnderReview = status === 'submitted';
  const canRequestDocs     = status === 'submitted' || status === 'under_review';
  const canApprove         = status === 'submitted' || status === 'under_review' || status === 'missing_documents';
  const canReject          = status === 'submitted' || status === 'under_review' || status === 'missing_documents';
  const isClosed           = status === 'rejected' || status === 'withdrawn';
  const canPostApproval    = status === 'approved' || status === 'expired';
  const canRevoke          = status === 'approved';
  const showReviewActions  = !isClosed && !canPostApproval;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppShell title="Accreditation Review">
      {/* Back */}
      <div className="mb-4">
        <Link
          href="/accreditation"
          className="inline-flex items-center gap-1 text-sm text-pq-neutral-500 hover:text-pq-neutral-900 transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Accreditation Queue
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading accreditation…" />
        </div>
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
          {error}
        </div>
      ) : !accreditation ? null : (
        <div className="space-y-4">

          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-pq-neutral-900">Supplier Accreditation Review</h1>
              <p className="text-sm text-pq-neutral-500 mt-0.5">
                Application submitted for Procurement evaluation and approval. Accreditation is separate from product verification — verified products can be awarded directly, while raw-material lines may still proceed with unverified items via procurement justification.
              </p>
            </div>
            {accreditationChip(status) && (
              <StatusChip
                status={accreditationChip(status).variant}
                label={accreditationChip(status).label}
              />
            )}
          </div>

          {/* ── Status card ── */}
          <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-4">

            {status === 'withdrawn' && (
              <div className="rounded-md border border-pq-neutral-200 bg-pq-neutral-50 px-4 py-3 text-sm text-pq-neutral-500">
                <span className="font-semibold text-pq-neutral-900">Withdrawn by supplier.</span>{' '}
                This application is closed. Documents remain on file for audit.
              </div>
            )}

            {status === 'expired' && (
              <div className="rounded-md border border-pq-danger-100 bg-pq-danger-100 px-4 py-3 flex items-start gap-2.5">
                <CalendarClock className="w-4 h-4 text-pq-danger-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-pq-danger-600">Accreditation Expired</p>
                  <p className="text-xs text-pq-danger-600 mt-0.5">
                    This accreditation has expired
                    {accreditation.valid_until
                      ? ` on ${format(new Date(accreditation.valid_until), 'MMMM d, yyyy')}`
                      : ''}.
                    Use <span className="font-semibold">Reopen for Review</span> to begin a renewal.
                  </p>
                </div>
              </div>
            )}

            {status === 'approved' && accreditation.valid_until && (() => {
              const daysLeft = differenceInDays(new Date(accreditation.valid_until), new Date());
              if (daysLeft <= 30) return (
                <div className="rounded-md border border-pq-warning-100 bg-pq-warning-100 px-4 py-3 flex items-start gap-2.5">
                  <CalendarClock className="w-4 h-4 text-pq-warning-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-pq-warning-600">
                    <span className="font-semibold">Expiring soon —</span>{' '}
                    valid until {format(new Date(accreditation.valid_until), 'MMMM d, yyyy')} ({daysLeft} day{daysLeft !== 1 ? 's' : ''} left).
                  </p>
                </div>
              );
              return null;
            })()}

            {/* Key dates */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <InfoField
                label="Created"
                value={format(new Date(accreditation.created_at), 'MMM d, yyyy')}
              />
              {accreditation.submitted_at && (
                <InfoField
                  label="Submitted"
                  value={format(new Date(accreditation.submitted_at), 'MMM d, yyyy')}
                />
              )}
              {accreditation.reviewed_at && (
                <InfoField
                  label="Last Reviewed"
                  value={format(new Date(accreditation.reviewed_at), 'MMM d, yyyy')}
                />
              )}
              {accreditation.approved_at && (
                <InfoField
                  label="Approved"
                  value={format(new Date(accreditation.approved_at), 'MMM d, yyyy')}
                />
              )}
              {accreditation.valid_until && (
                <InfoField
                  label="Valid Until"
                  value={format(new Date(accreditation.valid_until), 'MMM d, yyyy')}
                />
              )}
              {accreditation.rejected_at && (
                <InfoField
                  label="Rejected"
                  value={format(new Date(accreditation.rejected_at), 'MMM d, yyyy')}
                />
              )}
            </div>

            {/* Existing notes */}
            {(accreditation.missing_documents_note || accreditation.review_notes) && (
              <div className="border-t border-pq-neutral-200 pt-4 space-y-3">
                {accreditation.missing_documents_note && (
                  <div className="bg-pq-warning-100 border border-pq-warning-100 rounded-md p-3">
                    <p className="text-xs font-semibold text-pq-warning-600 mb-1 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Missing Documents Note (sent to supplier)
                    </p>
                    <p className="text-sm text-pq-warning-600">{accreditation.missing_documents_note}</p>
                  </div>
                )}
                {accreditation.review_notes && (
                  <div className="bg-pq-neutral-50 border border-pq-neutral-200 rounded-md p-3">
                    <p className="text-xs font-semibold text-pq-neutral-500 mb-1">Review Notes</p>
                    <p className="text-sm text-pq-neutral-900">{accreditation.review_notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Action bar + panels (in-review applications) ── */}
          {showReviewActions && (
            <div className="bg-white rounded-md border border-pq-neutral-200">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-pq-neutral-200 flex-wrap">
                <p className="text-sm font-semibold text-pq-neutral-900 mr-2">Actions</p>

                {canMarkUnderReview && (
                  <button
                    onClick={handleMarkUnderReview}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-pq-primary-700 bg-pq-primary-50 border border-pq-primary-200 rounded-md hover:bg-pq-primary-100 transition disabled:opacity-50"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Mark Under Review
                  </button>
                )}

                {canRequestDocs && (
                  <button
                    onClick={() => openPanel(activePanel === 'missing_docs' ? 'none' : 'missing_docs')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
                      activePanel === 'missing_docs'
                        ? 'bg-pq-warning-100 text-pq-warning-600 border-amber-300'
                        : 'text-pq-warning-600 bg-pq-warning-100 border-pq-warning-100 hover:bg-pq-warning-100'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Request Missing Docs
                  </button>
                )}

                {canApprove && (
                  <button
                    onClick={() => openPanel(activePanel === 'approve' ? 'none' : 'approve')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
                      activePanel === 'approve'
                        ? 'bg-pq-success-100 text-pq-success-600 border-pq-success-200'
                        : 'text-pq-success-600 bg-pq-success-100 border-pq-success-100 hover:bg-pq-success-100'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve
                  </button>
                )}

                {canReject && (
                  <button
                    onClick={() => openPanel(activePanel === 'reject' ? 'none' : 'reject')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
                      activePanel === 'reject'
                        ? 'bg-pq-danger-100 text-pq-danger-600 border-red-300'
                        : 'text-pq-danger-600 bg-pq-danger-100 border-pq-danger-100 hover:bg-pq-danger-100'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                )}
              </div>

              {/* Inline action panels */}
              {activePanel !== 'none' && (
                <div className="p-5 space-y-3 border-b border-pq-neutral-200">
                  {actionError && (
                    <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-3 text-sm text-pq-danger-600">
                      {actionError}
                    </div>
                  )}

                  {activePanel === 'missing_docs' && (
                    <>
                      <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                        Describe what documents are missing
                      </p>
                      <textarea
                        value={noteInput}
                        onChange={e => setNoteInput(e.target.value)}
                        rows={3}
                        placeholder="e.g. Please provide your valid Business Permit and SEC registration documents."
                        className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleRequestMissingDocs}
                          disabled={busy}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-md transition disabled:opacity-50"
                        >
                          {busy ? 'Sending…' : 'Send Request'}
                        </button>
                        <button
                          onClick={() => openPanel('none')}
                          className="px-4 py-2 text-xs font-medium text-pq-neutral-500 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md hover:bg-pq-neutral-200 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}

                  {activePanel === 'approve' && (
                    <>
                      <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                        Approval Notes (optional)
                      </p>
                      <textarea
                        value={noteInput}
                        onChange={e => setNoteInput(e.target.value)}
                        rows={2}
                        placeholder="Optional notes for the supplier."
                        className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleApprove}
                          disabled={busy}
                          className="px-4 py-2 bg-pq-success-600 hover:bg-pq-success-600 text-white text-xs font-semibold rounded-md transition disabled:opacity-50"
                        >
                          {busy ? 'Approving…' : 'Confirm Approval'}
                        </button>
                        <button
                          onClick={() => openPanel('none')}
                          className="px-4 py-2 text-xs font-medium text-pq-neutral-500 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md hover:bg-pq-neutral-200 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}

                  {activePanel === 'reject' && (
                    <>
                      <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                        Rejection Reason (optional)
                      </p>
                      <textarea
                        value={noteInput}
                        onChange={e => setNoteInput(e.target.value)}
                        rows={2}
                        placeholder="Optional reason for rejection."
                        className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleReject}
                          disabled={busy}
                          className="px-4 py-2 bg-pq-danger-600 hover:bg-pq-danger-600 text-white text-xs font-semibold rounded-md transition disabled:opacity-50"
                        >
                          {busy ? 'Rejecting…' : 'Confirm Rejection'}
                        </button>
                        <button
                          onClick={() => openPanel('none')}
                          className="px-4 py-2 text-xs font-medium text-pq-neutral-500 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md hover:bg-pq-neutral-200 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Success banner inside action card */}
              {actionSuccess && (
                <div className="px-5 py-3.5 bg-pq-success-100 border-b border-pq-success-100 text-sm text-pq-success-600 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {actionSuccess}
                </div>
              )}
            </div>
          )}

          {/* ── Post-approval actions ── */}
          {canPostApproval && (
            <div className="bg-white rounded-md border border-pq-neutral-200">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-pq-neutral-200 flex-wrap">
                <p className="text-sm font-semibold text-pq-neutral-900 mr-2">Post-Approval Actions</p>

                <button
                  onClick={() => openPanel(activePanel === 'reopen' ? 'none' : 'reopen')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
                    activePanel === 'reopen'
                      ? 'bg-pq-primary-50 text-pq-primary-700 border-pq-primary-200'
                      : 'text-pq-primary-700 bg-pq-primary-50 border-pq-primary-200 hover:bg-pq-primary-100'
                  }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reopen for Review
                </button>

                {canRevoke && (
                  <button
                    onClick={() => openPanel(activePanel === 'revoke' ? 'none' : 'revoke')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
                      activePanel === 'revoke'
                        ? 'bg-pq-danger-100 text-pq-danger-600 border-red-300'
                        : 'text-pq-danger-600 bg-pq-danger-100 border-pq-danger-100 hover:bg-pq-danger-100'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Revoke Accreditation
                  </button>
                )}
              </div>

              {activePanel !== 'none' && (
                <div className="p-5 space-y-3 border-b border-pq-neutral-200">
                  {actionError && (
                    <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-3 text-sm text-pq-danger-600">
                      {actionError}
                    </div>
                  )}

                  {activePanel === 'reopen' && (
                    <>
                      <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                        Reopen Notes (optional)
                      </p>
                      <p className="text-xs text-pq-neutral-400">
                        Returns this application to Under Review. The supplier can be asked to provide updates if needed.
                      </p>
                      <textarea
                        value={noteInput}
                        onChange={e => setNoteInput(e.target.value)}
                        rows={2}
                        placeholder="Optional notes for the supplier."
                        className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleReopen}
                          disabled={busy}
                          className="px-4 py-2 bg-pq-primary-600 hover:bg-pq-primary-700 text-white text-xs font-semibold rounded-md transition disabled:opacity-50"
                        >
                          {busy ? 'Reopening…' : 'Confirm Reopen'}
                        </button>
                        <button
                          onClick={() => openPanel('none')}
                          className="px-4 py-2 text-xs font-medium text-pq-neutral-500 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md hover:bg-pq-neutral-200 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}

                  {activePanel === 'revoke' && (
                    <>
                      <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                        Revocation Reason (required)
                      </p>
                      <p className="text-xs text-pq-neutral-400">
                        Marks accreditation as expired. Existing RFQ assignments are not automatically cancelled.
                      </p>
                      <textarea
                        value={noteInput}
                        onChange={e => setNoteInput(e.target.value)}
                        rows={2}
                        placeholder="Reason for revoking accreditation."
                        className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleRevoke}
                          disabled={busy}
                          className="px-4 py-2 bg-pq-danger-600 hover:bg-pq-danger-600 text-white text-xs font-semibold rounded-md transition disabled:opacity-50"
                        >
                          {busy ? 'Revoking…' : 'Confirm Revocation'}
                        </button>
                        <button
                          onClick={() => openPanel('none')}
                          className="px-4 py-2 text-xs font-medium text-pq-neutral-500 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md hover:bg-pq-neutral-200 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {actionSuccess && (
                <div className="px-5 py-3.5 bg-pq-success-100 border-b border-pq-success-100 text-sm text-pq-success-600 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {actionSuccess}
                </div>
              )}
            </div>
          )}

          {/* Success banner for closed / post-action states */}
          {(isClosed || canPostApproval) && actionSuccess && !canPostApproval && (
            <div className="bg-pq-success-100 border border-pq-success-100 rounded-md p-3 text-sm text-pq-success-600 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {actionSuccess}
            </div>
          )}

          {/* ── Documents ── */}
          <div className="bg-white rounded-md border border-pq-neutral-200">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-pq-neutral-200">
              <h2 className="text-sm font-semibold text-pq-neutral-900">Submitted Documents</h2>
              <span className="text-xs text-pq-neutral-400">
                {documents.length} file{documents.length !== 1 ? 's' : ''}
              </span>
            </div>

            {docsLoading ? (
              <div className="p-5">
                <LoadingState message="Loading documents…" />
              </div>
            ) : documents.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-6 h-6 text-pq-neutral-400 mx-auto mb-2" />
                <p className="text-sm text-pq-neutral-500">No documents uploaded by the supplier yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-pq-neutral-200">
                {documents.map(doc => (
                  <DocumentRow key={doc.id} doc={doc} />
                ))}
              </div>
            )}
          </div>

          {/* ── TSQA note ── */}
          <div className="bg-pq-neutral-50 border border-pq-neutral-200 rounded-md px-4 py-3 text-xs text-pq-neutral-500">
            <span className="font-semibold">Note:</span> TSQA validates individual products/samples only. Supplier accreditation approval remains a Procurement decision and is independent of product evaluation results. Accredited suppliers still need verified products for RFQ award eligibility.
          </div>

          {profile && id && (
            <ComplianceTraceability anchor={{ kind: 'accreditation', id }} role={profile.role} />
          )}

          {/* ── Linked supplier products ── */}
          {linkedProducts.length > 0 && (
            <div className="bg-white rounded-md border border-pq-neutral-200">
              <div className="px-5 py-3.5 border-b border-pq-neutral-200">
                <h2 className="text-sm font-semibold text-pq-neutral-900">Linked Supplier Products</h2>
                <p className="text-xs text-pq-neutral-400 mt-0.5">
                  Products registered under this accreditation.
                </p>
              </div>
              <div className="divide-y divide-pq-neutral-200">
                {linkedProducts.map(product => (
                  <LinkedProductRow key={product.id} product={product} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-pq-neutral-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-pq-neutral-900">{value}</p>
    </div>
  );
}

function LinkedProductRow({ product }: { product: ProductWithRSESummary }) {
  const canOffer = product.status === 'verified';

  const statusLabel: Record<string, string> = {
    draft:        'Draft',
    submitted:    'Submitted',
    under_review: 'Under Review',
    pending_tsqa: 'Under TSQA Evaluation',
    verified:     'Verified',
    rejected:     'Rejected',
    inactive:     'Inactive',
    withdrawn:    'Withdrawn',
    expired:      'Expired',
  };

  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-pq-neutral-900 truncate">{product.product_name}</p>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          {product.product_code && (
            <span className="text-xs text-pq-neutral-400 font-mono">{product.product_code}</span>
          )}
          <span className="text-xs text-pq-neutral-500">
            {statusLabel[product.status] ?? product.status}
          </span>
          {product.latest_rse_status && (
            <span className="text-xs text-pq-neutral-400">
              RSE: {product.latest_rse_status.replace(/_/g, ' ')}
            </span>
          )}
          {product.latest_tsqa_result && (
            <span className={`text-xs font-semibold ${product.latest_tsqa_result === 'passed' ? 'text-pq-success-600' : 'text-pq-danger-600'}`}>
              TSQA: {product.latest_tsqa_result}
            </span>
          )}
        </div>
      </div>
      <div className={`shrink-0 text-xs font-semibold ${canOffer ? 'text-pq-success-600' : 'text-pq-neutral-400'}`}>
        Can Offer: {canOffer ? 'Yes' : 'No'}
      </div>
      <Link
        href={`/accreditation/products/${product.id}`}
        className="shrink-0 text-xs text-pq-primary-600 hover:text-pq-neutral-900 font-medium transition"
      >
        View →
      </Link>
    </div>
  );
}

function DocumentRow({ doc }: { doc: SupplierDocument }) {
  const [loading, setLoading] = useState(false);

  const handleView = async () => {
    setLoading(true);
    try {
      const url = await getAccreditationDocumentSignedUrl(doc.file_path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch { /* fail silently */ }
    finally { setLoading(false); }
  };

  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <FileText className="w-4 h-4 text-pq-neutral-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-pq-neutral-900 truncate">{doc.file_name}</p>
        <p className="text-xs text-pq-neutral-400">
          {doc.document_type.replace(/_/g, ' ')}
          {' · '}
          {format(new Date(doc.uploaded_at), 'MMM d, yyyy')}
        </p>
      </div>
      <button
        type="button"
        onClick={handleView}
        disabled={loading}
        className="shrink-0 flex items-center gap-1 text-xs text-pq-primary-600 hover:text-pq-neutral-900 transition disabled:opacity-50"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        {loading ? 'Opening…' : 'View'}
      </button>
    </div>
  );
}
