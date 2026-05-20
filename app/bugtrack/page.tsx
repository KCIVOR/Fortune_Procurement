'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import StatusChip from '@/components/shared/StatusChip';
import StatusFilterTabs from '@/components/shared/StatusFilterTabs';
import PaginationControls from '@/components/shared/PaginationControls';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/AuthContext';
import { getBugReports, type BugReport } from '@/lib/bugtrack';
import { format } from 'date-fns';
import {
  Bug,
  Plus,
  ArrowRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Settings,
} from 'lucide-react';
import ReportBugModal from '@/components/bugtrack/ReportBugModal';
import BugTrackSettingsModal from '@/components/bugtrack/BugTrackSettingsModal';
import { cn } from '@/lib/utils';

// ─── Filter definitions ───────────────────────────────────────────────────────

type FilterKey = 'all' | 'open' | 'in_progress' | 'resolved' | 'closed';

const PAGE_SIZE = 10;

function getFilteredBugs(bugs: BugReport[], filter: FilterKey): BugReport[] {
  switch (filter) {
    case 'open':
      return bugs.filter(b => b.status === 'open');
    case 'in_progress':
      return bugs.filter(b => b.status === 'in_progress');
    case 'resolved':
      return bugs.filter(b => b.status === 'resolved');
    case 'closed':
      return bugs.filter(b => b.status === 'closed');
    case 'all':
    default:
      return bugs;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BugTrackPage() {
  const { profile } = useAuth();
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterKey>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchBugs = async () => {
    setLoading(true);
    try {
      const data = await getBugReports();
      setBugs(data);
    } catch (error) {
      console.error('Error fetching bugs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBugs();
  }, []);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  // Compute counts for tabs
  const counts = useMemo(() => ({
    all:         bugs.length,
    open:        bugs.filter(b => b.status === 'open').length,
    in_progress: bugs.filter(b => b.status === 'in_progress').length,
    resolved:    bugs.filter(b => b.status === 'resolved').length,
    closed:      bugs.filter(b => b.status === 'closed').length,
  }), [bugs]);

  // Filter and paginate
  const filteredBugs = useMemo(() => getFilteredBugs(bugs, activeTab), [bugs, activeTab]);
  const totalPages = Math.max(1, Math.ceil(filteredBugs.length / PAGE_SIZE));
  const paginatedBugs = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredBugs.slice(start, start + PAGE_SIZE);
  }, [filteredBugs, currentPage]);

  const stats = {
    total: bugs.length,
    active: bugs.filter(b => b.status !== 'closed' && b.status !== 'resolved').length,
    high: bugs.filter(b => b.severity === 'high' && b.status !== 'resolved').length,
    resolved: bugs.filter(b => b.status === 'resolved').length,
  };

  const tabs = [
    { key: 'all',         label: 'All',         count: counts.all },
    { key: 'open',        label: 'Open',        count: counts.open },
    { key: 'in_progress', label: 'In Progress', count: counts.in_progress },
    { key: 'resolved',    label: 'Resolved',    count: counts.resolved },
    { key: 'closed',      label: 'Closed',      count: counts.closed },
  ];

  return (
    <AppShell title="Bug Track">
      <PageHeader
        title="Bug Track"
        description="Global system bug tracking and fix queue. Report issues and track their resolution."
        action={
          <div className="flex items-center gap-3">
            {profile?.role === 'admin' && (
              <button
                onClick={() => setIsSettingsModalOpen(true)}
                className="flex items-center justify-center w-9 h-9 text-pq-neutral-500 hover:text-pq-primary-600 hover:bg-pq-neutral-50 rounded-md transition border border-pq-neutral-200 bg-white"
                title="Bug Track Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-pq-primary-600 hover:bg-pq-primary-700 text-white text-sm font-semibold rounded-md transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Report a Bug
            </button>
          </div>
        }
      />

      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Issues" value={stats.total} icon={Bug} color="neutral" />
          <StatCard label="Active Bugs" value={stats.active} icon={Clock} color="warning" />
          <StatCard label="High Severity" value={stats.high} icon={AlertTriangle} color="danger" />
          <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle2} color="success" />
        </div>

        {/* Status Filter Tabs */}
        {!loading && (
          <StatusFilterTabs
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(key) => setActiveTab(key as FilterKey)}
          />
        )}

        {/* Fix Queue */}
        <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
          <div className="hidden md:grid grid-cols-[1fr_120px_100px_140px_80px] gap-4 px-5 py-2.5 bg-pq-neutral-50 border-b border-pq-neutral-200">
            <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Bug</p>
            <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Severity</p>
            <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Status</p>
            <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Reported</p>
            <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide"></p>
          </div>

          {loading ? (
            <BugQueueSkeleton />
          ) : filteredBugs.length === 0 ? (
            <EmptyState
              title={activeTab === 'all' ? 'System Healthy' : `No ${activeTab.replace('_', ' ')} bugs`}
              description={
                activeTab === 'all'
                  ? 'No bugs reported yet. Everything seems to be running smoothly.'
                  : 'No bugs match this filter.'
              }
              icon={CheckCircle2}
            />
          ) : (
            <div className="divide-y divide-pq-neutral-200">
              {paginatedBugs.map((bug) => (
                <BugRow key={bug.id} bug={bug} />
              ))}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && filteredBugs.length > PAGE_SIZE && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={PAGE_SIZE}
            totalCount={filteredBugs.length}
            entityLabel="bugs"
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      <ReportBugModal 
        open={isReportModalOpen} 
        onOpenChange={setIsReportModalOpen} 
        onSuccess={fetchBugs}
      />
      <BugTrackSettingsModal
        open={isSettingsModalOpen}
        onOpenChange={setIsSettingsModalOpen}
      />
    </AppShell>
  );
}

// ─── Bug Row ──────────────────────────────────────────────────────────────────

function BugRow({ bug }: { bug: BugReport }) {
  const severityColors = {
    low: 'bg-pq-primary-50 text-pq-primary-700 border-pq-primary-200',
    medium: 'bg-pq-warning-50 text-pq-warning-700 border-pq-warning-200',
    high: 'bg-pq-danger-50 text-pq-danger-700 border-pq-danger-200',
  };

  const statusMap: Record<string, { variant: 'pending' | 'in_review' | 'approved' | 'rejected' | 'draft'; label: string }> = {
    open: { variant: 'pending', label: 'Open' },
    in_progress: { variant: 'in_review', label: 'In Progress' },
    resolved: { variant: 'approved', label: 'Resolved' },
    closed: { variant: 'rejected', label: 'Closed' },
  };

  const status = statusMap[bug.status] || { variant: 'draft' as const, label: bug.status };

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-pq-neutral-50 transition">
      {/* Bug Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[10px] font-mono text-pq-neutral-400 font-medium">#{bug.id.slice(0, 8).toUpperCase()}</span>
        </div>
        <h3 className="text-sm font-semibold text-pq-neutral-900 truncate">{bug.title}</h3>
        <div className="flex items-center gap-2 mt-1 text-xs text-pq-neutral-500">
          <span>in {bug.location}</span>
          <span>·</span>
          <span>by {bug.reporter?.full_name || 'System'}</span>
        </div>
      </div>

      {/* Severity */}
      <div className="shrink-0 w-[120px] hidden md:block">
        <span className={cn("text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border tracking-wide", severityColors[bug.severity])}>
          {bug.severity}
        </span>
      </div>

      {/* Status */}
      <div className="shrink-0 w-[100px] hidden md:block">
        <StatusChip status={status.variant} label={status.label} size="sm" />
      </div>

      {/* Date */}
      <div className="shrink-0 w-[140px] hidden md:block">
        <span className="text-xs text-pq-neutral-500">
          {format(new Date(bug.created_at), 'MMM d, yyyy')}
        </span>
      </div>

      {/* Action */}
      <Link
        href={`/bugtrack/${bug.id}`}
        className="shrink-0 flex items-center gap-1 text-xs font-semibold text-pq-neutral-500 hover:text-pq-primary-600 transition"
      >
        View
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: 'neutral' | 'warning' | 'success' | 'danger';
  icon: React.ElementType;
}) {
  const colorStyles = {
    neutral: 'bg-pq-neutral-50 border-pq-neutral-200 text-pq-neutral-600',
    warning: 'bg-pq-warning-50 border-pq-warning-200 text-pq-warning-600',
    success: 'bg-pq-success-50 border-pq-success-200 text-pq-success-600',
    danger:  'bg-pq-danger-50 border-pq-danger-200 text-pq-danger-600',
  };

  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 p-5">
      <div className={cn("inline-flex items-center justify-center w-10 h-10 rounded-md mb-3 border", colorStyles[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-pq-neutral-900">{value}</p>
      <p className="text-xs font-medium text-pq-neutral-500 uppercase tracking-wide mt-1">{label}</p>
    </div>
  );
}

// ─── Skeleton Loading ─────────────────────────────────────────────────────────

function BugQueueSkeleton() {
  return (
    <div className="divide-y divide-pq-neutral-200" aria-busy="true" aria-label="Loading bug queue">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-64" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
          <Skeleton className="h-5 w-16 hidden md:block" />
          <Skeleton className="h-5 w-20 rounded-full hidden md:block" />
          <Skeleton className="h-4 w-24 hidden md:block" />
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}
