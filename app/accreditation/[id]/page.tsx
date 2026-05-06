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
} from 'lucide-react';

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
  };
  return map[status] ?? { variant: 'draft', label: status };
}

// ─── Action types ─────────────────────────────────────────────────────────────

type ActionPanel = 'none' | 'missing_docs' | 'approve' | 'reject';

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

  // ── Derived ─────────────────────────────────────────────────────────────────

  const status = accreditation?.status ?? '';
  const canMarkUnderReview = status === 'submitted';
  const canRequestDocs     = status === 'submitted' || status === 'under_review';
  const canApprove         = status === 'submitted' || status === 'under_review' || status === 'missing_documents';
  const canReject          = status === 'submitted' || status === 'under_review' || status === 'missing_documents';
  const isTerminal         = status === 'approved' || status === 'rejected' || status === 'withdrawn';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppShell title="Accreditation Review">
      {/* Back */}
      <div className="mb-4">
        <Link
          href="/accreditation"
          className="inline-flex items-center gap-1 text-sm text-[#40527A] hover:text-[#0F1F3A] transition"
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
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">
          {error}
        </div>
      ) : !accreditation ? null : (
        <div className="space-y-4">

          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-[#0F1F3A]">Supplier Accreditation Review</h1>
              <p className="text-sm text-[#40527A] mt-0.5">
                Application submitted for Procurement evaluation and approval. Accreditation is separate from product verification—products must be verified before RFQ award.
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
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-5 space-y-4">

            {status === 'withdrawn' && (
              <div className="rounded-[4px] border border-[#D8E2FF] bg-[#F7F9FC] px-4 py-3 text-sm text-[#40527A]">
                <span className="font-semibold text-[#0F1F3A]">Withdrawn by supplier.</span>{' '}
                This application is closed. Documents remain on file for audit.
              </div>
            )}

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
              {accreditation.rejected_at && (
                <InfoField
                  label="Rejected"
                  value={format(new Date(accreditation.rejected_at), 'MMM d, yyyy')}
                />
              )}
            </div>

            {/* Existing notes */}
            {(accreditation.missing_documents_note || accreditation.review_notes) && (
              <div className="border-t border-[#D8E2FF] pt-4 space-y-3">
                {accreditation.missing_documents_note && (
                  <div className="bg-amber-50 border border-amber-200 rounded-[4px] p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Missing Documents Note (sent to supplier)
                    </p>
                    <p className="text-sm text-amber-900">{accreditation.missing_documents_note}</p>
                  </div>
                )}
                {accreditation.review_notes && (
                  <div className="bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] p-3">
                    <p className="text-xs font-semibold text-[#40527A] mb-1">Review Notes</p>
                    <p className="text-sm text-[#0F1F3A]">{accreditation.review_notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Action bar + panels (hidden when terminal) ── */}
          {!isTerminal && (
            <div className="bg-white rounded-[4px] border border-[#D8E2FF]">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#D8E2FF] flex-wrap">
                <p className="text-sm font-semibold text-[#0F1F3A] mr-2">Actions</p>

                {canMarkUnderReview && (
                  <button
                    onClick={handleMarkUnderReview}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-[4px] hover:bg-blue-100 transition disabled:opacity-50"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Mark Under Review
                  </button>
                )}

                {canRequestDocs && (
                  <button
                    onClick={() => openPanel(activePanel === 'missing_docs' ? 'none' : 'missing_docs')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] border transition ${
                      activePanel === 'missing_docs'
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Request Missing Docs
                  </button>
                )}

                {canApprove && (
                  <button
                    onClick={() => openPanel(activePanel === 'approve' ? 'none' : 'approve')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] border transition ${
                      activePanel === 'approve'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Approve
                  </button>
                )}

                {canReject && (
                  <button
                    onClick={() => openPanel(activePanel === 'reject' ? 'none' : 'reject')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] border transition ${
                      activePanel === 'reject'
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                )}
              </div>

              {/* Inline action panels */}
              {activePanel !== 'none' && (
                <div className="p-5 space-y-3 border-b border-[#D8E2FF]">
                  {actionError && (
                    <div className="bg-red-50 border border-red-200 rounded-[4px] p-3 text-sm text-red-700">
                      {actionError}
                    </div>
                  )}

                  {activePanel === 'missing_docs' && (
                    <>
                      <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                        Describe what documents are missing
                      </p>
                      <textarea
                        value={noteInput}
                        onChange={e => setNoteInput(e.target.value)}
                        rows={3}
                        placeholder="e.g. Please provide your valid Business Permit and SEC registration documents."
                        className="w-full px-3 py-2 text-sm border border-[#D8E2FF] rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleRequestMissingDocs}
                          disabled={busy}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-[4px] transition disabled:opacity-50"
                        >
                          {busy ? 'Sending…' : 'Send Request'}
                        </button>
                        <button
                          onClick={() => openPanel('none')}
                          className="px-4 py-2 text-xs font-medium text-[#40527A] bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] hover:bg-[#E5EAFF] transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}

                  {activePanel === 'approve' && (
                    <>
                      <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                        Approval Notes (optional)
                      </p>
                      <textarea
                        value={noteInput}
                        onChange={e => setNoteInput(e.target.value)}
                        rows={2}
                        placeholder="Optional notes for the supplier."
                        className="w-full px-3 py-2 text-sm border border-[#D8E2FF] rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleApprove}
                          disabled={busy}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-[4px] transition disabled:opacity-50"
                        >
                          {busy ? 'Approving…' : 'Confirm Approval'}
                        </button>
                        <button
                          onClick={() => openPanel('none')}
                          className="px-4 py-2 text-xs font-medium text-[#40527A] bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] hover:bg-[#E5EAFF] transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}

                  {activePanel === 'reject' && (
                    <>
                      <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                        Rejection Reason (optional)
                      </p>
                      <textarea
                        value={noteInput}
                        onChange={e => setNoteInput(e.target.value)}
                        rows={2}
                        placeholder="Optional reason for rejection."
                        className="w-full px-3 py-2 text-sm border border-[#D8E2FF] rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleReject}
                          disabled={busy}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-[4px] transition disabled:opacity-50"
                        >
                          {busy ? 'Rejecting…' : 'Confirm Rejection'}
                        </button>
                        <button
                          onClick={() => openPanel('none')}
                          className="px-4 py-2 text-xs font-medium text-[#40527A] bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] hover:bg-[#E5EAFF] transition"
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
                <div className="px-5 py-3.5 bg-emerald-50 border-b border-emerald-200 text-sm text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {actionSuccess}
                </div>
              )}
            </div>
          )}

          {/* Terminal state success banner */}
          {isTerminal && actionSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-[4px] p-3 text-sm text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {actionSuccess}
            </div>
          )}

          {/* ── Documents ── */}
          <div className="bg-white rounded-[4px] border border-[#D8E2FF]">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#D8E2FF]">
              <h2 className="text-sm font-semibold text-[#0F1F3A]">Submitted Documents</h2>
              <span className="text-xs text-[#BFC7D5]">
                {documents.length} file{documents.length !== 1 ? 's' : ''}
              </span>
            </div>

            {docsLoading ? (
              <div className="p-5">
                <LoadingState message="Loading documents…" />
              </div>
            ) : documents.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-6 h-6 text-[#BFC7D5] mx-auto mb-2" />
                <p className="text-sm text-[#40527A]">No documents uploaded by the supplier yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#D8E2FF]">
                {documents.map(doc => (
                  <DocumentRow key={doc.id} doc={doc} />
                ))}
              </div>
            )}
          </div>

          {/* ── TSQA note ── */}
          <div className="bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] px-4 py-3 text-xs text-[#40527A]">
            <span className="font-semibold">Note:</span> TSQA validates individual products/samples only. Supplier accreditation approval remains a Procurement decision and is independent of product evaluation results. Accredited suppliers still need verified products for RFQ award eligibility.
          </div>

          {profile && id && (
            <ComplianceTraceability anchor={{ kind: 'accreditation', id }} role={profile.role} />
          )}

          {/* ── Linked supplier products ── */}
          {linkedProducts.length > 0 && (
            <div className="bg-white rounded-[4px] border border-[#D8E2FF]">
              <div className="px-5 py-3.5 border-b border-[#D8E2FF]">
                <h2 className="text-sm font-semibold text-[#0F1F3A]">Linked Supplier Products</h2>
                <p className="text-xs text-[#BFC7D5] mt-0.5">
                  Products registered under this accreditation.
                </p>
              </div>
              <div className="divide-y divide-[#D8E2FF]">
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
      <p className="text-xs text-[#BFC7D5] mb-0.5">{label}</p>
      <p className="text-sm font-medium text-[#0F1F3A]">{value}</p>
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
  };

  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#0F1F3A] truncate">{product.product_name}</p>
        <div className="flex items-center gap-2 flex-wrap mt-0.5">
          {product.product_code && (
            <span className="text-xs text-[#BFC7D5] font-mono">{product.product_code}</span>
          )}
          <span className="text-xs text-[#40527A]">
            {statusLabel[product.status] ?? product.status}
          </span>
          {product.latest_rse_status && (
            <span className="text-xs text-[#BFC7D5]">
              RSE: {product.latest_rse_status.replace(/_/g, ' ')}
            </span>
          )}
          {product.latest_tsqa_result && (
            <span className={`text-xs font-semibold ${product.latest_tsqa_result === 'passed' ? 'text-emerald-600' : 'text-red-600'}`}>
              TSQA: {product.latest_tsqa_result}
            </span>
          )}
        </div>
      </div>
      <div className={`shrink-0 text-xs font-semibold ${canOffer ? 'text-emerald-600' : 'text-[#BFC7D5]'}`}>
        Can Offer: {canOffer ? 'Yes' : 'No'}
      </div>
      <Link
        href={`/accreditation/products/${product.id}`}
        className="shrink-0 text-xs text-[#1E4BFF] hover:text-[#0F1F3A] font-medium transition"
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
      <FileText className="w-4 h-4 text-[#BFC7D5] shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#0F1F3A] truncate">{doc.file_name}</p>
        <p className="text-xs text-[#BFC7D5]">
          {doc.document_type.replace(/_/g, ' ')}
          {' · '}
          {format(new Date(doc.uploaded_at), 'MMM d, yyyy')}
        </p>
      </div>
      <button
        type="button"
        onClick={handleView}
        disabled={loading}
        className="shrink-0 flex items-center gap-1 text-xs text-[#1E4BFF] hover:text-[#0F1F3A] transition disabled:opacity-50"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        {loading ? 'Opening…' : 'View'}
      </button>
    </div>
  );
}
