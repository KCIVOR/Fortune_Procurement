'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
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
    created:      { variant: 'pending',   label: 'Created' },
    assigned:     { variant: 'pending',   label: 'Assigned' },
    under_review: { variant: 'in_review', label: 'Under Review' },
    passed:       { variant: 'approved',  label: 'Passed' },
    failed:       { variant: 'rejected',  label: 'Failed' },
    cancelled:    { variant: 'cancelled', label: 'Cancelled' },
  };
  return map[status] ?? { variant: 'draft', label: status };
}

function validateDocFile(file: File): string | null {
  const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png']);
  if (!allowed.has(file.type || '')) return 'Allowed types: PDF, JPG, or PNG only.';
  if (file.size > 20 * 1024 * 1024)   return 'File must be 20 MB or smaller.';
  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TSQARSEDetailPage() {
  const { id }      = useParams<{ id: string }>();
  const { profile } = useAuth();
  const router      = useRouter();

  const [rse, setRse]         = useState<RseRecord | null>(null);
  const [review, setReview]   = useState<TsqaReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Action state
  const [busy, setBusy]                       = useState(false);
  const [actionError, setActionError]         = useState('');
  const [actionSuccess, setActionSuccess]     = useState('');
  const [remarks, setRemarks]                 = useState('');
  const [testFindings, setTestFindings]       = useState('');
  const [submitPanel, setSubmitPanel]         = useState<'none' | 'passed' | 'failed'>('none');

  // Upload state
  const [uploadFile, setUploadFile]     = useState<File | null>(null);
  const [uploadBusy, setUploadBusy]     = useState(false);
  const [uploadError, setUploadError]   = useState('');
  const fileInputRef                    = useRef<HTMLInputElement>(null);

  // Document state
  const [productDocs, setProductDocs]   = useState<SupplierDocument[]>([]);
  const [rseDocs, setRseDocs]           = useState<SupplierDocument[]>([]);
  const [docsLoading, setDocsLoading]   = useState(false);

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
      setActionSuccess('Review started. You can now submit your findings.');
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Failed to start review.');
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
          rse_id:        rse.id,
          result,
          remarks:       remarks.trim()       || null,
          test_findings: testFindings.trim()  || null,
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

  const status      = rse?.status ?? '';
  const chip        = rseChip(status);
  const canStart    = status === 'created' || status === 'assigned';
  const canUpload   = status === 'assigned' || status === 'under_review';
  const canSubmit   = status === 'under_review';
  const isCompleted = status === 'passed' || status === 'failed' || status === 'cancelled';

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <AppShell title="RSE Evaluation">
      {/* Back */}
      <div className="mb-4">
        <Link
          href="/tsqa/rse"
          className="inline-flex items-center gap-1 text-sm text-[#40527A] hover:text-[#0F1F3A] transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to RSE Queue
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading RSE record…" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">
          {error}
        </div>
      ) : !rse ? null : (
        <div className="space-y-4">

          {/* ── Header ── */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-[#0F1F3A] font-mono">
                {rse.rse_number ?? rse.id.slice(0, 8).toUpperCase()}
              </h1>
              <p className="text-sm text-[#40527A] mt-0.5">
                RSE Evaluation Record
              </p>
            </div>
            <StatusChip status={chip.variant} label={chip.label} />
          </div>

          {profile && id && (
            <ComplianceTraceability anchor={{ kind: 'rse', id }} role={profile.role} />
          )}

          {/* ── RSE info ── */}
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <InfoField label="Status"  value={chip.label} />
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
              <div className="border-t border-[#D8E2FF] pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              className={`rounded-[4px] border p-5 space-y-3 ${
                review.result === 'passed'
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {review.result === 'passed' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 shrink-0" />
                )}
                <p className={`text-sm font-semibold ${
                  review.result === 'passed' ? 'text-emerald-700' : 'text-red-700'
                }`}>
                  Result: {review.result === 'passed' ? 'Passed' : 'Failed'}
                  {review.reviewed_at
                    ? ` — ${format(new Date(review.reviewed_at), 'MMM d, yyyy')}`
                    : ''}
                </p>
              </div>
              {review.remarks && (
                <div>
                  <p className="text-xs font-semibold text-[#40527A] mb-1">Remarks</p>
                  <p className="text-sm text-[#0F1F3A] whitespace-pre-wrap">{review.remarks}</p>
                </div>
              )}
              {review.test_findings && (
                <div>
                  <p className="text-xs font-semibold text-[#40527A] mb-1">Test Findings</p>
                  <p className="text-sm text-[#0F1F3A] whitespace-pre-wrap">{review.test_findings}</p>
                </div>
              )}
              <div className="pt-1 border-t border-current/10">
                <p className="text-xs text-[#40527A]">
                  Note: Supplier accreditation status is managed separately by Procurement.
                  This evaluation only affects the product and RSE records.
                </p>
              </div>
            </div>
          )}

          {/* ── Action result banner ── */}
          {actionSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-[4px] p-3 text-sm text-emerald-700 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {actionSuccess}
            </div>
          )}

          {/* ── Action card: Start Review + Upload + Submit result ── */}
          {!isCompleted && (
            <div className="bg-white rounded-[4px] border border-[#D8E2FF]">
              <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#D8E2FF] flex-wrap">
                <p className="text-sm font-semibold text-[#0F1F3A] mr-2">Actions</p>

                {canStart && (
                  <button
                    onClick={handleStartReview}
                    disabled={busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-[4px] hover:bg-blue-100 transition disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {busy ? 'Starting…' : 'Start Review'}
                  </button>
                )}

                {canSubmit && (
                  <>
                    <button
                      onClick={() => setSubmitPanel(submitPanel === 'passed' ? 'none' : 'passed')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] border transition ${
                        submitPanel === 'passed'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Mark Passed
                    </button>
                    <button
                      onClick={() => setSubmitPanel(submitPanel === 'failed' ? 'none' : 'failed')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[4px] border transition ${
                        submitPanel === 'failed'
                          ? 'bg-red-100 text-red-800 border-red-300'
                          : 'text-red-700 bg-red-50 border-red-200 hover:bg-red-100'
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
                <div className="p-5 space-y-4 border-b border-[#D8E2FF]">
                  {actionError && (
                    <div className="bg-red-50 border border-red-200 rounded-[4px] p-3 text-sm text-red-700">
                      {actionError}
                    </div>
                  )}

                  <div
                    className={`rounded-[4px] border px-4 py-2.5 flex items-center gap-2 text-sm font-medium ${
                      submitPanel === 'passed'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-red-50 border-red-200 text-red-700'
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

                  <p className="text-xs text-[#BFC7D5]">
                    At least one of Remarks or Test Findings is required.
                    This will update the RSE and product status. Accreditation is not affected.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                        Remarks
                      </label>
                      <textarea
                        value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                        rows={4}
                        placeholder="Summary of evaluation findings and conclusion."
                        className="w-full px-3 py-2 text-sm border border-[#D8E2FF] rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                        Test Findings
                      </label>
                      <textarea
                        value={testFindings}
                        onChange={e => setTestFindings(e.target.value)}
                        rows={4}
                        placeholder="Detailed test results: values, measurements, observations."
                        className="w-full px-3 py-2 text-sm border border-[#D8E2FF] rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSubmitResult(submitPanel)}
                      disabled={busy}
                      className={`flex items-center gap-1.5 px-4 py-2 text-white text-xs font-semibold rounded-[4px] transition disabled:opacity-50 ${
                        submitPanel === 'passed'
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : 'bg-red-600 hover:bg-red-700'
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
                    </button>
                    <button
                      onClick={() => { setSubmitPanel('none'); setActionError(''); }}
                      className="px-4 py-2 text-xs font-medium text-[#40527A] bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] hover:bg-[#E5EAFF] transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Start review success */}
              {!submitPanel && actionSuccess && (
                <div className="px-5 py-3.5 bg-emerald-50 text-sm text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  {actionSuccess}
                </div>
              )}
            </div>
          )}

          {/* ── RSE Report upload (available when assigned or under_review) ── */}
          <div className="bg-white rounded-[4px] border border-[#D8E2FF]">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#D8E2FF]">
              <h2 className="text-sm font-semibold text-[#0F1F3A]">RSE Reports</h2>
              <span className="text-xs text-[#BFC7D5]">
                {rseDocs.length} file{rseDocs.length !== 1 ? 's' : ''}
              </span>
            </div>

            {canUpload && (
              <div className="p-5 border-b border-[#D8E2FF] space-y-3">
                <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                  Upload Report
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="sr-only"
                    onChange={handleFileChange}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#40527A] bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] hover:bg-[#E5EAFF] transition whitespace-nowrap"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploadFile ? uploadFile.name : 'Choose Report File'}
                  </button>
                  {uploadFile && (
                    <button
                      type="button"
                      onClick={handleUploadReport}
                      disabled={uploadBusy}
                      className="px-4 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-xs font-semibold rounded-[4px] transition disabled:opacity-50 whitespace-nowrap"
                    >
                      {uploadBusy ? 'Uploading…' : 'Upload Report'}
                    </button>
                  )}
                </div>
                {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
                <p className="text-xs text-[#BFC7D5]">Accepted: PDF, JPG, PNG · Max 20 MB</p>
              </div>
            )}

            {docsLoading ? (
              <div className="p-5"><LoadingState message="Loading documents…" /></div>
            ) : rseDocs.length === 0 ? (
              <div className="p-8 text-center">
                <FlaskConical className="w-6 h-6 text-[#BFC7D5] mx-auto mb-2" />
                <p className="text-sm text-[#40527A]">No reports uploaded yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#D8E2FF]">
                {rseDocs.map(doc => (
                  <DocRow key={doc.id} doc={doc} onView={handleViewDoc} />
                ))}
              </div>
            )}
          </div>

          {/* ── Supplier product documents (read-only reference) ── */}
          <div className="bg-white rounded-[4px] border border-[#D8E2FF]">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#D8E2FF]">
              <h2 className="text-sm font-semibold text-[#0F1F3A]">Product Documents</h2>
              <span className="text-xs text-[#BFC7D5]">
                Submitted by supplier · {productDocs.length} file{productDocs.length !== 1 ? 's' : ''}
              </span>
            </div>

            {docsLoading ? (
              <div className="p-5"><LoadingState message="Loading documents…" /></div>
            ) : productDocs.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-6 h-6 text-[#BFC7D5] mx-auto mb-2" />
                <p className="text-sm text-[#40527A]">No product documents uploaded by supplier.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#D8E2FF]">
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
      <p className="text-xs text-[#BFC7D5] mb-0.5">{label}</p>
      <p className="text-sm text-[#0F1F3A] whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function DocRow({
  doc,
  onView,
}: {
  doc:    SupplierDocument;
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
        disabled={viewBusy}
        className="shrink-0 flex items-center gap-1 text-xs text-[#1E4BFF] hover:text-[#0F1F3A] transition disabled:opacity-50"
      >
        <ExternalLink className="w-3.5 h-3.5" />
        {viewBusy ? 'Opening…' : 'View'}
      </button>
    </div>
  );
}
