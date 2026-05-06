'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import StatusChip from '@/components/shared/StatusChip';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { useAuth } from '@/context/AuthContext';
import {
  getMyAccreditation,
  createDraftAccreditation,
  submitAccreditation,
  withdrawAccreditation,
} from '@/lib/accreditation';
import {
  uploadSupplierAccreditationDocument,
  getDocumentsByAccreditationId,
  getAccreditationDocumentSignedUrl,
} from '@/lib/accreditation-documents';
import type { SupplierAccreditation, SupplierDocument } from '@/types/database';
import { format } from 'date-fns';
import {
  BadgeCheck,
  Upload,
  FileText,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

function statusChip(status: string): { variant: StatusVariant; label: string } {
  const map: Record<string, { variant: StatusVariant; label: string }> = {
    draft:             { variant: 'draft',     label: 'Draft' },
    submitted:         { variant: 'pending',   label: 'Submitted' },
    under_review:      { variant: 'in_review', label: 'Under Procurement Review' },
    missing_documents: { variant: 'pending',   label: 'Action Required: Missing Documents' },
    approved:          { variant: 'approved',  label: 'Accredited' },
    rejected:          { variant: 'rejected',  label: 'Rejected' },
    withdrawn:         { variant: 'cancelled', label: 'Withdrawn' },
  };
  return map[status] ?? { variant: 'draft', label: status };
}

const STATUS_DESCRIPTION: Record<string, string> = {
  draft:
    'Your application is a draft. Upload your documents below and submit for Procurement review when ready.',
  submitted:
    'Your application has been submitted and is awaiting Procurement review.',
  under_review:
    'Procurement is currently reviewing your accreditation application.',
  missing_documents:
    'Procurement has requested additional documents. Review the notes below, upload the missing files, and resubmit.',
  approved:
    'Your company is accredited. Product listings are still validated separately—verified products can be offered in RFQ; pending products cannot be awarded until verified.',
  rejected:
    'Your accreditation application was rejected. You may start a new application.',
  withdrawn:
    'This application was withdrawn. You may start a new accreditation application.',
};

// ─── Document upload constants ────────────────────────────────────────────────

const DOC_TYPE_OPTIONS = [
  { value: 'company_profile',        label: 'Company Profile' },
  { value: 'self_assessment',        label: 'Self Assessment' },
  { value: 'legal_document',         label: 'Legal Document' },
  { value: 'certification',          label: 'Certification' },
  { value: 'tds',                    label: 'Technical Data Sheet (TDS)' },
  { value: 'msds',                   label: 'MSDS / Safety Data Sheet' },
  { value: 'product_specification',  label: 'Product Specification' },
  { value: 'other',                  label: 'Other' },
];

function validateDocFile(file: File): string | null {
  const allowed = new Set(['application/pdf', 'image/jpeg', 'image/png']);
  if (!allowed.has(file.type || '')) return 'Allowed types: PDF, JPG, or PNG only.';
  if (file.size > 20 * 1024 * 1024)   return 'File must be 20 MB or smaller.';
  return null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupplierAccreditationPage() {
  const { profile } = useAuth();

  const [accreditation, setAccreditation] = useState<SupplierAccreditation | null>(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');

  const [busy, setBusy]                   = useState(false);
  const [actionError, setActionError]     = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const [documents, setDocuments]     = useState<SupplierDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const [docType, setDocType]           = useState('company_profile');
  const [docFile, setDocFile]           = useState<File | null>(null);
  const [uploadBusy, setUploadBusy]     = useState(false);
  const [uploadError, setUploadError]   = useState('');
  const fileInputRef                    = useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async (accId: string) => {
    setDocsLoading(true);
    try {
      const docs = await getDocumentsByAccreditationId(accId);
      setDocuments(docs);
    } catch {
      // document load failure should not block the main page
    } finally {
      setDocsLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    setError('');
    try {
      const acc = await getMyAccreditation(profile);
      setAccreditation(acc);
      if (acc) await loadDocs(acc.id);
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Failed to load accreditation data.');
    } finally {
      setLoading(false);
    }
  }, [profile, loadDocs]);

  useEffect(() => { load(); }, [load]);

  const handleStart = async () => {
    if (!profile) return;
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await createDraftAccreditation(profile);
      await load();
      setActionSuccess('Application created. Upload your documents and submit when ready.');
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Failed to start accreditation.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async () => {
    if (!profile || !accreditation) return;
    setBusy(true);
    setActionError('');
    setActionSuccess('');
    try {
      await submitAccreditation(accreditation.id, profile);
      await load();
      setActionSuccess('Accreditation submitted for Procurement review.');
    } catch (err: unknown) {
      setActionError((err as Error)?.message || 'Failed to submit accreditation.');
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
    if (!profile || !accreditation || !docFile) return;
    setUploadBusy(true);
    setUploadError('');
    try {
      await uploadSupplierAccreditationDocument(accreditation.id, docFile, docType, profile);
      await loadDocs(accreditation.id);
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
      // view failure is a secondary concern; could show inline error in a future iteration
    }
  };

  const canSubmit =
    accreditation?.status === 'draft' || accreditation?.status === 'missing_documents';

  const canWithdraw =
    accreditation?.status === 'draft' ||
    accreditation?.status === 'submitted' ||
    accreditation?.status === 'missing_documents';

  const canStartNewAfterClose =
    accreditation?.status === 'withdrawn' || accreditation?.status === 'rejected';

  const docUploadDisabled =
    accreditation?.status === 'withdrawn' || accreditation?.status === 'rejected';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <AppShell title="Supplier Accreditation">
      <PageHeader
        title="Supplier Accreditation"
        description="Submit your company accreditation for Procurement review. Accreditation approves your organization; each catalog product is validated separately (Procurement / TSQA) before it can be awarded on RFQs."
      />

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading accreditation..." />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">
          {error}
        </div>
      ) : !accreditation ? (
        /* ── No application yet ── */
        <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-10 text-center max-w-lg mx-auto mt-4">
          <div className="w-12 h-12 rounded-[4px] bg-[#F7F9FC] border border-[#D8E2FF] flex items-center justify-center mb-4 mx-auto">
            <BadgeCheck className="w-6 h-6 text-[#BFC7D5]" />
          </div>
          <h3 className="text-base font-semibold text-[#0F1F3A] mb-1">
            No accreditation application yet
          </h3>
          <p className="text-sm text-[#40527A] mb-6 max-w-xs mx-auto">
            Start your accreditation application to become a verified supplier. You will upload
            supporting documents and submit for Procurement review.
          </p>
          {actionError && (
            <div className="bg-red-50 border border-red-200 rounded-[4px] p-3 text-sm text-red-700 text-left mb-4">
              {actionError}
            </div>
          )}
          <button
            onClick={handleStart}
            disabled={busy}
            className="px-5 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition disabled:opacity-50"
          >
            {busy ? 'Starting…' : 'Start Accreditation Application'}
          </button>
        </div>
      ) : (
        /* ── Accreditation exists ── */
        <div className="space-y-4">

          {/* ── Status + notes + submit action ── */}
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-5 space-y-4">

            {/* Status row */}
            <div>
              <p className="text-xs font-semibold text-[#BFC7D5] uppercase tracking-wide mb-2">
                Accreditation Status
              </p>
              <StatusChip
                status={statusChip(accreditation.status).variant}
                label={statusChip(accreditation.status).label}
              />
            </div>

            {/* Status description */}
            <p className="text-sm text-[#40527A]">
              {STATUS_DESCRIPTION[accreditation.status] ?? ''}
            </p>

            {actionError && (
              <div className="bg-red-50 border border-red-200 rounded-[4px] p-3 text-sm text-red-700">
                {actionError}
              </div>
            )}
            {actionSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-[4px] p-3 text-sm text-emerald-700 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {actionSuccess}
              </div>
            )}

            {canStartNewAfterClose && (
              <div className="rounded-[4px] border border-[#D8E2FF] bg-[#F7F9FC] p-4 space-y-3">
                <p className="text-sm text-[#0F1F3A]">
                  {accreditation.status === 'withdrawn'
                    ? 'This application was withdrawn. You may start a new accreditation application.'
                    : 'You may start a new accreditation application.'}
                </p>
                <button
                  type="button"
                  onClick={handleStart}
                  disabled={busy}
                  className="px-5 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition disabled:opacity-50"
                >
                  {busy ? 'Starting…' : 'Start New Application'}
                </button>
              </div>
            )}

            {/* Key dates */}
            {(accreditation.submitted_at ||
              accreditation.reviewed_at ||
              accreditation.approved_at ||
              accreditation.rejected_at) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
                {accreditation.submitted_at && (
                  <InfoField
                    label="Submitted"
                    value={format(new Date(accreditation.submitted_at), 'MMM d, yyyy')}
                  />
                )}
                {accreditation.reviewed_at && (
                  <InfoField
                    label="Reviewed"
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
            )}

            {/* Procurement notes / missing documents request */}
            {(accreditation.missing_documents_note || accreditation.review_notes) && (
              <div className="border-t border-[#D8E2FF] pt-4 space-y-3">
                {accreditation.missing_documents_note && (
                  <div className="bg-amber-50 border border-amber-200 rounded-[4px] p-3">
                    <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Missing Documents Requested
                    </p>
                    <p className="text-sm text-amber-900">{accreditation.missing_documents_note}</p>
                  </div>
                )}
                {accreditation.review_notes && (
                  <div className="bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] p-3">
                    <p className="text-xs font-semibold text-[#40527A] mb-1">Reviewer Notes</p>
                    <p className="text-sm text-[#0F1F3A]">{accreditation.review_notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Submit action — only when supplier can act */}
            {canSubmit && (
              <div className="border-t border-[#D8E2FF] pt-4 space-y-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSubmit}
                    disabled={busy}
                    className="px-5 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition disabled:opacity-50"
                  >
                    {busy ? 'Submitting…' : 'Submit for Procurement Review'}
                  </button>
                </div>
                <p className="text-xs text-[#BFC7D5]">
                  Ensure all required documents are uploaded before submitting.
                </p>
              </div>
            )}

            {canWithdraw && profile && (
              <div className="border-t border-[#D8E2FF] pt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      disabled={busy}
                      className="px-4 py-2 text-sm font-semibold text-[#40527A] bg-white border border-[#D8E2FF] rounded-[4px] hover:bg-[#F7F9FC] transition disabled:opacity-50"
                    >
                      Withdraw Application
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-white border-[#D8E2FF]">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Withdraw this application?</AlertDialogTitle>
                      <AlertDialogDescription className="text-[#40527A]">
                        Your uploaded documents and history will be kept for audit purposes. Procurement
                        will no longer process this application. You can start a new application afterward.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="border-[#D8E2FF]">Back</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-red-600 hover:bg-red-700 text-white"
                        onClick={async () => {
                          if (!profile || !accreditation) return;
                          setBusy(true);
                          setActionError('');
                          setActionSuccess('');
                          try {
                            await withdrawAccreditation(accreditation.id, profile);
                            await load();
                            setActionSuccess('Application withdrawn. You may start a new accreditation application.');
                          } catch (err: unknown) {
                            setActionError((err as Error)?.message || 'Withdraw Application failed.');
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        Withdraw Application
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <p className="text-xs text-[#BFC7D5] mt-2">
                  Available while the application is a draft, submitted, or awaiting missing documents.
                </p>
              </div>
            )}
          </div>

          {/* ── Documents ── */}
          <div className="bg-white rounded-[4px] border border-[#D8E2FF]">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#D8E2FF]">
              <h2 className="text-sm font-semibold text-[#0F1F3A]">Accreditation Documents</h2>
              <span className="text-xs text-[#BFC7D5]">
                {documents.length} file{documents.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Upload form */}
            <div className="p-5 border-b border-[#D8E2FF] space-y-3">
              <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                Upload Document
              </p>
              {docUploadDisabled ? (
                <p className="text-sm text-[#40527A]">
                  Document uploads are not available for this closed application. Start a new application to submit documents.
                </p>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center flex-wrap">
                    <div className="w-full sm:w-52">
                      <Select value={docType} onValueChange={setDocType}>
                        <SelectTrigger className="text-sm border-[#D8E2FF]">
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
                      {docFile ? docFile.name : 'Choose File'}
                    </button>

                    {docFile && (
                      <button
                        type="button"
                        onClick={handleUpload}
                        disabled={uploadBusy}
                        className="px-4 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-xs font-semibold rounded-[4px] transition disabled:opacity-50 whitespace-nowrap"
                      >
                        {uploadBusy ? 'Uploading…' : 'Upload'}
                      </button>
                    )}
                  </div>
                  {uploadError && (
                    <p className="text-xs text-red-600">{uploadError}</p>
                  )}
                  <p className="text-xs text-[#BFC7D5]">Accepted: PDF, JPG, PNG · Max 20 MB</p>
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
                <FileText className="w-6 h-6 text-[#BFC7D5] mx-auto mb-2" />
                <p className="text-sm text-[#40527A]">No documents uploaded yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#D8E2FF]">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center gap-3 px-5 py-3.5">
                    <FileText className="w-4 h-4 text-[#BFC7D5] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#0F1F3A] truncate">{doc.file_name}</p>
                      <p className="text-xs text-[#BFC7D5]">
                        {DOC_TYPE_OPTIONS.find(o => o.value === doc.document_type)?.label ??
                          doc.document_type}
                        {' · '}
                        {format(new Date(doc.uploaded_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleViewDocument(doc.file_path)}
                      className="shrink-0 flex items-center gap-1 text-xs text-[#1E4BFF] hover:text-[#0F1F3A] transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View
                    </button>
                  </div>
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
      <p className="text-sm font-medium text-[#0F1F3A]">{value}</p>
    </div>
  );
}
