'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useBackNavigation } from '@/hooks/use-back-navigation';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import StatusChip from '@/components/shared/StatusChip';
import type { StatusVariant } from '@/components/shared/StatusChip';
import { fetchPR1ById, canUpdatePR1Priority, updatePR1Priority, fetchDownstreamStage } from '@/lib/pr1';
import type { PR1WithItems, DownstreamStage } from '@/types/pr1';
import RelatedRecords from '@/components/shared/RelatedRecords';
import PriorityChip from '@/components/shared/PriorityChip';
import { PR1_STATUS_LABELS } from '@/types/pr1';
import { useAuth } from '@/context/AuthContext';
import { Pencil, Clock, CircleCheck as CheckCircle2, User, Building2, FileText, CalendarDays, CircleAlert as AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const STATUS_MAP: Record<string, StatusVariant> = {
  draft:                'draft',
  pending_warehouse:    'pending',
  pending_approval:     'in_review',
  resolved_internal:    'validated',
  revision_requested:   'in_review',
  for_canvassing:       'approved',
  canvassing_complete:  'approved',
  approved:             'approved',
  rejected:             'rejected',
  cancelled:            'cancelled',
};

export default function PR1DetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { handleBack } = useBackNavigation();
  const [pr1, setPR1] = useState<PR1WithItems | null>(null);
  const [downstreamStage, setDownstreamStage] = useState<DownstreamStage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [priorityUpdating, setPriorityUpdating] = useState(false);
  const [priorityError, setPriorityError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetchPR1ById(id)
      .then((data) => {
        setPR1(data);
        if (data) {
          fetchDownstreamStage(data.id)
            .then(setDownstreamStage)
            .catch(() => setDownstreamStage('PR1 Approval'));
        }
      })
      .catch(() => setError('Failed to load PR1.'))
      .finally(() => setLoading(false));
  }, [id]);

  const canEdit = pr1 && profile && pr1.requisitioner_id === profile.id && pr1.status === 'draft';
  const canUpdatePriority = pr1 && profile && canUpdatePR1Priority(profile);

  const handlePriorityChange = async (newPriority: 'normal' | 'medium' | 'high') => {
    if (!pr1 || !profile || newPriority === pr1.priority) return;

    setPriorityUpdating(true);
    setPriorityError('');

    try {
      await updatePR1Priority(pr1.id, newPriority, profile);
      setPR1({ ...pr1, priority: newPriority });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update priority.';
      setPriorityError(message);
    } finally {
      setPriorityUpdating(false);
    }
  };

  if (loading) {
    return (
      <AppShell title="PR1 Detail">
        <div className="flex items-center justify-center h-64">
          <LoadingState message="Loading PR1..." />
        </div>
      </AppShell>
    );
  }

  if (error || !pr1) {
    return (
      <AppShell title="PR1 Detail">
        <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">
          {error || 'PR1 not found.'}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="PR1 Detail">
      {/* Back nav */}
      <DetailBackButton
        className="mb-2"
        onClick={() => handleBack({ role: profile?.role })}
      />

      {/* Page header */}
      <DetailHeaderLayout
        left={
          <div>
            <DetailTitleRow wrap>
              <h1 className="text-xl font-bold text-[#0F1F3A]">PR1 {pr1.pr1_number}</h1>
              <StatusChip status={STATUS_MAP[pr1.status] || 'pending'} label={PR1_STATUS_LABELS[pr1.status]} />
              {downstreamStage && pr1.status === 'approved' && (
                <StatusChip status="in_review" label={`Current: ${downstreamStage}`} />
              )}
              {canUpdatePriority ? (
                <PrioritySelector
                  value={pr1.priority}
                  onChange={handlePriorityChange}
                  isUpdating={priorityUpdating}
                />
              ) : (
                <PriorityChip priority={pr1.priority || 'normal'} />
              )}
            </DetailTitleRow>
            <p className="text-sm text-[#40527A] mt-1">
              Created {format(new Date(pr1.created_at), 'MMMM d, yyyy')}
            </p>
            {priorityError && (
              <div className="flex items-start gap-2 mt-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{priorityError}</span>
              </div>
            )}
          </div>
        }
        right={
          <div className="flex items-center gap-2">
            <DetailPrintButton
              href={`/pr1/${pr1.id}/print`}
              label="Print"
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-[#D8E2FF] hover:border-[#0F1F3A] text-[#40527A] text-sm font-medium rounded-[4px] transition"
            />
            {canEdit && (
              <Link
                href={`/pr1/${pr1.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition"
              >
                <Pencil className="w-4 h-4" />
                Edit Draft
              </Link>
            )}
          </div>
        }
      />

      <div className="space-y-5">
        {/* Header card */}
        <DetailCard overflow>
          <DetailCardHeader
            left={<h2 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Request Header</h2>}
            right={<span className="text-xs text-[#BFC7D5]">Form No. PR1-v1</span>}
          />
          <DetailInfoGrid>
            <DetailInfoField
              icon={<User className="w-3.5 h-3.5 text-[#BFC7D5]" />}
              label="Requisitioner"
              value={pr1.requisitioner_name_snapshot}
            />
            <DetailInfoField
              icon={<Building2 className="w-3.5 h-3.5 text-[#BFC7D5]" />}
              label="Department"
              value={pr1.department_name_snapshot}
            />
            <DetailInfoField
              icon={<FileText className="w-3.5 h-3.5 text-[#BFC7D5]" />}
              label="PR1 Number"
              value={pr1.pr1_number}
              valueClassName="font-mono font-semibold"
            />
            <DetailInfoField
              icon={<Clock className="w-3.5 h-3.5 text-[#BFC7D5]" />}
              label="Date"
              value={format(new Date(pr1.created_at), 'MMMM d, yyyy')}
            />
            <DetailInfoField
              icon={<CalendarDays className="w-3.5 h-3.5 text-[#BFC7D5]" />}
              label="Date Required"
              value={format(new Date(pr1.date_required), 'MMMM d, yyyy')}
            />
            <div className="col-span-2 md:col-span-1" />
            <DetailWideInfoRow label="Purpose">{pr1.purpose}</DetailWideInfoRow>
          </DetailInfoGrid>
        </DetailCard>

        {/* Related Records */}
        {profile && (
          <RelatedRecords baseType="PR1" baseId={pr1.id} role={profile.role} currentDocType="PR1" />
        )}

        {/* Items */}
        <DetailTableCard
          title={<h2 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Items Requested</h2>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#D8E2FF] bg-[#F7F9FC]">
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide w-10">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide w-28">Item Code</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide">Description</th>
                  <th className="text-center px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide w-24">Unit</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide w-24">SOH</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-[#40527A] uppercase tracking-wide w-28">Req. Qty</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D8E2FF]">
                {pr1.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-center text-xs text-[#BFC7D5] font-mono">{item.item_order}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[#40527A]">{item.item_code || '—'}</td>
                    <td className="px-4 py-3 text-[#0F1F3A]">{item.description}</td>
                    <td className="px-4 py-3 text-center text-[#40527A]">{item.unit_of_measure}</td>
                    <td className="px-4 py-3 text-right text-[#40527A] font-mono">
                      {item.validated_soh !== undefined && item.validated_soh !== null
                        ? `${item.validated_soh.toLocaleString()}`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-[#0F1F3A] font-mono">{item.quantity_requested.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DetailTableCard>

        {/* Signature block */}
        <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
          <div className="px-6 py-4 border-b border-[#D8E2FF]">
            <h2 className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">Signatories</h2>
          </div>
          <div className="p-6">
            <SignatureRow
              label="Prepared By"
              name={pr1.prepared_by_name_snapshot}
              position={pr1.prepared_by_position_snapshot}
              date={pr1.prepared_at}
              done={Boolean(pr1.prepared_at)}
            />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function SignatureRow({
  label,
  name,
  position,
  date,
  done,
}: {
  label: string;
  name: string | null;
  position: string | null;
  date: string | null;
  done: boolean;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${done ? 'bg-[#F7F9FC]' : 'bg-[#F7F9FC]'}`}>
        <CheckCircle2 className={`w-3.5 h-3.5 ${done ? 'text-[#40527A]' : 'text-[#BFC7D5]'}`} />
      </div>
      <div>
        <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">{label}</p>
        {done ? (
          <div className="mt-1">
            <p className="text-sm font-semibold text-[#0F1F3A]">{name}</p>
            <p className="text-xs text-[#40527A]">{position}</p>
            {date && (
              <p className="text-xs text-[#BFC7D5] mt-0.5">{format(new Date(date), 'MMMM d, yyyy h:mm a')}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#BFC7D5] italic mt-1">Pending submission</p>
        )}
      </div>
    </div>
  );
}

function PrioritySelector({
  value,
  onChange,
  isUpdating,
}: {
  value: string;
  onChange: (priority: 'normal' | 'medium' | 'high') => void;
  isUpdating: boolean;
}) {
  return (
    <Select value={value} onValueChange={onChange as (val: string) => void} disabled={isUpdating}>
      <SelectTrigger className="w-32 h-8 text-xs font-medium bg-white border-[#D8E2FF] hover:border-[#0F1F3A]">
        <SelectValue placeholder="Priority" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="normal">
          <div className="inline-flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-400" />
            Normal
          </div>
        </SelectItem>
        <SelectItem value="medium">
          <div className="inline-flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            Medium
          </div>
        </SelectItem>
        <SelectItem value="high">
          <div className="inline-flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            High
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
