'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import StatusChip from '@/components/shared/StatusChip';
import FilterBar from '@/components/shared/FilterBar';
import type { FilterConfig, TabFilter } from '@/components/shared/FilterBar.types';
import PaginationControls from '@/components/shared/PaginationControls';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/context/AuthContext';
import { getBugReports, createBugReport, getMyBugReports, type BugReport } from '@/lib/bugtrack';
import { notifyByRole } from '@/lib/notifications';
import { authFetch } from '@/lib/authenticated-fetch';
import { format } from 'date-fns';
import {
  Bug,
  Plus,
  ArrowRight,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Settings,
  Loader2,
} from 'lucide-react';
import ReportBugModal from '@/components/bugtrack/ReportBugModal';
import BugTrackSettingsModal from '@/components/bugtrack/BugTrackSettingsModal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const isAdmin = profile?.role === 'admin' || (profile?.role as string) === 'superadmin';

  const [myBugs, setMyBugs] = useState<BugReport[]>([]);
  const [myBugsLoading, setMyBugsLoading] = useState(false);

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
    if (!profile) return;
    if (isAdmin) {
      fetchBugs();
    } else {
      setLoading(false);
      setMyBugsLoading(true);
      getMyBugReports(profile.id)
        .then(setMyBugs)
        .catch(() => {})
        .finally(() => setMyBugsLoading(false));
    }
  }, [isAdmin, profile]);

  // Reset to page 1 when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, appliedSearch]);

  // Compute counts for tabs
  const counts = useMemo(() => ({
    all:         bugs.length,
    open:        bugs.filter(b => b.status === 'open').length,
    in_progress: bugs.filter(b => b.status === 'in_progress').length,
    resolved:    bugs.filter(b => b.status === 'resolved').length,
    closed:      bugs.filter(b => b.status === 'closed').length,
  }), [bugs]);

  // Filter and paginate
  const filteredBugs = useMemo(() => {
    let result = getFilteredBugs(bugs, activeTab);
    if (appliedSearch.trim()) {
      const searchLower = appliedSearch.toLowerCase();
      result = result.filter(b =>
        b.title.toLowerCase().includes(searchLower) ||
        b.location.toLowerCase().includes(searchLower) ||
        (b.reporter?.full_name && b.reporter.full_name.toLowerCase().includes(searchLower))
      );
    }
    return result;
  }, [bugs, activeTab, appliedSearch]);
  
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

  const tabs: TabFilter[] = [
    { value: 'all',         label: `All (${counts.all})` },
    { value: 'open',        label: `Open (${counts.open})` },
    { value: 'in_progress', label: `In Progress (${counts.in_progress})` },
    { value: 'resolved',    label: `Resolved (${counts.resolved})` },
    { value: 'closed',      label: `Closed (${counts.closed})` },
  ];

  const handleClear = () => {
    setSearch('');
    setAppliedSearch('');
    setActiveTab('all');
  };

  // Non-admin users see the report form + their own reports
  if (!isAdmin) {
    return (
      <AppShell title="Report a Bug">
        <div className="max-w-2xl mx-auto space-y-8">
          <div>
            <PageHeader
              title="Report a Bug"
              description="Found an issue? Let us know and we'll get it fixed as soon as possible."
            />
            <BugReportForm
              profile={profile}
              onSuccess={(bug) => setMyBugs((prev) => [bug, ...prev])}
            />
          </div>
          <MyReportsSection bugs={myBugs} loading={myBugsLoading} />
        </div>
      </AppShell>
    );
  }

  // Admin view - full bug tracking dashboard
  return (
    <AppShell title="Bug Track">
      <PageHeader
        title="Bug Track"
        description="Global system bug tracking and fix queue. Report issues and track their resolution."
        action={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex items-center justify-center w-9 h-9 text-pq-neutral-500 hover:text-pq-primary-600 hover:bg-pq-neutral-50 rounded-md transition border border-pq-neutral-200 bg-white"
              title="Bug Track Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
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

        {/* FilterBar with tabs and search */}
        {!loading && (
          <FilterBar
            tabs={tabs}
            activeTab={activeTab}
            onTabChange={(value) => setActiveTab(value as FilterKey)}
            filters={[
              {
                type: 'search',
                id: 'bug-search',
                label: 'Search',
                placeholder: 'Search by title, location, or reporter...',
                value: search,
                onChange: (value) => setSearch(value as string),
              },
            ] as FilterConfig[]}
            onApply={() => setAppliedSearch(search)}
            onClear={handleClear}
            loading={loading}
            resultCount={filteredBugs.length}
            resultLabel="bug"
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

        {/* Pagination - always show when there are results */}
        {!loading && filteredBugs.length > 0 && (
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

// ─── My Reports Section (non-admin) ──────────────────────────────────────────

function MyReportsSection({ bugs, loading }: { bugs: BugReport[]; loading: boolean }) {
  const statusMap: Record<string, { variant: 'pending' | 'in_review' | 'approved' | 'rejected'; label: string }> = {
    open:        { variant: 'pending',  label: 'Open' },
    in_progress: { variant: 'in_review', label: 'In Progress' },
    resolved:    { variant: 'approved', label: 'Resolved' },
    closed:      { variant: 'rejected', label: 'Closed' },
  };

  const severityColors = {
    low:    'bg-pq-primary-50 text-pq-primary-700 border-pq-primary-200',
    medium: 'bg-pq-warning-50 text-pq-warning-700 border-pq-warning-200',
    high:   'bg-pq-danger-50 text-pq-danger-700 border-pq-danger-200',
  };

  return (
    <div>
      <h2 className="text-base font-semibold text-pq-neutral-900 mb-3">My Reports</h2>
      <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-16 ml-auto" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
            ))}
          </div>
        ) : bugs.length === 0 ? (
          <EmptyState
            icon={Bug}
            title="No reports yet"
            description="Your submitted bug reports will appear here."
          />
        ) : (
          <div className="divide-y divide-pq-neutral-200">
            {bugs.map((bug) => {
              const status = statusMap[bug.status] || { variant: 'pending' as const, label: bug.status };
              return (
                <div key={bug.id} className="flex items-center gap-3 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-pq-neutral-900 truncate">{bug.title}</p>
                    <p className="text-xs text-pq-neutral-500 mt-0.5">
                      {bug.location} · {format(new Date(bug.created_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <span className={cn('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border tracking-wide shrink-0', severityColors[bug.severity])}>
                    {bug.severity}
                  </span>
                  <StatusChip status={status.variant} label={status.label} size="sm" />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Inline Bug Report Form ──────────────────────────────────────────────────

function BugReportForm({ profile, onSuccess }: { profile: any; onSuccess?: (bug: BugReport) => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    expected_behavior: '',
    error_message: '',
    affected_user: profile?.role || '',
    location: '',
    severity: 'medium' as 'low' | 'medium' | 'high',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setLoading(true);
    try {
      const newBug = await createBugReport({
        ...formData,
        reporter_id: profile.id,
        status: 'open',
      });

      // Notify admins in-app
      notifyByRole('admin', {
        title: 'New Bug Report',
        body: `${profile.full_name || 'A user'} reported: ${formData.title}`,
        type: 'action_required',
        document_type: 'bug',
        document_id: newBug.id,
        action_url: `/bugtrack/${newBug.id}`,
      }).catch(() => {});

      // Trigger email notification
      await authFetch('/api/bugtrack/send-email', {
        method: 'POST',
        body: JSON.stringify({
          bugTitle: formData.title,
          bugDescription: formData.description,
          severity: formData.severity,
          location: formData.location,
          reporterName: profile.full_name || 'User',
        })
      });

      toast.success('Bug reported successfully! Our team will review it shortly.');
      onSuccess?.(newBug);

      // Reset form
      setFormData({
        title: '',
        description: '',
        expected_behavior: '',
        error_message: '',
        affected_user: profile.role || '',
        location: '',
        severity: 'medium',
      });
    } catch (error) {
      console.error('Error reporting bug:', error);
      toast.error('Failed to report bug. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 p-6">
      <div className="flex items-start gap-4 mb-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-md bg-pq-primary-50 border border-pq-primary-200">
          <Bug className="w-6 h-6 text-pq-primary-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-pq-neutral-900 mb-1">Submit a Bug Report</h3>
          <p className="text-sm text-pq-neutral-600">
            Describe the issue you encountered in detail. Our team will review and address it promptly.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Issue Summary */}
        <div className="space-y-1.5">
          <Label htmlFor="title" className="text-sm font-medium text-pq-neutral-700">
            Issue Summary <span className="text-pq-danger-500">*</span>
          </Label>
          <Input
            id="title"
            placeholder="e.g. Navigation bar is overlapping on mobile"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            className="h-10"
          />
        </div>

        {/* Location & Severity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="location" className="text-sm font-medium text-pq-neutral-700">
              Where it Happens <span className="text-pq-danger-500">*</span>
            </Label>
            <Input
              id="location"
              placeholder="e.g. /dashboard or Sidebar"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              required
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="severity" className="text-sm font-medium text-pq-neutral-700">
              Severity <span className="text-pq-danger-500">*</span>
            </Label>
            <Select
              value={formData.severity}
              onValueChange={(val: 'low' | 'medium' | 'high') => setFormData({ ...formData, severity: val })}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-sm font-medium text-pq-neutral-700">
            What I See (Description) <span className="text-pq-danger-500">*</span>
          </Label>
          <Textarea
            id="description"
            placeholder="Describe the bug in detail..."
            className="min-h-[100px] resize-none"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
          />
        </div>

        {/* Expected Behavior */}
        <div className="space-y-1.5">
          <Label htmlFor="expected" className="text-sm font-medium text-pq-neutral-700">
            Expected Behavior <span className="text-pq-danger-500">*</span>
          </Label>
          <Textarea
            id="expected"
            placeholder="What should happen instead?"
            className="min-h-[80px] resize-none"
            value={formData.expected_behavior}
            onChange={(e) => setFormData({ ...formData, expected_behavior: e.target.value })}
            required
          />
        </div>

        {/* Error Message */}
        <div className="space-y-1.5">
          <Label htmlFor="error_message" className="text-sm font-medium text-pq-neutral-700">
            Error Message <span className="text-pq-neutral-400 font-normal">(Optional)</span>
          </Label>
          <Input
            id="error_message"
            placeholder="e.g. Uncaught TypeError: ..."
            value={formData.error_message}
            onChange={(e) => setFormData({ ...formData, error_message: e.target.value })}
            className="h-10 font-mono text-sm"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-4 border-t border-pq-neutral-200">
          <Button 
            type="submit" 
            disabled={loading}
            className="w-full bg-pq-primary-600 hover:bg-pq-primary-700 text-white h-11"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Submit Bug Report
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Help Section */}
      <div className="mt-6 pt-6 border-t border-pq-neutral-200">
        <h4 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-3">What to Include</h4>
        <ul className="space-y-2 text-sm text-pq-neutral-600">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-pq-success-600 mt-0.5 shrink-0" />
            <span>Clear description of what went wrong</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-pq-success-600 mt-0.5 shrink-0" />
            <span>Where in the system the issue occurred</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-pq-success-600 mt-0.5 shrink-0" />
            <span>What you expected to happen instead</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-pq-success-600 mt-0.5 shrink-0" />
            <span>Any error messages you saw (optional)</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
