'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Settings, Save, Mail, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getBugTrackSettings, updateBugTrackSettings } from '@/lib/bugtrack';

interface BugTrackSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BugTrackSettingsModal({ open, onOpenChange }: BugTrackSettingsModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (open) {
      fetchSettings();
      setStatus('idle');
    }
  }, [open]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const settings = await getBugTrackSettings();
      if (settings?.notification_email) {
        setEmail(settings.notification_email);
      } else {
        setEmail('');
      }
    } catch (error: any) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatus('idle');
    
    try {
      await updateBugTrackSettings(email || null);
      setStatus('success');
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (error: any) {
      console.error('Failed to update settings:', error);
      setStatus('error');
      setErrorMessage(error.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden bg-white">
        <div className="bg-[#F7F9FC] px-6 py-4 border-b border-[#D8E2FF] flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-slate-200 text-slate-700 flex items-center justify-center">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <DialogTitle className="text-[#0F1F3A] text-base font-bold">Bug Track Settings</DialogTitle>
            <DialogDescription className="text-xs text-[#40527A] mt-0.5">
              Configure notifications for global bug reports.
            </DialogDescription>
          </div>
        </div>

        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 text-[#1E4BFF] animate-spin" />
            <p className="text-sm text-[#40527A]">Loading settings...</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-6 space-y-5">
            {status === 'success' && (
              <div className="p-3 bg-emerald-50 text-emerald-700 rounded text-sm flex items-center gap-2 font-medium border border-emerald-100">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Settings updated successfully
              </div>
            )}
            
            {status === 'error' && (
              <div className="p-3 bg-red-50 text-red-700 rounded text-sm flex items-center gap-2 font-medium border border-red-100">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                {errorMessage}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-bold text-[#0F1F3A] flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-[#40527A]" />
                Notification Email
              </label>
              <p className="text-xs text-[#40527A] mb-2">
                This email address will receive an alert whenever a new bug or issue is reported.
              </p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g., devteam@company.com"
                className="w-full px-3 py-2 bg-white border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:border-[#1E4BFF] focus:ring-1 focus:ring-[#1E4BFF] text-[#0F1F3A]"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#F1F5F9]">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 text-sm font-semibold text-[#40527A] hover:bg-[#F7F9FC] rounded-[4px] transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition shadow-sm disabled:opacity-70"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
