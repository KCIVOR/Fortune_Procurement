'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchGRNById } from '@/lib/grn';
import type { GRNWithItems } from '@/types/grn';
import { format } from 'date-fns';

export default function GRNPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [grn, setGRN]     = useState<GRNWithItems | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    fetchGRNById(id)
      .then(g => {
        if (!g) { setError('GRN not found.'); return; }
        setGRN(g);
        setTimeout(() => window.print(), 800);
      })
      .catch(() => setError('Failed to load GRN.'));
  }, [id]);

  if (error) return (
    <div className="p-8 text-red-600 text-sm">{error}</div>
  );

  if (!grn) return (
    <div className="p-8 text-[#BFC7D5] text-sm">Loading...</div>
  );

  const receivedTotal = grn.items.reduce(
    (s, i) => s + i.quantity_received * i.unit_price, 0
  );
  const orderedTotal = grn.items.reduce(
    (s, i) => s + i.quantity_ordered * i.unit_price, 0
  );

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { font-family: 'Arial', sans-serif; font-size: 11px; color: #1e293b; background: white; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #cbd5e1; padding: 5px 8px; }
        th { background-color: #f1f5f9; font-weight: 600; text-transform: uppercase; font-size: 9px; letter-spacing: 0.05em; }
        .header-table td { border: none; padding: 2px 0; }
        .sig-table td { border: 1px solid #cbd5e1; padding: 28px 8px 8px 8px; text-align: center; font-size: 9px; }
      `}</style>

      {/* Print button */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] hover:bg-[#0F1F3A] transition"
        >
          Print / Save PDF
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 bg-white border border-[#D8E2FF] text-[#0F1F3A] text-sm font-semibold rounded-[4px] hover:border-[#0F1F3A] transition"
        >
          Close
        </button>
      </div>

      <div style={{ maxWidth: '210mm', margin: '0 auto', padding: '10mm', background: 'white' }}>

        {/* Company header */}
        <div style={{ textAlign: 'center', marginBottom: '12px', borderBottom: '2px solid #1e293b', paddingBottom: '10px' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', letterSpacing: '0.05em', color: '#0f172a' }}>
            Fortune Packaging Corporation
          </div>
          <div style={{ fontSize: '9px', color: '#64748b', marginTop: '2px' }}>
            Procurement Management System
          </div>
          <div style={{ fontSize: '14px', fontWeight: '700', marginTop: '6px', letterSpacing: '0.1em', color: '#0f172a' }}>
            GOODS RECEIPT NOTE
          </div>
        </div>

        {/* GRN metadata grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0', marginBottom: '12px' }}>
          <table className="header-table" style={{ borderRight: '1px solid #e2e8f0' }}>
            <tbody>
              <tr><td style={{ color: '#64748b', width: '120px' }}>GRN No.:</td><td style={{ fontWeight: '700', fontFamily: 'monospace' }}>{grn.grn_number}</td></tr>
              <tr><td style={{ color: '#64748b' }}>PO No.:</td><td style={{ fontFamily: 'monospace' }}>{grn.po_number_snapshot}</td></tr>
              <tr><td style={{ color: '#64748b' }}>PR2 No.:</td><td style={{ fontFamily: 'monospace' }}>{grn.pr2_number_snapshot}</td></tr>
              <tr><td style={{ color: '#64748b' }}>PR1 No.:</td><td style={{ fontFamily: 'monospace' }}>{grn.pr1_number_snapshot}</td></tr>
            </tbody>
          </table>
          <table className="header-table" style={{ paddingLeft: '16px' }}>
            <tbody>
              <tr><td style={{ color: '#64748b', width: '120px', paddingLeft: '16px' }}>Transaction Date:</td><td style={{ fontWeight: '600' }}>{format(new Date(grn.transaction_date), 'MMMM d, yyyy')}</td></tr>
              <tr><td style={{ color: '#64748b', paddingLeft: '16px' }}>Invoice No.:</td><td>{grn.invoice_no || '—'}</td></tr>
              <tr><td style={{ color: '#64748b', paddingLeft: '16px' }}>DR No.:</td><td>{grn.dr_no || '—'}</td></tr>
              <tr><td style={{ color: '#64748b', paddingLeft: '16px' }}>DR Date:</td><td>{grn.dr_date ? format(new Date(grn.dr_date), 'MMMM d, yyyy') : '—'}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Supplier & delivery info */}
        <table className="header-table" style={{ marginBottom: '12px', width: '100%', border: '1px solid #e2e8f0', padding: '8px' }}>
          <tbody>
            <tr>
              <td style={{ color: '#64748b', width: '100px' }}>Supplier:</td>
              <td style={{ fontWeight: '600', width: '250px' }}>{grn.supplier_name_snapshot}</td>
              <td style={{ color: '#64748b', width: '100px' }}>Received At:</td>
              <td style={{ fontWeight: '600' }}>{grn.warehouse}</td>
            </tr>
            <tr>
              <td style={{ color: '#64748b' }}>Department:</td>
              <td>{grn.department_name_snapshot}</td>
              <td style={{ color: '#64748b' }}>Address:</td>
              <td style={{ fontSize: '9px' }}>{grn.delivery_address}</td>
            </tr>
            <tr>
              <td style={{ color: '#64748b' }}>Purpose:</td>
              <td colSpan={3}>{grn.purpose}</td>
            </tr>
          </tbody>
        </table>

        {/* Items table */}
        <table style={{ marginBottom: '0' }}>
          <thead>
            <tr>
              <th style={{ width: '30px', textAlign: 'center' }}>#</th>
              <th style={{ textAlign: 'left' }}>Description</th>
              <th style={{ width: '40px', textAlign: 'center' }}>Unit</th>
              <th style={{ width: '70px', textAlign: 'right' }}>Ordered</th>
              <th style={{ width: '70px', textAlign: 'right' }}>Received</th>
              <th style={{ width: '60px', textAlign: 'right' }}>Rejected</th>
              <th style={{ width: '80px', textAlign: 'right' }}>Unit Price</th>
              <th style={{ width: '90px', textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {grn.items.map((item, idx) => {
              const amount  = item.quantity_received * item.unit_price;
              const isShort = item.quantity_received < item.quantity_ordered;
              return (
                <tr key={item.id} style={{ backgroundColor: idx % 2 === 1 ? '#f8fafc' : 'white' }}>
                  <td style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '9px', color: '#94a3b8' }}>{item.item_order}</td>
                  <td>
                    <div style={{ fontWeight: '500' }}>{item.description}</div>
                    {item.item_code && <div style={{ fontSize: '8px', color: '#94a3b8', fontFamily: 'monospace' }}>{item.item_code}</div>}
                    {item.remarks && <div style={{ fontSize: '8px', color: '#64748b', fontStyle: 'italic' }}>{item.remarks}</div>}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '9px' }}>{item.unit_of_measure}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: '#64748b' }}>{item.quantity_ordered}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '600', color: isShort ? '#d97706' : '#0f172a' }}>
                    {item.quantity_received}
                    {isShort && <span style={{ fontSize: '8px', color: '#d97706', marginLeft: '2px' }}>▼</span>}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: item.quantity_rejected > 0 ? '#dc2626' : '#94a3b8' }}>
                    {item.quantity_rejected > 0 ? item.quantity_rejected : '—'}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '10px' }}>
                    ₱{item.unit_price.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '600' }}>
                    ₱{amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: '#f1f5f9' }}>
              <td colSpan={3} style={{ textAlign: 'right', fontWeight: '600', border: '1px solid #cbd5e1', fontSize: '9px', color: '#64748b' }}>
                PO Total Value
              </td>
              <td colSpan={4} style={{ border: '1px solid #cbd5e1' }}></td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '600', border: '1px solid #cbd5e1', color: '#64748b' }}>
                ₱{orderedTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </td>
            </tr>
            <tr style={{ backgroundColor: '#0f172a' }}>
              <td colSpan={3} style={{ textAlign: 'right', fontWeight: '700', border: '1px solid #334155', color: 'white', fontSize: '10px' }}>
                TOTAL RECEIVED
              </td>
              <td colSpan={4} style={{ border: '1px solid #334155' }}></td>
              <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: '700', border: '1px solid #334155', color: 'white', fontSize: '11px' }}>
                ₱{receivedTotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Remarks */}
        {grn.remarks && (
          <div style={{ margin: '10px 0', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '10px' }}>
            <span style={{ fontWeight: '600', color: '#64748b', textTransform: 'uppercase', fontSize: '9px' }}>Remarks: </span>
            {grn.remarks}
          </div>
        )}

        {/* Signature block */}
        <table className="sig-table" style={{ marginTop: '20px' }}>
          <thead>
            <tr>
              <th>Received By</th>
              <th>Inspected By</th>
              <th>Checked By</th>
              <th>Noted By</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div style={{ fontWeight: '600', borderTop: '1px solid #1e293b', paddingTop: '4px' }}>
                  {grn.received_by_name_snapshot || ' '}
                </div>
                <div style={{ color: '#64748b' }}>{grn.received_by_position_snapshot}</div>
                <div style={{ color: '#64748b' }}>
                  {grn.closed_at ? format(new Date(grn.closed_at), 'MM/dd/yyyy') : ' '}
                </div>
              </td>
              <td><div style={{ borderTop: '1px solid #1e293b', paddingTop: '4px' }}>&nbsp;</div><div style={{ color: '#64748b' }}>Warehouse Staff</div></td>
              <td><div style={{ borderTop: '1px solid #1e293b', paddingTop: '4px' }}>&nbsp;</div><div style={{ color: '#64748b' }}>Procurement Officer</div></td>
              <td><div style={{ borderTop: '1px solid #1e293b', paddingTop: '4px' }}>&nbsp;</div><div style={{ color: '#64748b' }}>Department Head</div></td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ marginTop: '12px', textAlign: 'center', fontSize: '8px', color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
          <span style={{ fontFamily: 'monospace', fontWeight: '600' }}>{grn.grn_number}</span>
          {' · '}This document serves as an official goods receipt record.
          {' · '}Generated {format(new Date(), 'MMMM d, yyyy h:mm a')}
        </div>
      </div>
    </>
  );
}
