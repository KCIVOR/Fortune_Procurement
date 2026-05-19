'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import LoadingState from '@/components/shared/LoadingState';
import PaginationControls from '@/components/shared/PaginationControls';
import { fetchSupplierInboxPaged } from '@/lib/canvassing';
import { useAuth } from '@/context/AuthContext';
import type { SupplierRfqInboxRow } from '@/types/canvassing';
import { Tag, ArrowRight, Clock, CircleCheck as CheckCircle2, CalendarDays, Building2, PackageSearch } from 'lucide-react';
import { format } from 'date-fns';

const SUPPLIER_STATUS_BADGE: Record<string, string> = {
  invited:   'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
  submitted: 'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
  declined:  'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
};
const SUPPLIER_STATUS_LABEL: Record<string, string> = {
  invited:   'Awaiting Response',
  submitted: 'Submitted',
  declined:  'Declined',
};

const RFQ_STATUS_BADGE: Record<string, string> = {
  open:   'bg-pq-neutral-50 text-pq-neutral-900 border-pq-neutral-200',
  closed: 'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200',
  draft:  'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200',
};

export default function SupplierQuotationsPage() {
  const { profile } = useAuth();
  const [inbox, setInbox]     = useState<SupplierRfqInboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 20;
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (!profile) return;
    const offset = (currentPage - 1) * rowsPerPage;
    setLoading(true);
    fetchSupplierInboxPaged(profile.id, { limit: rowsPerPage, offset })
      .then(result => {
        setInbox(result.inbox);
        setTotalCount(result.total_count);
      })
      .catch(() => setError('Failed to load RFQ inbox.'))
      .finally(() => setLoading(false));
  }, [profile, currentPage]);

  const pending    = inbox.filter(r => r.supplier_status === 'invited' && r.rfq_status === 'open');
  const submitted  = inbox.filter(r => r.supplier_status === 'submitted');
  const other      = inbox.filter(r => r.supplier_status !== 'invited' || r.rfq_status !== 'open').filter(r => r.supplier_status !== 'submitted');
  const totalPages = Math.ceil(totalCount / rowsPerPage);

  return (
    <AppShell title="Quotations">
      <PageHeader
        title="RFQ Inbox"
        description="Requests for quotation sent to your company. Submit your pricing for each open RFQ."
      />

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <LoadingState message="Loading RFQs..." />
        </div>
      ) : error ? (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">{error}</div>
      ) : inbox.length === 0 ? (
        <div className="bg-white rounded-md border border-pq-neutral-200">
          <EmptyState
            title="No RFQs yet"
            description="When procurement sends you an RFQ, it will appear here for your response."
            icon={Tag}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <StatCard label="Awaiting Response" value={pending.length}   color="amber"   icon={Clock} />
            <StatCard label="Submitted"          value={submitted.length} color="emerald" icon={CheckCircle2} />
            <StatCard label="Total RFQs"         value={totalCount}       color="slate"   icon={PackageSearch} />
          </div>

          {pending.length > 0 && (
            <InboxSection title="Awaiting Your Response" accent="amber" count={pending.length}>
              {pending.map(row => <InboxRow key={row.rfq_supplier_id} row={row} />)}
            </InboxSection>
          )}

          {submitted.length > 0 && (
            <InboxSection title="Submitted" accent="emerald" count={submitted.length}>
              {submitted.map(row => <InboxRow key={row.rfq_supplier_id} row={row} />)}
            </InboxSection>
          )}

          {other.length > 0 && (
            <InboxSection title="Other" accent="slate" count={other.length}>
              {other.map(row => <InboxRow key={row.rfq_supplier_id} row={row} />)}
            </InboxSection>
          )}

          {totalCount > 0 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={rowsPerPage}
              totalCount={totalCount}
              entityLabel="RFQs"
              loading={loading}
              onPageChange={(page) => {
                if (page < currentPage) setCurrentPage(p => Math.max(1, p - 1));
                else setCurrentPage(p => Math.min(totalPages, p + 1));
              }}
            />
          )}
        </div>
      )}
    </AppShell>
  );
}

function InboxRow({ row }: { row: SupplierRfqInboxRow }) {
  const canRespond = row.rfq_status === 'open' && row.supplier_status === 'invited';
  const hasPartial = row.quotes_submitted > 0 && row.quotes_submitted < row.item_count;

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-pq-neutral-50 transition">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="font-mono text-xs font-bold text-pq-neutral-900">{row.rfq_number}</span>
          <span className={`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${RFQ_STATUS_BADGE[row.rfq_status] ?? ''}`}>
            {row.rfq_status.charAt(0).toUpperCase() + row.rfq_status.slice(1)}
          </span>
          <span className={`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${SUPPLIER_STATUS_BADGE[row.supplier_status]}`}>
            {SUPPLIER_STATUS_LABEL[row.supplier_status]}
          </span>
          {hasPartial && (
            <span className="inline-flex items-center text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded-full px-2 py-0.5">
              {row.quotes_submitted}/{row.item_count} items quoted
            </span>
          )}
        </div>
        <p className="text-sm text-pq-neutral-900 truncate">{row.purpose}</p>
        <div className="flex items-center gap-3 mt-1">
          <span className="inline-flex items-center gap-1 text-xs text-pq-neutral-400">
            <Building2 className="w-3 h-3" />
            {row.department_name}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-pq-neutral-400">
            <PackageSearch className="w-3 h-3" />
            {row.item_count} item{row.item_count !== 1 ? 's' : ''}
          </span>
          {row.rfq_deadline && (
            <span className="inline-flex items-center gap-1 text-xs text-pq-neutral-400">
              <CalendarDays className="w-3 h-3" />
              Deadline: {format(new Date(row.rfq_deadline), 'MMM d, yyyy')}
            </span>
          )}
        </div>
      </div>
      <div className="shrink-0">
        {canRespond || row.supplier_status === 'submitted' ? (
          <Link
            href={`/supplier/quotations/${row.rfq_supplier_id}`}
            className={`inline-flex items-center gap-1 text-xs font-semibold transition ${
              canRespond
                ? 'text-pq-primary-600 hover:text-pq-neutral-900'
                : 'text-pq-neutral-500 hover:text-pq-neutral-900'
            }`}
          >
            {canRespond ? 'Submit Quote' : 'View Quote'}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <span className="text-xs text-pq-neutral-400">Closed</span>
        )}
      </div>
    </div>
  );
}

function InboxSection({
  title,
  accent,
  count,
  children,
}: {
  title: string;
  accent: 'amber' | 'emerald' | 'slate';
  count: number;
  children: React.ReactNode;
}) {
  const accentClass = {
    amber:   'border-amber-300 bg-pq-warning-100 text-pq-warning-600',
    emerald: 'border-pq-success-100 bg-pq-success-100 text-pq-success-600',
    slate:   'border-pq-neutral-200 bg-pq-neutral-50 text-pq-neutral-500',
  }[accent];

  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-pq-neutral-200">
        <h2 className="text-sm font-semibold text-pq-neutral-900">{title}</h2>
        <span className={`text-xs font-semibold border rounded-full px-2 py-0.5 ${accentClass}`}>{count}</span>
      </div>
      <div className="divide-y divide-pq-neutral-200">{children}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: 'amber' | 'emerald' | 'slate';
  icon: React.ElementType;
}) {
  const colorClass = {
    amber:   'text-pq-warning-600 bg-pq-warning-100',
    emerald: 'text-pq-success-600 bg-pq-success-100',
    slate:   'text-pq-neutral-500 bg-pq-neutral-50',
  }[color];

  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 p-4">
      <div className={`inline-flex items-center justify-center w-9 h-9 rounded-md mb-3 ${colorClass}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-pq-neutral-900">{value}</p>
      <p className="text-xs text-pq-neutral-500 mt-0.5">{label}</p>
    </div>
  );
}
