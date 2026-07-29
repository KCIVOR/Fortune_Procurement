'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import { useAuth } from '@/context/AuthContext';
import {
  fetchSupplierCompliancePOById,
  uploadComplianceDocument,
  deleteComplianceDocument,
  type CompliancePOSummary,
  type POItemWithCompliance,
  type ComplianceDocument,
} from '@/lib/compliance-documents';
import { format } from 'date-fns';
import {
  ChevronLeft, FileText, CalendarDays, Package, FileCheck2,
  UploadCloud, Trash2, ExternalLink, CheckCircle2, Clock,
} from 'lucide-react';

const PO_STATUS_STYLES: Record<string, string> = {
  approved: 'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
  sent:     'bg-pq-neutral-50 text-pq-neutral-900 border-pq-neutral-200',
};

function InfoField({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-pq-neutral-400 uppercase tracking-wide font-semibold">{label}</p>
        <p className={`text-sm text-pq-neutral-900 mt-0.5 ${mono ? 'font-mono font-semibold' : 'font-medium'}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function ComplianceItemCard({
  poId,
  item,
  onUploaded,
}: {
  poId:       string;
  item:       POItemWithCompliance;
  onUploaded: () => void;
}) {
  const { profile } = useAuth();
  const inputRef   = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting,  setDeleting]  = useState<string | null>(null);
  const [error,     setError]     = useState('');

  const hasDoc = item.documents.length > 0;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploading(true);
    setError('');
    try {
      await uploadComplianceDocument(poId, item.po_item_id, file, profile);
      onUploaded();
    } catch (err: any) {
      setError(err.message ?? 'Upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleDelete = async (doc: ComplianceDocument) => {
    if (!profile) return;
    setDeleting(doc.id);
    setError('');
    try {
      await deleteComplianceDocument(doc.id, doc.storage_path, profile);
      onUploaded();
    } catch (err: any) {
      setError(err.message ?? 'Delete failed.');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-sm font-medium text-pq-neutral-900">
          <span className="text-pq-neutral-400 font-mono mr-1.5">#{item.item_order}</span>
          {item.description}
        </p>
        <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${
          hasDoc
            ? 'bg-pq-success-100 text-pq-success-700'
            : 'bg-pq-warning-100 text-pq-warning-700'
        }`}>
          {hasDoc
            ? <><CheckCircle2 className="w-3 h-3" /> Uploaded</>
            : <><Clock className="w-3 h-3" /> Pending</>
          }
        </span>
      </div>

      {item.documents.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {item.documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-2 bg-pq-neutral-50 border border-pq-neutral-200 rounded px-3 py-2">
              <FileCheck2 className="w-4 h-4 text-pq-success-600 shrink-0" />
              <span className="text-xs text-pq-neutral-700 flex-1 truncate">{doc.file_name}</span>
              <span className="text-xs text-pq-neutral-400 shrink-0">
                {format(new Date(doc.uploaded_at), 'MMM d, yyyy')}
              </span>
              {doc.url && (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pq-primary-600 hover:text-pq-primary-800 shrink-0"
                  title="Download"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              <button
                onClick={() => handleDelete(doc)}
                disabled={deleting === doc.id}
                className="text-pq-danger-500 hover:text-pq-danger-700 shrink-0 disabled:opacity-40"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <input
          ref={inputRef}
          id={`compliance-upload-${item.po_item_id}`}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
        <label
          htmlFor={`compliance-upload-${item.po_item_id}`}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border cursor-pointer transition-colors ${
            uploading
              ? 'opacity-50 cursor-not-allowed bg-pq-neutral-100 border-pq-neutral-200 text-pq-neutral-500'
              : 'bg-white border-pq-primary-300 text-pq-primary-700 hover:bg-pq-primary-50'
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" />
          {uploading ? 'Uploading…' : hasDoc ? 'Upload Another' : 'Upload Document'}
        </label>
        <p className="text-[10px] text-pq-neutral-400 mt-1">
          PDF, JPG, PNG, WEBP, DOC — max 20 MB
        </p>
      </div>

      {error && (
        <p className="text-xs text-pq-danger-600 mt-2">{error}</p>
      )}
    </div>
  );
}

export default function SupplierComplianceDocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();

  const [po, setPO] = useState<CompliancePOSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    if (!id || !profile) return;
    fetchSupplierCompliancePOById(profile.id, id)
      .then((data) => {
        if (!data) { setError('No compliance documents required for this PO.'); return; }
        setPO(data);
      })
      .catch(() => setError('Failed to load compliance documents.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return (
    <AppShell title="Compliance Documents">
      <div className="flex items-center justify-center h-64">
        <LoadingState message="Loading compliance documents..." />
      </div>
    </AppShell>
  );

  if (error || !po) return (
    <AppShell title="Compliance Documents">
      <div className="mb-2">
        <Link href="/supplier/compliance-documents" className="inline-flex items-center gap-1 text-xs text-pq-neutral-500 hover:text-pq-neutral-900 transition">
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to Compliance Documents
        </Link>
      </div>
      <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
        {error || 'Compliance document record not found.'}
      </div>
    </AppShell>
  );

  const uploadedCount = po.items.filter(i => i.documents.length > 0).length;

  return (
    <AppShell title={`Compliance — ${po.po_number}`}>
      <div className="mb-2">
        <Link href="/supplier/compliance-documents" className="inline-flex items-center gap-1 text-xs text-pq-neutral-500 hover:text-pq-neutral-900 transition">
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to Compliance Documents
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-xl font-bold text-pq-neutral-900 font-mono">{po.po_number}</h1>
            <span className={`inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-1 ${PO_STATUS_STYLES[po.status] ?? PO_STATUS_STYLES.sent}`}>
              {po.status === 'approved' ? 'Approved' : po.status === 'sent' ? 'Sent' : po.status}
            </span>
          </div>
          <p className="text-sm text-pq-neutral-500">{uploadedCount} of {po.items.length} items uploaded</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-4">
            <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">PO Summary</h2>
            <InfoField icon={FileText}     label="PO Number" value={po.po_number} mono />
            <InfoField icon={CalendarDays} label="Sent to You" value={po.sent_at ? format(new Date(po.sent_at), 'MMMM d, yyyy') : 'Not yet sent'} />
            <InfoField icon={Package}      label="Compliance Items" value={`${uploadedCount} of ${po.items.length} uploaded`} />
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center gap-2">
              <FileCheck2 className="w-3.5 h-3.5 text-pq-neutral-400" />
              <h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                Compliance Items ({po.items.length})
              </h2>
            </div>
            <div className="divide-y divide-pq-neutral-200">
              {po.items.map((item) => (
                <ComplianceItemCard
                  key={item.po_item_id}
                  poId={po.po_id}
                  item={item}
                  onUploaded={load}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
