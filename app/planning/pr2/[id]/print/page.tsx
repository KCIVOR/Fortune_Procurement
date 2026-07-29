'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchPR2ById } from '@/lib/pr2';
import { fetchPR2ApprovalDetailByPR2Id } from '@/lib/pr2-approvals';
import { labelForApprovalAction, latestActionForStep } from '@/lib/print-approval-signatures';
import type { PR2WithItems } from '@/types/pr2';
import { PR2_STATUS_LABELS } from '@/types/pr2';
import type { ApprovalActionRecord, PR2ApprovalDetail, WorkflowStep } from '@/types/approvals';
import { format } from 'date-fns';

function pr2StepOrders(steps: WorkflowStep[]) {
  const ordered = [...steps].sort((a, b) => a.step_order - b.step_order);
  const firstOrder = ordered[0]?.step_order ?? 1;
  const finalStep = ordered.find((s) => s.is_final) ?? ordered[ordered.length - 1];
  const finalOrder = finalStep?.step_order ?? 2;
  return { firstOrder, finalOrder };
}

function PR2ApproverSignatureBody({ action }: { action: ApprovalActionRecord | null }) {
  if (!action) {
    return (
      <div style={{ borderTop: '1px solid #000', paddingTop: 3, color: '#999', fontStyle: 'italic' }}>
        Pending
      </div>
    );
  }

  const statusLabel = labelForApprovalAction(action.action);
  const statusColor =
    action.action === 'rejected' ? '#b91c1c' : action.action === 'revision_requested' ? '#b45309' : '#166534';

  return (
    <div style={{ borderTop: '1px solid #000', paddingTop: 3 }}>
      {action.action !== 'approved' && (
        <div style={{ fontWeight: 'bold', color: statusColor, marginBottom: 2 }}>{statusLabel}</div>
      )}
      <div style={{ fontWeight: 'bold' }}>{action.actor_name_snapshot}</div>
      <div>{action.actor_position_snapshot}</div>
      <div style={{ fontSize: 8, color: '#555', marginTop: 2 }}>
        {format(new Date(action.acted_at), 'MM/dd/yyyy hh:mm a')}
      </div>
      {action.remarks && (
        <div style={{ fontSize: 8, color: '#555', marginTop: 3, fontStyle: 'italic' }}>
          {action.remarks}
        </div>
      )}
    </div>
  );
}

export default function RawMaterialPR2PrintPage() {
  const { id } = useParams<{ id: string }>();
  const [pr2, setPR2] = useState<PR2WithItems | null>(null);
  const [approvalDetail, setApprovalDetail] = useState<PR2ApprovalDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [pr2Row, approval] = await Promise.all([
        fetchPR2ById(id),
        fetchPR2ApprovalDetailByPR2Id(id).catch(() => null),
      ]);
      setPR2(pr2Row);
      setApprovalDetail(approval);
    })().finally(() => setLoading(false));
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

  if (!pr2 || (pr2.request_type !== 'raw_material' && pr2.request_type !== 'services')) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-pq-neutral-500">Request not found.</p>
      </div>
    );
  }

  const isServices = pr2.request_type === 'services';

  const MINIMUM_ROWS = 10;
  const paddedItems = [
    ...pr2.items,
    ...Array(Math.max(0, MINIMUM_ROWS - pr2.items.length)).fill(null),
  ];

  const { firstOrder, finalOrder } = approvalDetail
    ? pr2StepOrders(approvalDetail.phase1_steps)
    : { firstOrder: 1, finalOrder: 2 };
  const reviewedAction = approvalDetail ? latestActionForStep(approvalDetail.phase1_actions, firstOrder) : null;
  const approvedAction = approvalDetail ? latestActionForStep(approvalDetail.phase1_actions, finalOrder) : null;

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 15mm 15mm 15mm 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; }
      `}</style>

      {/* Print toolbar (hidden on print) */}
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

      {/* Print body */}
      <div className="no-print pt-12" />
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 0' }}>

        {/* Header */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
          <tbody>
            <tr>
              <td style={{ width: '20%', border: '1px solid #000', padding: '6px 8px', verticalAlign: 'middle' }}>
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 8, lineHeight: 1.15 }}>
                  Fortune Packaging Corporation
                </div>
                <div style={{ textAlign: 'center', fontSize: 6, lineHeight: 1.2, marginTop: 2, color: '#555' }}>
                  Severina Industrial Subdivision, 20 Main Avenue, Km 16 South Luzon Expy, Parañaque, 1700 Metro Manila
                </div>
                <div style={{ textAlign: 'center', fontSize: 6, color: '#555' }}>
                  Tel: (02) 8823 6333
                </div>
              </td>
              <td style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                <div style={{ fontSize: 15, fontWeight: 'bold', letterSpacing: 1 }}>
                  {isServices ? 'SERVICES REQUEST' : 'RAW MATERIAL REQUEST'}
                </div>
                <div style={{ fontSize: 9, marginTop: 2 }}>Fortune Procurement System</div>
              </td>
              <td style={{ width: '22%', border: '1px solid #000', padding: '4px 8px', verticalAlign: 'top', fontSize: 9 }}>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 'bold' }}>Form No.:</span> {isServices ? 'PR2-SV-v1' : 'PR2-RM-v1'}
                </div>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 'bold' }}>PR2 No.:</span>{' '}
                  <span style={{ fontFamily: 'monospace' }}>{pr2.pr2_number}</span>
                </div>
                <div>
                  <span style={{ fontWeight: 'bold' }}>Status:</span>{' '}
                  {PR2_STATUS_LABELS[pr2.status]}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Subheader info */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: 'none' }}>
          <tbody>
            <tr>
              <td style={{ width: '50%', border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9 }}>
                <span style={{ fontWeight: 'bold' }}>Requisitioner:</span>{' '}
                {pr2.requisitioner_name_snapshot}
              </td>
              <td style={{ width: '25%', border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9 }}>
                <span style={{ fontWeight: 'bold' }}>Department:</span>{' '}
                {pr2.department_name_snapshot}
              </td>
              <td style={{ width: '25%', border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9 }}>
                <span style={{ fontWeight: 'bold' }}>Date:</span>{' '}
                {format(new Date(pr2.created_at), 'MM/dd/yyyy')}
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9 }}>
                <span style={{ fontWeight: 'bold' }}>Purpose:</span>{' '}
                {pr2.purpose}
              </td>
              <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9 }}>
                <span style={{ fontWeight: 'bold' }}>Date Required:</span>{' '}
                {format(new Date(pr2.date_required), 'MM/dd/yyyy')}
              </td>
            </tr>
            {pr2.remarks && (
              <tr>
                <td colSpan={3} style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9 }}>
                  <span style={{ fontWeight: 'bold' }}>Remarks:</span>{' '}
                  {pr2.remarks}
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: 'none' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', fontSize: 9, textAlign: 'center', width: 28 }}>No.</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', fontSize: 9, textAlign: 'center', width: 80 }}>Item Code</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', fontSize: 9, textAlign: 'left' }}>Description</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', fontSize: 9, textAlign: 'center', width: 60 }}>Unit</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', fontSize: 9, textAlign: 'center', width: 70 }}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {paddedItems.map((item, idx) => (
              <tr key={idx} style={{ height: 22 }}>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '3px 6px', fontSize: 9, textAlign: 'center' }}>
                  {item ? idx + 1 : ''}
                </td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '3px 6px', fontSize: 9, fontFamily: 'monospace', textAlign: 'center' }}>
                  {item?.item_code || ''}
                </td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '3px 6px', fontSize: 9 }}>
                  <div>{item?.description || ''}</div>
                  {item?.remarks && (
                    <div style={{ fontSize: 7, color: '#555', marginTop: 2, fontStyle: 'italic', wordBreak: 'break-word' }}>
                      Remarks: {item.remarks}
                    </div>
                  )}
                  {item?.attachments && item.attachments.length > 0 && (
                    <div style={{ fontSize: 7, color: '#555', marginTop: 2 }}>
                      <span style={{ fontWeight: 'bold' }}>Attachments: </span>
                      {item.attachments.map((att: any) => att.file_name).join(', ')}
                    </div>
                  )}
                </td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '3px 6px', fontSize: 9, textAlign: 'center' }}>
                  {item?.unit_of_measure || ''}
                </td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '3px 6px', fontSize: 9, textAlign: 'right', fontWeight: item ? 'bold' : 'normal' }}>
                  {item ? item.quantity_requested.toLocaleString() : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Signature block */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: 'none' }}>
          <tbody>
            <tr>
              <td style={{ width: '34%', border: '1px solid #000', borderTop: 'none', padding: '6px 8px', fontSize: 9, verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', marginBottom: 20 }}>Requested By:</div>
                <div style={{ borderTop: '1px solid #000', paddingTop: 3 }}>
                  <div style={{ fontWeight: 'bold' }}>{pr2.requisitioner_name_snapshot}</div>
                  <div>Planning</div>
                  <div style={{ fontSize: 8, color: '#555', marginTop: 2 }}>
                    {format(new Date(pr2.created_at), 'MM/dd/yyyy hh:mm a')}
                  </div>
                </div>
              </td>
              <td style={{ width: '33%', border: '1px solid #000', borderTop: 'none', padding: '6px 8px', fontSize: 9, verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', marginBottom: 20 }}>Reviewed and Noted By:</div>
                <PR2ApproverSignatureBody action={reviewedAction} />
              </td>
              <td style={{ width: '33%', border: '1px solid #000', borderTop: 'none', padding: '6px 8px', fontSize: 9, verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', marginBottom: 20 }}>Approved By:</div>
                <PR2ApproverSignatureBody action={approvedAction} />
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ fontSize: 8, color: '#888', textAlign: 'right', marginTop: 6 }}>
          Printed: {format(new Date(), 'MM/dd/yyyy hh:mm a')} · Fortune Procurement System · {isServices ? 'PR2-SV-v1' : 'PR2-RM-v1'}
        </div>
      </div>
    </>
  );
}
