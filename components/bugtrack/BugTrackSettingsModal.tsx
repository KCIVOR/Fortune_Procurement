'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    } catch (error: unknown) {
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
    } catch (error: unknown) {
      console.error('Failed to update settings:', error);
      setStatus('error');
      setErrorMessage((error as Error).message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-pq-neutral-100 text-pq-neutral-600 flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle>Bug Track Settings</DialogTitle>
              <DialogDescription>
                Configure notifications for global bug reports.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 text-pq-primary-600 animate-spin" />
            <p className="text-sm text-pq-neutral-500">Loading settings...</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {status === 'success' && (
              <div className="p-3 bg-pq-success-50 text-pq-success-700 rounded-md text-sm flex items-center gap-2 font-medium border border-pq-success-200">
                <CheckCircle2 className="w-4 h-4 text-pq-success-600" />
                Settings updated successfully
              </div>
            )}
            
            {status === 'error' && (
              <div className="p-3 bg-pq-danger-50 text-pq-danger-700 rounded-md text-sm flex items-center gap-2 font-medium border border-pq-danger-200">
                <AlertCircle className="w-4 h-4 text-pq-danger-600 shrink-0" />
                {errorMessage}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="notification-email" className="text-sm font-medium text-pq-neutral-700 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-pq-neutral-500" />
                Notification Email
              </Label>
              <p className="text-xs text-pq-neutral-500 mb-2">
                This email address will receive an alert whenever a new bug or issue is reported.
              </p>
              <Input
                id="notification-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g., devteam@company.com"
                className="h-10"
              />
            </div>

            <DialogFooter className="pt-4 border-t border-pq-neutral-200">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-pq-primary-600 hover:bg-pq-primary-700 text-white flex items-center gap-2"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
