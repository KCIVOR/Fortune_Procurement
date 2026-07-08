'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { fetchPR2ById, calcPR2VatBreakdown } from '@/lib/pr2';
import { canViewCommercialPricing, formatCommercialAmount } from '@/lib/price-visibility';
import { fetchPR2ApprovalDetailByPR2Id } from '@/lib/pr2-approvals';
import { labelForApprovalAction, latestActionForStep } from '@/lib/print-approval-signatures';
import type { PR2WithItems } from '@/types/pr2';
import type { PR2ApprovalDetail, ApprovalActionRecord, WorkflowStep } from '@/types/approvals';
import { format } from 'date-fns';

interface SignatureSlot {
  label: string;
  hint: string;
  action: ApprovalActionRecord | null;
}

// Labels come from each workflow step's own action_label so the print stays
// correct if the workflow is ever restructured (a stale hardcoded label array
// previously mislabeled cells after the workflow was reduced to 3 steps).
function buildSignatureSlots(
  steps: WorkflowStep[],
  actions: ApprovalActionRecord[]
): SignatureSlot[] {
  return [...steps]
    .sort((a, b) => a.step_order - b.step_order)
    .map((step) => ({
      label: step.action_label || `Step ${step.step_order}`,
      hint: step.position_required,
      action: latestActionForStep(actions, step.step_order),
    }));
}

function SignatureCell({ slot, width }: { slot: SignatureSlot; width: string }) {
  const action = slot.action;
  const statusColor =
    action?.action === 'rejected'
      ? '#b91c1c'
      : action?.action === 'revision_requested'
        ? '#b45309'
        : '#166534';

  return (
    <td style={{ width, border: '1px solid #000', borderTop: 'none', padding: '6px 8px', fontSize: 9, verticalAlign: 'top' }}>
      <div style={{ fontWeight: 'bold', marginBottom: 2 }}>{slot.label}:</div>
      <div style={{ fontSize: 8, color: '#666', marginBottom: action ? 4 : 18 }}>{slot.hint}</div>
      {action ? (
        <div style={{ borderTop: '1px solid #000', paddingTop: 3 }}>
          {action.action !== 'approved' && (
            <div style={{ fontWeight: 'bold', fontSize: 8, color: statusColor, marginBottom: 2 }}>
              {labelForApprovalAction(action.action)}
            </div>
          )}
          <div style={{ fontWeight: 'bold', fontSize: 9 }}>{action.actor_name_snapshot}</div>
          <div style={{ fontSize: 8, color: '#333' }}>{action.actor_position_snapshot}</div>
          <div style={{ fontSize: 7, color: '#666', marginTop: 1 }}>
            {format(new Date(action.acted_at), 'MM/dd/yyyy hh:mm a')}
          </div>
          {action.remarks && (
            <div style={{ fontSize: 7, color: '#555', marginTop: 2, fontStyle: 'italic' }}>
              {action.remarks}
            </div>
          )}
        </div>
      ) : (
        <div style={{ borderTop: '1px solid #000', paddingTop: 3, color: '#999', fontStyle: 'italic', fontSize: 8 }}>
          Pending
        </div>
      )}
    </td>
  );
}

export default function PR2PrintPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [pr2, setPR2] = useState<PR2WithItems | null>(null);
  const [detail, setDetail] = useState<PR2ApprovalDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function load() {
      const pr2Data = await fetchPR2ById(id as string);
      setPR2(pr2Data);

      if (pr2Data) {
        try {
          const approvalData = await fetchPR2ApprovalDetailByPR2Id(id as string);
          setDetail(approvalData);
        } catch {
          // approval detail not critical for print — show pending if unavailable
        }
      }
    }

    load().finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading && pr2) {
      setTimeout(() => window.print(), 300);
    }
  }, [loading, pr2]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-pq-neutral-500">Preparing print view...</p>
      </div>
    );
  }

  if (!pr2) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-pq-neutral-500">PR2 not found.</p>
      </div>
    );
  }

  const MINIMUM_ROWS = 10;
  const paddedItems = [
    ...pr2.items,
    ...Array(Math.max(0, MINIMUM_ROWS - pr2.items.length)).fill(null),
  ];

  const canViewPrices = canViewCommercialPricing(profile);
  const vatBreakdown = canViewPrices ? calcPR2VatBreakdown(pr2.items) : null;

  // Build signature slots from fetched detail, or fallback to static hints
  // matching the current single-phase PR2 workflow.
  const signatureSlots: SignatureSlot[] = detail
    ? buildSignatureSlots(detail.phase1_steps, detail.phase1_actions)
    : [
        { label: 'Prepared By', hint: 'Procurement Staff', action: null },
        { label: 'Reviewed By', hint: 'Procurement Manager', action: null },
        { label: 'Approved By', hint: 'Director', action: null },
      ];
  const slotWidth = `${(100 / Math.max(signatureSlots.length, 1)).toFixed(2)}%`;

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm 12mm 12mm 12mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body { font-family: Arial, sans-serif; font-size: 10px; color: #000; background: #fff; }
      `}</style>

      {/* Print toolbar */}
      <div className="no-print fixed top-0 left-0 right-0 bg-pq-neutral-900 text-white px-6 py-3 flex items-center justify-between z-10">
        <span className="text-sm font-medium">Print Preview — {pr2.pr2_number}</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="text-xs text-pq-neutral-400 hover:text-white transition"
          >
            ← Back
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-xs font-semibold rounded-md transition"
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      <div className="no-print pt-12" />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 0' }}>

        {/* ── Document Header ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '18%', border: '1px solid #000', padding: '6px 8px', verticalAlign: 'middle', textAlign: 'center' }}>
                <div style={{ fontWeight: 'bold', fontSize: 8, lineHeight: 1.15 }}>Fortune Packaging Corporation</div>
                <div style={{ fontSize: 6, lineHeight: 1.2, marginTop: 2, color: '#555' }}>
                  Severina Industrial Subdivision, 20 Main Avenue, Km 16 South Luzon Expy, Parañaque, 1700 Metro Manila
                </div>
                <div style={{ fontSize: 6, color: '#555' }}>
                  Tel: (02) 8823 6333
                </div>
              </td>
              <td style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                <div style={{ fontSize: 14, fontWeight: 'bold', letterSpacing: 1 }}>PURCHASE REQUEST</div>
                <div style={{ fontSize: 8, marginTop: 2 }}>Canvass Slip / PR2</div>
                <div style={{ fontSize: 8, color: '#555' }}>Fortune Procurement System</div>
              </td>
              <td style={{ width: '24%', border: '1px solid #000', padding: '5px 8px', verticalAlign: 'top', fontSize: 9 }}>
                <div style={{ marginBottom: 3 }}>
                  <span style={{ fontWeight: 'bold' }}>Form No.:</span> PR2-v1
                </div>
                <div style={{ marginBottom: 3 }}>
                  <span style={{ fontWeight: 'bold' }}>PR2 No.:</span>{' '}
                  <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{pr2.pr2_number}</span>
                </div>
                <div style={{ marginBottom: 3 }}>
                  <span style={{ fontWeight: 'bold' }}>PR1 Ref.:</span>{' '}
                  <span style={{ fontFamily: 'monospace' }}>{pr2.pr1_number_snapshot}</span>
                </div>
                <div>
                  <span style={{ fontWeight: 'bold' }}>RFQ Ref.:</span>{' '}
                  <span style={{ fontFamily: 'monospace' }}>{pr2.rfq_number_snapshot}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Subheader info ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: 'none' }}>
          <tbody>
            <tr>
              <td style={{ width: '45%', border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9 }}>
                <span style={{ fontWeight: 'bold' }}>Requisitioner:</span>{' '}
                {pr2.requisitioner_name_snapshot}
              </td>
              <td style={{ width: '30%', border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9 }}>
                <span style={{ fontWeight: 'bold' }}>Department:</span>{' '}
                {pr2.department_name_snapshot}
              </td>
              <td style={{ width: '25%', border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9 }}>
                <span style={{ fontWeight: 'bold' }}>Date Required:</span>{' '}
                {format(new Date(pr2.date_required), 'MM/dd/yyyy')}
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9 }}>
                <span style={{ fontWeight: 'bold' }}>Purpose:</span>{' '}
                {pr2.purpose}
              </td>
              <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9 }}>
                <span style={{ fontWeight: 'bold' }}>Generated:</span>{' '}
                {format(new Date(pr2.generated_at), 'MM/dd/yyyy')}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Items table ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: 'none' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 5px', fontSize: 8, textAlign: 'center', width: 22 }}>No.</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 5px', fontSize: 8, textAlign: 'center', width: 55 }}>Item Code</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 5px', fontSize: 8, textAlign: 'left' }}>Description</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 5px', fontSize: 8, textAlign: 'center', width: 40 }}>Unit</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 5px', fontSize: 8, textAlign: 'center', width: 44 }}>Req. Qty</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 5px', fontSize: 8, textAlign: 'center', width: 38 }}>SOH</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 5px', fontSize: 8, textAlign: 'center', width: 44 }}>In-Transit</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 5px', fontSize: 8, textAlign: 'center', width: 44 }}>To Buy</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 5px', fontSize: 8, textAlign: 'left', width: 90 }}>Supplier</th>
              {canViewPrices ? (
                <>
                  <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 5px', fontSize: 8, textAlign: 'right', width: 62 }}>Unit Price</th>
                  <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 5px', fontSize: 8, textAlign: 'right', width: 68 }}>Total</th>
                </>
              ) : (
                <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 5px', fontSize: 8, textAlign: 'center', width: 68 }}>Pricing</th>
              )}
            </tr>
          </thead>
          <tbody>
            {paddedItems.map((item, idx) => {
              const total = item ? Number(item.total_price) : 0;
              return (
                <tr key={idx} style={{ height: 20 }}>
                  <td style={{ border: '1px solid #000', borderTop: 'none', padding: '2px 5px', fontSize: 8, textAlign: 'center' }}>
                    {item ? idx + 1 : ''}
                  </td>
                  <td style={{ border: '1px solid #000', borderTop: 'none', padding: '2px 5px', fontSize: 8, fontFamily: 'monospace', textAlign: 'center' }}>
                    {item?.item_code || ''}
                  </td>
                  <td style={{ border: '1px solid #000', borderTop: 'none', padding: '2px 5px', fontSize: 8 }}>
                    {item?.description || ''}
                    {item?.is_alternative && (
                      <span style={{ marginLeft: 4, fontSize: 7, color: '#b45309' }}>[Alt]</span>
                    )}
                    {item?.is_raw_material && (
                      <span style={{ marginLeft: 4, fontSize: 7, color: '#1e40af', fontWeight: 'bold' }}>[RAW]</span>
                    )}
                    {item?.quote_justification && (
                      <div style={{ marginTop: 2, fontSize: 7, color: '#92400e', fontStyle: 'italic' }}>
                        Justification: {item.quote_justification}
                      </div>
                    )}
                    {item?.pr1_remarks_snapshot && (
                      <div style={{ marginTop: 2, fontSize: 7, color: '#555', fontStyle: 'italic' }}>
                        Requestor remarks: {item.pr1_remarks_snapshot}
                      </div>
                    )}
                  </td>
                  <td style={{ border: '1px solid #000', borderTop: 'none', padding: '2px 5px', fontSize: 8, textAlign: 'center' }}>
                    {item?.unit_of_measure || ''}
                  </td>
                  <td style={{ border: '1px solid #000', borderTop: 'none', padding: '2px 5px', fontSize: 8, textAlign: 'right' }}>
                    {item ? Number(item.quantity_requested).toLocaleString() : ''}
                  </td>
                  <td style={{ border: '1px solid #000', borderTop: 'none', padding: '2px 5px', fontSize: 8, textAlign: 'right' }}>
                    {item ? Number(item.qty_on_hand).toLocaleString() : ''}
                  </td>
                  <td style={{ border: '1px solid #000', borderTop: 'none', padding: '2px 5px', fontSize: 8, textAlign: 'right' }}>
                    {item ? Number(item.qty_incoming).toLocaleString() : ''}
                  </td>
                  <td style={{ border: '1px solid #000', borderTop: 'none', padding: '2px 5px', fontSize: 8, textAlign: 'right', fontWeight: item ? 'bold' : 'normal' }}>
                    {item ? Number(item.quantity_to_purchase).toLocaleString() : ''}
                  </td>
                  <td style={{ border: '1px solid #000', borderTop: 'none', padding: '2px 5px', fontSize: 8 }}>
                    {item?.supplier_name_snapshot || ''}
                  </td>
                  {canViewPrices ? (
                    <>
                      <td style={{ border: '1px solid #000', borderTop: 'none', padding: '2px 5px', fontSize: 8, textAlign: 'right' }}>
                        {item ? formatCommercialAmount(Number(item.unit_price), true) : ''}
                      </td>
                      <td style={{ border: '1px solid #000', borderTop: 'none', padding: '2px 5px', fontSize: 8, textAlign: 'right', fontWeight: item ? 'bold' : 'normal' }}>
                        {item ? formatCommercialAmount(total, true) : ''}
                      </td>
                    </>
                  ) : (
                    <td style={{ border: '1px solid #000', borderTop: 'none', padding: '2px 5px', fontSize: 8, textAlign: 'center', color: '#94a3b8' }}>
                      {item ? formatCommercialAmount(0, false) : ''}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          {canViewPrices && vatBreakdown && (
            <tfoot>
              {vatBreakdown.vatAmount > 0 && (
                <>
                  <tr>
                    <td colSpan={10} style={{ border: '1px solid #000', borderTop: 'none', padding: '3px 8px', fontSize: 8, textAlign: 'right' }}>
                      Subtotal
                    </td>
                    <td style={{ border: '1px solid #000', borderTop: 'none', padding: '3px 8px', fontSize: 8, textAlign: 'right' }}>
                      {formatCommercialAmount(vatBreakdown.subtotal, true)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={10} style={{ border: '1px solid #000', borderTop: 'none', padding: '3px 8px', fontSize: 8, textAlign: 'right' }}>
                      VAT
                    </td>
                    <td style={{ border: '1px solid #000', borderTop: 'none', padding: '3px 8px', fontSize: 8, textAlign: 'right' }}>
                      {formatCommercialAmount(vatBreakdown.vatAmount, true)}
                    </td>
                  </tr>
                </>
              )}
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <td colSpan={10} style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9, textAlign: 'right', fontWeight: 'bold' }}>
                  Grand Total
                </td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9, textAlign: 'right', fontWeight: 'bold' }}>
                  {formatCommercialAmount(vatBreakdown.total, true)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* ── Signature Block (single-phase PR2 approval) ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: 'none', marginTop: 0 }}>
          <tbody>
            <tr>
              <td colSpan={signatureSlots.length} style={{ border: '1px solid #000', borderTop: 'none', padding: '3px 8px', fontSize: 8, fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>
                APPROVAL
              </td>
            </tr>
            <tr>
              {signatureSlots.map((slot, i) => (
                <SignatureCell key={i} slot={slot} width={slotWidth} />
              ))}
            </tr>
          </tbody>
        </table>

        {/* ── Remarks ── */}
        {pr2.remarks && (
          <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: 'none', marginTop: 0 }}>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9 }}>
                  <span style={{ fontWeight: 'bold' }}>Remarks:</span>{' '}
                  {pr2.remarks}
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Footer */}
        <div style={{ fontSize: 8, color: '#888', textAlign: 'right', marginTop: 6 }}>
          Printed: {format(new Date(), 'MM/dd/yyyy hh:mm a')} · Fortune Procurement System · PR2-v1
        </div>
      </div>
    </>
  );
}
