export type DocumentType = 'PR1' | 'RFQ' | 'PR2' | 'PO' | 'Delivery' | 'GRN';

export type DocumentStatusUI = {
  label: string;
  /**
   * Tailwind classes intended for a small status pill.
   * Notes:
   * - RelatedRecords uses bg+text only (no border, no dot).
   * - Some detail pages use bordered pills and sometimes different hues.
   */
  className: string;
};

export type ApprovalInstanceStatusUI = {
  label: string;
  className: string;
  /**
   * Whether the badge uses a pulsing dot indicator (instance "active" only today).
   * Consumers decide how to render it.
   */
  pulseDot?: boolean;
  /**
   * Icon name hint (current UI uses lucide icons). Consumers decide rendering.
   */
  icon?: 'check' | 'x' | 'rotate';
};

/**
 * Centralized status display mapping.
 *
 * IMPORTANT:
 * - Mapping ONLY. No business semantics are decided here.
 * - Status strings are preserved exactly as they appear in current UI.
 * - Where conflicts exist across UI surfaces, we keep the mapping used in the
 *   document-chain context (RelatedRecords), and leave TODO notes so the later
 *   normalization work can keep surface-specific styling if needed.
 */

// ---------------------------------------------------------------------------
// Document status UI (source of truth: components/shared/RelatedRecords.tsx)
// ---------------------------------------------------------------------------

const DOCUMENT_STATUS_UI: Partial<Record<DocumentType, Record<string, DocumentStatusUI>>> = {
  PR1: {
    draft:                  { label: 'Draft', className: 'bg-[#F7F9FC] text-[#40527A]' },
    pending_approval:       { label: 'Pending Approval', className: 'bg-amber-50 text-amber-700' },
    approved_for_warehouse: { label: 'Approved — Awaiting Warehouse', className: 'bg-blue-50 text-blue-700' },
    pending_warehouse:      { label: 'Pending Warehouse', className: 'bg-amber-50 text-amber-700' },
    resolved_internal:      { label: 'Resolved Internally', className: 'bg-teal-50 text-teal-700' },
    revision_requested:     { label: 'Needs Revision', className: 'bg-orange-50 text-orange-700' },
    for_canvassing:         { label: 'For Canvassing', className: 'bg-sky-50 text-sky-700' },
    canvassing_complete:    { label: 'Canvassing Complete', className: 'bg-sky-50 text-sky-700' },
    pr2_pending_approval:   { label: 'PR2 Pending Approval', className: 'bg-amber-50 text-amber-700' },
    pr2_approved:           { label: 'PR2 Approved — Ready for RFQ', className: 'bg-sky-50 text-sky-700' },
    approved:               { label: 'Approved', className: 'bg-emerald-50 text-emerald-700' },
    completed:              { label: 'Completed', className: 'bg-emerald-50 text-emerald-700' },
    rejected:               { label: 'Rejected', className: 'bg-red-50 text-red-600' },
    cancelled:              { label: 'Cancelled', className: 'bg-[#F7F9FC] text-[#BFC7D5]' },
  },

  RFQ: {
    open:   { label: 'Open', className: 'bg-amber-50 text-amber-700' },
    closed: { label: 'Closed', className: 'bg-emerald-50 text-emerald-700' },
  },

  PR2: {
    draft:              { label: 'Draft', className: 'bg-[#F7F9FC] text-[#40527A]' },
    pending_approval:   { label: 'Pending Approval', className: 'bg-amber-50 text-amber-700' },
    approved:           { label: 'Approved', className: 'bg-emerald-50 text-emerald-700' },
    revision_requested: { label: 'Needs Revision', className: 'bg-orange-50 text-orange-700' },
    rejected:           { label: 'Rejected', className: 'bg-red-50 text-red-600' },
    cancelled:          { label: 'Cancelled', className: 'bg-red-50 text-red-600' },
  },

  PO: {
    for_approval: { label: 'For Approval', className: 'bg-amber-50 text-amber-700' },
    // TODO(conflict): RelatedRecords uses sky for sent; PO detail page uses blue.
    sent:         { label: 'Sent to Supplier', className: 'bg-sky-50 text-sky-700' },
    approved:     { label: 'Approved', className: 'bg-emerald-50 text-emerald-700' },
    draft:        { label: 'Draft', className: 'bg-[#F7F9FC] text-[#40527A]' },
    revision_requested: { label: 'Needs Revision', className: 'bg-orange-50 text-orange-700' },
    rejected:     { label: 'Rejected', className: 'bg-red-50 text-red-600' },
    cancelled:    { label: 'Cancelled', className: 'bg-red-50 text-red-600' },
  },

  Delivery: {
    pending:     { label: 'Pending', className: 'bg-[#F7F9FC] text-[#40527A]' },
    scheduled:   { label: 'Scheduled', className: 'bg-sky-50 text-sky-700' },
    in_transit:  { label: 'In Transit', className: 'bg-amber-50 text-amber-700' },
    delayed:     { label: 'Delayed', className: 'bg-red-50 text-red-600' },
    delivered:   { label: 'Delivered', className: 'bg-emerald-50 text-emerald-700' },
  },

  GRN: {
    open:        { label: 'Open', className: 'bg-amber-50 text-amber-700' },
    pending_qa:  { label: 'Pending QA', className: 'bg-sky-50 text-sky-700' },
    closed:      { label: 'Closed', className: 'bg-emerald-50 text-emerald-700' },
  },
};

export function getDocumentStatusUI(docType: DocumentType, status: string | null | undefined): DocumentStatusUI | null {
  if (!status) return null;
  const byType = DOCUMENT_STATUS_UI[docType];
  if (!byType) return { label: status, className: 'bg-[#F7F9FC] text-[#40527A]' };
  return byType[status] ?? { label: status, className: 'bg-[#F7F9FC] text-[#40527A]' };
}

// ---------------------------------------------------------------------------
// Approval instance status UI (source of truth: InstanceStatusBadge in app/approvals/[id]/page.tsx)
// ---------------------------------------------------------------------------

const APPROVAL_INSTANCE_STATUS_UI: Record<string, ApprovalInstanceStatusUI> = {
  active: {
    label: 'Pending Approval',
    className: 'text-[#0F1F3A] bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px]',
    pulseDot: true,
  },
  approved: {
    label: 'Approved',
    className: 'text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full',
    icon: 'check',
  },
  rejected: {
    label: 'Rejected',
    className: 'text-red-700 bg-red-50 border border-red-200 rounded-full',
    icon: 'x',
  },
  // Note: current UI treats any other instance status as "Revision Requested".
  revision_requested: {
    label: 'Revision Requested',
    className: 'text-orange-700 bg-orange-50 border border-orange-200 rounded-full',
    icon: 'rotate',
  },
};

export function getApprovalInstanceStatusUI(status: string | null | undefined): ApprovalInstanceStatusUI | null {
  if (!status) return null;
  return APPROVAL_INSTANCE_STATUS_UI[status] ?? APPROVAL_INSTANCE_STATUS_UI.revision_requested;
}

// ---------------------------------------------------------------------------
// Known conflicts (not resolved here)
// ---------------------------------------------------------------------------
/**
 * Conflicts observed in current UI (DO NOT "fix" here; preserve per-surface behavior):
 * - StatusChip.tsx uses different palette + always-dot behavior for generic variants.
 *   - TODO: if later we centralize StatusChip variants too, keep its dot semantics.
 * - PR2StatusBadge and POStatusBadge detail pages use bordered pills and sometimes
 *   different hues than RelatedRecords (e.g., PO sent).
 */

