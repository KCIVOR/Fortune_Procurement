'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import StatusChip from '@/components/shared/StatusChip';
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
  Filter,
  Settings,
} from 'lucide-react';
import ReportBugModal from '@/components/bugtrack/ReportBugModal';
import BugTrackSettingsModal from '@/components/bugtrack/BugTrackSettingsModal';
import { cn } from '@/lib/utils';

export default function BugTrackPage() {
  const { profile } = useAuth();
  const [bugs, setBugs] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

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

  const stats = {
    total: bugs.length,
    active: bugs.filter(b => b.status !== 'closed' && b.status !== 'resolved').length,
    high: bugs.filter(b => b.severity === 'high' && b.status !== 'resolved').length,
    resolved: bugs.filter(b => b.status === 'resolved').length,
  };

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
                className="flex items-center justify-center w-9 h-9 text-[#40527A] hover:text-[#1E4BFF] hover:bg-[#F7F9FC] rounded-[4px] transition shadow-sm border border-[#D8E2FF] bg-white"
                title="Bug Track Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition shadow-sm"
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
          <StatCard label="Total Issues" value={stats.total} icon={Bug} color="slate" />
          <StatCard label="Active Bugs" value={stats.active} icon={Clock} color="amber" />
          <StatCard label="High Severity" value={stats.high} icon={AlertTriangle} color="red" />
          <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle2} color="emerald" />
        </div>

        {/* Fix Queue */}
        <div className="bg-white rounded-[4px] border border-[#D8E2FF] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 bg-[#F7F9FC]/50 border-b border-[#D8E2FF]">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#0F1F3A]">Fix Queue</h2>
              <span className="px-2 py-0.5 rounded-full bg-[#1E4BFF]/10 text-[#1E4BFF] text-[10px] font-bold">
                {stats.active} ACTIVE
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button className="text-xs text-[#40527A] hover:text-[#1E4BFF] font-semibold flex items-center gap-1.5 transition">
                <Filter className="w-3.5 h-3.5" />
                Filter Queue
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-24 flex justify-center bg-white">
              <LoadingState message="Loading fix queue..." />
            </div>
          ) : bugs.length === 0 ? (
            <div className="p-24 text-center bg-white">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-base font-bold text-[#0F1F3A]">System Healthy</h3>
              <p className="text-sm text-[#40527A] mt-1 max-w-xs mx-auto">No bugs reported yet. Everything seems to be running smoothly.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#D8E2FF] bg-white">
              {bugs.map((bug) => (
                <BugRow key={bug.id} bug={bug} />
              ))}
            </div>
          )}
        </div>
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

function BugRow({ bug }: { bug: BugReport }) {
  const severityColors = {
    low: 'bg-blue-50 text-blue-700 border-blue-100',
    medium: 'bg-amber-50 text-amber-700 border-amber-100',
    high: 'bg-red-50 text-red-700 border-red-100',
  };

  const statusMap: Record<string, any> = {
    open: { variant: 'pending', label: 'Open' },
    in_progress: { variant: 'in_review', label: 'In Progress' },
    resolved: { variant: 'approved', label: 'Resolved' },
    closed: { variant: 'rejected', label: 'Closed' },
  };

  const status = statusMap[bug.status] || { variant: 'draft', label: bug.status };

  return (
    <div className="flex items-center gap-4 px-6 py-4.5 hover:bg-[#F7F9FC]/50 transition-all group border-l-2 border-l-transparent hover:border-l-[#1E4BFF]">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 mb-1.5">
          <span className={cn("text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border tracking-wider", severityColors[bug.severity])}>
            {bug.severity}
          </span>
          <StatusChip status={status.variant} label={status.label} size="sm" />
          <span className="text-[10px] font-mono text-[#BFC7D5] font-semibold tracking-tighter">#{bug.id.slice(0, 8).toUpperCase()}</span>
        </div>
        <h3 className="text-sm font-bold text-[#0F1F3A] group-hover:text-[#1E4BFF] transition-colors truncate">{bug.title}</h3>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5 text-[11px] text-[#40527A] font-medium">
             <Clock className="w-3 h-3 text-[#BFC7D5]" />
             {format(new Date(bug.created_at), 'MMM d, yyyy')}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#40527A] font-medium">
             <span className="w-1 h-1 rounded-full bg-[#D8E2FF]" />
             <span className="text-[#BFC7D5]">in</span> {bug.location}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-[#40527A] font-medium">
             <span className="w-1 h-1 rounded-full bg-[#D8E2FF]" />
             <span className="text-[#BFC7D5]">by</span> {bug.reporter?.full_name || 'System'}
          </div>
        </div>
      </div>
      <Link
        href={`/bugtrack/${bug.id}`}
        className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold text-[#40527A] hover:text-[#1E4BFF] transition-all bg-white px-3 py-1.5 rounded border border-[#D8E2FF] shadow-sm opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
      >
        View Details
        <ArrowRight className="w-3.5 h-3.5" />
      </Link>
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
  color: 'slate' | 'amber' | 'blue' | 'emerald' | 'red';
  icon: React.ElementType;
}) {
  const colorClass = {
    slate:   'text-[#40527A] bg-[#F7F9FC] border-[#D8E2FF]',
    amber:   'text-amber-600 bg-amber-50 border-amber-100',
    blue:    'text-blue-600 bg-blue-50 border-blue-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    red:     'text-red-600 bg-red-50 border-red-100',
  }[color];

  return (
    <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-5 shadow-sm hover:shadow-md transition-shadow group">
      <div className={cn("inline-flex items-center justify-center w-10 h-10 rounded-[4px] mb-4 border transition-transform group-hover:scale-110", colorClass)}>
        <Icon className="w-5.5 h-5.5" />
      </div>
      <p className="text-3xl font-black text-[#0F1F3A] tracking-tighter">{value}</p>
      <p className="text-[11px] font-bold text-[#40527A] uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}
