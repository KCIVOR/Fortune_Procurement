'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, FileText, Search, ShoppingCart, Truck, PackageCheck, ClipboardList } from 'lucide-react';
import { fetchDocumentChain } from '@/lib/traceability';
import type { ChainDoc, ChainDocType, DocumentChain } from '@/lib/traceability';
import type { AppRole } from '@/types/auth';
import DocumentStatusChip from '@/components/shared/DocumentStatusChip';

// ── Role visibility rules ─────────────────────────────────────────────────────

// Only approver-level roles can view the Related Records section
function canViewRelatedRecords(role: AppRole): boolean {
  return role === 'approver' || role === 'procurement' || role === 'admin';
}

// Document-level visibility: suppliers only see RFQ + PO
function isDocVisibleForRole(type: ChainDocType, role: AppRole): boolean {
  if (role === 'supplier') {
    return type === 'RFQ' || type === 'PO';
  }
  return true;
}

// ── Status display helpers ────────────────────────────────────────────────────

const TYPE_ICONS: Record<ChainDocType, React.ElementType> = {
  PR1:      ClipboardList,
  RFQ:      Search,
  PR2:      FileText,
  PO:       ShoppingCart,
  Delivery: Truck,
  GRN:      PackageCheck,
};

const TYPE_LABELS: Record<ChainDocType, string> = {
  PR1:      'Purchase Request',
  RFQ:      'Request for Quotation',
  PR2:      'Purchase Memo',
  PO:       'Purchase Order',
  Delivery: 'Delivery',
  GRN:      'Goods Receipt',
};

// ── Component ─────────────────────────────────────────────────────────────────

interface RelatedRecordsProps {
  baseType: ChainDocType;
  baseId: string;
  role: AppRole;
  currentDocType?: ChainDocType;
  compact?: boolean;
}

export default function RelatedRecords({ baseType, baseId, role, currentDocType, compact = false }: RelatedRecordsProps) {
  // Only approver-level roles can view the Related Records section
  if (!canViewRelatedRecords(role)) {
    return null;
  }

  const [chain, setChain] = useState<DocumentChain | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDocumentChain(baseType, baseId).then(c => {
      if (!cancelled) setChain(c);
    });
    return () => { cancelled = true; };
  }, [baseType, baseId]);

  // Filter to role-visible docs only
  const visible = chain?.filter(doc => isDocVisibleForRole(doc.type, role)) ?? [];

  // If nothing visible, don't render the section at all
  if (chain !== null && visible.length === 0) return null;

  return (
    <div className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden">
      <div className={compact ? 'px-3 py-2 border-b border-[#D8E2FF] bg-[#F7F9FC]' : 'px-5 py-3.5 border-b border-[#D8E2FF] bg-[#F7F9FC]'}>
        <h2 className="text-[10px] font-semibold text-[#40527A] uppercase tracking-wide">Related Records</h2>
      </div>

      {chain === null ? (
        <div className={compact ? 'px-3 py-2 flex items-center gap-2' : 'px-5 py-4 flex items-center gap-2'}>
          <span className="w-3 h-3 border-2 border-[#D8E2FF] border-t-[#40527A] rounded-full animate-spin shrink-0" />
          <span className="text-[10px] text-[#BFC7D5]">Loading chain...</span>
        </div>
      ) : (
        <div className="divide-y divide-[#D8E2FF]">
          {visible.map((doc, idx) => (
            <ChainRow
              key={doc.type}
              doc={doc}
              isCurrent={doc.type === currentDocType}
              isLast={idx === visible.length - 1}
              compact={compact}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChainRow({ doc, isCurrent, isLast, compact = false }: { doc: ChainDoc; isCurrent: boolean; isLast: boolean; compact?: boolean }) {
  const Icon = TYPE_ICONS[doc.type];

  const rowBase = compact
    ? `flex items-center gap-2 px-3 py-1.5 text-xs transition ${isCurrent ? 'bg-[#F0F4FF]' : 'hover:bg-[#F7F9FC]'}`
    : `flex items-center gap-3 px-5 py-3 text-xs transition ${isCurrent ? 'bg-[#F0F4FF]' : 'hover:bg-[#F7F9FC]'}`;

  const inner = (
    <>
      {/* Icon + type label */}
      <div className={`flex items-center gap-1.5 shrink-0 ${compact ? 'w-32' : 'w-40'}`}>
        <Icon className={`w-3 h-3 shrink-0 ${isCurrent ? 'text-[#1E4BFF]' : doc.exists ? 'text-[#40527A]' : 'text-[#BFC7D5]'}`} />
        <span className={`font-semibold uppercase tracking-wide text-[10px] ${isCurrent ? 'text-[#1E4BFF]' : doc.exists ? 'text-[#40527A]' : 'text-[#BFC7D5]'}`}>
          {TYPE_LABELS[doc.type]}
        </span>
      </div>

      {/* Document number */}
      <div className="flex-1 min-w-0">
        {doc.exists && doc.document_number ? (
          <span className="font-mono font-medium text-xs text-[#0F1F3A]">
            {doc.document_number}
          </span>
        ) : doc.exists ? (
          <span className="text-xs text-[#40527A]">View record</span>
        ) : (
          <span className="text-[10px] text-[#BFC7D5] italic">Not yet created</span>
        )}
      </div>

      {/* Status badge */}
      <div className="shrink-0">
        {doc.exists && doc.status ? (
          <DocumentStatusChip docType={doc.type} status={doc.status} />
        ) : doc.exists ? (
          <span className="text-[10px] text-[#BFC7D5]">—</span>
        ) : null}
      </div>

      {/* Arrow indicator for linked rows */}
      {doc.exists && doc.route && !isCurrent && (
        <ChevronRight className="w-3 h-3 text-[#BFC7D5] shrink-0" />
      )}
      {isCurrent && (
        <span className="text-[10px] text-[#1E4BFF] font-medium shrink-0">Current</span>
      )}
    </>
  );

  if (doc.exists && doc.route && !isCurrent) {
    return (
      <Link href={doc.route} className={rowBase}>
        {inner}
      </Link>
    );
  }

  return <div className={rowBase}>{inner}</div>;
}
