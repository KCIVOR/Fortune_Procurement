'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Copy, Sparkles } from 'lucide-react';

interface AIReadyPromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: string;
}

export default function AIReadyPromptModal({ open, onOpenChange, prompt }: AIReadyPromptModalProps) {
  const copyToClipboard = () => {
    navigator.clipboard.writeText(prompt);
    toast.success('Prompt copied to clipboard!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pq-primary-600" />
            AI Ready Prompt
          </DialogTitle>
          <DialogDescription>
            Copy this prompt and paste it into your AI coding assistant to quickly resolve this issue.
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-pq-neutral-900 text-pq-neutral-300 p-4 rounded-md font-mono text-xs whitespace-pre-wrap max-h-[400px] overflow-y-auto border border-pq-neutral-800">
          {prompt}
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <Button 
            onClick={copyToClipboard}
            className="bg-pq-primary-600 hover:bg-pq-primary-700 text-white flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            Copy Prompt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
