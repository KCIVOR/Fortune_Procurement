'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import ComplianceTraceability from '@/components/shared/ComplianceTraceability';
import LoadingState from '@/components/shared/LoadingState';
import { DetailPageSkeleton } from '@/components/shared/structural-skeletons';
import StatusChip from '@/components/shared/StatusChip';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { useAuth } from '@/context/AuthContext';
import {
  getSupplierProductById,
  updateSupplierProduct,
  submitSupplierProductForReview,
  withdrawSupplierProduct,
} from '@/lib/supplier-products';
import {
  uploadSupplierProductDocument,
  getDocumentsByProductId,
  getAccreditationDocumentSignedUrl,
} from '@/lib/accreditation-documents';
import { getRSERecordsByProductId, type RSEWithReview } from '@/lib/rse';
import type { SupplierProduct, SupplierDocument } from '@/types/database';
import { format } from 'date-fns';
import {
  ChevronLeft,
  Package,
  CheckCircle2,
  Circle,
  Upload,
  FileText,
  ExternalLink,
  AlertCircle,
  Pencil,
  X,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileUpload } from '@/components/shared/FileUpload';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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
  };
  return map[status] ?? { variant: 'draft', label: status };
}

// ─── Document upload constants ────────────────────────────────────────────────

const DOC_TYPE_OPTIONS = [
  { value: 'tds', label: 'Technical Data Sheet (TDS)' },
  { value: 'msds', label: 'MSDS / Safety Data Sheet' },
  { value: 'product_specification', label: 'Product Specification' },
  { value: 'certification', label: 'Certification' },
  { value: 'company_profile', label: 'Company Profile' },
  { value: 'other', label: 'Other' },
];

function validateDocFile(file: File): string | null {
  const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png']);
  if (!allowed.has(file.type || '')) return 'Allowed types: PDF, JPG, or PNG only.';
  if (file.size > 20 * 1024 * 1024) return 'File must be 20 MB or smaller.';
  return null;
}

// ─── Form state type ─────────────────────────────────────────────────────────

interface ProductForm {
  product_name: string;
  product_code: string;
  category: string;
  description: string;
  specifications: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupplierProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();

  const [product, setProduct] = useState<SupplierProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<ProductForm>({
    product_name: '', product_code: '', category: '', description: '', specifications: '',
  });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const [rseRecords, setRseRecords] = useState<RSEWithReview[]>([]);

  const [documents, setDocuments] = useState<SupplierDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docType, setDocType] = useState('tds');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async (productId: string) => {
    setDocsLoading(true);
    try {
      const docs = await getDocumentsByProductId(productId);
      setDocuments(docs);
    } catch {
      // non-blocking
    } finally {
      setDocsLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const p = await getSupplierProductById(id);
      if (!p) { setError('Product not found.'); return; }
      setProduct(p);
      setForm({
        product_name: p.product_name,
        product_code: p.product_code ?? '',
        category: p.category ?? '',
        description: p.description ?? '',
        specifications: p.specifications ?? '',
      });
      const [, rse] = await Promise.all([
        loadDocs(p.id),
        getRSERecordsByProductId(p.id),
      ]);
      setRseRecords(rse);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to load product.');
    } finally {
      setLoading(false);
    }
  }, [id, loadDocs]);

  useEffect(() => { load(); }, [load]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!profile || !product) return;
    if (!form.product_name.trim()) { setFormError('Product name is required.'); return; }
    setBusy(true);
    setFormError('');
    setActionSuccess('');
    try {
      await updateSupplierProduct(
        product.id,
        {
          product_name: form.product_name,
          product_code: form.product_code.trim() || null,
          category: form.category.trim() || null,
          description: form.description.trim() || null,
          specifications: form.specifications.trim() || null,
        },
        profile
      );
      await load();
      setEditing(false);
      setActionSuccess('Changes saved.');
    } catch (err: unknown) {
      setFormError((err as Error)?.message || 'Failed to save changes.');
    } finally {
      setBusy(false);
    }
  };

  const handleCancelEdit = () => {
    if (!product) return;
    setForm({
      product_name: product.product_name,
      product_code: product.product_code ?? '',
      category: product.category ?? '',
      description: product.description ?? '',
      specifications: product.specifications ?? '',
    });
    setFormError('');
    setEditing(false);
  };

  const handleSubmitForReview = async () => {
    if (!profile || !product) return;
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await submitSupplierProductForReview(product.id, profile);
      await load();
      setActionSuccess('Product submitted for Procurement review.');
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Failed to submit product for review.');
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) { setDocFile(null); return; }
    const err = validateDocFile(f);
    if (err) { setUploadError(err); setDocFile(null); return; }
    setUploadError('');
    setDocFile(f);
  };

  const handleUpload = async () => {
    if (!profile || !product || !docFile) return;
    setUploadBusy(true);
    setUploadError('');
    try {
      await uploadSupplierProductDocument(product.id, docFile, docType, profile);
      await loadDocs(product.id);
      setDocFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: unknown) {
      setUploadError((err as Error)?.message || 'Upload failed. Please try again.');
    } finally {
      setUploadBusy(false);
    }
  };

  const handleViewDocument = async (path: string) => {
    try {
      const url = await getAccreditationDocumentSignedUrl(path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      // secondary action; fail silently
    }
  };

  const isDraft = product?.status === 'draft';
  const isWithdrawn = product?.status === 'withdrawn';
  const chip = product ? productChip(product.status) : null;
  const canOffer = product?.status === 'verified';
  const canWithdraw =
    product?.status === 'draft' || product?.status === 'submitted';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppShell title={product?.product_name ?? 'Product Detail'}>
      {/* Back link */}
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

          {/* ── Header ── */}
          <PageHeader
            title={product.product_name}
            description={product.category ?? undefined}
            action={
              chip ? (
                <StatusChip status={chip.variant} label={chip.label} />
              ) : null
            }
          />

          {/* ── Can Offer banner ── */}
          <div
            className={`rounded-md border px-4 py-3 flex items-center gap-2.5 text-sm font-medium ${canOffer
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
                ? 'Verified = Can Offer in RFQ / awardable when linked on a quote (requestor substitute rules still apply).'
                : isWithdrawn
                  ? 'This product was withdrawn and cannot be offered in procurement.'
                  : 'Pending validation = Cannot Offer / cannot be awarded on RFQ until status is verified.'}
            </span>
          </div>

          {profile && (
            <ComplianceTraceability anchor={{ kind: 'product', id: product.id }} role={profile.role} />
          )}

          {isWithdrawn && (
            <div className="rounded-md border border-pq-neutral-200 bg-pq-neutral-50 px-4 py-3 text-sm text-pq-neutral-500">
              This product was withdrawn. It remains on file for audit; documents below are view-only.
            </div>
          )}

          {/* ── Product details card ── */}
          <div className="bg-white rounded-md border border-pq-neutral-200">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-pq-neutral-200">
              <h2 className="text-sm font-semibold text-pq-neutral-900">Product Details</h2>
              {isDraft && !editing && !isWithdrawn && (
                <button
                  type="button"
                  onClick={() => { setEditing(true); setActionSuccess(''); }}
                  className="flex items-center gap-1.5 text-xs font-medium text-pq-primary-600 hover:text-pq-neutral-900 transition"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit
                </button>
              )}
              {editing && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex items-center gap-1.5 text-xs font-medium text-pq-neutral-500 hover:text-pq-neutral-900 transition"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              )}
            </div>

            <div className="p-5 space-y-5">
              {/* Editable fields — shown when editing (draft only), read-only otherwise */}
              {isDraft && editing ? (
                <>
                  {formError && (
                    <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-3 text-sm text-pq-danger-600">
                      {formError}
                    </div>
                  )}

                  <FormField label="Product Name" required>
                    <input
                      type="text"
                      name="product_name"
                      value={form.product_name}
                      onChange={handleChange}
                      className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] bg-white"
                    />
                  </FormField>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <FormField label="Product Code / SKU">
                      <input
                        type="text"
                        name="product_code"
                        value={form.product_code}
                        onChange={handleChange}
                        className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] bg-white"
                      />
                    </FormField>
                    <FormField label="Category">
                      <input
                        type="text"
                        name="category"
                        value={form.category}
                        onChange={handleChange}
                        className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] bg-white"
                      />
                    </FormField>
                  </div>

                  <FormField label="Description">
                    <textarea
                      name="description"
                      value={form.description}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
                    />
                  </FormField>

                  <FormField label="Specifications">
                    <textarea
                      name="specifications"
                      value={form.specifications}
                      onChange={handleChange}
                      rows={5}
                      className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
                    />
                  </FormField>

                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={busy}
                    className="px-5 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
                  >
                    {busy ? 'Saving…' : 'Save Changes'}
                  </button>
                </>
              ) : (
                /* Read-only view */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <InfoField label="Product Code" value={product.product_code ?? '—'} />
                  <InfoField label="Category" value={product.category ?? '—'} />
                  {product.description && (
                    <div className="sm:col-span-2">
                      <InfoField label="Description" value={product.description} />
                    </div>
                  )}
                  {product.specifications && (
                    <div className="sm:col-span-2">
                      <InfoField label="Specifications" value={product.specifications} />
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
              )}
            </div>

            {/* Procurement review notes */}
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

          {/* ── Submit for review (draft only) ── */}
          {isDraft && !editing && !isWithdrawn && (
            <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-3">
              {actionError && (
                <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-3 text-sm text-pq-danger-600">
                  {actionError}
                </div>
              )}
              {actionSuccess && (
                <div className="bg-pq-success-100 border border-pq-success-100 rounded-md p-3 text-sm text-pq-success-600 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {actionSuccess}
                </div>
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSubmitForReview}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-5 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
                >
                  <Package className="w-4 h-4" />
                  {busy ? 'Submitting…' : 'Submit for Procurement Review'}
                </button>
              </div>
              <p className="text-xs text-pq-neutral-400">
                Upload supporting documents below before submitting. Once submitted, you cannot
                edit this product until the review is complete.
              </p>
              {canWithdraw && profile && (
                <div className="pt-2 border-t border-pq-neutral-200 mt-3">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        disabled={busy}
                        className="px-4 py-2 text-sm font-semibold text-pq-neutral-500 bg-white border border-pq-neutral-200 rounded-md hover:bg-pq-neutral-50 transition disabled:opacity-50"
                      >
                        Withdraw Product
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="bg-white border-pq-neutral-200">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Withdraw this product?</AlertDialogTitle>
                        <AlertDialogDescription className="text-pq-neutral-500">
                          Your product record and uploaded documents stay on file for audit. Procurement will not
                          validate or award this listing while it is withdrawn.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="border-pq-neutral-200">Back</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-pq-danger-600 hover:bg-pq-danger-600 text-white"
                          onClick={async () => {
                            if (!profile || !product) return;
                            setBusy(true);
                            setActionError('');
                            setActionSuccess('');
                            try {
                              await withdrawSupplierProduct(product.id, profile);
                              await load();
                              setActionSuccess(
                                'This product was withdrawn and cannot be offered in procurement.'
                              );
                            } catch (err: unknown) {
                              setActionError((err as Error)?.message || 'Withdraw Product failed.');
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Withdraw Product
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          )}

          {/* Withdraw — submitted (not in draft submit card) */}
          {!isDraft && product.status === 'submitted' && profile && (
            <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-3">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    disabled={busy}
                    className="px-4 py-2 text-sm font-semibold text-pq-neutral-500 bg-white border border-pq-neutral-200 rounded-md hover:bg-pq-neutral-50 transition disabled:opacity-50"
                  >
                    Withdraw Product
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-white border-pq-neutral-200">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Withdraw this product?</AlertDialogTitle>
                    <AlertDialogDescription className="text-pq-neutral-500">
                      Your product record and uploaded documents stay on file for audit. It will be removed from
                      the Procurement review queue.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-pq-neutral-200">Back</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-pq-danger-600 hover:bg-pq-danger-600 text-white"
                      onClick={async () => {
                        if (!profile || !product) return;
                        setBusy(true);
                        setActionError('');
                        setActionSuccess('');
                        try {
                          await withdrawSupplierProduct(product.id, profile);
                          await load();
                          setActionSuccess(
                            'This product was withdrawn and cannot be offered in procurement.'
                          );
                        } catch (err: unknown) {
                          setActionError((err as Error)?.message || 'Withdraw Product failed.');
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      Withdraw Product
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <p className="text-xs text-pq-neutral-400">
                Available while the product is a draft or awaiting Procurement review.
              </p>
            </div>
          )}

          {/* Success / errors for non-draft (e.g. after submit or withdraw from submitted) */}
          {!isDraft && actionError && (
            <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-3 text-sm text-pq-danger-600">
              {actionError}
            </div>
          )}
          {!isDraft && actionSuccess && (
            <div className="bg-pq-success-100 border border-pq-success-100 rounded-md p-3 text-sm text-pq-success-600 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {actionSuccess}
            </div>
          )}

          {/* ── Product documents ── */}
          <div className="bg-white rounded-md border border-pq-neutral-200">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-pq-neutral-200">
              <h2 className="text-sm font-semibold text-pq-neutral-900">Product Documents</h2>
              <span className="text-xs text-pq-neutral-400">
                {documents.length} file{documents.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Upload form */}
            <div className="p-5 border-b border-pq-neutral-200 space-y-3">
              <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                Upload Document
              </p>
              {isWithdrawn ? (
                <p className="text-sm text-pq-neutral-500">
                  Uploads are disabled for withdrawn products. You can still view documents below.
                </p>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center flex-wrap">
                    <div className="w-full sm:w-52">
                      <Select value={docType} onValueChange={setDocType}>
                        <SelectTrigger className="text-sm border-pq-neutral-200">
                          <SelectValue placeholder="Document type" />
                        </SelectTrigger>
                        <SelectContent>
                          {DOC_TYPE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex-1 w-full min-w-[200px]">
                      <FileUpload
                        accept=".pdf,.jpg,.jpeg,.png"
                        selectedFileName={docFile?.name}
                        onFileSelect={(file) => {
                          const err = validateDocFile(file);
                          if (err) {
                            setUploadError(err);
                            setDocFile(null);
                          } else {
                            setUploadError('');
                            setDocFile(file);
                          }
                        }}
                        onFileRemove={() => {
                          setDocFile(null);
                          setUploadError('');
                        }}
                        error={uploadError}
                        isLoading={uploadBusy}
                      />
                    </div>

                    {docFile && (
                      <Button
                        type="button"
                        onClick={handleUpload}
                        disabled={uploadBusy}
                        className="px-4 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-xs font-semibold rounded-md transition whitespace-nowrap self-end"
                      >
                        {uploadBusy ? 'Uploading…' : 'Upload'}
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Document list */}
            {docsLoading ? (
              <div className="p-5">
                <LoadingState message="Loading documents…" />
              </div>
            ) : documents.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-6 h-6 text-pq-neutral-400 mx-auto mb-2" />
                <p className="text-sm text-pq-neutral-500">No documents uploaded yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-pq-neutral-200">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 px-5 py-3.5">
                    <FileText className="w-4 h-4 text-pq-neutral-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-pq-neutral-900 truncate">{doc.file_name}</p>
                      <p className="text-xs text-pq-neutral-400">
                        {DOC_TYPE_OPTIONS.find(o => o.value === doc.document_type)?.label ??
                          doc.document_type}
                        {' · '}
                        {format(new Date(doc.uploaded_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleViewDocument(doc.file_path)}
                      className="shrink-0 flex items-center gap-1 text-xs text-pq-primary-600 hover:text-pq-neutral-900 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── TSQA / RSE evaluation section (read-only for supplier) ── */}
          {rseRecords.length > 0 && (
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

          {product?.status === 'pending_tsqa' && rseRecords.length === 0 && (
            <div className="bg-pq-neutral-50 border border-pq-neutral-200 rounded-md px-4 py-3 text-sm text-pq-neutral-500">
              This product is currently under technical evaluation by TSQA. Results will be reflected here once complete.
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

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
        {label}
        {required && <span className="text-pq-danger-600 ml-0.5">*</span>}
      </label>
      {children}
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
