'use client';

import { useState } from 'react';
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
import { Loader2 } from 'lucide-react';

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
          <DialogDescription>
            Describe the issue you encountered. Our team will review and address it.
          </DialogDescription>
        </DialogHeader>
        
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
          <div className="grid grid-cols-2 gap-4">
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
              className="min-h-[80px] resize-none"
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
              className="min-h-[60px] resize-none"
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

          {/* Footer */}
          <DialogFooter className="pt-4 border-t border-pq-neutral-200">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-pq-primary-600 hover:bg-pq-primary-700 text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Bug Report'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
