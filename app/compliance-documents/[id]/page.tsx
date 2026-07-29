'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { DetailPageSkeleton } from '@/components/shared/structural-skeletons';
import { useAuth } from '@/context/AuthContext';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import DetailBackButton from '@/components/shared/DetailBackButton';
import DetailHeaderLayout from '@/components/shared/DetailHeaderLayout';
import DetailTitleRow from '@/components/shared/DetailTitleRow';
import DetailTableCard from '@/components/shared/DetailTableCard';
import DetailInfoField from '@/components/shared/DetailInfoField';
import RelatedRecords from '@/components/shared/RelatedRecords';
import {
  fetchProcurementCompliancePOById,
  type ProcurementCompliancePO,
  type ProcurementComplianceItemStatus,
} from '@/lib/compliance-documents';
import { format } from 'date-fns';
import {
  FileText, Building2, CalendarDays, Package, FileCheck2,
  PackageSearch, Clock, CheckCircle2, ExternalLink,
} from 'lucide-react';

const ITEM_STATUS_STYLES: Record<ProcurementComplianceItemStatus, string> = {
  awaiting_grn:   'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200',
  pending_upload: 'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
  uploaded:       'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
};

const ITEM_STATUS_LABELS: Record<ProcurementComplianceItemStatus, string> = {
  awaiting_grn:   'Awaiting GRN',
  pending_upload: 'Pending Upload',
  uploaded:       'Uploaded',
};

const ITEM_STATUS_ICONS: Record<ProcurementComplianceItemStatus, React.ElementType> = {
  awaiting_grn:   PackageSearch,
  pending_upload: Clock,
  uploaded:       CheckCircle2,
};

const PO_STATUS_STYLES: Record<string, string> = {
  draft:        'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200',
  for_approval: 'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
  approved:     'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
  sent:         'bg-sky-50 text-sky-700 border-sky-200',
  rejected:     'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
  cancelled:    'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
};

export default function ComplianceDocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const router = useRouter();
  const { handleBack } = useBackNavigation();

  const [po, setPO] = useState<ProcurementCompliancePO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetchProcurementCompliancePOById(id)
      .then((data) => {
        if (!data) { setError('No compliance-flagged items found for this PO.'); return; }
        setPO(data);
      })
      .catch(() => setError('Failed to load compliance document detail.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <AppShell title="Compliance Documents">
      <DetailPageSkeleton />
    </AppShell>
  );

  if (error || !po) return (
    <AppShell title="Compliance Documents">
      <DetailBackButton className="mb-3" onClick={() => router.push('/compliance-documents')} />
      <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
        {error || 'Compliance document record not found.'}
      </div>
    </AppShell>
  );

  const totalItems = po.items.length;

  return (
    <AppShell title={`Compliance — ${po.po_number}`}>
      <DetailBackButton className="mb-3" onClick={() => handleBack({ role: profile?.role })} />

      <DetailHeaderLayout
        wrap
        left={
          <div>
            <DetailTitleRow wrap mb>
              <h1 className="text-2xl font-bold text-pq-neutral-900 font-mono">{po.po_number}</h1>
              <span className={`inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-1 ${PO_STATUS_STYLES[po.status] ?? PO_STATUS_STYLES.draft}`}>
                {po.status.replace(/_/g, ' ')}
              </span>
            </DetailTitleRow>
            <p className="text-sm text-pq-neutral-500">{po.supplier_name}</p>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 auto-rows-max lg:auto-rows-auto">
        {/* Left column: PO summary + compliance items */}
        <div className="lg:col-span-2 space-y-4 order-2 lg:order-none">
          <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-4">
            <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">PO Summary</h2>
            <DetailInfoField
              layout="inline"
              icon={<FileText className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="PO Number"
              value={po.po_number}
              valueClassName="font-mono font-semibold"
            />
            <DetailInfoField
              layout="inline"
              icon={<Building2 className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="Supplier"
              value={po.supplier_name}
            />
            <DetailInfoField
              layout="inline"
              icon={<CalendarDays className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="Sent to Supplier"
              value={po.sent_at ? format(new Date(po.sent_at), 'MMMM d, yyyy') : 'Not yet sent'}
            />
            <DetailInfoField
              layout="inline"
              icon={<Package className="w-3.5 h-3.5 text-pq-neutral-400 mt-0.5 shrink-0" />}
              label="Compliance Items"
              value={`${po.uploaded_count} of ${totalItems} uploaded`}
            />
          </div>

          <DetailTableCard
            title={
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-3.5 h-3.5 text-pq-neutral-400" />
                <h2 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                  Compliance Items ({totalItems})
                </h2>
              </div>
            }
            headerClassName="bg-pq-neutral-50"
          >
            <div className="divide-y divide-pq-neutral-200">
              {po.items.map((item) => {
                const StatusIcon = ITEM_STATUS_ICONS[item.status];
                return (
                  <div key={item.po_item_id} className="p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <p className="text-sm font-medium text-pq-neutral-900">
                        <span className="text-pq-neutral-400 font-mono mr-1.5">#{item.item_order}</span>
                        {item.description}
                      </p>
                      <span className={`shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${ITEM_STATUS_STYLES[item.status]}`}>
                        <StatusIcon className="w-3 h-3" />
                        {ITEM_STATUS_LABELS[item.status]}
                      </span>
                    </div>

                    {item.documents.length > 0 ? (
                      <div className="space-y-1.5">
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
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-pq-neutral-400">
                        {item.status === 'awaiting_grn'
                          ? 'Supplier can upload once warehouse/procurement creates the GRN for this item.'
                          : 'Not yet uploaded by the supplier.'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </DetailTableCard>
        </div>

        {/* Right column: Related Records */}
        <div className="lg:col-span-1 order-1 lg:order-none">
          <div className="lg:sticky lg:top-20">
            {profile && (
              <RelatedRecords baseType="PO" baseId={po.po_id} role={profile.role} currentDocType="PO" />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
