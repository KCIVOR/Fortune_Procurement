'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import { useAuth } from '@/context/AuthContext';
import { fetchSubstituteBundleForPr1, saveSubstituteDecision } from '@/lib/canvassing';
import type { SubstituteReviewBundle, SubstituteReviewItem } from '@/types/canvassing';
import {
  ChevronLeft,
  Replace,
  CircleCheck as CheckCircle2,
  Circle as XCircle,
  TriangleAlert as AlertTriangle,
  Package,
  Clock,
  ArrowRight,
  Loader as Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { canViewCommercialPricing, formatCommercialAmount } from '@/lib/price-visibility';
import QuoteAttachmentPills from '@/components/rfq/QuoteAttachmentPills';

export default function SubstituteReviewPage() {
  const { pr1Id } = useParams<{ pr1Id: string }>();
  const { profile } = useAuth();

  const [bundle, setBundle]   = useState<SubstituteReviewBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const load = useCallback(() => {
    if (!pr1Id) return;
    setLoading(true);
    fetchSubstituteBundleForPr1(pr1Id)
      .then(b => {
        if (!b) { setError('PR1 not found.'); return; }
        setBundle(b);
      })
      .catch(() => setError('Failed to load substitutes.'))
      .finally(() => setLoading(false));
  }, [pr1Id]);

  useEffect(load, [load]);

  if (loading) return (
    <AppShell title="Substitute Review">
      <div className="flex items-center justify-center h-64">
        <LoadingState message="Loading substitutes..." />
      </div>
    </AppShell>
  );

  if (error || !bundle) return (
    <AppShell title="Substitute Review">
      <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
        {error || 'Not found.'}
      </div>
    </AppShell>
  );

  const isOwner = profile && bundle.pr1.requisitioner_id === profile.id;
  const pending = bundle.substitutes.filter(s => s.decision === null).length;

  return (
    <AppShell title="Substitute Review">
      <div className="mb-2">
        <Link href="/substitutes" className="inline-flex items-center gap-1 text-xs text-pq-neutral-500 hover:text-pq-neutral-900 transition">
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to Substitutes
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-pq-neutral-900 font-mono">{bundle.pr1.pr1_number}</h1>
          {pending > 0 ? (
            <span className="text-xs font-semibold border rounded-full px-2.5 py-1 bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100">
              {pending} awaiting decision
            </span>
          ) : (
            <span className="text-xs font-semibold border rounded-full px-2.5 py-1 bg-pq-success-100 text-pq-success-600 border-pq-success-100">
              All decided
            </span>
          )}
        </div>
        <p className="text-sm text-pq-neutral-500">
          {bundle.pr1.department_name_snapshot} · {bundle.pr1.purpose}
        </p>
      </div>

      {!isOwner && (
        <div className="flex items-start gap-3 bg-pq-warning-100 border border-pq-warning-100 rounded-md px-5 py-4 mb-6">
          <AlertTriangle className="w-4 h-4 text-pq-warning-600 mt-0.5 shrink-0" />
          <p className="text-sm text-pq-warning-600">Only the original requestor can accept or reject substitutes for this PR1.</p>
        </div>
      )}

      {bundle.substitutes.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title="No substitutes offered"
            description="Suppliers have not proposed any alternatives for this PR1."
            icon={Replace}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {bundle.substitutes.map(sub => {
            const rfqDone = sub.rfq_status === 'closed' || sub.rfq_status === 'cancelled';
            return (
            <SubstituteCard
              key={sub.quote_id}
              substitute={sub}
              canDecide={!!isOwner && !rfqDone && !sub.is_awarded}
              locked={rfqDone || sub.is_awarded}
              onDecided={load}
              pr1Id={bundle.pr1.id}
            />
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function SubstituteCard({
  substitute,
  canDecide,
  locked,
  onDecided,
  pr1Id,
}: {
  substitute: SubstituteReviewItem;
  canDecide: boolean;
  locked: boolean;
  onDecided: () => void;
  pr1Id: string;
}) {
  const { profile } = useAuth();
  const [notes, setNotes]           = useState('');
  const [submitting, setSubmitting] = useState<'accepted' | 'rejected' | null>(null);
  const [error, setError]           = useState('');

  const decided = substitute.decision !== null;
  const canViewPrices = canViewCommercialPricing(profile);

  const decide = async (decision: 'accepted' | 'rejected') => {
    if (!profile) return;
    setSubmitting(decision);
    setError('');
    try {
      await saveSubstituteDecision(substitute.quote_id, pr1Id, decision, notes, profile);
      setNotes('');
      onDecided();
    } catch (e: any) {
      setError(e.message ?? 'Failed to save decision.');
    } finally {
      setSubmitting(null);
    }
  };

  const borderClass =
    substitute.decision === 'accepted' ? 'border-pq-success-100 bg-pq-success-100/30' :
    substitute.decision === 'rejected' ? 'border-rose-200 bg-rose-50/30' :
    'border-pq-neutral-200';

  return (
    <div className={`bg-white rounded-md border ${borderClass} overflow-hidden`}>
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-pq-neutral-200 bg-pq-neutral-50">
        <span className="w-6 h-6 rounded-full bg-pq-neutral-200 text-pq-neutral-500 text-xs font-bold flex items-center justify-center shrink-0">
          {substitute.item_order}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-pq-neutral-400">From</p>
          <p className="text-sm font-semibold text-pq-neutral-900">{substitute.supplier_name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-pq-neutral-400">RFQ</p>
          <p className="text-xs font-mono font-semibold text-pq-neutral-500">{substitute.rfq_number}</p>
        </div>
        {decided && (
          <span className={`ml-2 inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2.5 py-1 ${
            substitute.decision === 'accepted'
              ? 'bg-pq-success-100 text-pq-success-600 border-pq-success-100'
              : 'bg-rose-50 text-rose-600 border-rose-200'
          }`}>
            {substitute.decision === 'accepted' ? (
              <><CheckCircle2 className="w-3 h-3" /> Accepted</>
            ) : (
              <><XCircle className="w-3 h-3" /> Rejected</>
            )}
          </span>
        )}
      </div>

      {/* Comparison: requested vs offered */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-pq-neutral-200">
        <div className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-3.5 h-3.5 text-pq-neutral-400" />
            <p className="text-xs font-bold text-pq-neutral-400 uppercase tracking-wide">You requested</p>
          </div>
          <p className="text-sm font-semibold text-pq-neutral-900 leading-snug">{substitute.original_description}</p>
          {substitute.item_code && (
            <p className="text-xs font-mono text-pq-neutral-400 mt-1">{substitute.item_code}</p>
          )}
          <p className="text-xs text-pq-neutral-500 mt-2">
            <span className="font-medium">{substitute.original_quantity}</span> {substitute.unit_of_measure}
          </p>
        </div>

        <div className="p-5 bg-orange-50/40">
          <div className="flex items-center gap-2 mb-2">
            <Replace className="w-3.5 h-3.5 text-orange-500" />
            <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">Supplier is offering</p>
          </div>
          <p className="text-sm font-semibold text-pq-neutral-900 leading-snug">{substitute.quoted_description}</p>
          <div className="flex items-baseline gap-4 mt-3">
            <div>
              <p className="text-xs text-pq-neutral-500">Unit price</p>
              <p className="text-lg font-bold text-pq-neutral-900">
                {formatCommercialAmount(substitute.unit_price, canViewPrices)}
              </p>
            </div>
            <div>
              <p className="text-xs text-pq-neutral-500">Lead time</p>
              <p className="text-sm font-semibold text-pq-neutral-500">{substitute.lead_time_days} day{substitute.lead_time_days !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {substitute.remarks && (
            <p className="text-xs text-pq-neutral-500 italic mt-3">"{substitute.remarks}"</p>
          )}
          {substitute.attachments && substitute.attachments.length > 0 && (
            <div className="mt-3">
              <QuoteAttachmentPills attachments={substitute.attachments} />
            </div>
          )}
        </div>
      </div>

      {/* Decision panel */}
      <div className="px-5 py-4 border-t border-pq-neutral-200">
        {decided ? (
          <div className="text-xs text-pq-neutral-500">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span>Decided on {substitute.decided_at ? format(new Date(substitute.decided_at), 'MMM d, yyyy · h:mm a') : '—'}</span>
              {canDecide && (
                <button
                  onClick={() => decide(substitute.decision === 'accepted' ? 'rejected' : 'accepted')}
                  className="inline-flex px-2.5 py-1.5 text-xs font-medium border border-pq-neutral-200 bg-white text-pq-neutral-500 rounded-md hover:bg-pq-neutral-50 hover:border-pq-primary-600 hover:text-pq-neutral-900 transition focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:ring-offset-1"
                >
                  Change decision to {substitute.decision === 'accepted' ? 'Rejected' : 'Accepted'}
                </button>
              )}
              {locked && (
                <span className="text-[10px] text-pq-neutral-400 italic">
                  {substitute.is_awarded ? 'Line already awarded — decision locked.' : 'RFQ closed — decision locked.'}
                </span>
              )}
            </div>
            {substitute.decision_notes && (
              <p className="mt-1 text-pq-neutral-500 italic">Notes: {substitute.decision_notes}</p>
            )}
          </div>
        ) : locked ? (
          <div className="flex items-center gap-1.5 text-xs text-pq-neutral-400 italic">
            <Clock className="w-3.5 h-3.5 shrink-0" />
            {substitute.is_awarded ? 'Line already awarded — decision locked.' : 'RFQ closed — decision locked.'}
          </div>
        ) : canDecide ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                Notes <span className="text-pq-neutral-400 font-normal normal-case">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Why accept or reject this substitute?"
                className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-pq-danger-100 border border-pq-danger-100 text-pq-danger-600 text-sm rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => decide('rejected')}
                disabled={submitting !== null}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 text-sm font-semibold rounded-md transition disabled:opacity-50"
              >
                {submitting === 'rejected' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Reject substitute
              </button>
              <button
                onClick={() => decide('accepted')}
                disabled={submitting !== null}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-pq-success-600 hover:bg-pq-success-600 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
              >
                {submitting === 'accepted' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Accept substitute
              </button>
            </div>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 text-xs text-pq-neutral-500">
            <Clock className="w-3.5 h-3.5" />
            Awaiting requestor decision
          </div>
        )}
      </div>
    </div>
  );
}
