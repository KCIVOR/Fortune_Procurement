import { supabase } from './supabase';
import type { UserProfile } from '@/types/auth';

export interface BugReport {
  id: string;
  title: string;
  description: string;
  expected_behavior: string;
  error_message?: string;
  affected_user: string;
  location: string;
  severity: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  reporter_id: string;
  ai_prompt?: string;
  created_at: string;
  updated_at: string;
  reporter?: {
    full_name: string;
    email?: string;
    role: string;
  };
}

export interface BugTrackSettings {
  id: string;
  notification_email: string | null;
  created_at: string;
  updated_at: string;
}

export async function getBugReports() {
  const { data, error } = await supabase
    .from('bug_reports')
    .select('*, reporter:profiles(full_name, email, roles:role_id(name))')
    .order('created_at', { ascending: false });

  if (error) throw error;

  // Map nested role name to role
  const bugs = (data as any[]).map(bug => ({
    ...bug,
    reporter: bug.reporter ? {
      full_name: bug.reporter.full_name,
      email: bug.reporter.email,
      role: bug.reporter.roles?.name
    } : null
  }));

  return bugs as BugReport[];
}

export async function getBugReport(id: string) {
  const { data, error } = await supabase
    .from('bug_reports')
    .select('*, reporter:profiles(full_name, email, roles:role_id(name))')
    .eq('id', id)
    .single();

  if (error) throw error;

  const row = data as any;
  const bug = {
    ...row,
    reporter: row.reporter ? {
      full_name: row.reporter.full_name,
      email: row.reporter.email,
      role: row.reporter.roles?.name
    } : null
  };

  return bug as BugReport;
}

export async function getMyBugReports(reporterId: string) {
  const { data, error } = await supabase
    .from('bug_reports')
    .select('*')
    .eq('reporter_id', reporterId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as BugReport[];
}

export async function createBugReport(bug: Partial<BugReport>) {
  const table = supabase.from('bug_reports') as any;
  const { data, error } = await table
    .insert([bug])
    .select()
    .single();

  if (error) throw error;
  return data as BugReport;
}

export async function updateBugReport(id: string, updates: Partial<BugReport>) {
  const table = supabase.from('bug_reports') as any;
  const { data, error } = await table
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as BugReport;
}

export async function getBugTrackSettings() {
  const { data, error } = await supabase
    .from('bugtrack_settings')
    .select('*')
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data as BugTrackSettings | null;
}

export async function updateBugTrackSettings(email: string | null) {
  const { data: existing } = await supabase
    .from('bugtrack_settings')
    .select('id')
    .single();

  if (existing) {
    const table = supabase.from('bugtrack_settings') as any;
    const { data, error } = await table
      .update({ notification_email: email })
      .eq('id', (existing as any).id)
      .select()
      .single();
    if (error) throw error;
    return data as BugTrackSettings;
  } else {
    const table = supabase.from('bugtrack_settings') as any;
    const { data, error } = await table
      .insert([{ notification_email: email }])
      .select()
      .single();
    if (error) throw error;
    return data as BugTrackSettings;
  }
}

/**
 * Generates an AI-ready prompt based on the bug report data.
 * Formatted for tools like Bolt or other AI coding agents.
 */
export function generateAIReadyPrompt(bug: BugReport) {
  return `We will fix only one exact issue.

Affected user: ${bug.affected_user || 'All users'}
User workflow: ${bug.location || 'General application'}
Issue: ${bug.title}

What I see:
${bug.description || 'No description provided.'}

Expected:
${bug.expected_behavior || 'Not specified.'}

Error Message (if any):
${bug.error_message || 'None'}

Scope:
Identify and resolve the specific bug described above. Maintain existing design patterns and code structure.

Your task:
Fix the issue and ensure the solution is verified.

Output format:
Direct code implementation with explanation of the fix.

Additional context:
This bug was reported by ${bug.reporter?.full_name || 'System'}. Severity: ${bug.severity.toUpperCase()}.`;
}
