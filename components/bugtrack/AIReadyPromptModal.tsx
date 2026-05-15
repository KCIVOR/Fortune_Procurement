'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
            <Sparkles className="w-5 h-5 text-blue-500" />
            AI Ready Prompt
          </DialogTitle>
        </DialogHeader>
        <div className="mt-4">
          <p className="text-sm text-[#40527A] mb-4">
            Copy this prompt and paste it into your AI coding assistant (like Bolt or ChatGPT) to quickly resolve this issue.
          </p>
          <div className="bg-[#0F1F3A] text-[#BFC7D5] p-5 rounded-[4px] font-mono text-xs whitespace-pre-wrap max-h-[400px] overflow-y-auto">
            {prompt}
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <Button 
            onClick={copyToClipboard}
            className="bg-[#1E4BFF] hover:bg-[#0F1F3A] flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            Copy Prompt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
