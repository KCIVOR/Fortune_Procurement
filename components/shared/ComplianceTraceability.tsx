'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GitBranch, ChevronRight } from 'lucide-react';
import {
  fetchComplianceTraceability,
  type ComplianceAnchor,
  type ComplianceTraceRow,
} from '@/lib/compliance-traceability';
import type { AppRole } from '@/types/auth';

interface Props {
  anchor: ComplianceAnchor;
  role:   AppRole;
  /** When true, omit panel if empty after load */
  hideIfEmpty?: boolean;
}

export default function ComplianceTraceability({ anchor, role, hideIfEmpty = true }: Props) {
  const [rows, setRows] = useState<ComplianceTraceRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchComplianceTraceability(anchor, role).then(r => {
      if (!cancelled) setRows(r);
    });
    return () => { cancelled = true; };
  }, [anchor, role]);

  if (rows === null) {
    return (
      <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center gap-2">
          <GitBranch className="w-3.5 h-3.5 text-pq-neutral-500" />
          <h2 className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide">
            Compliance traceability
          </h2>
        </div>
        <div className="px-5 py-4 flex items-center gap-2">
          <span className="w-3 h-3 border-2 border-pq-neutral-200 border-t-[#40527A] rounded-full animate-spin shrink-0" />
          <span className="text-xs text-pq-neutral-400">Loading links…</span>
        </div>
      </div>
    );
  }

  if (hideIfEmpty && rows.length === 0) return null;

  return (
    <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-pq-neutral-200 bg-pq-neutral-50 flex items-center gap-2">
        <GitBranch className="w-3.5 h-3.5 text-pq-neutral-500" />
        <h2 className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide">
          Compliance traceability
        </h2>
        <span className="text-[10px] text-pq-neutral-400 ml-auto normal-case font-normal">
          Accreditation · Products · RSE · TSQA
        </span>
      </div>
      <div className="divide-y divide-pq-neutral-200">
        {rows.map(row => (
          <TraceRow key={row.key} row={row} />
        ))}
      </div>
    </div>
  );
}

function TraceRow({ row }: { row: ComplianceTraceRow }) {
  const inner = (
    <div className="flex items-start gap-3 px-5 py-3 text-xs hover:bg-pq-neutral-50 transition">
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-pq-neutral-500 uppercase tracking-wide text-[10px]">{row.label}</p>
        {row.detail && <p className="text-sm text-pq-neutral-900 mt-0.5 truncate">{row.detail}</p>}
        {row.status && (
          <p className="text-[10px] text-pq-neutral-400 mt-0.5 capitalize">Status: {row.status.replace(/_/g, ' ')}</p>
        )}
        {row.hint && <p className="text-[10px] text-pq-neutral-500 mt-1.5 leading-snug">{row.hint}</p>}
      </div>
      {row.href ? (
        <ChevronRight className="w-3.5 h-3.5 text-pq-neutral-400 shrink-0 mt-1" />
      ) : null}
    </div>
  );

  if (row.href) {
    return <Link href={row.href} className="block">{inner}</Link>;
  }
  return <div className="block">{inner}</div>;
}
