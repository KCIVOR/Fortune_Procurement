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
      <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">
        {error || 'Not found.'}
      </div>
    </AppShell>
  );

  const isOwner = profile && bundle.pr1.requisitioner_id === profile.id;
  const pending = bundle.substitutes.filter(s => s.decision === null).length;

  return (
    <AppShell title="Substitute Review">
      <div className="mb-2">
        <Link href="/substitutes" className="inline-flex items-center gap-1 text-xs text-[#40527A] hover:text-[#0F1F3A] transition">
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to Substitutes
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-[#0F1F3A] font-mono">{bundle.pr1.pr1_number}</h1>
          {pending > 0 ? (
            <span className="text-xs font-semibold border rounded-full px-2.5 py-1 bg-amber-50 text-amber-700 border-amber-200">
              {pending} awaiting decision
            </span>
          ) : (
            <span className="text-xs font-semibold border rounded-full px-2.5 py-1 bg-emerald-50 text-emerald-700 border-emerald-200">
              All decided
            </span>
          )}
        </div>
        <p className="text-sm text-[#40527A]">
          {bundle.pr1.department_name_snapshot} · {bundle.pr1.purpose}
        </p>
      </div>

      {!isOwner && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-[4px] px-5 py-4 mb-6">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">Only the original requestor can accept or reject substitutes for this PR1.</p>
        </div>
      )}

      {bundle.substitutes.length === 0 ? (
        <div className="bg-white rounded-[4px] border border-[#D8E2FF]">
          <EmptyState
            title="No substitutes offered"
            description="Suppliers have not proposed any alternatives for this PR1."
            icon={Replace}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {bundle.substitutes.map(sub => (
            <SubstituteCard
              key={sub.quote_id}
              substitute={sub}
              canDecide={!!isOwner}
              onDecided={load}
              pr1Id={bundle.pr1.id}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function SubstituteCard({
  substitute,
  canDecide,
  onDecided,
  pr1Id,
}: {
  substitute: SubstituteReviewItem;
  canDecide: boolean;
  onDecided: () => void;
  pr1Id: string;
}) {
  const { profile } = useAuth();
  const [notes, setNotes]           = useState('');
  const [submitting, setSubmitting] = useState<'accepted' | 'rejected' | null>(null);
  const [error, setError]           = useState('');

  const decided = substitute.decision !== null;

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
    substitute.decision === 'accepted' ? 'border-emerald-200 bg-emerald-50/30' :
    substitute.decision === 'rejected' ? 'border-rose-200 bg-rose-50/30' :
    'border-slate-200';

  return (
    <div className={`bg-white rounded-[4px] border ${borderClass} overflow-hidden`}>
      {/* Card header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#D8E2FF] bg-[#F7F9FC]">
        <span className="w-6 h-6 rounded-full bg-[#D8E2FF] text-[#40527A] text-xs font-bold flex items-center justify-center shrink-0">
          {substitute.item_order}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[#BFC7D5]">From</p>
          <p className="text-sm font-semibold text-[#0F1F3A]">{substitute.supplier_name}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#BFC7D5]">RFQ</p>
          <p className="text-xs font-mono font-semibold text-[#40527A]">{substitute.rfq_number}</p>
        </div>
        {decided && (
          <span className={`ml-2 inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2.5 py-1 ${
            substitute.decision === 'accepted'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
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
      <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-[#D8E2FF]">
        <div className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-3.5 h-3.5 text-[#BFC7D5]" />
            <p className="text-xs font-bold text-[#BFC7D5] uppercase tracking-wide">You requested</p>
          </div>
          <p className="text-sm font-semibold text-[#0F1F3A] leading-snug">{substitute.original_description}</p>
          {substitute.item_code && (
            <p className="text-xs font-mono text-[#BFC7D5] mt-1">{substitute.item_code}</p>
          )}
          <p className="text-xs text-[#40527A] mt-2">
            <span className="font-medium">{substitute.original_quantity}</span> {substitute.unit_of_measure}
          </p>
        </div>

        <div className="p-5 bg-orange-50/40">
          <div className="flex items-center gap-2 mb-2">
            <Replace className="w-3.5 h-3.5 text-orange-500" />
            <p className="text-xs font-bold text-orange-700 uppercase tracking-wide">Supplier is offering</p>
          </div>
          <p className="text-sm font-semibold text-[#0F1F3A] leading-snug">{substitute.quoted_description}</p>
          <div className="flex items-baseline gap-4 mt-3">
            <div>
              <p className="text-xs text-[#40527A]">Unit price</p>
              <p className="text-lg font-bold text-slate-900">
                ₱{substitute.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#40527A]">Lead time</p>
              <p className="text-sm font-semibold text-[#40527A]">{substitute.lead_time_days} day{substitute.lead_time_days !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {substitute.remarks && (
            <p className="text-xs text-[#40527A] italic mt-3">"{substitute.remarks}"</p>
          )}
        </div>
      </div>

      {/* Decision panel */}
      <div className="px-5 py-4 border-t border-[#D8E2FF]">
        {decided ? (
          <div className="text-xs text-[#40527A]">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span>Decided on {substitute.decided_at ? format(new Date(substitute.decided_at), 'MMM d, yyyy · h:mm a') : '—'}</span>
              {canDecide && (
                <button
                  onClick={() => decide(substitute.decision === 'accepted' ? 'rejected' : 'accepted')}
                  className="inline-flex px-2.5 py-1.5 text-xs font-medium border border-[#D8E2FF] bg-white text-[#40527A] rounded-[4px] hover:bg-[#F7F9FC] hover:border-[#1E4BFF] hover:text-[#0F1F3A] transition focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] focus:ring-offset-1"
                >
                  Change decision to {substitute.decision === 'accepted' ? 'Rejected' : 'Accepted'}
                </button>
              )}
            </div>
            {substitute.decision_notes && (
              <p className="mt-1 text-[#40527A] italic">Notes: {substitute.decision_notes}</p>
            )}
          </div>
        ) : canDecide ? (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                Notes <span className="text-slate-400 font-normal normal-case">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Why accept or reject this substitute?"
                className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => decide('rejected')}
                disabled={submitting !== null}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 text-sm font-semibold rounded-[4px] transition disabled:opacity-50"
              >
                {submitting === 'rejected' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Reject substitute
              </button>
              <button
                onClick={() => decide('accepted')}
                disabled={submitting !== null}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-[4px] transition disabled:opacity-50"
              >
                {submitting === 'accepted' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Accept substitute
              </button>
            </div>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 text-xs text-[#40527A]">
            <Clock className="w-3.5 h-3.5" />
            Awaiting requestor decision
          </div>
        )}
      </div>
    </div>
  );
}
