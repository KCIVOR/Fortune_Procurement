'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import ComplianceTraceability from '@/components/shared/ComplianceTraceability';
import LoadingState from '@/components/shared/LoadingState';
import { DetailPageSkeleton } from '@/components/shared/structural-skeletons';
import StatusChip from '@/components/shared/StatusChip';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { getSupplierProductById } from '@/lib/supplier-products';
import { getRSERecordsByProductId, type RSEWithReview } from '@/lib/rse';
import type { SupplierProduct } from '@/types/database';
import { format } from 'date-fns';
import {
  ChevronLeft,
  CheckCircle2,
  Circle,
  AlertCircle,
} from 'lucide-react';

// ─── Status helpers ───────────────────────────────────────────────────────────

function productChip(status: string): { variant: StatusVariant; label: string } {
  const map: Record<string, { variant: StatusVariant; label: string }> = {
    draft: { variant: 'draft', label: 'Draft' },
    submitted: { variant: 'pending', label: 'Submitted' },
    under_review: { variant: 'in_review', label: 'Under Procurement Review' },
    pending_tsqa: { variant: 'in_review', label: 'Under Technical Evaluation' },
    verified: { variant: 'validated', label: 'Verified' },
    rejected: { variant: 'rejected', label: 'Rejected' },
    inactive: { variant: 'cancelled', label: 'Inactive' },
    withdrawn: { variant: 'cancelled', label: 'Withdrawn' },
    expired:  { variant: 'cancelled', label: 'Expired' },
  };
  return map[status] ?? { variant: 'draft', label: status };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupplierProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();

  const [product, setProduct] = useState<SupplierProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rseRecords, setRseRecords] = useState<RSEWithReview[]>([]);

  const isRawMatSupplier =
    profile?.role === 'supplier' && profile.supplier_supply_type === 'raw_material';
  const accessDenied =
    !!profile && profile.role === 'supplier' && profile.supplier_supply_type !== 'raw_material';

  useEffect(() => {
    if (accessDenied) {
      router.replace('/dashboard');
    }
  }, [accessDenied, router]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const p = await getSupplierProductById(id);
      if (!p) { setError('Product not found.'); return; }
      setProduct(p);
      const rse = await getRSERecordsByProductId(p.id);
      setRseRecords(rse);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to load product.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!isRawMatSupplier) return;
    load();
  }, [load, isRawMatSupplier]);

  const isWithdrawn = product?.status === 'withdrawn';
  const chip        = product ? productChip(product.status) : null;
  const canOffer    = product?.status === 'verified';
  const isService   = (product?.item_type ?? 'goods') === 'services';

  if (!profile || accessDenied) {
    return (
      <AppShell title="Product Detail">
        <div className="space-y-6">
          <PageHeader
            title="Product Detail"
            description="View products in your Procurement-managed catalog."
          />
          {accessDenied ? (
            <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-6">
              <h3 className="font-semibold text-red-900 mb-2">Access Denied</h3>
              <p className="text-sm text-pq-danger-600">
                The product catalog is only available to raw-material suppliers. Redirecting…
              </p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48">
              <LoadingState message="Loading…" />
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={product?.product_name ?? 'Product Detail'}>
      <div className="mb-4">
        <Link
          href="/supplier/products"
          className="inline-flex items-center gap-1 text-sm text-pq-neutral-500 hover:text-pq-neutral-900 transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Products
        </Link>
      </div>

      {loading ? (
        <DetailPageSkeleton />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
          {error}
        </div>
      ) : !product ? null : (
        <div className="space-y-4">

          <PageHeader
            title={product.product_name}
            description={product.category ?? undefined}
            action={
              chip ? (
                <StatusChip status={chip.variant} label={chip.label} />
              ) : null
            }
          />

          <div className="rounded-md border border-pq-neutral-200 bg-pq-neutral-50 px-4 py-3 text-sm text-pq-neutral-500">
            This catalog is read-only. Contact Procurement to request product changes.
          </div>

          <div
            className={`rounded-md border px-4 py-3 flex items-center gap-2.5 text-sm font-medium ${
              canOffer
                ? 'bg-pq-success-100 border-pq-success-100 text-pq-success-600'
                : 'bg-pq-neutral-50 border-pq-neutral-200 text-pq-neutral-500'
            }`}
          >
            {canOffer ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <Circle className="w-4 h-4 shrink-0 text-pq-neutral-400" />
            )}
            <span>
              {canOffer
                ? 'Verified — this product can be offered and awarded on RFQ quotes when substitute rules are met.'
                : isWithdrawn
                  ? 'This product was withdrawn and cannot be offered in procurement.'
                  : 'Pending validation — this product can still be offered and awarded on RFQ quotes, but Procurement will see a notice that it is pending validation.'}
            </span>
          </div>

          {profile && (
            <ComplianceTraceability anchor={{ kind: 'product', id: product.id }} role={profile.role} />
          )}

          {isWithdrawn && (
            <div className="rounded-md border border-pq-neutral-200 bg-pq-neutral-50 px-4 py-3 text-sm text-pq-neutral-500">
              This product was withdrawn. It remains on file for audit.
            </div>
          )}

          <div className="bg-white rounded-md border border-pq-neutral-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-pq-neutral-200">
              <h2 className="text-sm font-semibold text-pq-neutral-900">{isService ? 'Service Details' : 'Product Details'}</h2>
            </div>

            <div className="p-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <p className="text-xs text-pq-neutral-400 mb-1">Offering Type</p>
                  <span className={`inline-flex text-xs font-semibold border rounded-full px-2.5 py-0.5 ${
                    isService
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : 'bg-blue-50 text-blue-700 border-blue-200'
                  }`}>
                    {isService ? 'Services' : 'Goods'}
                  </span>
                </div>
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
                {product.submitted_at && (
                  <InfoField
                    label="Submitted"
                    value={format(new Date(product.submitted_at), 'MMM d, yyyy')}
                  />
                )}
                {product.verified_at && (
                  <InfoField
                    label="Verified"
                    value={format(new Date(product.verified_at), 'MMM d, yyyy')}
                  />
                )}
                {product.rejected_at && (
                  <InfoField
                    label="Rejected"
                    value={format(new Date(product.rejected_at), 'MMM d, yyyy')}
                  />
                )}
              </div>
            </div>

            {product.review_notes && (
              <div className="px-5 pb-5">
                <div className="bg-pq-neutral-50 border border-pq-neutral-200 rounded-md p-3">
                  <p className="text-xs font-semibold text-pq-neutral-500 mb-1 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Procurement Review Notes
                  </p>
                  <p className="text-sm text-pq-neutral-900">{product.review_notes}</p>
                </div>
              </div>
            )}
          </div>

          {!isService && rseRecords.length > 0 && (
            <div className="bg-white rounded-md border border-pq-neutral-200">
              <div className="px-5 py-3.5 border-b border-pq-neutral-200">
                <h2 className="text-sm font-semibold text-pq-neutral-900">Technical Evaluation (RSE)</h2>
              </div>
              <div className="divide-y divide-pq-neutral-200">
                {rseRecords.map(rse => (
                  <SupplierRSERow key={rse.id} rse={rse} />
                ))}
              </div>
            </div>
          )}

          {!isService && product?.status === 'pending_tsqa' && rseRecords.length === 0 && (
            <div className="bg-pq-neutral-50 border border-pq-neutral-200 rounded-md px-4 py-3 text-sm text-pq-neutral-500">
              This product is currently under technical evaluation by TSQA. Results will be reflected here once complete.
            </div>
          )}

        </div>
      )}
    </AppShell>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-pq-neutral-400 mb-0.5">{label}</p>
      <p className="text-sm text-pq-neutral-900 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function SupplierRSERow({ rse }: { rse: RSEWithReview }) {
  const resultColor =
    rse.tsqa_result === 'passed'
      ? 'text-pq-success-600 bg-pq-success-100 border-pq-success-100'
      : rse.tsqa_result === 'failed'
        ? 'text-pq-danger-600 bg-pq-danger-100 border-pq-danger-100'
        : 'text-pq-neutral-500 bg-pq-neutral-50 border-pq-neutral-200';

  return (
    <div className="px-5 py-4 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-xs font-bold text-pq-neutral-900">
          {rse.rse_number ?? rse.id.slice(0, 8).toUpperCase()}
        </span>
        <span className="text-xs text-pq-neutral-400">RSE Status: {rse.status.replace(/_/g, ' ')}</span>
        {rse.tsqa_result && (
          <span className={`inline-flex items-center gap-1 text-xs font-medium border rounded-full px-2.5 py-1 ${resultColor}`}>
            {rse.tsqa_result === 'passed' ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <Circle className="w-3 h-3" />
            )}
            TSQA Result: {rse.tsqa_result.charAt(0).toUpperCase() + rse.tsqa_result.slice(1)}
          </span>
        )}
      </div>
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
      {rse.completed_at && (
        <p className="text-xs text-pq-neutral-400">
          Completed {format(new Date(rse.completed_at), 'MMM d, yyyy')}
        </p>
      )}
    </div>
  );
}
