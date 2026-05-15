'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { createBugReport } from '@/lib/bugtrack';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface ReportBugModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function ReportBugModal({ open, onOpenChange, onSuccess }: ReportBugModalProps) {
  const { profile } = useAuth();
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
      await createBugReport({
        ...formData,
        reporter_id: profile.id,
        status: 'open',
      });
      
      // Trigger email notification
      await fetch('/api/bugtrack/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bugTitle: formData.title,
          bugDescription: formData.description,
          severity: formData.severity,
          location: formData.location,
          reporterName: profile.full_name || 'User',
        })
      });

      toast.success('Bug reported successfully!');
      onOpenChange(false);
      onSuccess?.();
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
      toast.error('Failed to report bug.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Report a Bug</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Issue Summary</Label>
            <Input
              id="title"
              placeholder="e.g. Navigation bar is overlapping on mobile"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="location">Where it Happens</Label>
              <Input
                id="location"
                placeholder="e.g. /dashboard or Sidebar"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="severity">Severity</Label>
              <Select
                value={formData.severity}
                onValueChange={(val: any) => setFormData({ ...formData, severity: val })}
              >
                <SelectTrigger>
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

          <div className="space-y-2">
            <Label htmlFor="description">What I See (Description)</Label>
            <Textarea
              id="description"
              placeholder="Describe the bug in detail..."
              className="min-h-[100px]"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expected">Expected Behavior</Label>
            <Textarea
              id="expected"
              placeholder="What should happen instead?"
              value={formData.expected_behavior}
              onChange={(e) => setFormData({ ...formData, expected_behavior: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="error_message">Error Message (Optional)</Label>
            <Input
              id="error_message"
              placeholder="e.g. Uncaught TypeError: ..."
              value={formData.error_message}
              onChange={(e) => setFormData({ ...formData, error_message: e.target.value })}
            />
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-[#1E4BFF] hover:bg-[#0F1F3A]">
              {loading ? 'Submitting...' : 'Submit Bug Report'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
