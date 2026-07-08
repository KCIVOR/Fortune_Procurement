'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchPR1ById } from '@/lib/pr1';
import { fetchPR1ApprovalSignatories } from '@/lib/approvals';
import { labelForApprovalAction, latestActionForStep } from '@/lib/print-approval-signatures';
import type { PR1WithItems, PR1WarehouseValidationSummary } from '@/types/pr1';
import { PR1_STATUS_LABELS } from '@/types/pr1';
import type { ApprovalActionRecord, PR1ApprovalSignatories, WorkflowStep } from '@/types/approvals';
import { format } from 'date-fns';

function pr1StepOrders(steps: WorkflowStep[]) {
  const ordered = [...steps].sort((a, b) => a.step_order - b.step_order);
  const firstOrder = ordered[0]?.step_order ?? 1;
  const finalStep = ordered.find(s => s.is_final) ?? ordered[ordered.length - 1];
  const finalOrder = finalStep?.step_order ?? 2;
  return { firstOrder, finalOrder };
}

function PR1ApproverSignatureBody({
  action,
}: {
  action: ApprovalActionRecord | null;
}) {
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

function PR1WarehouseUseBody({
  warehouseValidation,
}: {
  warehouseValidation: PR1WarehouseValidationSummary | null | undefined;
}) {
  if (!warehouseValidation) {
    return (
      <div style={{ borderTop: '1px solid #000', paddingTop: 3, color: '#999', fontStyle: 'italic' }}>
        Pending
      </div>
    );
  }

  const completed = Boolean(warehouseValidation.validated_at && warehouseValidation.decision);
  const decisionLine =
    warehouseValidation.decision === 'sufficient'
      ? 'Stock sufficient'
      : warehouseValidation.decision === 'insufficient'
        ? 'Stock insufficient — forwarded for approval'
        : null;

  return (
    <div style={{ borderTop: '1px solid #000', paddingTop: 3 }}>
      {completed ? (
        <>
          <div style={{ fontWeight: 'bold' }}>SOH Verified</div>
          {decisionLine && (
            <div style={{ fontSize: 8, color: '#333', marginTop: 2 }}>{decisionLine}</div>
          )}
          {warehouseValidation.validator_name_snapshot && (
            <div style={{ fontWeight: 'bold', marginTop: 4 }}>
              {warehouseValidation.validator_name_snapshot}
            </div>
          )}
          {warehouseValidation.validator_position_snapshot && (
            <div style={{ fontSize: 8, color: '#333' }}>
              {warehouseValidation.validator_position_snapshot}
            </div>
          )}
          {warehouseValidation.validated_at && (
            <div style={{ fontSize: 8, color: '#555', marginTop: 2 }}>
              {format(new Date(warehouseValidation.validated_at), 'MM/dd/yyyy hh:mm a')}
            </div>
          )}
          {warehouseValidation.notes && (
            <div style={{ fontSize: 8, color: '#555', marginTop: 4, fontStyle: 'italic' }}>
              {warehouseValidation.notes}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ fontWeight: 'bold', color: '#555', fontSize: 9 }}>
            Warehouse review in progress
          </div>
          {warehouseValidation.validator_name_snapshot && (
            <div style={{ fontWeight: 'bold', marginTop: 4, fontSize: 9 }}>
              {warehouseValidation.validator_name_snapshot}
            </div>
          )}
          {warehouseValidation.validator_position_snapshot && (
            <div style={{ fontSize: 8, color: '#333' }}>
              {warehouseValidation.validator_position_snapshot}
            </div>
          )}
          {warehouseValidation.notes && (
            <div style={{ fontSize: 8, color: '#555', marginTop: 4, fontStyle: 'italic' }}>
              {warehouseValidation.notes}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PR1PrintPage() {
  const { id } = useParams<{ id: string }>();
  const [pr1, setPR1] = useState<PR1WithItems | null>(null);
  const [signatories, setSignatories] = useState<PR1ApprovalSignatories | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [prRow, sig] = await Promise.all([
        fetchPR1ById(id),
        fetchPR1ApprovalSignatories(id).catch(() => null),
      ]);
      setPR1(prRow);
      setSignatories(sig);
    })().finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading && pr1) {
      setTimeout(() => window.print(), 300);
    }
  }, [loading, pr1]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-pq-neutral-500">Preparing print view...</p>
      </div>
    );
  }

  if (!pr1) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-pq-neutral-500">PR1 not found.</p>
      </div>
    );
  }

  // Pad items to at least 10 rows for the official form look
  const MINIMUM_ROWS = 10;
  const paddedItems = [
    ...pr1.items,
    ...Array(Math.max(0, MINIMUM_ROWS - pr1.items.length)).fill(null),
  ];

  const { firstOrder, finalOrder } = signatories
    ? pr1StepOrders(signatories.workflow_steps)
    : { firstOrder: 1, finalOrder: 2 };
  const reviewedAction = signatories ? latestActionForStep(signatories.actions, firstOrder) : null;
  const approvedAction = signatories ? latestActionForStep(signatories.actions, finalOrder) : null;

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
        <span className="text-sm font-medium">Print Preview — {pr1.pr1_number}</span>
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
                <div style={{ fontSize: 15, fontWeight: 'bold', letterSpacing: 1 }}>PURCHASE REQUEST</div>
                <div style={{ fontSize: 9, marginTop: 2 }}>Fortune Procurement System</div>
              </td>
              <td style={{ width: '22%', border: '1px solid #000', padding: '4px 8px', verticalAlign: 'top', fontSize: 9 }}>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 'bold' }}>Form No.:</span> PR1-v1
                </div>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 'bold' }}>PR1 No.:</span>{' '}
                  <span style={{ fontFamily: 'monospace' }}>{pr1.pr1_number}</span>
                </div>
                <div>
                  <span style={{ fontWeight: 'bold' }}>Status:</span>{' '}
                  {PR1_STATUS_LABELS[pr1.status]}
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
                {pr1.requisitioner_name_snapshot}
              </td>
              <td style={{ width: '25%', border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9 }}>
                <span style={{ fontWeight: 'bold' }}>Department:</span>{' '}
                {pr1.department_name_snapshot}
              </td>
              <td style={{ width: '25%', border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9 }}>
                <span style={{ fontWeight: 'bold' }}>Date:</span>{' '}
                {format(new Date(pr1.created_at), 'MM/dd/yyyy')}
              </td>
            </tr>
            <tr>
              <td colSpan={2} style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9 }}>
                <span style={{ fontWeight: 'bold' }}>Purpose:</span>{' '}
                {pr1.purpose}
              </td>
              <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9 }}>
                <span style={{ fontWeight: 'bold' }}>Date Required:</span>{' '}
                {format(new Date(pr1.date_required), 'MM/dd/yyyy')}
              </td>
            </tr>
            <tr>
              <td colSpan={3} style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 8px', fontSize: 9 }}>
                <span style={{ fontWeight: 'bold' }}>Request Type:</span>{' '}
                {pr1.request_type === 'services' ? 'Services (intangible — SOH not applicable)' : 'Goods'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', borderTop: 'none' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', fontSize: 9, textAlign: 'center', width: 28 }}>No.</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', fontSize: 9, textAlign: 'center', width: 80 }}>Item Code</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', fontSize: 9, textAlign: 'left' }}>Description</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', fontSize: 9, textAlign: 'center', width: 56 }}>Type</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', fontSize: 9, textAlign: 'center', width: 60 }}>Unit</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', fontSize: 9, textAlign: 'center', width: 60 }}>SOH</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', fontSize: 9, textAlign: 'center', width: 70 }}>Req. Qty</th>
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
                    <div style={{ fontSize: 7, color: '#555', marginTop: 2, fontStyle: 'italic' }}>
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
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '3px 6px', fontSize: 8, textAlign: 'center', fontWeight: 'bold', color: item?.is_raw_material ? '#1e40af' : '#999' }}>
                  {item ? (pr1.request_type === 'services' ? '—' : item.is_raw_material ? 'RAW' : '—') : ''}
                </td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '3px 6px', fontSize: 9, textAlign: 'center' }}>
                  {item?.unit_of_measure || ''}
                </td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '3px 6px', fontSize: 9, textAlign: 'right' }}>
                  {item ? (
                    pr1.request_type === 'services'
                      ? 'N/A'
                      : (item as any).validated_soh !== undefined && (item as any).validated_soh !== null
                        ? (item as any).validated_soh.toLocaleString()
                        : '—'
                  ) : ''}
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
              <td style={{ width: '25%', border: '1px solid #000', borderTop: 'none', padding: '6px 8px', fontSize: 9, verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', marginBottom: 20 }}>Prepared By:</div>
                {pr1.prepared_by_name_snapshot ? (
                  <>
                    <div style={{ borderTop: '1px solid #000', paddingTop: 3 }}>
                      <div style={{ fontWeight: 'bold' }}>{pr1.prepared_by_name_snapshot}</div>
                      <div>{pr1.prepared_by_position_snapshot}</div>
                      {pr1.prepared_at && (
                        <div style={{ fontSize: 8, color: '#555', marginTop: 2 }}>
                          {format(new Date(pr1.prepared_at), 'MM/dd/yyyy hh:mm a')}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{ borderTop: '1px solid #000', paddingTop: 3, color: '#999', fontStyle: 'italic' }}>
                    Pending
                  </div>
                )}
              </td>
              <td style={{ width: '25%', border: '1px solid #000', borderTop: 'none', padding: '6px 8px', fontSize: 9, verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', marginBottom: 20 }}>Reviewed and Noted By:</div>
                <PR1ApproverSignatureBody action={reviewedAction} />
              </td>
              <td style={{ width: '25%', border: '1px solid #000', borderTop: 'none', padding: '6px 8px', fontSize: 9, verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', marginBottom: 20 }}>Approved By:</div>
                <PR1ApproverSignatureBody action={approvedAction} />
              </td>
              <td style={{ width: '25%', border: '1px solid #000', borderTop: 'none', padding: '6px 8px', fontSize: 9, verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>For Warehouse Use:</div>
                <div style={{ fontSize: 8, color: '#555', marginBottom: 16 }}>SOH Verified / Remarks:</div>
                <PR1WarehouseUseBody warehouseValidation={pr1.warehouse_validation} />
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ fontSize: 8, color: '#888', textAlign: 'right', marginTop: 6 }}>
          Printed: {format(new Date(), 'MM/dd/yyyy hh:mm a')} · Fortune Procurement System · PR1-v1
        </div>
      </div>
    </>
  );
}
