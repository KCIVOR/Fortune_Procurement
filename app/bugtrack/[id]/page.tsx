'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { DetailPageSkeleton } from '@/components/shared/structural-skeletons';
import StatusChip from '@/components/shared/StatusChip';
import { useAuth } from '@/context/AuthContext';
import { getBugReport, updateBugReport, generateAIReadyPrompt, type BugReport } from '@/lib/bugtrack';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Sparkles,
  History,
  MessageSquare,
  Wrench,
  CheckCircle,
  Clock,
  Copy,
  ChevronDown,
  ChevronUp,
  Terminal,
  User,
  ShieldCheck,
} from 'lucide-react';
import AIReadyPromptModal from '@/components/bugtrack/AIReadyPromptModal';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function BugDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const [bug, setBug] = useState<BugReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [isTraceExpanded, setIsTraceExpanded] = useState(false);

  const fetchBug = async () => {
    setLoading(true);
    try {
      const data = await getBugReport(id as string);
      setBug(data);
    } catch (error) {
      console.error('Error fetching bug:', error);
      toast.error('Bug report not found.');
      router.push('/bugtrack');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchBug();
  }, [id]);

  const handleStatusUpdate = async (newStatus: BugReport['status']) => {
    if (!bug) return;
    setUpdating(true);
    try {
      await updateBugReport(bug.id, { status: newStatus });
      toast.success(`Status updated to ${newStatus.replace('_', ' ').toUpperCase()}`);
      
      // Dispatch email if resolved
      if (newStatus === 'resolved' && bug.reporter?.email) {
        await fetch('/api/bugtrack/send-resolved-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: bug.reporter.email,
            bugId: bug.id,
            bugTitle: bug.title,
            reporterName: bug.reporter.full_name,
          })
        });
      }

      fetchBug();
    } catch (error) {
      toast.error('Failed to update status.');
    } finally {
      setUpdating(false);
    }
  };

  const copyTrace = () => {
    if (bug?.error_message) {
      navigator.clipboard.writeText(bug.error_message);
      toast.success('Error trace copied to clipboard');
    }
  };

  if (loading) {
    return (
      <AppShell title="Loading Bug...">
        <DetailPageSkeleton sections={2} fieldsPerSection={4} />
      </AppShell>
    );
  }

  if (!bug) return null;

  const aiPrompt = generateAIReadyPrompt(bug);
  const role = profile?.role as string | undefined;
  const isAdmin = role === 'admin' || role === 'superadmin';

  const statusMap: Record<string, { variant: 'pending' | 'in_review' | 'approved' | 'rejected'; label: string }> = {
    open: { variant: 'pending', label: 'Open' },
    in_progress: { variant: 'in_review', label: 'In Progress' },
    resolved: { variant: 'approved', label: 'Resolved' },
    closed: { variant: 'rejected', label: 'Closed' },
  };
  const statusInfo = statusMap[bug.status] || { variant: 'pending' as const, label: bug.status };

  return (
    <AppShell title={bug.title}>
      {/* Navigation Breadcrumb */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/bugtrack')}
          className="flex items-center gap-2 text-xs font-semibold text-pq-neutral-500 hover:text-pq-primary-600 transition group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Fix Queue
        </button>
      </div>

      {/* Main Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
            <span className="text-[10px] font-bold text-pq-primary-600 bg-pq-primary-50 px-2 py-0.5 rounded border border-pq-primary-200 uppercase tracking-wide">
              Report #{bug.id.slice(0, 8).toUpperCase()}
            </span>
            <StatusChip status={statusInfo.variant} label={statusInfo.label} size="sm" />
          </div>
          <h1 className="text-xl font-bold text-pq-neutral-900">{bug.title}</h1>
          <p className="text-sm text-pq-neutral-500 mt-1">
            Reported by {bug.reporter?.full_name} · {format(new Date(bug.created_at), 'PPP')}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-4 flex items-center gap-2"
              onClick={() => setIsPromptModalOpen(true)}
            >
              <Sparkles className="w-4 h-4 text-pq-primary-600" />
              AI Ready Prompt
            </Button>
          )}
          {isAdmin && bug.status !== 'resolved' && (
            <Button
              size="sm"
              className="h-9 px-4 bg-pq-primary-600 hover:bg-pq-primary-700 text-white flex items-center gap-2"
              onClick={() => handleStatusUpdate('resolved')}
              disabled={updating}
            >
              <CheckCircle className="w-4 h-4" />
              Resolve Bug
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Content Column */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Technical Analysis Card */}
          <div className="bg-white rounded-md border border-pq-neutral-200">
            <div className="px-5 py-3 border-b border-pq-neutral-200 bg-pq-neutral-50">
              <h3 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Technical Analysis</h3>
            </div>
            <div className="p-5 space-y-6">
              
              {/* Observed Behavior */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquare className="w-4 h-4 text-pq-primary-600" />
                  <h4 className="text-xs font-semibold text-pq-neutral-900 uppercase tracking-wide">Observed Behavior</h4>
                </div>
                <div className="bg-pq-neutral-50 border border-pq-neutral-200 p-4 rounded-md text-sm text-pq-neutral-700 leading-relaxed">
                  {bug.description}
                </div>
              </section>

              {/* Expected Behavior */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="w-4 h-4 text-pq-success-600" />
                  <h4 className="text-xs font-semibold text-pq-neutral-900 uppercase tracking-wide">Expected Outcome</h4>
                </div>
                <div className="bg-pq-neutral-50 border border-pq-neutral-200 p-4 rounded-md text-sm text-pq-neutral-700 leading-relaxed">
                  {bug.expected_behavior}
                </div>
              </section>

              {/* Error Trace */}
              {bug.error_message && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-pq-danger-600" />
                      <h4 className="text-xs font-semibold text-pq-neutral-900 uppercase tracking-wide">Stack Trace / Logs</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={copyTrace}
                        className="p-1.5 hover:bg-pq-neutral-100 rounded text-pq-neutral-400 hover:text-pq-primary-600 transition"
                        title="Copy Trace"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => setIsTraceExpanded(!isTraceExpanded)}
                        className="p-1.5 hover:bg-pq-neutral-100 rounded text-pq-neutral-400 hover:text-pq-neutral-600 transition"
                      >
                        {isTraceExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className={cn(
                    "bg-pq-neutral-900 border border-pq-neutral-800 rounded-md text-xs font-mono p-4 transition-all duration-300 overflow-hidden relative",
                    isTraceExpanded ? "max-h-none" : "max-h-[200px]"
                  )}>
                    <pre className="text-pq-danger-400 whitespace-pre-wrap leading-relaxed">
                      {bug.error_message}
                    </pre>
                    {!isTraceExpanded && bug.error_message.length > 500 && (
                      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-pq-neutral-900 to-transparent pointer-events-none" />
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* System Context Card */}
          <div className="bg-white rounded-md border border-pq-neutral-200">
            <div className="px-5 py-3 border-b border-pq-neutral-200 bg-pq-neutral-50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-pq-neutral-400" />
                <h3 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">System Context & Environment</h3>
              </div>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <span className="text-[10px] font-semibold text-pq-neutral-400 uppercase tracking-wide block mb-1">Access Role</span>
                  <div className="flex items-center gap-2 text-sm font-medium text-pq-neutral-900">
                    <div className="w-6 h-6 rounded bg-pq-neutral-100 flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-pq-primary-600" />
                    </div>
                    {bug.affected_user}
                  </div>
                </div>
                
                <div>
                  <span className="text-[10px] font-semibold text-pq-neutral-400 uppercase tracking-wide block mb-1">Entry Point</span>
                  <div className="flex items-center gap-2 text-sm font-medium text-pq-neutral-900">
                    <div className="w-6 h-6 rounded bg-pq-neutral-100 flex items-center justify-center">
                      <Wrench className="w-3.5 h-3.5 text-pq-primary-600" />
                    </div>
                    {bug.location}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-pq-neutral-400 uppercase tracking-wide block mb-1">Priority</span>
                  <div className="pt-1">
                    <span className={cn(
                      "text-[10px] font-bold uppercase px-2 py-1 rounded border",
                      bug.severity === 'high' ? "bg-pq-danger-50 text-pq-danger-600 border-pq-danger-200" :
                      bug.severity === 'medium' ? "bg-pq-warning-50 text-pq-warning-600 border-pq-warning-200" :
                      "bg-pq-primary-50 text-pq-primary-600 border-pq-primary-200"
                    )}>
                      {bug.severity} SEVERITY
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-semibold text-pq-neutral-400 uppercase tracking-wide block mb-1">Timestamp</span>
                  <div className="flex items-center gap-2 text-sm font-medium text-pq-neutral-900">
                    <Clock className="w-3.5 h-3.5 text-pq-neutral-400" />
                    {format(new Date(bug.created_at), 'MMM d, p')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          
          {/* Workflow Status Card */}
          <div className="bg-white rounded-md border border-pq-neutral-200">
            <div className="px-5 py-3 border-b border-pq-neutral-200 bg-pq-neutral-50">
              <h4 className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">Workflow Status</h4>
            </div>
            <div className="p-5 space-y-6">
              <div>
                <StatusChip 
                  status={statusInfo.variant} 
                  label={statusInfo.label} 
                  size="lg" 
                  className="w-full justify-center py-2.5"
                />
              </div>

              <div className="pt-4 border-t border-pq-neutral-200">
                <h5 className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide mb-4 flex items-center gap-2">
                  <History className="w-3.5 h-3.5" />
                  Audit Timeline
                </h5>
                <div className="space-y-4 relative before:absolute before:left-[9px] before:top-2 before:bottom-2 before:w-[2px] before:bg-pq-neutral-200 before:rounded-full">
                  
                  {/* Initial Report */}
                  <div className="relative pl-7">
                    <div className="absolute left-0 top-1 w-5 h-5 rounded-full border-2 border-pq-primary-600 bg-white flex items-center justify-center z-10">
                      <div className="w-2 h-2 rounded-full bg-pq-primary-600" />
                    </div>
                    <div>
                      <span className="text-[10px] text-pq-neutral-500 font-semibold uppercase">Initial Report</span>
                      <p className="text-xs font-medium text-pq-neutral-900 mt-0.5">{bug.reporter?.full_name}</p>
                      <span className="text-[10px] text-pq-neutral-400 mt-0.5 block">{format(new Date(bug.created_at), 'MMM d, h:mm a')}</span>
                    </div>
                  </div>

                  {/* Last Update */}
                  {bug.updated_at !== bug.created_at && (
                    <div className="relative pl-7">
                      <div className="absolute left-0 top-1 w-5 h-5 rounded-full border-2 border-pq-neutral-300 bg-pq-neutral-50 flex items-center justify-center z-10">
                        <div className="w-2 h-2 rounded-full bg-pq-neutral-400" />
                      </div>
                      <div>
                        <span className="text-[10px] text-pq-neutral-500 font-semibold uppercase">System Update</span>
                        <p className="text-xs font-medium text-pq-neutral-900 mt-0.5">Status: {bug.status.replace('_', ' ').toUpperCase()}</p>
                        <span className="text-[10px] text-pq-neutral-400 mt-0.5 block">{format(new Date(bug.updated_at), 'MMM d, h:mm a')}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Management Actions */}
              {isAdmin && (
                <div className="pt-4 border-t border-pq-neutral-200 space-y-3">
                  <span className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide block">Management Console</span>
                  <div className="flex flex-col gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full text-xs font-semibold h-9"
                      onClick={() => handleStatusUpdate('in_progress')}
                      disabled={updating || bug.status === 'in_progress'}
                    >
                      Process Report
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full text-xs font-semibold h-9 border-pq-danger-200 text-pq-danger-600 hover:bg-pq-danger-50"
                      onClick={() => handleStatusUpdate('closed')}
                      disabled={updating || bug.status === 'closed'}
                    >
                      Close / Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Developer Tip */}
          {isAdmin && (
            <div className="p-4 bg-pq-primary-50 border border-pq-primary-200 rounded-md">
              <div className="flex items-start gap-3">
                <Terminal className="w-4 h-4 text-pq-primary-600 mt-0.5 shrink-0" />
                <div>
                  <h6 className="text-[10px] font-semibold text-pq-neutral-900 uppercase tracking-wide mb-1">Developer Tip</h6>
                  <p className="text-xs text-pq-neutral-600 leading-relaxed">
                    Use the AI Ready Prompt to generate a full context summary for automated code fixes.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <AIReadyPromptModal 
        open={isPromptModalOpen} 
        onOpenChange={setIsPromptModalOpen} 
        prompt={aiPrompt} 
      />
    </AppShell>
  );
}
