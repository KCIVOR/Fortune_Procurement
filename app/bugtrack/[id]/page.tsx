'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import StatusChip from '@/components/shared/StatusChip';
import DetailCard from '@/components/shared/DetailCard';
import DetailInfoField from '@/components/shared/DetailInfoField';
import DetailInfoGrid from '@/components/shared/DetailInfoGrid';
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
  XCircle,
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
        <div className="p-24 flex justify-center bg-white/50 min-h-[400px]">
          <LoadingState message="Fetching bug data..." />
        </div>
      </AppShell>
    );
  }

  if (!bug) return null;

  const aiPrompt = generateAIReadyPrompt(bug);
  const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin';

  return (
    <AppShell title={bug.title}>
      {/* Navigation Breadcrumb */}
      <div className="mb-6">
        <button
          onClick={() => router.push('/bugtrack')}
          className="flex items-center gap-2 text-xs font-bold text-[#40527A] hover:text-[#1E4BFF] transition-all group uppercase tracking-wider"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Fix Queue
        </button>
      </div>

      {/* Main Header with Sticky Action Bar integration */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1.5">
             <span className="text-[10px] font-black text-[#1E4BFF] bg-[#1E4BFF]/5 px-2 py-0.5 rounded border border-[#1E4BFF]/10 uppercase tracking-tighter">
               Report #{bug.id.slice(0, 8).toUpperCase()}
             </span>
             <StatusChip 
                status={bug.status === 'open' ? 'pending' : bug.status === 'in_progress' ? 'in_review' : bug.status === 'resolved' ? 'approved' : 'rejected'} 
                label={bug.status.replace('_', ' ').toUpperCase()} 
                size="sm" 
             />
          </div>
          <h1 className="text-2xl font-black text-[#0F1F3A] tracking-tight leading-tight">{bug.title}</h1>
          <p className="text-sm text-[#40527A] mt-1 font-medium">Reported by {bug.reporter?.full_name} · {format(new Date(bug.created_at), 'PPP')}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="h-10 px-4 flex items-center gap-2 border-[#D8E2FF] hover:bg-white hover:text-[#1E4BFF] text-[#40527A] font-bold text-xs uppercase tracking-widest transition-all shadow-sm"
              onClick={() => setIsPromptModalOpen(true)}
            >
              <Sparkles className="w-4 h-4 text-[#1E4BFF]" />
              AI Ready Prompt
            </Button>
          )}
          {isAdmin && bug.status !== 'resolved' && (
            <Button
              size="sm"
              className="h-10 px-5 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white flex items-center gap-2 font-bold text-xs uppercase tracking-widest transition-all shadow-md active:scale-95"
              onClick={() => handleStatusUpdate('resolved')}
              disabled={updating}
            >
              <CheckCircle className="w-4 h-4" />
              Resolve Bug
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Main Content Column */}
        <div className="lg:col-span-3 space-y-8">
          
          {/* Technical Analysis Card */}
          <DetailCard title="Technical Analysis" className="border-[#D8E2FF] shadow-none bg-white">
            <div className="space-y-10 py-2">
              
              {/* What I See */}
              <section className="relative pl-6 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-[#1E4BFF]/20 before:rounded-full">
                <div className="flex items-center gap-2.5 mb-4">
                  <MessageSquare className="w-4 h-4 text-[#1E4BFF]" />
                  <h4 className="text-[11px] font-black text-[#0F1F3A] uppercase tracking-[0.1em]">Observed Behavior</h4>
                </div>
                <div className="bg-[#F8FAFC] border border-slate-100 p-6 rounded-lg text-sm text-[#0F1F3A] leading-relaxed font-medium shadow-inner">
                  {bug.description}
                </div>
              </section>

              {/* Expected Behavior */}
              <section className="relative pl-6 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-emerald-500/20 before:rounded-full">
                <div className="flex items-center gap-2.5 mb-4">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <h4 className="text-[11px] font-black text-[#0F1F3A] uppercase tracking-[0.1em]">Expected Outcome</h4>
                </div>
                <div className="bg-[#F8FAFC] border border-slate-100 p-6 rounded-lg text-sm text-[#0F1F3A] leading-relaxed font-medium shadow-inner">
                  {bug.expected_behavior}
                </div>
              </section>

              {/* Error Trace */}
              {bug.error_message && (
                <section className="relative pl-6 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-red-500/20 before:rounded-full">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <Terminal className="w-4 h-4 text-red-600" />
                      <h4 className="text-[11px] font-black text-[#0F1F3A] uppercase tracking-[0.1em]">Stack Trace / Logs</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={copyTrace}
                        className="p-1.5 hover:bg-slate-100 rounded text-[#BFC7D5] hover:text-[#1E4BFF] transition-colors"
                        title="Copy Trace"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => setIsTraceExpanded(!isTraceExpanded)}
                        className="p-1.5 hover:bg-slate-100 rounded text-[#BFC7D5] hover:text-[#40527A] transition-colors"
                      >
                        {isTraceExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className={cn(
                    "bg-[#0F1F3A] border border-white/5 rounded-lg text-xs font-mono p-6 transition-all duration-300 overflow-hidden",
                    isTraceExpanded ? "max-h-none" : "max-h-[250px]"
                  )}>
                    <pre className="text-red-400/90 whitespace-pre-wrap leading-relaxed">
                      {bug.error_message}
                    </pre>
                    {!isTraceExpanded && bug.error_message.length > 500 && (
                       <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#0F1F3A] to-transparent pointer-events-none" />
                    )}
                  </div>
                </section>
              )}
            </div>
          </DetailCard>

          {/* Environmental Context Footer */}
          <div className="bg-white border border-[#D8E2FF] rounded-lg p-8">
            <h4 className="text-[11px] font-black text-[#0F1F3A] uppercase tracking-[0.1em] mb-8 flex items-center gap-2">
               <ShieldCheck className="w-4 h-4 text-[#BFC7D5]" />
               System Context & Environment
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-[#BFC7D5] uppercase tracking-widest block">Access Role</span>
                <div className="flex items-center gap-2 text-sm font-bold text-[#0F1F3A]">
                   <div className="w-6 h-6 rounded bg-[#F7F9FC] flex items-center justify-center">
                     <User className="w-3.5 h-3.5 text-[#1E4BFF]" />
                   </div>
                   {bug.affected_user}
                </div>
              </div>
              
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-[#BFC7D5] uppercase tracking-widest block">Entry Point</span>
                <div className="flex items-center gap-2 text-sm font-bold text-[#0F1F3A]">
                   <div className="w-6 h-6 rounded bg-[#F7F9FC] flex items-center justify-center">
                     <Wrench className="w-3.5 h-3.5 text-[#1E4BFF]" />
                   </div>
                   {bug.location}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-[#BFC7D5] uppercase tracking-widest block">Priority</span>
                <div className="pt-1">
                  <span className={cn(
                    "text-[10px] font-black uppercase px-2.5 py-1 rounded-sm border shadow-sm",
                    bug.severity === 'high' ? "bg-red-50 text-red-600 border-red-100" :
                    bug.severity === 'medium' ? "bg-amber-50 text-amber-600 border-amber-100" :
                    "bg-blue-50 text-blue-600 border-blue-100"
                  )}>
                    {bug.severity} SEVERITY
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-[#BFC7D5] uppercase tracking-widest block">Timestamp</span>
                <div className="flex items-center gap-2 text-sm font-bold text-[#0F1F3A]">
                   <Clock className="w-3.5 h-3.5 text-[#BFC7D5]" />
                   {format(new Date(bug.created_at), 'MMM d, p')}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Management Column */}
        <div className="space-y-8">
          
          {/* Lifecycle & Status Card */}
          <div className="bg-[#F8FAFC] border border-[#D8E2FF] rounded-lg p-6 shadow-sm">
            <h4 className="text-[11px] font-black text-[#40527A] uppercase tracking-widest mb-6">Workflow Status</h4>
            
            <div className="space-y-8">
              <div>
                <StatusChip 
                  status={bug.status === 'open' ? 'pending' : bug.status === 'in_progress' ? 'in_review' : bug.status === 'resolved' ? 'approved' : 'rejected'} 
                  label={bug.status.replace('_', ' ').toUpperCase()} 
                  size="lg" 
                  className="w-full justify-center py-3 text-sm font-black tracking-widest"
                />
              </div>

              <div className="pt-6 border-t border-[#D8E2FF]">
                <h5 className="text-[10px] font-black text-[#40527A] uppercase tracking-widest mb-6 flex items-center gap-2">
                  <History className="w-3.5 h-3.5" />
                  Audit Timeline
                </h5>
                <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-[#D8E2FF] before:rounded-full">
                  
                  {/* Reporting Step */}
                  <div className="relative pl-8">
                    <div className="absolute left-0 top-1.5 w-[24px] h-[24px] rounded-full border-2 border-[#1E4BFF] bg-white flex items-center justify-center z-10 shadow-sm">
                       <div className="w-2 h-2 rounded-full bg-[#1E4BFF]" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-[#40527A] font-black uppercase tracking-tight">Initial Report</span>
                      <span className="text-xs font-bold text-[#0F1F3A] mt-0.5">{bug.reporter?.full_name}</span>
                      <span className="text-[10px] text-[#BFC7D5] mt-1 font-medium italic">{format(new Date(bug.created_at), 'MMM d, h:mm a')}</span>
                    </div>
                  </div>

                  {/* Last Update Step (if any) */}
                  {bug.updated_at !== bug.created_at && (
                    <div className="relative pl-8">
                      <div className="absolute left-0 top-1.5 w-[24px] h-[24px] rounded-full border-2 border-[#D8E2FF] bg-[#F8FAFC] flex items-center justify-center z-10">
                         <div className="w-2 h-2 rounded-full bg-[#BFC7D5]" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] text-[#40527A] font-black uppercase tracking-tight">System Update</span>
                        <span className="text-xs font-bold text-[#0F1F3A] mt-0.5">Status: {bug.status.replace('_', ' ').toUpperCase()}</span>
                        <span className="text-[10px] text-[#BFC7D5] mt-1 font-medium italic">{format(new Date(bug.updated_at), 'MMM d, h:mm a')}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Management Actions */}
              {isAdmin && (
                <div className="pt-6 border-t border-[#D8E2FF] space-y-4">
                  <span className="text-[10px] font-black text-[#40527A] uppercase tracking-widest block mb-2">Management Console</span>
                  <div className="flex flex-col gap-2.5">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full text-[10px] font-black border-[#D8E2FF] hover:bg-white hover:text-[#1E4BFF] transition-all h-10 uppercase tracking-widest"
                      onClick={() => handleStatusUpdate('in_progress')}
                      disabled={updating || bug.status === 'in_progress'}
                    >
                      Process Report
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full text-[10px] font-black border-red-100 text-red-600 hover:bg-red-50 transition-all h-10 uppercase tracking-widest"
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

          {/* Quick Help Tip */}
          {isAdmin && (
            <div className="p-5 bg-blue-50/50 border border-blue-100 rounded-lg">
               <div className="flex items-start gap-3">
                  <Terminal className="w-4 h-4 text-[#1E4BFF] mt-0.5" />
                  <div>
                     <h6 className="text-[10px] font-black text-[#0F1F3A] uppercase tracking-wider mb-1">Developer Tip</h6>
                     <p className="text-[10px] text-[#40527A] leading-relaxed font-medium">
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

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("text-sm font-medium", className)}>{children}</span>;
}
