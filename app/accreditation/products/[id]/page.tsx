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
  reopenProductForReview,
  deactivateProduct,
  reactivateProduct,
} from '@/lib/supplier-products';
import type { SupplierProduct } from '@/types/database';
import { format } from 'date-fns';
import {
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Eye,
  Circle,
  AlertCircle,
  RotateCcw,
  Ban,
  CircleCheck as CheckCircle,
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

type ActionPanel = 'none' | 'verify' | 'reject' | 'reopen' | 'deactivate' | 'reactivate';

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

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const p = await getSupplierProductById(id);
      if (!p) { setError('Product not found.'); return; }
      setProduct(p);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to load product.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const openPanel = (panel: ActionPanel) => {
    setActivePanel(panel);
    setNoteInput('');
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
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await markProductVerified(product.id, profile, noteInput.trim() || undefined);
      await load();
      setActivePanel('none');
      setActionSuccess('Product verified. Can Offer = Yes.');
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
      setActionSuccess('Product rejected.');
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
      setActionSuccess('Product reopened for review.');
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeactivate = async () => {
    if (!profile || !product) return;
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await deactivateProduct(product.id, profile, noteInput.trim() || undefined);
      await load();
      setActivePanel('none');
      setActionSuccess('Product deactivated. It cannot be offered on new quotes.');
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleReactivate = async () => {
    if (!profile || !product) return;
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await reactivateProduct(product.id, profile, noteInput.trim() || undefined);
      await load();
      setActivePanel('none');
      setActionSuccess('Product reactivated. Can Offer = Yes.');
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
  const canDeactivate  = status === 'verified';
  const canReactivate  = status === 'inactive';
  const canReopen      = status === 'verified' || status === 'inactive' || status === 'expired';
  const showReviewActions = status === 'submitted' || status === 'under_review';
  const showCatalogActions = status === 'verified' || status === 'expired' || status === 'inactive';
  const canOffer       = status === 'verified';
  const chip           = product ? productChip(status) : null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppShell title="Product Catalog">
      {/* Back */}
      <div className="mb-4">
        <Link
          href="/accreditation/products"
          className="inline-flex items-center gap-1 text-sm text-pq-neutral-500 hover:text-pq-neutral-900 transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Product Catalog
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
                ? 'Verified — this product can be offered on RFQ quotes.'
                : status === 'inactive'
                  ? 'Inactive — this product cannot be offered on new quotes until reactivated.'
                  : 'Not offerable — only verified catalog products can be newly linked on quotes.'
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
                This listing is read-only.
              </div>
            )}
            {status === 'inactive' && (
              <div className="rounded-md border border-pq-warning-100 bg-pq-warning-100 px-4 py-3 text-sm text-pq-warning-600">
                <span className="font-semibold">Deactivated.</span>{' '}
                This product is inactive and cannot be offered on new quotes until reactivated.
              </div>
            )}

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
                        Confirm verification after reviewing the product details.
                        {' '}After verification, Can Offer = Yes.
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

          {/* ── Catalog actions ── */}
          {showCatalogActions && (
            <div className="bg-white rounded-md border border-pq-neutral-200">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-pq-neutral-200 flex-wrap">
                <p className="text-sm font-semibold text-pq-neutral-900 mr-2">Catalog Actions</p>

                {canDeactivate && (
                  <button
                    type="button"
                    onClick={() => openPanel(activePanel === 'deactivate' ? 'none' : 'deactivate')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
                      activePanel === 'deactivate'
                        ? 'bg-pq-warning-100 text-pq-warning-700 border-pq-warning-200'
                        : 'text-pq-warning-700 bg-pq-warning-100 border-pq-warning-100 hover:bg-pq-warning-100'
                    }`}
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Deactivate
                  </button>
                )}

                {canReactivate && (
                  <button
                    type="button"
                    onClick={() => openPanel(activePanel === 'reactivate' ? 'none' : 'reactivate')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
                      activePanel === 'reactivate'
                        ? 'bg-pq-success-100 text-pq-success-600 border-pq-success-200'
                        : 'text-pq-success-600 bg-pq-success-100 border-pq-success-100 hover:bg-pq-success-100'
                    }`}
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    Reactivate
                  </button>
                )}

                {canReopen && (
                  <button
                    type="button"
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
              </div>

              {activePanel === 'deactivate' && (
                <div className="p-5 space-y-3 border-b border-pq-neutral-200">
                  {actionError && (
                    <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-3 text-sm text-pq-danger-600">
                      {actionError}
                    </div>
                  )}
                  <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                    Deactivate Notes (optional)
                  </p>
                  <p className="text-xs text-pq-neutral-400">
                    Sets status to Inactive. The product stays in history and cannot be offered on new quotes.
                    Existing quotes that already linked this product are not deleted.
                  </p>
                  <textarea
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    rows={2}
                    placeholder="Optional reason for deactivation."
                    className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleDeactivate}
                      disabled={busy}
                      className="px-4 py-2 bg-pq-warning-600 hover:bg-pq-warning-700 text-white text-xs font-semibold rounded-md transition disabled:opacity-50"
                    >
                      {busy ? 'Deactivating…' : 'Confirm Deactivate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openPanel('none')}
                      className="px-4 py-2 text-xs font-medium text-pq-neutral-500 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md hover:bg-pq-neutral-200 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {activePanel === 'reactivate' && (
                <div className="p-5 space-y-3 border-b border-pq-neutral-200">
                  {actionError && (
                    <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-3 text-sm text-pq-danger-600">
                      {actionError}
                    </div>
                  )}
                  <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                    Reactivate Notes (optional)
                  </p>
                  <p className="text-xs text-pq-neutral-400">
                    Restores status to Verified. Can Offer becomes Yes for new quotes.
                  </p>
                  <textarea
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    rows={2}
                    placeholder="Optional notes."
                    className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleReactivate}
                      disabled={busy}
                      className="px-4 py-2 bg-pq-success-600 hover:bg-pq-success-700 text-white text-xs font-semibold rounded-md transition disabled:opacity-50"
                    >
                      {busy ? 'Reactivating…' : 'Confirm Reactivate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openPanel('none')}
                      className="px-4 py-2 text-xs font-medium text-pq-neutral-500 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md hover:bg-pq-neutral-200 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {activePanel === 'reopen' && (
                <div className="p-5 space-y-3 border-b border-pq-neutral-200">
                  {actionError && (
                    <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-3 text-sm text-pq-danger-600">
                      {actionError}
                    </div>
                  )}

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
                    placeholder="Optional notes."
                    className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleReopenForReview}
                      disabled={busy}
                      className="px-4 py-2 bg-pq-primary-600 hover:bg-pq-primary-700 text-white text-xs font-semibold rounded-md transition disabled:opacity-50"
                    >
                      {busy ? 'Reopening…' : 'Confirm Reopen'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openPanel('none')}
                      className="px-4 py-2 text-xs font-medium text-pq-neutral-500 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md hover:bg-pq-neutral-200 transition"
                    >
                      Cancel
                    </button>
                  </div>
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
