'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import AppShell from '@/components/layout/AppShell';
import { DetailPageSkeleton } from '@/components/shared/structural-skeletons';
import StatusChip from '@/components/shared/StatusChip';
import type { StatusVariant } from '@/components/shared/StatusChip';
import PriorityChip from '@/components/shared/PriorityChip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/context/AuthContext';
import { canRequestRawMaterials } from '@/lib/raw-material-access';
import { fetchPR2ById } from '@/lib/pr2';
import { fetchPR2ApprovalDetailByPR2Id } from '@/lib/pr2-approvals';
import {
  updateRawMaterialPR2Draft,
  submitRawMaterialPR2,
  deleteDraftRawMaterialPR2,
  uploadPR2ItemAttachment,
  deletePR2ItemAttachment,
  type RawMaterialPR2ItemInput,
} from '@/lib/pr2-planning';
import type { PR2WithItems, PR2ItemAttachment } from '@/types/pr2';
import { PR2_STATUS_LABELS } from '@/types/pr2';
import type { PR2ApprovalDetail } from '@/types/approvals';
import { format } from 'date-fns';
import { Save, Send, Trash2, User, FileText, CalendarDays, Clock, TriangleAlert as AlertTriangle, RotateCcw } from 'lucide-react';
import DetailBackButton from '@/components/shared/DetailBackButton';
import DetailHeaderLayout from '@/components/shared/DetailHeaderLayout';
import DetailTitleRow from '@/components/shared/DetailTitleRow';
import DetailPrintButton from '@/components/shared/DetailPrintButton';
import DetailCard from '@/components/shared/DetailCard';
import DetailCardHeader from '@/components/shared/DetailCardHeader';
import DetailInfoGrid from '@/components/shared/DetailInfoGrid';
import DetailInfoField from '@/components/shared/DetailInfoField';
import DetailWideInfoRow from '@/components/shared/DetailWideInfoRow';
import DetailTableCard from '@/components/shared/DetailTableCard';
import RelatedRecords from '@/components/shared/RelatedRecords';
import { RequestTypeBadge } from '@/components/shared/RequestTypeBadge';
import ApprovalPhaseTimeline from '@/components/approvals/ApprovalPhaseTimeline';
import RawMaterialPR2ItemsEditor from '@/components/planning/RawMaterialPR2ItemsEditor';
import { PR2AttachmentsGallery } from '@/components/planning/PR2ItemAttachmentsSection';

const STATUS_MAP: Record<string, StatusVariant> = {
  draft:                'draft',
  pending_approval:     'in_review',
  approved:             'approved',
  revision_requested:   'in_review',
  rejected:             'rejected',
  cancelled:            'cancelled',
};

export default function RawMaterialPR2DetailPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const { handleBack } = useBackNavigation();
  const params = useParams();
  const id = params?.id as string;

  const [pr2, setPr2] = useState<PR2WithItems | null>(null);
  const [approvalDetail, setApprovalDetail] = useState<PR2ApprovalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [purpose, setPurpose] = useState('');
  const [dateRequired, setDateRequired] = useState('');
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<RawMaterialPR2ItemInput[]>([]);

  // Attachment state — mirrors PR1Form's pendingFiles/existingAttachments/
  // attachmentsToDelete pattern, keyed by item.id (real pr2_items.id).
  const [pendingFiles, setPendingFiles] = useState<Record<string, File[]>>({});
  const [existingAttachments, setExistingAttachments] = useState<Record<string, PR2ItemAttachment[]>>({});
  const [attachmentsToDelete, setAttachmentsToDelete] = useState<Record<string, boolean>>({});
  // Immutable snapshot from load(), keyed by attachment id — existingAttachments
  // gets optimistically filtered as the user removes items in the UI, so it can't
  // be used to look up an attachment already marked for deletion at save time.
  const [allAttachmentsById, setAllAttachmentsById] = useState<Record<string, PR2ItemAttachment>>({});

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [data, approval] = await Promise.all([
        fetchPR2ById(id),
        fetchPR2ApprovalDetailByPR2Id(id).catch(() => null),
      ]);
      if (!data || (data.request_type !== 'raw_material' && data.request_type !== 'services')) {
        setError('Request not found.');
        setPr2(null);
        return;
      }
      setPr2(data);
      setApprovalDetail(approval);
      setPurpose(data.purpose ?? '');
      setDateRequired(data.date_required ?? '');
      setRemarks(data.remarks ?? '');
      setItems(
        data.items.map((item, idx) => ({
          id:                  item.id,
          item_order:         item.item_order ?? idx + 1,
          item_code:          item.item_code,
          description:        item.description,
          unit_of_measure:    item.unit_of_measure,
          quantity_requested: item.quantity_requested,
          remarks:            item.remarks ?? '',
        }))
      );
      const attByItem: Record<string, PR2ItemAttachment[]> = {};
      const attById: Record<string, PR2ItemAttachment> = {};
      for (const item of data.items) {
        const atts = (item.attachments as PR2ItemAttachment[] | undefined) ?? [];
        attByItem[item.id] = atts;
        for (const att of atts) attById[att.id] = att;
      }
      setExistingAttachments(attByItem);
      setAllAttachmentsById(attById);
      setPendingFiles({});
      setAttachmentsToDelete({});
    } catch {
      setError('Failed to load request.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!profile) return;
    if (!canRequestRawMaterials(profile)) {
      router.push('/dashboard');
      return;
    }
    load();
  }, [profile, router, load]);

  const isOwner = !!profile && !!pr2 && pr2.requisitioner_id === profile.id;
  const isDraft = pr2?.status === 'draft';
  const canEdit = isOwner && isDraft;
  const wasRevisionRequested =
    isDraft && approvalDetail?.phase1_instance_status === 'cancelled';

  /** Shared by Save Draft and Submit: persist header/items, then reconcile attachments. */
  const persistItemsAndAttachments = async () => {
    if (!profile || !pr2) return;
    const { items: syncedItems } = await updateRawMaterialPR2Draft(pr2.id, profile, {
      purpose,
      date_required: dateRequired,
      remarks: remarks || null,
      items,
    });

    // 1. Process deletions
    const deletePromises = Object.keys(attachmentsToDelete).map(async (attId) => {
      const foundAtt = allAttachmentsById[attId];
      if (foundAtt) {
        await deletePR2ItemAttachment(foundAtt, profile.id);
      }
    });
    await Promise.all(deletePromises);

    // 2. Process uploads — items already carrying a real id upload directly;
    // rows added this session (temp id) resolve their real id via syncedItems.
    const uploadPromises: Promise<any>[] = [];
    items.forEach((item, idx) => {
      const files = pendingFiles[item.id ?? ''];
      if (!files || files.length === 0) return;
      const realId = item.id && !item.id.startsWith('temp-')
        ? item.id
        : syncedItems.find((si) => si.item_order === idx + 1)?.id;
      if (!realId) return;
      files.forEach((file) => {
        uploadPromises.push(uploadPR2ItemAttachment(pr2.id, realId, file));
      });
    });
    await Promise.all(uploadPromises);
  };

  const handleSaveDraft = async () => {
    if (!profile || !pr2) return;
    setError('');
    setSaving(true);
    try {
      await persistItemsAndAttachments();
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!profile || !pr2) return;
    setError('');
    setSubmitting(true);
    try {
      await persistItemsAndAttachments();
      await submitRawMaterialPR2(pr2.id, profile);
      await load();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!profile || !pr2) return;
    if (!confirm('Are you sure you want to delete this draft? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteDraftRawMaterialPR2(pr2.id, profile);
      handleBack({ fallbackPath: '/planning/pr2' });
    } catch (err: any) {
      setError(err?.message || 'Failed to delete draft.');
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <AppShell title="PR2 Request">
        <DetailPageSkeleton />
      </AppShell>
    );
  }

  if (error || !pr2) {
    return (
      <AppShell title="PR2 Request">
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
          {error || 'Request not found.'}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={`PR2 ${pr2.pr2_number}`}>
      <DetailBackButton
        className="mb-2"
        onClick={() => handleBack({ role: profile?.role, fallbackPath: '/planning/pr2' })}
      />

      <DetailHeaderLayout
        wrap
        left={
          <div>
            <DetailTitleRow wrap mb>
              <h1 className="text-xl font-bold text-pq-neutral-900 font-mono">{pr2.pr2_number}</h1>
              <PriorityChip priority={pr2.priority ?? 'normal'} />
              <StatusChip status={STATUS_MAP[pr2.status] || 'pending'} label={PR2_STATUS_LABELS[pr2.status]} />
              <RequestTypeBadge type={pr2.request_type as 'raw_material' | 'services'} />
            </DetailTitleRow>
            <p className="text-sm text-pq-neutral-500">
              Created {format(new Date(pr2.created_at), 'MMMM d, yyyy')}
            </p>
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <DetailPrintButton
              href={`/planning/pr2/${pr2.id}/print`}
              label="Print"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-pq-white border border-pq-neutral-200 hover:border-pq-neutral-300 text-pq-neutral-700 text-sm font-medium rounded-md transition"
            />
            {canEdit && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-pq-white border border-pq-danger-200 hover:bg-pq-danger-50 text-pq-danger-600 text-sm font-semibold rounded-md transition disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? 'Deleting...' : 'Delete Draft'}
              </button>
            )}
          </div>
        }
      />

      <div className="space-y-5">
        {wasRevisionRequested && (
          <div className="bg-orange-50 border border-orange-200 rounded-md px-6 py-4 flex items-start gap-3">
            <RotateCcw className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-orange-800">Needs Revision</p>
              <p className="text-xs text-orange-700 mt-0.5">
                An approver requested changes. Edit the request and resubmit when ready.
              </p>
            </div>
          </div>
        )}

        {/* Header card */}
        <DetailCard overflow>
          <DetailCardHeader
            left={<h2 className="text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide">Request Header</h2>}
            right={<span className="text-xs text-pq-neutral-400">Form No. PR2-v1</span>}
          />
          <DetailInfoGrid>
            <DetailInfoField
              icon={<User className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Requisitioner"
              value={pr2.requisitioner_name_snapshot}
            />
            <DetailInfoField
              icon={<FileText className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="PR2 Number"
              value={pr2.pr2_number}
              valueClassName="font-mono font-semibold"
            />
            <DetailInfoField
              icon={<Clock className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Date Created"
              value={format(new Date(pr2.created_at), 'MMMM d, yyyy')}
            />
            <DetailInfoField
              icon={<CalendarDays className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Date Required"
              value={
                canEdit ? (
                  <Input
                    type="date"
                    value={dateRequired}
                    onChange={(e) => setDateRequired(e.target.value)}
                    className="h-9 text-sm font-medium"
                  />
                ) : (
                  format(new Date(pr2.date_required), 'MMMM d, yyyy')
                )
              }
            />
            <DetailWideInfoRow label="Purpose">
              {canEdit ? (
                <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} className="mt-1" />
              ) : (
                pr2.purpose
              )}
            </DetailWideInfoRow>
            <DetailWideInfoRow label="Remarks">
              {canEdit ? (
                <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="mt-1" />
              ) : (
                pr2.remarks || '—'
              )}
            </DetailWideInfoRow>
          </DetailInfoGrid>
        </DetailCard>

        {/* Related Records */}
        {profile && (
          <RelatedRecords baseType="PR2" baseId={pr2.id} role={profile.role} currentDocType="PR2" />
        )}

        {/* Items */}
        {canEdit ? (
          <RawMaterialPR2ItemsEditor
            items={items}
            onChange={setItems}
            existingAttachments={existingAttachments}
            pendingFiles={pendingFiles}
            onAddFiles={(itemKey, files) =>
              setPendingFiles((prev) => ({
                ...prev,
                [itemKey]: [...(prev[itemKey] ?? []), ...files],
              }))
            }
            onRemovePendingFile={(itemKey, idx) =>
              setPendingFiles((prev) => ({
                ...prev,
                [itemKey]: (prev[itemKey] ?? []).filter((_, i) => i !== idx),
              }))
            }
            onRemoveExistingAttachment={(itemKey, att) => {
              setAttachmentsToDelete((prev) => ({ ...prev, [att.id]: true }));
              setExistingAttachments((prev) => ({
                ...prev,
                [itemKey]: (prev[itemKey] ?? []).filter((a) => a.id !== att.id),
              }));
            }}
          />
        ) : (
          <DetailTableCard
            title={<h2 className="text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide">Line Items</h2>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pq-neutral-200 bg-pq-neutral-50">
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide w-10">#</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide w-28">Item Code</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide">Description</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide w-24">Unit</th>
                    <th className="text-right px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide w-28">Qty</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-pq-neutral-700 uppercase tracking-wide w-24">Attachments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pq-neutral-200">
                  {pr2.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 text-center text-xs text-pq-neutral-400 font-mono">{item.item_order}</td>
                      <td className="px-4 py-3 font-mono text-xs text-pq-neutral-700">{item.item_code || '—'}</td>
                      <td className="px-4 py-3 text-pq-neutral-900">
                        {item.description}
                        {item.remarks && (
                          <p className="text-xs text-pq-neutral-400 mt-0.5 italic">{item.remarks}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-pq-neutral-700">{item.unit_of_measure}</td>
                      <td className="px-4 py-3 text-right font-semibold text-pq-neutral-900 font-mono">
                        {item.quantity_requested.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <PR2AttachmentsGallery attachments={(item.attachments as PR2ItemAttachment[] | undefined) ?? []} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DetailTableCard>
        )}

        {/* Approval timeline */}
        <ApprovalPhaseTimeline
          phaseLabel="Approval"
          phaseSubLabel="PR2 Approval Chain"
          steps={approvalDetail?.phase1_steps ?? []}
          actions={approvalDetail?.phase1_actions ?? []}
          currentStep={approvalDetail?.phase1_current_step ?? 1}
          instanceStatus={approvalDetail?.phase1_instance_status ?? 'active'}
          notStarted={!approvalDetail}
          preparer={approvalDetail?.preparer}
        />

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-3 bg-pq-danger-100 border border-pq-danger-100 text-pq-danger-600 text-sm rounded-md px-4 py-3">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Actions */}
        {canEdit && (
          <div className="flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={saving || submitting}
              className="inline-flex items-center gap-2 hover:border-pq-primary-600 transition"
            >
              {saving ? (
                <span className="w-4 h-4 border-2 border-pq-neutral-200 border-t-pq-primary-600 rounded-full animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Draft
            </Button>
            <Button
              type="button"
              variant="default"
              onClick={handleSubmit}
              disabled={saving || submitting}
              className="inline-flex items-center gap-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-pq-white transition"
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Submit for Approval
            </Button>
          </div>
        )}

        {!isOwner && (
          <p className="text-xs text-pq-neutral-500">You do not have edit access to this request.</p>
        )}
      </div>
    </AppShell>
  );
}
