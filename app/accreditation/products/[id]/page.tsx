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
  getSupplierProductById,
  markProductUnderReview,
  markProductVerified,
  markProductRejected,
  revokeProductVerification,
  reopenProductForReview,
  updateProductVerificationExpiry,
} from '@/lib/supplier-products';
import {
  getRSERecordsByProductId,
  type RSEWithReview,
} from '@/lib/rse';
import {
  getDocumentsByProductId,
  getDocumentsByRSEId,
  getAccreditationDocumentSignedUrl,
} from '@/lib/accreditation-documents';
import type { SupplierProduct, SupplierDocument } from '@/types/database';
import { format, differenceInDays } from 'date-fns';
import {
  ChevronLeft,
  FileText,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Eye,
  Circle,
  AlertCircle,
  RotateCcw,
  CalendarClock,
} from 'lucide-react';

// ─── Status helpers ───────────────────────────────────────────────────────────

function productChip(status: string): { variant: StatusVariant; label: string } {
  const map: Record<string, { variant: StatusVariant; label: string }> = {
    draft:        { variant: 'draft',     label: 'Draft' },
    submitted:    { variant: 'pending',   label: 'Submitted' },
    under_review: { variant: 'in_review', label: 'Under Procurement Review' },
    pending_tsqa: { variant: 'in_review', label: 'Under Technical Evaluation' },
    verified:     { variant: 'validated', label: 'Verified' },
    rejected:     { variant: 'rejected',  label: 'Rejected' },
    inactive:     { variant: 'cancelled', label: 'Inactive' },
    withdrawn:    { variant: 'cancelled', label: 'Withdrawn' },
    expired:      { variant: 'cancelled', label: 'Expired' },
  };
  return map[status] ?? { variant: 'draft', label: status };
}

// ─── Action panel type ────────────────────────────────────────────────────────

type ActionPanel = 'none' | 'verify' | 'reject' | 'revoke' | 'reopen' | 'edit_expiry';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductReviewDetailPage() {
  const { id }      = useParams<{ id: string }>();
  const { profile } = useAuth();

  const [product, setProduct] = useState<SupplierProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const [busy, setBusy]                       = useState(false);
  const [actionError, setActionError]         = useState('');
  const [actionSuccess, setActionSuccess]     = useState('');
  const [activePanel, setActivePanel]         = useState<ActionPanel>('none');
  const [noteInput, setNoteInput]             = useState('');
  const [expiryInput, setExpiryInput]         = useState('');
  const [expiryError, setExpiryError]         = useState('');

  const [rseRecords, setRseRecords]           = useState<RSEWithReview[]>([]);
  const [rseDocsMap,  setRseDocsMap]          = useState<Record<string, SupplierDocument[]>>({});

  const [documents, setDocuments]             = useState<SupplierDocument[]>([]);
  const [docsLoading, setDocsLoading]         = useState(false);

  const loadDocs = useCallback(async (productId: string) => {
    setDocsLoading(true);
    try {
      setDocuments(await getDocumentsByProductId(productId));
    } catch { /* non-blocking */ }
    finally { setDocsLoading(false); }
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const p = await getSupplierProductById(id);
      if (!p) { setError('Product not found.'); return; }
      setProduct(p);
      const [, rseRows] = await Promise.all([
        loadDocs(p.id),
        getRSERecordsByProductId(p.id),
      ]);
      setRseRecords(rseRows);
      // Fetch RSE report documents for each RSE
      const docsEntries = await Promise.all(
        rseRows.map(async rse => {
          try {
            const docs = await getDocumentsByRSEId(rse.id);
            return [rse.id, docs] as [string, SupplierDocument[]];
          } catch {
            return [rse.id, []] as [string, SupplierDocument[]];
          }
        })
      );
      setRseDocsMap(Object.fromEntries(docsEntries));
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to load product.');
    } finally {
      setLoading(false);
    }
  }, [id, loadDocs]);

  useEffect(() => { load(); }, [load]);

  const openPanel = (panel: ActionPanel) => {
    setActivePanel(panel);
    setNoteInput('');
    setExpiryInput(panel === 'edit_expiry' ? (product?.valid_until ?? '') : '');
    setExpiryError('');
    setActionError('');
    setActionSuccess('');
  };

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleMarkUnderReview = async () => {
    if (!profile || !product) return;
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await markProductUnderReview(product.id, profile);
      await load();
      setActionSuccess('Marked as under review.');
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    if (!profile || !product) return;
    setExpiryError('');
    if (expiryInput) {
      const chosen = new Date(`${expiryInput}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (chosen <= today) {
        setExpiryError('Expiry date must be in the future.');
        return;
      }
    }
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await markProductVerified(product.id, profile, noteInput.trim() || undefined, expiryInput || null);
      await load();
      setActivePanel('none');
      setActionSuccess('Product verified. Supplier has been notified. Can Offer = Yes.');
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!profile || !product) return;
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await markProductRejected(product.id, profile, noteInput.trim() || undefined);
      await load();
      setActivePanel('none');
      setActionSuccess('Product rejected. Supplier has been notified.');
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };


  const handleRevokeVerification = async () => {
    if (!profile || !product) return;
    if (!noteInput.trim()) {
      setActionError('Please enter a reason for revoking verification.');
      return;
    }
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await revokeProductVerification(product.id, profile, noteInput.trim());
      await load();
      setActivePanel('none');
      setActionSuccess('Verification revoked. Product is expired and Can Offer = No.');
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleEditExpiry = async () => {
    if (!profile || !product) return;
    setExpiryError('');
    if (expiryInput) {
      const chosen = new Date(`${expiryInput}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (chosen <= today) {
        setExpiryError('Expiry date must be in the future.');
        return;
      }
    }
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await updateProductVerificationExpiry(product.id, profile, expiryInput || null);
      await load();
      setActivePanel('none');
      setActionSuccess('Expiry date updated.');
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleReopenForReview = async () => {
    if (!profile || !product) return;
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await reopenProductForReview(product.id, profile, noteInput.trim() || undefined);
      await load();
      setActivePanel('none');
      setActionSuccess('Product reopened for review. Supplier has been notified.');
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const status         = product?.status ?? '';
  const isService      = (product?.item_type ?? 'goods') === 'services';
  const canMarkReview  = status === 'submitted';
  const canVerify      = status === 'submitted' || status === 'under_review';
  const canRejectProd  = status === 'submitted' || status === 'under_review';
  const isClosed       = status === 'rejected' || status === 'withdrawn';
  const canRevoke      = status === 'verified';
  const canReopen      = status === 'verified' || status === 'inactive' || status === 'expired';
  const showReviewActions = status === 'submitted' || status === 'under_review';
  const showPostVerifyActions = status === 'verified' || status === 'expired' || status === 'inactive';
  const canOffer       = status === 'verified';
  const chip           = product ? productChip(status) : null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppShell title="Product Review">
      {/* Back */}
      <div className="mb-4">
        <Link
          href="/accreditation/products"
          className="inline-flex items-center gap-1 text-sm text-pq-neutral-500 hover:text-pq-neutral-900 transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Product Queue
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading product…" />
        </div>
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
          {error}
        </div>
      ) : !product ? null : (
        <div className="space-y-4">

          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-pq-neutral-900">{product.product_name}</h1>
                <span className={`inline-flex text-xs font-semibold border rounded-full px-2.5 py-0.5 ${
                  isService
                    ? 'bg-purple-50 text-purple-700 border-purple-200'
                    : 'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  {isService ? 'Services' : 'Goods'}
                </span>
              </div>
              {product.category && (
                <p className="text-sm text-pq-neutral-500 mt-0.5">{product.category}</p>
              )}
            </div>
            {chip && <StatusChip status={chip.variant} label={chip.label} />}
          </div>

          {/* ── Can Offer banner ── */}
          <div
            className={`rounded-md border px-4 py-3 flex items-start gap-2.5 text-sm ${
              canOffer
                ? 'bg-pq-success-100 border-pq-success-100 text-pq-success-600'
                : 'bg-pq-neutral-50 border-pq-neutral-200 text-pq-neutral-500'
            }`}
          >
            {canOffer ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-4 h-4 shrink-0 mt-0.5 text-pq-neutral-400" />
            )}
            <span className="font-medium">
              {canOffer
                ? 'Verified — this product can be offered and awarded on RFQ quotes when substitute rules are met.'
                : status === 'expired'
                ? 'Expired — this product can still be offered on RFQ quotes, but Procurement will see that verification has expired. Re-verification is recommended before award.'
                : 'Unverified — this product can still be offered and awarded on RFQ quotes, but Procurement will see a notice that it is pending validation. Verification is recommended before award.'
              }
            </span>
          </div>

          {profile && (
            <ComplianceTraceability anchor={{ kind: 'product', id: product.id }} role={profile.role} />
          )}

          {/* ── Product detail card ── */}
          <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-4">
            {status === 'withdrawn' && (
              <div className="rounded-md border border-pq-neutral-200 bg-pq-neutral-50 px-4 py-3 text-sm text-pq-neutral-500">
                <span className="font-semibold text-pq-neutral-900">Withdrawn by supplier.</span>{' '}
                This listing is read-only. Documents remain on file for audit.
              </div>
            )}
            {status === 'inactive' && (
              <div className="rounded-md border border-pq-warning-100 bg-pq-warning-100 px-4 py-3 text-sm text-pq-warning-600">
                <span className="font-semibold">Verification revoked.</span>{' '}
                This product is inactive and cannot be offered in RFQ until re-verified.
              </div>
            )}

            {status === 'expired' && (
              <div className="rounded-md border border-pq-danger-100 bg-pq-danger-100 px-4 py-3 flex items-start gap-2.5">
                <CalendarClock className="w-4 h-4 text-pq-danger-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-pq-danger-600">Verification Expired</p>
                  <p className="text-xs text-pq-danger-600 mt-0.5">
                    This product's verification has expired
                    {product.valid_until
                      ? ` on ${format(new Date(product.valid_until), 'MMMM d, yyyy')}`
                      : ''}.
                    Use <span className="font-semibold">Reopen for Review</span> to begin a renewal.
                  </p>
                </div>
              </div>
            )}

            {status === 'verified' && product.valid_until && (() => {
              const daysLeft = differenceInDays(new Date(product.valid_until), new Date());
              if (daysLeft <= 30) return (
                <div className="rounded-md border border-pq-warning-100 bg-pq-warning-100 px-4 py-3 flex items-start gap-2.5">
                  <CalendarClock className="w-4 h-4 text-pq-warning-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-pq-warning-600">
                    <span className="font-semibold">Expiring soon —</span>{' '}
                    valid until {format(new Date(product.valid_until), 'MMMM d, yyyy')} ({daysLeft} day{daysLeft !== 1 ? 's' : ''} left).
                  </p>
                </div>
              );
              return null;
            })()}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {!isService && (
                <InfoField label="Product Code" value={product.product_code ?? '—'} />
              )}
              <InfoField label="Category" value={product.category ?? '—'} />
              {product.description && (
                <div className="sm:col-span-2">
                  <InfoField
                    label={isService ? 'Scope of Service' : 'Description'}
                    value={product.description}
                  />
                </div>
              )}
              {product.specifications && (
                <div className="sm:col-span-2">
                  <InfoField
                    label={isService ? 'Terms & Conditions / SLA' : 'Specifications'}
                    value={product.specifications}
                  />
                </div>
              )}
            </div>

            <div className="border-t border-pq-neutral-200 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {product.submitted_at && (
                <InfoField label="Submitted" value={format(new Date(product.submitted_at), 'MMM d, yyyy')} />
              )}
              {product.reviewed_at && (
                <InfoField label="Reviewed"  value={format(new Date(product.reviewed_at),  'MMM d, yyyy')} />
              )}
              {product.verified_at && (
                <InfoField label="Verified"  value={format(new Date(product.verified_at),  'MMM d, yyyy')} />
              )}
              {product.valid_until && (
                <InfoField label="Valid Until" value={format(new Date(product.valid_until), 'MMM d, yyyy')} />
              )}
              {product.rejected_at && (
                <InfoField label="Rejected"  value={format(new Date(product.rejected_at),  'MMM d, yyyy')} />
              )}
            </div>

            {product.review_notes && (
              <div className="bg-pq-neutral-50 border border-pq-neutral-200 rounded-md p-3">
                <p className="text-xs font-semibold text-pq-neutral-500 mb-1 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Review Notes
                </p>
                <p className="text-sm text-pq-neutral-900">{product.review_notes}</p>
              </div>
            )}
          </div>

          {/* ── Action bar + panels (in-review) ── */}
          {showReviewActions && (
            <div className="bg-white rounded-md border border-pq-neutral-200">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-pq-neutral-200 flex-wrap">
                <p className="text-sm font-semibold text-pq-neutral-900 mr-2">Actions</p>

                {canMarkReview && (
                  <button
                    onClick={handleMarkUnderReview}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-pq-primary-700 bg-pq-primary-50 border border-pq-primary-200 rounded-md hover:bg-pq-primary-100 transition disabled:opacity-50"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Mark Under Review
                  </button>
                )}

                {canVerify && (
                  <button
                    onClick={() => openPanel(activePanel === 'verify' ? 'none' : 'verify')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
                      activePanel === 'verify'
                        ? 'bg-pq-success-100 text-pq-success-600 border-pq-success-200'
                        : 'text-pq-success-600 bg-pq-success-100 border-pq-success-100 hover:bg-pq-success-100'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Verify
                  </button>
                )}

                {canRejectProd && (
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

                  {/* Verify panel */}
                  {activePanel === 'verify' && (
                    <>
                      <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                        Verification Notes (optional)
                      </p>
                      <p className="text-xs text-pq-neutral-400">
                        Confirm verification after reviewing the product details and supporting documents.
                        {' '}After verification, Can Offer = Yes.
                      </p>
                      <textarea
                        value={noteInput}
                        onChange={e => setNoteInput(e.target.value)}
                        rows={2}
                        placeholder="Optional notes for the supplier."
                        className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
                      />
                      <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                        Valid Until <span className="text-pq-neutral-400 font-normal normal-case">(optional — leave blank for no expiry)</span>
                      </p>
                      <input
                        type="date"
                        value={expiryInput}
                        onChange={e => { setExpiryInput(e.target.value); setExpiryError(''); }}
                        className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] bg-white"
                      />
                      {expiryError && (
                        <p className="text-xs text-pq-danger-600">{expiryError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={handleVerify}
                          disabled={busy}
                          className="px-4 py-2 bg-pq-success-600 hover:bg-pq-success-600 text-white text-xs font-semibold rounded-md transition disabled:opacity-50"
                        >
                          {busy ? 'Verifying…' : 'Confirm Verification'}
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

                  {/* Reject panel */}
                  {activePanel === 'reject' && (
                    <>
                      <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                        Rejection Reason (optional)
                      </p>
                      <textarea
                        value={noteInput}
                        onChange={e => setNoteInput(e.target.value)}
                        rows={2}
                        placeholder="Reason for rejection."
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

              {/* Success banner */}
              {actionSuccess && (
                <div className="px-5 py-3.5 bg-pq-success-100 border-b border-pq-success-100 text-sm text-pq-success-600 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {actionSuccess}
                </div>
              )}
            </div>
          )}

          {/* ── Post-verification actions ── */}
          {showPostVerifyActions && (
            <div className="bg-white rounded-md border border-pq-neutral-200">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-pq-neutral-200 flex-wrap">
                <p className="text-sm font-semibold text-pq-neutral-900 mr-2">Post-Verification Actions</p>

                {canReopen && (
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
                )}

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
                    Revoke Verification
                  </button>
                )}

                {canRevoke && (
                  <button
                    onClick={() => openPanel(activePanel === 'edit_expiry' ? 'none' : 'edit_expiry')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
                      activePanel === 'edit_expiry'
                        ? 'bg-pq-neutral-100 text-pq-neutral-900 border-pq-neutral-300'
                        : 'text-pq-neutral-500 bg-white border-pq-neutral-200 hover:border-pq-neutral-300'
                    }`}
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    Edit Expiry
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
                        Returns this product to Under Review. Can Offer becomes No until verified again.
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
                          onClick={handleReopenForReview}
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
                        Sets product to Expired. Existing RFQ quotes are not automatically removed.
                      </p>
                      <textarea
                        value={noteInput}
                        onChange={e => setNoteInput(e.target.value)}
                        rows={2}
                        placeholder="Reason for revoking verification."
                        className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleRevokeVerification}
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

                  {activePanel === 'edit_expiry' && (
                    <>
                      <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                        Valid Until <span className="text-pq-neutral-400 font-normal normal-case">(optional — leave blank for no expiry)</span>
                      </p>
                      <p className="text-xs text-pq-neutral-400">
                        Changes the expiry date directly. The product stays verified.
                      </p>
                      <input
                        type="date"
                        value={expiryInput}
                        onChange={e => { setExpiryInput(e.target.value); setExpiryError(''); }}
                        className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] bg-white"
                      />
                      {expiryError && (
                        <p className="text-xs text-pq-danger-600">{expiryError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={handleEditExpiry}
                          disabled={busy}
                          className="px-4 py-2 bg-pq-primary-600 hover:bg-pq-primary-700 text-white text-xs font-semibold rounded-md transition disabled:opacity-50"
                        >
                          {busy ? 'Saving…' : 'Save Expiry'}
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

          {/* Success banner for closed states */}
          {isClosed && actionSuccess && (
            <div className="bg-pq-success-100 border border-pq-success-100 rounded-md p-3 text-sm text-pq-success-600 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {actionSuccess}
            </div>
          )}

          {/* ── Product documents ── */}
          <div className="bg-white rounded-md border border-pq-neutral-200">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-pq-neutral-200">
              <h2 className="text-sm font-semibold text-pq-neutral-900">{isService ? 'Supporting Documents' : 'Product Documents'}</h2>
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

          {/* ── Historical RSE / TSQA evaluation records — goods only ── */}
          {!isService && rseRecords.length > 0 && (
            <div className="bg-white rounded-md border border-pq-neutral-200">
              <div className="px-5 py-3.5 border-b border-pq-neutral-200">
                <h2 className="text-sm font-semibold text-pq-neutral-900">RSE / TSQA Evaluation Records</h2>
              </div>
              <div className="divide-y divide-pq-neutral-200">
                {rseRecords.map(rse => (
                  <ProcurementRSERow
                    key={rse.id}
                    rse={rse}
                    rseDocs={rseDocsMap[rse.id] ?? []}
                  />
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
      <p className="text-sm text-pq-neutral-900 whitespace-pre-wrap">{value}</p>
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

function ProcurementRSERow({
  rse,
  rseDocs,
}: {
  rse:     RSEWithReview;
  rseDocs: SupplierDocument[];
}) {
  const resultColor =
    rse.tsqa_result === 'passed'
      ? 'text-pq-success-600 bg-pq-success-100 border-pq-success-100'
      : rse.tsqa_result === 'failed'
      ? 'text-pq-danger-600 bg-pq-danger-100 border-pq-danger-100'
      : 'text-pq-neutral-500 bg-pq-neutral-50 border-pq-neutral-200';

  return (
    <div className="px-5 py-4 space-y-2">
      {/* RSE header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-xs font-bold text-pq-neutral-900">
          {rse.rse_number ?? rse.id.slice(0, 8).toUpperCase()}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full border border-pq-neutral-200 text-pq-neutral-500">
          RSE: {rse.status.replace(/_/g, ' ')}
        </span>
        {rse.tsqa_result && (
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${resultColor}`}>
            TSQA: {rse.tsqa_result.charAt(0).toUpperCase() + rse.tsqa_result.slice(1)}
          </span>
        )}
      </div>

      {/* Assignee */}
      {rse.assigned_to_name && (
        <p className="text-xs text-pq-neutral-500">
          <span className="font-semibold">Assigned to:</span> {rse.assigned_to_name}
        </p>
      )}

      {/* TSQA findings */}
      {rse.tsqa_remarks && (
        <p className="text-xs text-pq-neutral-500">
          <span className="font-semibold">Remarks:</span> {rse.tsqa_remarks}
        </p>
      )}
      {rse.tsqa_test_findings && (
        <p className="text-xs text-pq-neutral-500">
          <span className="font-semibold">Test Findings:</span> {rse.tsqa_test_findings}
        </p>
      )}

      {/* Completion date */}
      {rse.completed_at && (
        <p className="text-xs text-pq-neutral-400">
          Completed {format(new Date(rse.completed_at), 'MMM d, yyyy')}
        </p>
      )}

      {/* RSE report documents */}
      {rseDocs.length > 0 && (
        <div className="pt-1 space-y-1">
          <p className="text-xs font-semibold text-pq-neutral-500">RSE Reports</p>
          {rseDocs.map(doc => (
            <DocumentRow key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  );
}
