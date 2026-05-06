'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchPR2ById } from '@/lib/pr2';
import { fetchPR2ApprovalDetail } from '@/lib/pr2-approvals';
import type { PR2WithItems } from '@/types/pr2';
import type { PR2ApprovalDetail, ApprovalActionRecord, WorkflowStep } from '@/types/approvals';
import { format } from 'date-fns';

interface SignatureSlot {
  label: string;
  hint: string;
  action: ApprovalActionRecord | null;
}

function buildPhase1Slots(
  steps: WorkflowStep[],
  actions: ApprovalActionRecord[]
): SignatureSlot[] {
  const labels = ['Prepared By', 'Certified By', 'Reviewed By', 'Approved By'];
  return steps
    .sort((a, b) => a.step_order - b.step_order)
    .map((step, idx) => ({
      label: labels[idx] ?? `Step ${step.step_order}`,
      hint: step.position_required,
      action: actions.find(a => a.step_order === step.step_order && a.action === 'approved') ?? null,
    }));
}

function buildPhase2Slots(
  steps: WorkflowStep[],
  actions: ApprovalActionRecord[]
): SignatureSlot[] {
  const labels = ['Prepared By', 'Reviewed By', 'Approved By'];
  return steps
    .sort((a, b) => a.step_order - b.step_order)
    .map((step, idx) => ({
      label: labels[idx] ?? `Step ${step.step_order}`,
      hint: step.position_required,
      action: actions.find(a => a.step_order === step.step_order && a.action === 'approved') ?? null,
    }));
}

function SignatureCell({ slot, width }: { slot: SignatureSlot; width: string }) {
  return (
    <td style={{ width, border: '1px solid #000', borderTop: 'none', padding: '6px 8px', fontSize: 9, verticalAlign: 'top' }}>
      <div style={{ fontWeight: 'bold', marginBottom: 2 }}>{slot.label}:</div>
      <div style={{ fontSize: 8, color: '#666', marginBottom: slot.action ? 4 : 18 }}>{slot.hint}</div>
      {slot.action ? (
        <div style={{ borderTop: '1px solid #000', paddingTop: 3 }}>
          <div style={{ fontWeight: 'bold', fontSize: 9 }}>{slot.action.actor_name_snapshot}</div>
          <div style={{ fontSize: 8, color: '#333' }}>{slot.action.actor_position_snapshot}</div>
          <div style={{ fontSize: 7, color: '#666', marginTop: 1 }}>
            {format(new Date(slot.action.acted_at), 'MM/dd/yyyy hh:mm a')}
          </div>
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
  const [pr2, setPR2] = useState<PR2WithItems | null>(null);
  const [detail, setDetail] = useState<PR2ApprovalDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function load() {
      const [pr2Data] = await Promise.all([
        fetchPR2ById(id as string),
      ]);
      setPR2(pr2Data);

      // Fetch approval detail — we need any instance id for this PR2.
      // We do it by querying the first active or approved instance via approval detail.
      // Since fetchPR2ApprovalDetail needs an instanceId, we'll use a direct supabase call
      // from within the pr2 detail fetch, but we don't have that here.
      // Instead, expose a helper that fetches by pr2_id.
      // For now, try fetching phase detail via the pr2's own approval instance lookup.
      if (pr2Data) {
        try {
          const { supabase } = await import('@/lib/supabase');
          const db = supabase as any;
          const { data: inst } = await db
            .from('approval_instances')
            .select('id')
            .eq('document_type', 'PR2')
            .eq('document_id', id)
            .order('started_at', { ascending: true })
            .limit(1)
            .maybeSingle();

          if (inst?.id) {
            const approvalData = await fetchPR2ApprovalDetail(inst.id);
            setDetail(approvalData);
          }
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
        <p className="text-sm text-[#40527A]">Preparing print view...</p>
      </div>
    );
  }

  if (!pr2) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-[#40527A]">PR2 not found.</p>
      </div>
    );
  }

  const MINIMUM_ROWS = 10;
  const paddedItems = [
    ...pr2.items,
    ...Array(Math.max(0, MINIMUM_ROWS - pr2.items.length)).fill(null),
  ];

  const grandTotal = pr2.items.reduce(
    (sum, item) => sum + Number(item.unit_price) * Number(item.quantity_to_purchase),
    0
  );

  // Build signature slots from fetched detail, or fallback to static hints
  const phase1Slots: SignatureSlot[] = detail
    ? buildPhase1Slots(detail.phase1_steps, detail.phase1_actions)
    : [
        { label: 'Prepared By', hint: 'Procurement Staff', action: null },
        { label: 'Certified By', hint: 'Department Head', action: null },
        { label: 'Reviewed By', hint: 'Procurement Manager', action: null },
        { label: 'Approved By', hint: 'Director', action: null },
      ];

  const phase2Slots: SignatureSlot[] = detail
    ? buildPhase2Slots(detail.phase2_steps, detail.phase2_actions)
    : [
        { label: 'Prepared By', hint: 'Buyer', action: null },
        { label: 'Reviewed By', hint: 'Procurement Manager', action: null },
        { label: 'Approved By', hint: 'Director', action: null },
      ];

  const phase2Started = detail ? detail.phase2_instance_id !== null : false;

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
      <div className="no-print fixed top-0 left-0 right-0 bg-[#0F1F3A] text-white px-6 py-3 flex items-center justify-between z-10">
        <span className="text-sm font-medium">Print Preview — {pr2.pr2_number}</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="text-xs text-[#BFC7D5] hover:text-white transition"
          >
            Back
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-xs font-semibold rounded-[4px] transition"
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
              </td>
              <td style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                <div style={{ fontSize: 14, fontWeight: 'bold', letterSpacing: 1 }}>PURCHASE REQUEST</div>
                <div style={{ fontSize: 8, marginTop: 2 }}>Canvass Slip / PR2</div>
                <div style={{ fontSize: 8, color: '#555' }}>Fortune Procurement Automation System</div>
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
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 5px', fontSize: 8, textAlign: 'right', width: 62 }}>Unit Price</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 5px', fontSize: 8, textAlign: 'right', width: 68 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {paddedItems.map((item, idx) => {
              const total = item
                ? Number(item.unit_price) * Number(item.quantity_to_purchase)
                : 0;
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
                  <td style={{ border: '1px solid #000', borderTop: 'none', padding: '2px 5px', fontSize: 8, textAlign: 'right' }}>
                    {item ? `₱${Number(item.unit_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : ''}
                  </td>
                  <td style={{ border: '1px solid #000', borderTop: 'none', padding: '2px 5px', fontSize: 8, textAlign: 'right', fontWeight: item ? 'bold' : 'normal' }}>
                    {item ? `₱${total.toLocaleString('en-PH', { minimumFractionDigits: 2 })}` : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <td colSpan={10} style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9, textAlign: 'right', fontWeight: 'bold' }}>
                Grand Total
              </td>
              <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9, textAlign: 'right', fontWeight: 'bold' }}>
                ₱{grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* ── Phase 1 Signature Block ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: 'none', marginTop: 0 }}>
          <tbody>
            <tr>
              <td colSpan={4} style={{ border: '1px solid #000', borderTop: 'none', padding: '3px 8px', fontSize: 8, fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>
                PHASE 1 APPROVAL
              </td>
            </tr>
            <tr>
              {phase1Slots.map((slot, i) => (
                <SignatureCell key={i} slot={slot} width="25%" />
              ))}
              {/* Pad to 4 cells if fewer steps */}
              {phase1Slots.length < 4 && Array(4 - phase1Slots.length).fill(null).map((_, i) => (
                <td key={`pad-${i}`} style={{ width: '25%', border: '1px solid #000', borderTop: 'none' }} />
              ))}
            </tr>
          </tbody>
        </table>

        {/* ── Phase 2 Signature Block ── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: 'none', marginTop: 0 }}>
          <tbody>
            <tr>
              <td colSpan={3} style={{ border: '1px solid #000', borderTop: 'none', padding: '3px 8px', fontSize: 8, fontWeight: 'bold', backgroundColor: '#f0f0f0' }}>
                PHASE 2 APPROVAL{!phase2Started ? ' — Not yet started' : ''}
              </td>
            </tr>
            <tr>
              {phase2Slots.map((slot, i) => (
                <SignatureCell key={i} slot={slot} width="33.33%" />
              ))}
              {phase2Slots.length < 3 && Array(3 - phase2Slots.length).fill(null).map((_, i) => (
                <td key={`pad-${i}`} style={{ width: '33.33%', border: '1px solid #000', borderTop: 'none' }} />
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
          Printed: {format(new Date(), 'MM/dd/yyyy hh:mm a')} · Fortune Procurement Automation System · PR2-v1
        </div>
      </div>
    </>
  );
}
