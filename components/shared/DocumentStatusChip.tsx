import React from 'react';
import { cn } from '@/lib/utils';
import { getDocumentStatusUI, type DocumentType } from '@/lib/status-ui';

interface DocumentStatusChipProps {
  docType: DocumentType;
  status?: string | null;
  className?: string;
}

export default function DocumentStatusChip({ docType, status, className }: DocumentStatusChipProps) {
  if (!status) return null;

  const ui = getDocumentStatusUI(docType, status);
  if (!ui) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium',
        ui.className,
        className
      )}
    >
      {ui.label}
    </span>
  );
}

