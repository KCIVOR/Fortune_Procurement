'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchPOById, calcPOGrandTotal } from '@/lib/po';
import type { POWithItems } from '@/types/po';
import { format } from 'date-fns';

export default function POPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [po, setPO] = useState<POWithItems | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchPOById(id as string).then(data => {
      setPO(data);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!loading && po) {
      setTimeout(() => window.print(), 300);
    }
  }, [loading, po]);

  if (loading || !po) {
    return (
      <div style={{ fontFamily: 'Arial, sans-serif', padding: 40, textAlign: 'center', color: '#666' }}>
        Loading...
      </div>
    );
  }

  const grandTotal = calcPOGrandTotal(po.items);
  const today = format(new Date(), 'MMMM d, yyyy');

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm 14mm; }
          body { margin: 0; }
          .no-print { display: none !important; }
        }
        body { font-family: Arial, sans-serif; font-size: 10px; color: #000; background: #fff; }
      `}</style>

      {/* Print button — hidden on print */}
      <div className="no-print" style={{ padding: '12px 20px', background: '#f8f9fa', borderBottom: '1px solid #dee2e6', display: 'flex', gap: 8 }}>
        <button
          onClick={() => window.print()}
          style={{ padding: '6px 16px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          style={{ padding: '6px 16px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}
        >
          Close
        </button>
      </div>

      {/* PO Document */}
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '16px 20px' }}>

        {/* Header */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
          <tbody>
            <tr>
              <td style={{ width: '60%', verticalAlign: 'top', paddingBottom: 8 }}>
                <div style={{ fontWeight: 'bold', fontSize: 16, letterSpacing: 1 }}>Fortune Packaging Corporation</div>
                <div style={{ fontSize: 9, color: '#444', marginTop: 2 }}>123 Commerce Street, Makati City, Philippines</div>
                <div style={{ fontSize: 9, color: '#444' }}>Tel: (02) 8123-4567 · procurement@fortune.com.ph</div>
              </td>
              <td style={{ width: '40%', verticalAlign: 'top', textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 'bold', letterSpacing: 2, color: '#1e3a5f' }}>PURCHASE ORDER</div>
                <div style={{ fontSize: 11, fontWeight: 'bold', marginTop: 4, fontFamily: 'monospace' }}>{po.po_number}</div>
                <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>
                  PO Date: {format(new Date(po.po_date), 'MMMM d, yyyy')}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ borderTop: '2px solid #1e3a5f', marginBottom: 10 }} />

        {/* Supplier + Delivery side by side */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
          <tbody>
            <tr>
              {/* Supplier / Vendor */}
              <td style={{ width: '50%', border: '1px solid #000', padding: '6px 8px', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', fontSize: 9, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Supplier / Vendor:
                </div>
                <div style={{ fontWeight: 'bold', fontSize: 11 }}>{po.supplier_name_snapshot}</div>
                <div style={{ fontSize: 9, color: '#333', marginTop: 2 }}>
                  {po.payment_terms && <div>Terms: {po.payment_terms}</div>}
                  {po.packing && <div>Packing: {po.packing}</div>}
                </div>
              </td>
              {/* Deliver To */}
              <td style={{ width: '50%', border: '1px solid #000', borderLeft: 'none', padding: '6px 8px', verticalAlign: 'top' }}>
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
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #000', padding: '5px 8px', width: '33%' }}>
                <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>PR2 Reference</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 9 }}>{po.pr2_number_snapshot}</div>
              </td>
              <td style={{ border: '1px solid #000', borderLeft: 'none', padding: '5px 8px', width: '33%' }}>
                <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>PR1 Reference</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 9 }}>{po.pr1_number_snapshot}</div>
              </td>
              <td style={{ border: '1px solid #000', borderLeft: 'none', padding: '5px 8px', width: '34%' }}>
                <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>Date Required</div>
                <div style={{ fontWeight: 'bold', fontSize: 9 }}>{format(new Date(po.date_required), 'MMMM d, yyyy')}</div>
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', borderTop: 'none', padding: '5px 8px' }}>
                <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>RFQ Reference</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 9 }}>{po.rfq_number_snapshot}</div>
              </td>
              <td style={{ border: '1px solid #000', borderLeft: 'none', borderTop: 'none', padding: '5px 8px' }}>
                <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>Department</div>
                <div style={{ fontWeight: 'bold', fontSize: 9 }}>{po.department_name_snapshot}</div>
              </td>
              <td style={{ border: '1px solid #000', borderLeft: 'none', borderTop: 'none', padding: '5px 8px' }}>
                <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>Requisitioner</div>
                <div style={{ fontWeight: 'bold', fontSize: 9 }}>{po.requisitioner_name_snapshot}</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Purpose */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #000', padding: '5px 8px' }}>
                <span style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>Purpose: </span>
                <span style={{ fontSize: 9 }}>{po.purpose}</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
          <thead>
            <tr style={{ background: '#1e3a5f', color: '#fff' }}>
              <th style={{ border: '1px solid #1e3a5f', padding: '5px 6px', textAlign: 'center', width: 28, fontSize: 8, fontWeight: 'bold' }}>#</th>
              <th style={{ border: '1px solid #1e3a5f', padding: '5px 6px', textAlign: 'left', width: 60, fontSize: 8, fontWeight: 'bold' }}>Item Code</th>
              <th style={{ border: '1px solid #1e3a5f', padding: '5px 6px', textAlign: 'left', fontSize: 8, fontWeight: 'bold' }}>Description</th>
              <th style={{ border: '1px solid #1e3a5f', padding: '5px 6px', textAlign: 'center', width: 40, fontSize: 8, fontWeight: 'bold' }}>Unit</th>
              <th style={{ border: '1px solid #1e3a5f', padding: '5px 6px', textAlign: 'right', width: 50, fontSize: 8, fontWeight: 'bold' }}>Qty</th>
              <th style={{ border: '1px solid #1e3a5f', padding: '5px 6px', textAlign: 'right', width: 80, fontSize: 8, fontWeight: 'bold' }}>Unit Price</th>
              <th style={{ border: '1px solid #1e3a5f', padding: '5px 6px', textAlign: 'right', width: 90, fontSize: 8, fontWeight: 'bold' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {po.items.map((item, idx) => (
              <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                <td style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'center', fontSize: 8, fontFamily: 'monospace' }}>{item.item_order}</td>
                <td style={{ border: '1px solid #ccc', padding: '4px 6px', fontSize: 8, fontFamily: 'monospace' }}>{item.item_code || '—'}</td>
                <td style={{ border: '1px solid #ccc', padding: '4px 6px', fontSize: 9 }}>{item.description}</td>
                <td style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'center', fontSize: 8 }}>{item.unit_of_measure}</td>
                <td style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right', fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold' }}>
                  {Number(item.quantity_to_purchase).toLocaleString()}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right', fontSize: 8 }}>
                  ₱{Number(item.unit_price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '4px 6px', textAlign: 'right', fontSize: 9, fontWeight: 'bold' }}>
                  ₱{(Number(item.unit_price) * Number(item.quantity_to_purchase)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
            {/* Blank rows to fill space */}
            {Array.from({ length: Math.max(0, 8 - po.items.length) }).map((_, i) => (
              <tr key={`blank-${i}`}>
                <td style={{ border: '1px solid #ccc', padding: '4px 6px', height: 18 }}>&nbsp;</td>
                <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}></td>
                <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}></td>
                <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}></td>
                <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}></td>
                <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}></td>
                <td style={{ border: '1px solid #ccc', padding: '4px 6px' }}></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'right', fontSize: 9, fontWeight: 'bold' }}>
                GRAND TOTAL
              </td>
              <td colSpan={2} style={{ border: '1px solid #ccc', padding: '5px 8px', textAlign: 'right', fontSize: 11, fontWeight: 'bold', background: '#f0f4f8' }}>
                ₱{grandTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Remarks */}
        {po.remarks && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #ccc', padding: '5px 8px' }}>
                  <span style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>Remarks: </span>
                  <span style={{ fontSize: 9, fontStyle: 'italic' }}>{po.remarks}</span>
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Signature block */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20 }}>
          <tbody>
            <tr>
              <td style={{ border: '1px solid #000', padding: '8px', width: '25%', textAlign: 'center', verticalAlign: 'top' }}>
                <div style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 24 }}>Prepared By:</div>
                <div style={{ borderTop: '1px solid #000', paddingTop: 3, fontSize: 8, color: '#666' }}>Buyer / Procurement Staff</div>
              </td>
              <td style={{ border: '1px solid #000', borderLeft: 'none', padding: '8px', width: '25%', textAlign: 'center', verticalAlign: 'top' }}>
                <div style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 24 }}>Reviewed By:</div>
                <div style={{ borderTop: '1px solid #000', paddingTop: 3, fontSize: 8, color: '#666' }}>Procurement Manager</div>
              </td>
              <td style={{ border: '1px solid #000', borderLeft: 'none', padding: '8px', width: '25%', textAlign: 'center', verticalAlign: 'top' }}>
                <div style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 24 }}>Approved By:</div>
                <div style={{ borderTop: '1px solid #000', paddingTop: 3, fontSize: 8, color: '#666' }}>Finance Director</div>
              </td>
              <td style={{ border: '1px solid #000', borderLeft: 'none', padding: '8px', width: '25%', textAlign: 'center', verticalAlign: 'top' }}>
                <div style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 24 }}>Received By:</div>
                <div style={{ borderTop: '1px solid #000', paddingTop: 3, fontSize: 8, color: '#666' }}>Supplier Representative</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer note */}
        <div style={{ marginTop: 10, fontSize: 8, color: '#999', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: 6 }}>
          This Purchase Order is subject to the terms and conditions of Fortune Packaging Corporation.
          Supplier acceptance constitutes agreement to all terms stated herein.
          · PO No. {po.po_number} · Date: {format(new Date(po.po_date), 'MMMM d, yyyy')}
        </div>
      </div>
    </>
  );
}
