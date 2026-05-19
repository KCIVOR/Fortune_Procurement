'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import { DetailPageSkeleton } from '@/components/shared/structural-skeletons';
import { FileUpload } from '@/components/shared/FileUpload';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import ComplianceTraceability from '@/components/shared/ComplianceTraceability';
import StatusChip from '@/components/shared/StatusChip';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { getRSEById, startRSEReview } from '@/lib/rse';
import { getAssignedRSEForCurrentTSQA, getTSQAReviewByRSEId, submitTSQAResult } from '@/lib/tsqa';
import {
  uploadRSEReport,
  getDocumentsByProductId,
  getDocumentsByRSEId,
  getAccreditationDocumentSignedUrl,
} from '@/lib/accreditation-documents';
import type { RseRecord, TsqaReview, SupplierDocument } from '@/types/database';
import { format } from 'date-fns';
import {
  ChevronLeft,
  FlaskConical,
  CheckCircle2,
  XCircle,
  Eye,
  Upload,
  FileText,
  ExternalLink,
  AlertCircle,
  Play,
} from 'lucide-react';

// ─── Status helpers ───────────────────────────────────────────────────────────

function rseChip(status: string): { variant: StatusVariant; label: string } {
  const map: Record<string, { variant: StatusVariant; label: string }> = {
    created: { variant: 'pending', label: 'Created' },
    assigned: { variant: 'pending', label: 'Assigned' },
    under_review: { variant: 'in_review', label: 'Under Review' },
    passed: { variant: 'approved', label: 'Passed' },
    failed: { variant: 'rejected', label: 'Failed' },
    cancelled: { variant: 'cancelled', label: 'Cancelled' },
  };
  return map[status] ?? { variant: 'draft', label: status };
}

function validateDocFile(file: File): string | null {
  const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png']);
  if (!allowed.has(file.type || '')) return 'Allowed types: PDF, JPG, or PNG only.';
  if (file.size > 20 * 1024 * 1024) return 'File must be 20 MB or smaller.';
  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TSQARSEDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();

  const [rse, setRse] = useState<RseRecord | null>(null);
  const [review, setReview] = useState<TsqaReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Action state
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [remarks, setRemarks] = useState('');
  const [testFindings, setTestFindings] = useState('');
  const [submitPanel, setSubmitPanel] = useState<'none' | 'passed' | 'failed'>('none');

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Document state
  const [productDocs, setProductDocs] = useState<SupplierDocument[]>([]);
  const [rseDocs, setRseDocs] = useState<SupplierDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  // ── Guards ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (profile && profile.role !== 'tsqa' && profile.role !== 'admin') {
      router.replace('/dashboard');
    }
  }, [profile, router]);

  // ── Data loading ──────────────────────────────────────────────────────────────

  const loadDocs = useCallback(async (rseRecord: RseRecord) => {
    setDocsLoading(true);
    try {
      const [pDocs, rDocs] = await Promise.all([
        getDocumentsByProductId(rseRecord.supplier_product_id),
        getDocumentsByRSEId(rseRecord.id),
      ]);
      setProductDocs(pDocs);
      setRseDocs(rDocs);
    } catch { /* non-blocking */ }
    finally { setDocsLoading(false); }
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [rseRecord, existingReview] = await Promise.all([
        getRSEById(id),
        getTSQAReviewByRSEId(id),
      ]);
      if (!rseRecord) { setError('RSE record not found.'); return; }
      setRse(rseRecord);
      setReview(existingReview);
      // Pre-fill form from existing review
      if (existingReview) {
        setRemarks(existingReview.remarks ?? '');
        setTestFindings(existingReview.test_findings ?? '');
      }
      await loadDocs(rseRecord);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to load RSE record.');
    } finally {
      setLoading(false);
    }
  }, [id, loadDocs]);

  useEffect(() => { load(); }, [load]);

  // ── Actions ───────────────────────────────────────────────────────────────────

  const handleStartReview = async () => {
    if (!profile || !rse) return;
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await startRSEReview(rse.id, profile);
      await load();
      const updated = await getRSEById(rse.id);
      if (updated?.status !== 'under_review' || updated?.assigned_to !== profile.id) {
        setActionError('Unable to start review. The record status did not update successfully.');
      } else {
        setActionSuccess('Review started. You can now submit your findings.');
      }
    } catch (err: any) {
      if (err?.code === 'PGRST116') {
        setActionError('Unable to start review. This record may have already been claimed, reassigned, or your session may no longer have permission.');
      } else {
        setActionError(err?.message || 'Failed to start review.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) { setUploadFile(null); return; }
    const err = validateDocFile(f);
    if (err) { setUploadError(err); setUploadFile(null); return; }
    setUploadError('');
    setUploadFile(f);
  };

  const handleUploadReport = async () => {
    if (!profile || !rse || !uploadFile) return;
    setUploadBusy(true);
    setUploadError('');
    try {
      await uploadRSEReport(rse.id, uploadFile, profile);
      await loadDocs(rse);
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: unknown) {
      setUploadError((err as Error)?.message || 'Upload failed. Please try again.');
    } finally {
      setUploadBusy(false);
    }
  };

  const handleSubmitResult = async (result: 'passed' | 'failed') => {
    if (!profile || !rse) return;
    if (!remarks.trim() && !testFindings.trim()) {
      setActionError('Please enter at least remarks or test findings before submitting.');
      return;
    }
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await submitTSQAResult(
        {
          rse_id: rse.id,
          result,
          remarks: remarks.trim() || null,
          test_findings: testFindings.trim() || null,
        },
        profile
      );
      await load();
      setSubmitPanel('none');
      setActionSuccess(
        result === 'passed'
          ? 'RSE marked as Passed. Product status updated to Verified. Procurement and supplier notified.'
          : 'RSE marked as Failed. Product status updated to Rejected. Procurement and supplier notified.'
      );
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Failed to submit result.');
    } finally {
      setBusy(false);
    }
  };

  const handleViewDoc = async (path: string) => {
    try {
      const url = await getAccreditationDocumentSignedUrl(path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch { /* fail silently */ }
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  const status = rse?.status ?? '';
  const chip = rseChip(status);
  const canStart = status === 'created' || status === 'assigned';
  const canUpload = status === 'assigned' || status === 'under_review';
  const canSubmit = status === 'under_review';
  const isCompleted = status === 'passed' || status === 'failed' || status === 'cancelled';

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <AppShell title="RSE Evaluation">
      {/* Back */}
      <div className="mb-4">
        <Link
          href="/tsqa/rse"
          className="inline-flex items-center gap-1 text-sm text-pq-neutral-500 hover:text-pq-neutral-900 transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to RSE Queue
        </Link>
      </div>

      {loading ? (
        <DetailPageSkeleton />
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
          {error}
        </div>
      ) : !rse ? null : (
        <div className="space-y-4">

          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-pq-neutral-900 font-mono">
                {rse.rse_number ?? rse.id.slice(0, 8).toUpperCase()}
              </h1>
              <p className="text-sm text-pq-neutral-500 mt-0.5">
                RSE Evaluation Record
              </p>
            </div>
            <StatusChip status={chip.variant} label={chip.label} />
          </div>

          {profile && id && (
            <ComplianceTraceability anchor={{ kind: 'rse', id }} role={profile.role} />
          )}

          {/* ── RSE info ── */}
          <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <InfoField label="Status" value={chip.label} />
              <InfoField
                label="Created"
                value={format(new Date(rse.created_at), 'MMM d, yyyy')}
              />
              {rse.assigned_at && (
                <InfoField
                  label="Assigned"
                  value={format(new Date(rse.assigned_at), 'MMM d, yyyy')}
                />
              )}
              {rse.completed_at && (
                <InfoField
                  label="Completed"
                  value={format(new Date(rse.completed_at), 'MMM d, yyyy')}
                />
              )}
            </div>

            {(rse.reason || rse.procurement_notes) && (
              <div className="border-t border-pq-neutral-200 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {rse.reason && (
                  <InfoField label="Reason / Purpose" value={rse.reason} />
                )}
                {rse.procurement_notes && (
                  <InfoField label="Procurement Notes" value={rse.procurement_notes} />
                )}
              </div>
            )}
          </div>

          {/* ── Existing review result (if completed) ── */}
          {review && isCompleted && (
            <div
              className={`rounded-md border p-5 space-y-3 ${review.result === 'passed'
                  ? 'bg-pq-success-100 border-pq-success-100'
                  : 'bg-pq-danger-100 border-pq-danger-100'
                }`}
            >
              <div className="flex items-center gap-2">
                {review.result === 'passed' ? (
                  <CheckCircle2 className="w-5 h-5 text-pq-success-600 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-pq-danger-600 shrink-0" />
                )}
                <p className={`text-sm font-semibold ${review.result === 'passed' ? 'text-pq-success-600' : 'text-pq-danger-600'
                  }`}>
                  Result: {review.result === 'passed' ? 'Passed' : 'Failed'}
                  {review.reviewed_at
                    ? ` — ${format(new Date(review.reviewed_at), 'MMM d, yyyy')}`
                    : ''}
                </p>
              </div>
              {review.remarks && (
                <div>
                  <p className="text-xs font-semibold text-pq-neutral-500 mb-1">Remarks</p>
                  <p className="text-sm text-pq-neutral-900 whitespace-pre-wrap">{review.remarks}</p>
                </div>
              )}
              {review.test_findings && (
                <div>
                  <p className="text-xs font-semibold text-pq-neutral-500 mb-1">Test Findings</p>
                  <p className="text-sm text-pq-neutral-900 whitespace-pre-wrap">{review.test_findings}</p>
                </div>
              )}
              <div className="pt-1 border-t border-current/10">
                <p className="text-xs text-pq-neutral-500">
                  Note: Supplier accreditation status is managed separately by Procurement.
                  This evaluation only affects the product and RSE records.
                </p>
              </div>
            </div>
          )}

          {/* ── Action result banner ── */}
          {actionSuccess && (
            <div className="bg-pq-success-100 border border-pq-success-100 rounded-md p-3 text-sm text-pq-success-600 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {actionSuccess}
            </div>
          )}

          {/* ── Action card: Start Review + Upload + Submit result ── */}
          {!isCompleted && (
            <div className="bg-white rounded-md border border-pq-neutral-200">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-pq-neutral-200 flex-wrap">
                <p className="text-sm font-semibold text-pq-neutral-900 mr-2">Actions</p>

                {canStart && (
                  <button
                    onClick={handleStartReview}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-pq-primary-700 bg-pq-primary-50 border border-pq-primary-200 rounded-md hover:bg-pq-primary-100 transition disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {busy ? 'Starting…' : 'Start Review'}
                  </button>
                )}

                {canSubmit && (
                  <>
                    <button
                      onClick={() => setSubmitPanel(submitPanel === 'passed' ? 'none' : 'passed')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition ${submitPanel === 'passed'
                          ? 'bg-pq-success-100 text-pq-success-600 border-pq-success-200'
                          : 'text-pq-success-600 bg-pq-success-100 border-pq-success-100 hover:bg-pq-success-100'
                        }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark Passed
                    </button>
                    <button
                      onClick={() => setSubmitPanel(submitPanel === 'failed' ? 'none' : 'failed')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition ${submitPanel === 'failed'
                          ? 'bg-pq-danger-100 text-pq-danger-600 border-red-300'
                          : 'text-pq-danger-600 bg-pq-danger-100 border-pq-danger-100 hover:bg-pq-danger-100'
                        }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Mark Failed
                    </button>
                  </>
                )}
              </div>

              {/* Submit result panel */}
              {submitPanel !== 'none' && (
                <div className="p-5 space-y-4 border-b border-pq-neutral-200">
                  {actionError && (
                    <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-3 text-sm text-pq-danger-600">
                      {actionError}
                    </div>
                  )}

                  <div
                    className={`rounded-md border px-4 py-2.5 flex items-center gap-2 text-sm font-medium ${submitPanel === 'passed'
                        ? 'bg-pq-success-100 border-pq-success-100 text-pq-success-600'
                        : 'bg-pq-danger-100 border-pq-danger-100 text-pq-danger-600'
                      }`}
                  >
                    {submitPanel === 'passed' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 shrink-0" />
                    )}
                    Submitting result:{' '}
                    <strong>{submitPanel === 'passed' ? 'PASSED' : 'FAILED'}</strong>
                  </div>

                  <p className="text-xs text-pq-neutral-400">
                    At least one of Remarks or Test Findings is required.
                    This will update the RSE and product status. Accreditation is not affected.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                        Remarks
                      </label>
                      <Textarea
                        value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                        rows={4}
                        placeholder="Summary of evaluation findings and conclusion."
                        className="w-full text-sm border-pq-neutral-200 bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                        Test Findings
                      </label>
                      <Textarea
                        value={testFindings}
                        onChange={e => setTestFindings(e.target.value)}
                        rows={4}
                        placeholder="Detailed test results: values, measurements, observations."
                        className="w-full text-sm border-pq-neutral-200 bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleSubmitResult(submitPanel)}
                      disabled={busy}
                      className={`flex items-center gap-1.5 px-4 py-2 text-white text-xs font-semibold rounded-md transition ${submitPanel === 'passed'
                          ? 'bg-pq-success-600 hover:bg-pq-success-600'
                          : 'bg-pq-danger-600 hover:bg-pq-danger-600'
                        }`}
                    >
                      {submitPanel === 'passed' ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5" />
                      )}
                      {busy
                        ? 'Submitting…'
                        : submitPanel === 'passed'
                          ? 'Confirm Pass'
                          : 'Confirm Fail'}
                    </Button>
                    <Button
                      onClick={() => { setSubmitPanel('none'); setActionError(''); }}
                      variant="ghost"
                      className="px-4 py-2 text-xs font-medium text-pq-neutral-500 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md hover:bg-pq-neutral-200 transition"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {/* Start review success */}
              {!submitPanel && actionSuccess && (
                <div className="px-5 py-3.5 bg-pq-success-100 text-sm text-pq-success-600 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {actionSuccess}
                </div>
              )}
            </div>
          )}

          {/* ── RSE Report upload (available when assigned or under_review) ── */}
          <div className="bg-white rounded-md border border-pq-neutral-200">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-pq-neutral-200">
              <h2 className="text-sm font-semibold text-pq-neutral-900">RSE Reports</h2>
              <span className="text-xs text-pq-neutral-400">
                {rseDocs.length} file{rseDocs.length !== 1 ? 's' : ''}
              </span>
            </div>

            {canUpload && (
              <div className="p-5 border-b border-pq-neutral-200 space-y-3">
                <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                  Upload Report
                </p>
                <div className="flex flex-col gap-2 items-start">
                  <div className="w-full max-w-md">
                    <FileUpload
                      accept=".pdf,.jpg,.jpeg,.png"
                      selectedFileName={uploadFile?.name}
                      onFileSelect={(file) => {
                        const err = validateDocFile(file);
                        if (err) {
                          setUploadError(err);
                          setUploadFile(null);
                        } else {
                          setUploadError('');
                          setUploadFile(file);
                        }
                      }}
                      onFileRemove={() => {
                        setUploadFile(null);
                        setUploadError('');
                      }}
                      error={uploadError}
                      isLoading={uploadBusy}
                    />
                  </div>
                  {uploadFile && (
                    <Button
                      type="button"
                      onClick={handleUploadReport}
                      disabled={uploadBusy}
                      className="px-4 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-xs font-semibold rounded-md transition whitespace-nowrap"
                    >
                      {uploadBusy ? 'Uploading…' : 'Upload Report'}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {docsLoading ? (
              <div className="p-5"><LoadingState message="Loading documents…" /></div>
            ) : rseDocs.length === 0 ? (
              <div className="p-8 text-center">
                <FlaskConical className="w-6 h-6 text-pq-neutral-400 mx-auto mb-2" />
                <p className="text-sm text-pq-neutral-500">No reports uploaded yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-pq-neutral-200">
                {rseDocs.map(doc => (
                  <DocRow key={doc.id} doc={doc} onView={handleViewDoc} />
                ))}
              </div>
            )}
          </div>

          {/* ── Supplier product documents (read-only reference) ── */}
          <div className="bg-white rounded-md border border-pq-neutral-200">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-pq-neutral-200">
              <h2 className="text-sm font-semibold text-pq-neutral-900">Product Documents</h2>
              <span className="text-xs text-pq-neutral-400">
                Submitted by supplier · {productDocs.length} file{productDocs.length !== 1 ? 's' : ''}
              </span>
            </div>

            {docsLoading ? (
              <div className="p-5"><LoadingState message="Loading documents…" /></div>
            ) : productDocs.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-6 h-6 text-pq-neutral-400 mx-auto mb-2" />
                <p className="text-sm text-pq-neutral-500">No product documents uploaded by supplier.</p>
              </div>
            ) : (
              <div className="divide-y divide-pq-neutral-200">
                {productDocs.map(doc => (
                  <DocRow key={doc.id} doc={doc} onView={handleViewDoc} />
                ))}
              </div>
            )}
          </div>

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

function DocRow({
  doc,
  onView,
}: {
  doc: SupplierDocument;
  onView: (path: string) => void;
}) {
  const [viewBusy, setViewBusy] = useState(false);

  const handleView = async () => {
    setViewBusy(true);
    try { await onView(doc.file_path); }
    finally { setViewBusy(false); }
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
        disabled={viewBusy}
        className="shrink-0 flex items-center gap-1 text-xs text-pq-primary-600 hover:text-pq-neutral-900 transition disabled:opacity-50"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        {viewBusy ? 'Opening…' : 'View'}
      </button>
    </div>
  );
}
