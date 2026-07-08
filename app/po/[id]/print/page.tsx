'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { fetchPOById, calcPOVatBreakdown } from '@/lib/po';
import { canViewCommercialPricing, formatCommercialAmount } from '@/lib/price-visibility';
import { fetchPOApprovalDetailByPOId } from '@/lib/po-approvals';
import { labelForApprovalAction, latestActionForStep } from '@/lib/print-approval-signatures';
import type { POWithItems, POApprovalDetail, POApprovalAction, POReceipt } from '@/types/po';
import { format } from 'date-fns';

function POApproverSignatureCell({
  title,
  staticHint,
  action,
}: {
  title: string;
  staticHint: string;
  action: POApprovalAction | null;
}) {
  return (
    <td
      style={{
        border: '1px solid #000',
        borderTop: 'none',
        padding: '8px',
        width: '25%',
        textAlign: 'center',
        verticalAlign: 'top',
      }}
    >
      <div style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 8, color: '#666', marginBottom: 6 }}>{staticHint}</div>
      <div style={{ borderTop: '1px solid #000', paddingTop: 6, minHeight: 28 }}>
        {action ? (
          <>
            {action.action !== 'approved' && (
              <div
                style={{
                  fontWeight: 'bold',
                  fontSize: 8,
                  color: action.action === 'rejected' ? '#b91c1c' : '#b45309',
                  marginBottom: 4,
                }}
              >
                {labelForApprovalAction(action.action)}
              </div>
            )}
            <div style={{ fontSize: 8, fontWeight: 'bold' }}>{action.actor_name_snapshot}</div>
            <div style={{ fontSize: 7, color: '#444' }}>{action.actor_position_snapshot}</div>
            <div style={{ fontSize: 7, color: '#666', marginTop: 2 }}>
              {format(new Date(action.acted_at), 'MMMM d, yyyy h:mm a')}
            </div>
            {action.remarks && (
              <div style={{ fontSize: 7, color: '#555', marginTop: 4, fontStyle: 'italic' }}>
                {action.remarks}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 8, color: '#999', fontStyle: 'italic' }}>Pending</div>
        )}
      </div>
    </td>
  );
}

function POReceivedSignatureCell({
  receipt,
  step4Action,
}: {
  receipt: POReceipt | null;
  step4Action: POApprovalAction | null;
}) {
  const body = receipt ? (
    <>
      <div style={{ fontSize: 8, fontWeight: 'bold' }}>{receipt.acknowledged_by_name}</div>
      <div style={{ fontSize: 7, color: '#666', marginTop: 2 }}>
        {format(new Date(receipt.acknowledged_at), 'MMMM d, yyyy h:mm a')}
      </div>
      {receipt.commitment_date && (
        <div style={{ fontSize: 7, color: '#444', marginTop: 2 }}>
          Commitment: {format(new Date(receipt.commitment_date), 'MMMM d, yyyy')}
        </div>
      )}
      {receipt.delivery_remarks && (
        <div style={{ fontSize: 7, color: '#555', marginTop: 4, fontStyle: 'italic' }}>
          {receipt.delivery_remarks}
        </div>
      )}
    </>
  ) : step4Action ? (
    <>
      {step4Action.action !== 'approved' && (
        <div
          style={{
            fontWeight: 'bold',
            fontSize: 8,
            color: step4Action.action === 'rejected' ? '#b91c1c' : '#b45309',
            marginBottom: 4,
          }}
        >
          {labelForApprovalAction(step4Action.action)}
        </div>
      )}
      <div style={{ fontSize: 8, fontWeight: 'bold' }}>{step4Action.actor_name_snapshot}</div>
      <div style={{ fontSize: 7, color: '#444' }}>{step4Action.actor_position_snapshot}</div>
      <div style={{ fontSize: 7, color: '#666', marginTop: 2 }}>
        {format(new Date(step4Action.acted_at), 'MMMM d, yyyy h:mm a')}
      </div>
      {step4Action.remarks && (
        <div style={{ fontSize: 7, color: '#555', marginTop: 4, fontStyle: 'italic' }}>
          {step4Action.remarks}
        </div>
      )}
    </>
  ) : (
    <div style={{ fontSize: 8, color: '#999', fontStyle: 'italic' }}>Pending</div>
  );

  return (
    <td style={{ border: '1px solid #000', borderTop: 'none', borderLeft: 'none', padding: '8px', width: '25%', textAlign: 'center', verticalAlign: 'top' }}>
      <div style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 8 }}>Received By:</div>
      <div style={{ fontSize: 8, color: '#666', marginBottom: 6 }}>Supplier Representative</div>
      <div style={{ borderTop: '1px solid #000', paddingTop: 6, minHeight: 28 }}>{body}</div>
    </td>
  );
}

export default function POPrintPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [po, setPO] = useState<POWithItems | null>(null);
  const [approvalDetail, setApprovalDetail] = useState<POApprovalDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [poData, detail] = await Promise.all([
        fetchPOById(id as string),
        fetchPOApprovalDetailByPOId(id as string),
      ]);
      setPO(poData);
      setApprovalDetail(detail);
    })().finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading && po) {
      setTimeout(() => window.print(), 300);
    }
  }, [loading, po]);

  if (loading || !po) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-pq-neutral-500">Preparing print view...</p>
      </div>
    );
  }

  const canViewPrices = canViewCommercialPricing(profile);
  const vatBreakdown = canViewPrices ? calcPOVatBreakdown(po.items) : null;

  const actions = approvalDetail?.actions ?? [];
  const preparedAction = latestActionForStep(actions, 1);
  const reviewedAction = latestActionForStep(actions, 2);
  const approvedAction = latestActionForStep(actions, 3);
  const receivedAction = latestActionForStep(actions, 4);

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm 14mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        body { font-family: Arial, sans-serif; font-size: 10px; color: #000; background: #fff; }
      `}</style>

      {/* Print toolbar */}
      <div className="no-print fixed top-0 left-0 right-0 bg-pq-neutral-900 text-white px-6 py-3 flex items-center justify-between z-10">
        <span className="text-sm font-medium">Print Preview — {po.po_number}</span>
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

      {/* PO Document */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 0' }}>

        {/* Header */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                <div style={{ fontSize: 15, fontWeight: 'bold', letterSpacing: 1 }}>PURCHASE ORDER</div>
                <div style={{ fontSize: 9, marginTop: 2 }}>Fortune Procurement System</div>
              </td>
              <td style={{ width: '22%', border: '1px solid #000', padding: '4px 8px', verticalAlign: 'top', fontSize: 9 }}>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 'bold' }}>Form No.:</span> PO-v1
                </div>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 'bold' }}>PO No.:</span>{' '}
                  <span style={{ fontFamily: 'monospace' }}>{po.po_number}</span>
                </div>
                <div>
                  <span style={{ fontWeight: 'bold' }}>PO Date:</span> {format(new Date(po.po_date), 'MM/dd/yyyy')}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Supplier + Delivery side by side */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '50%', border: '1px solid #000', borderTop: 'none', padding: '6px 8px', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', fontSize: 9, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Supplier / Vendor:
                </div>
                <div style={{ fontWeight: 'bold', fontSize: 10 }}>{po.supplier_name_snapshot}</div>
                <div style={{ fontSize: 9, color: '#333', marginTop: 2 }}>
                  {po.payment_terms && <div>Terms: {po.payment_terms}</div>}
                  {po.packing && <div>Packing: {po.packing}</div>}
                </div>
              </td>
              <td style={{ width: '50%', border: '1px solid #000', borderTop: 'none', borderLeft: 'none', padding: '6px 8px', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', fontSize: 9, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Deliver To:
                </div>
                <div style={{ fontWeight: 'bold', fontSize: 10 }}>{po.warehouse}</div>
                <div style={{ fontSize: 9, color: '#333', marginTop: 2, whiteSpace: 'pre-wrap' }}>
                  {po.delivery_address}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* References row */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #000', borderTop: 'none', padding: '5px 8px', width: '33%' }}>
                <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>PR2 Reference</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 9 }}>{po.pr2_number_snapshot}</div>
              </td>
              <td style={{ border: '1px solid #000', borderTop: 'none', borderLeft: 'none', padding: '5px 8px', width: '33%' }}>
                <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>PR1 Reference</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 9 }}>{po.pr1_number_snapshot}</div>
              </td>
              <td style={{ border: '1px solid #000', borderTop: 'none', borderLeft: 'none', padding: '5px 8px', width: '34%' }}>
                <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>Date Required</div>
                <div style={{ fontWeight: 'bold', fontSize: 9 }}>{format(new Date(po.date_required), 'MMMM d, yyyy')}</div>
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', borderTop: 'none', padding: '5px 8px' }}>
                <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>RFQ Reference</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 9 }}>{po.rfq_number_snapshot}</div>
              </td>
              <td style={{ border: '1px solid #000', borderTop: 'none', borderLeft: 'none', padding: '5px 8px' }}>
                <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>Department</div>
                <div style={{ fontWeight: 'bold', fontSize: 9 }}>{po.department_name_snapshot}</div>
              </td>
              <td style={{ border: '1px solid #000', borderTop: 'none', borderLeft: 'none', padding: '5px 8px' }}>
                <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>Requisitioner</div>
                <div style={{ fontWeight: 'bold', fontSize: 9 }}>{po.requisitioner_name_snapshot}</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Purpose */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #000', borderTop: 'none', padding: '5px 8px' }}>
                <span style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>Purpose: </span>
                <span style={{ fontSize: 9 }}>{po.purpose}</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'center', width: 28, fontSize: 8, fontWeight: 'bold' }}>#</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'left', width: 60, fontSize: 8, fontWeight: 'bold' }}>Item Code</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'left', fontSize: 8, fontWeight: 'bold' }}>Description</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'center', width: 40, fontSize: 8, fontWeight: 'bold' }}>Unit</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'right', width: 50, fontSize: 8, fontWeight: 'bold' }}>Qty</th>
              {canViewPrices ? (
                <>
                  <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'right', width: 80, fontSize: 8, fontWeight: 'bold' }}>Unit Price</th>
                  <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'right', width: 90, fontSize: 8, fontWeight: 'bold' }}>Amount</th>
                </>
              ) : (
                <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'center', width: 90, fontSize: 8, fontWeight: 'bold' }}>Pricing</th>
              )}
            </tr>
          </thead>
          <tbody>
            {po.items.map((item, idx) => (
              <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'center', fontSize: 8, fontFamily: 'monospace' }}>{item.item_order}</td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', fontSize: 8, fontFamily: 'monospace' }}>{item.item_code || '—'}</td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', fontSize: 9 }}>
                  {item.description}
                  {item.is_raw_material && (
                    <span style={{ marginLeft: 4, fontSize: 7, color: '#1e40af', fontWeight: 'bold' }}>[RAW]</span>
                  )}
                  {item.quote_justification && (
                    <div style={{ marginTop: 2, fontSize: 7, color: '#92400e', fontStyle: 'italic' }}>
                      Justification: {item.quote_justification}
                    </div>
                  )}
                  {item.pr1_remarks_snapshot && (
                    <div style={{ marginTop: 2, fontSize: 7, color: '#555', fontStyle: 'italic' }}>
                      Requestor remarks: {item.pr1_remarks_snapshot}
                    </div>
                  )}
                </td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'center', fontSize: 8 }}>{item.unit_of_measure}</td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'right', fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold' }}>
                  {Number(item.quantity_to_purchase).toLocaleString()}
                </td>
                {canViewPrices ? (
                  <>
                    <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'right', fontSize: 8 }}>
                      {formatCommercialAmount(Number(item.unit_price), true)}
                    </td>
                    <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'right', fontSize: 9, fontWeight: 'bold' }}>
                      {formatCommercialAmount(Number(item.total_price), true)}
                    </td>
                  </>
                ) : (
                  <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'center', fontSize: 8, color: '#94a3b8' }}>
                    {formatCommercialAmount(0, false)}
                  </td>
                )}
              </tr>
            ))}
            {/* Blank rows to fill space */}
            {Array.from({ length: Math.max(0, 8 - po.items.length) }).map((_, i) => (
              <tr key={`blank-${i}`}>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', height: 18 }}>&nbsp;</td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
              </tr>
            ))}
          </tbody>
          {canViewPrices && vatBreakdown && (
            <tfoot>
              {vatBreakdown.vatAmount > 0 && (
                <>
                  <tr>
                    <td colSpan={5} style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 8px', textAlign: 'right', fontSize: 8 }}>
                      Subtotal
                    </td>
                    <td colSpan={2} style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 8px', textAlign: 'right', fontSize: 9 }}>
                      {formatCommercialAmount(vatBreakdown.subtotal, true)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={5} style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 8px', textAlign: 'right', fontSize: 8 }}>
                      VAT
                    </td>
                    <td colSpan={2} style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 8px', textAlign: 'right', fontSize: 9 }}>
                      {formatCommercialAmount(vatBreakdown.vatAmount, true)}
                    </td>
                  </tr>
                </>
              )}
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <td colSpan={5} style={{ border: '1px solid #000', borderTop: 'none', padding: '5px 8px', textAlign: 'right', fontSize: 9, fontWeight: 'bold' }}>
                  GRAND TOTAL
                </td>
                <td colSpan={2} style={{ border: '1px solid #000', borderTop: 'none', padding: '5px 8px', textAlign: 'right', fontSize: 11, fontWeight: 'bold' }}>
                  {formatCommercialAmount(vatBreakdown.total, true)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* Remarks */}
        {po.remarks && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '5px 8px' }}>
                  <span style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>Remarks: </span>
                  <span style={{ fontSize: 9, fontStyle: 'italic' }}>{po.remarks}</span>
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Signature block */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <POApproverSignatureCell title="Prepared By:" staticHint="Buyer / Procurement Staff" action={preparedAction} />
              <POApproverSignatureCell title="Reviewed By:" staticHint="Procurement Manager" action={reviewedAction} />
              <POApproverSignatureCell title="Approved By:" staticHint="Finance Director" action={approvedAction} />
              <POReceivedSignatureCell receipt={approvalDetail?.receipt ?? null} step4Action={receivedAction} />
            </tr>
          </tbody>
        </table>

        {/* Footer note */}
        <div style={{ fontSize: 8, color: '#999', textAlign: 'center', borderTop: '1px solid #eee', marginTop: 10, paddingTop: 6 }}>
          This Purchase Order is subject to the terms and conditions of Fortune Packaging Corporation.
          Supplier acceptance constitutes agreement to all terms stated herein.
        </div>
        <div style={{ fontSize: 8, color: '#888', textAlign: 'right', marginTop: 6 }}>
          Printed: {format(new Date(), 'MM/dd/yyyy hh:mm a')} · Fortune Procurement System · PO-v1
        </div>
      </div>
    </>
  );
}
