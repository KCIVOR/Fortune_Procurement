'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { fetchGRNById } from '@/lib/grn';
import { canViewCommercialPricing, formatCommercialAmount } from '@/lib/price-visibility';
import type { GRNWithItems } from '@/types/grn';
import { format } from 'date-fns';

export default function GRNPrintPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [grn, setGRN] = useState<GRNWithItems | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchGRNById(id)
      .then(g => {
        if (!g) { setError('GRN not found.'); return; }
        setGRN(g);
      })
      .catch(() => setError('Failed to load GRN.'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading && grn) {
      setTimeout(() => window.print(), 300);
    }
  }, [loading, grn]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-pq-neutral-500">Preparing print view...</p>
      </div>
    );
  }

  if (error || !grn) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-pq-neutral-500">{error || 'GRN not found.'}</p>
      </div>
    );
  }

  const isClosed = grn.status === 'closed';
  const canViewPrices = canViewCommercialPricing(profile);
  const receivedTotal = canViewPrices
    ? grn.items.reduce((s, i) => s + i.quantity_received * i.unit_price, 0)
    : null;
  const orderedTotal = canViewPrices
    ? grn.items.reduce((s, i) => s + i.quantity_ordered * i.unit_price, 0)
    : null;

  const MINIMUM_ROWS = 8;
  const blankRows = Math.max(0, MINIMUM_ROWS - grn.items.length);

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
        <span className="text-sm font-medium">Print Preview — {grn.grn_number}</span>
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
                <div style={{ fontSize: 15, fontWeight: 'bold', letterSpacing: 1 }}>GOODS RECEIPT NOTE</div>
                <div style={{ fontSize: 9, marginTop: 2 }}>Fortune Procurement System</div>
              </td>
              <td style={{ width: '22%', border: '1px solid #000', padding: '4px 8px', verticalAlign: 'top', fontSize: 9 }}>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 'bold' }}>Form No.:</span> GRN-v1
                </div>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontWeight: 'bold' }}>GRN No.:</span>{' '}
                  <span style={{ fontFamily: 'monospace' }}>{grn.grn_number}</span>
                </div>
                <div>
                  <span style={{ fontWeight: 'bold' }}>Status:</span> {isClosed ? 'Closed' : 'Open'}
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Supplier + Received At side by side */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '50%', border: '1px solid #000', borderTop: 'none', padding: '6px 8px', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', fontSize: 9, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Supplier:
                </div>
                <div style={{ fontWeight: 'bold', fontSize: 10 }}>{grn.supplier_name_snapshot}</div>
                <div style={{ fontSize: 9, color: '#333', marginTop: 2 }}>
                  Department: {grn.department_name_snapshot}
                </div>
              </td>
              <td style={{ width: '50%', border: '1px solid #000', borderTop: 'none', borderLeft: 'none', padding: '6px 8px', verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', fontSize: 9, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Received At:
                </div>
                <div style={{ fontWeight: 'bold', fontSize: 10 }}>{grn.warehouse}</div>
                <div style={{ fontSize: 9, color: '#333', marginTop: 2, whiteSpace: 'pre-wrap' }}>
                  {grn.delivery_address}
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
                <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>PO Reference</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 9 }}>{grn.po_number_snapshot}</div>
              </td>
              <td style={{ border: '1px solid #000', borderTop: 'none', borderLeft: 'none', padding: '5px 8px', width: '33%' }}>
                <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>PR2 Reference</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 9 }}>{grn.pr2_number_snapshot}</div>
              </td>
              <td style={{ border: '1px solid #000', borderTop: 'none', borderLeft: 'none', padding: '5px 8px', width: '34%' }}>
                <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>PR1 Reference</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 9 }}>{grn.pr1_number_snapshot}</div>
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', borderTop: 'none', padding: '5px 8px' }}>
                <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>Transaction Date</div>
                <div style={{ fontWeight: 'bold', fontSize: 9 }}>{format(new Date(grn.transaction_date), 'MMMM d, yyyy')}</div>
              </td>
              <td style={{ border: '1px solid #000', borderTop: 'none', borderLeft: 'none', padding: '5px 8px' }}>
                <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>DR No.</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 'bold', fontSize: 9 }}>{grn.dr_no || '—'}</div>
              </td>
              <td style={{ border: '1px solid #000', borderTop: 'none', borderLeft: 'none', padding: '5px 8px' }}>
                <div style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>DR Date</div>
                <div style={{ fontWeight: 'bold', fontSize: 9 }}>{grn.dr_date ? format(new Date(grn.dr_date), 'MMMM d, yyyy') : '—'}</div>
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
                <span style={{ fontSize: 9 }}>{grn.purpose}</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Items table */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#f0f0f0' }}>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'center', width: 28, fontSize: 8, fontWeight: 'bold' }}>#</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'left', fontSize: 8, fontWeight: 'bold' }}>Description</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'center', width: 40, fontSize: 8, fontWeight: 'bold' }}>Unit</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'right', width: 55, fontSize: 8, fontWeight: 'bold' }}>Ordered</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'right', width: 55, fontSize: 8, fontWeight: 'bold' }}>Received</th>
              <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'right', width: 55, fontSize: 8, fontWeight: 'bold' }}>Rejected</th>
              {canViewPrices ? (
                <>
                  <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'right', width: 75, fontSize: 8, fontWeight: 'bold' }}>Unit Price</th>
                  <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'right', width: 85, fontSize: 8, fontWeight: 'bold' }}>Amount</th>
                </>
              ) : (
                <th style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'center', width: 85, fontSize: 8, fontWeight: 'bold' }}>Pricing</th>
              )}
            </tr>
          </thead>
          <tbody>
            {grn.items.map((item, idx) => {
              const amount = item.quantity_received * item.unit_price;
              const isShort = item.quantity_received < item.quantity_ordered;
              return (
                <tr key={item.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'center', fontSize: 8, fontFamily: 'monospace' }}>{item.item_order}</td>
                  <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', fontSize: 9 }}>
                    {item.description}
                    {item.is_raw_material && (
                      <span style={{ marginLeft: 4, fontSize: 7, color: '#1e40af', fontWeight: 'bold' }}>[RAW]</span>
                    )}
                    {item.item_code && (
                      <div style={{ fontSize: 7, color: '#666', fontFamily: 'monospace' }}>{item.item_code}</div>
                    )}
                    {item.quote_justification && (
                      <div style={{ marginTop: 2, fontSize: 7, color: '#92400e', fontStyle: 'italic' }}>
                        Justification: {item.quote_justification}
                      </div>
                    )}
                    {item.remarks && (
                      <div style={{ marginTop: 2, fontSize: 7, color: '#666', fontStyle: 'italic' }}>
                        {item.remarks}
                      </div>
                    )}
                  </td>
                  <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'center', fontSize: 8 }}>{item.unit_of_measure}</td>
                  <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'right', fontSize: 9, fontFamily: 'monospace' }}>
                    {item.quantity_ordered}
                  </td>
                  <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'right', fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold', color: isShort ? '#b45309' : '#000' }}>
                    {item.quantity_received}
                  </td>
                  <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'right', fontSize: 9, fontFamily: 'monospace', color: item.quantity_rejected > 0 ? '#b91c1c' : '#999' }}>
                    {item.quantity_rejected > 0 ? item.quantity_rejected : '—'}
                  </td>
                  {canViewPrices ? (
                    <>
                      <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'right', fontSize: 8 }}>
                        {formatCommercialAmount(item.unit_price, true)}
                      </td>
                      <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'right', fontSize: 9, fontWeight: 'bold' }}>
                        {formatCommercialAmount(amount, true)}
                      </td>
                    </>
                  ) : (
                    <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', textAlign: 'center', fontSize: 8, color: '#94a3b8' }}>
                      {formatCommercialAmount(0, false)}
                    </td>
                  )}
                </tr>
              );
            })}
            {Array.from({ length: blankRows }).map((_, i) => (
              <tr key={`blank-${i}`}>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px', height: 18 }}>&nbsp;</td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 6px' }}></td>
              </tr>
            ))}
          </tbody>
          {canViewPrices && (
            <tfoot>
              <tr>
                <td colSpan={6} style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 8px', textAlign: 'right', fontSize: 8 }}>
                  PO Total Value
                </td>
                <td colSpan={2} style={{ border: '1px solid #000', borderTop: 'none', padding: '4px 8px', textAlign: 'right', fontSize: 9 }}>
                  {formatCommercialAmount(orderedTotal ?? 0, true)}
                </td>
              </tr>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <td colSpan={6} style={{ border: '1px solid #000', borderTop: 'none', padding: '5px 8px', textAlign: 'right', fontSize: 9, fontWeight: 'bold' }}>
                  TOTAL RECEIVED
                </td>
                <td colSpan={2} style={{ border: '1px solid #000', borderTop: 'none', padding: '5px 8px', textAlign: 'right', fontSize: 11, fontWeight: 'bold' }}>
                  {formatCommercialAmount(receivedTotal ?? 0, true)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>

        {/* Remarks */}
        {grn.remarks && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '5px 8px' }}>
                  <span style={{ fontSize: 8, color: '#666', textTransform: 'uppercase' }}>Remarks: </span>
                  <span style={{ fontSize: 9, fontStyle: 'italic' }}>{grn.remarks}</span>
                </td>
              </tr>
            </tbody>
          </table>
        )}

        {/* Signature block */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '25%', border: '1px solid #000', borderTop: 'none', padding: '8px', textAlign: 'center', verticalAlign: 'top' }}>
                <div style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 8 }}>Received By:</div>
                <div style={{ fontSize: 8, color: '#666', marginBottom: 6 }}>Warehouse Representative</div>
                <div style={{ borderTop: '1px solid #000', paddingTop: 6, minHeight: 28 }}>
                  {grn.received_by_name_snapshot ? (
                    <>
                      <div style={{ fontSize: 8, fontWeight: 'bold' }}>{grn.received_by_name_snapshot}</div>
                      <div style={{ fontSize: 7, color: '#444' }}>{grn.received_by_position_snapshot}</div>
                      {grn.closed_at && (
                        <div style={{ fontSize: 7, color: '#666', marginTop: 2 }}>
                          {format(new Date(grn.closed_at), 'MMMM d, yyyy h:mm a')}
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ fontSize: 8, color: '#999', fontStyle: 'italic' }}>Pending</div>
                  )}
                </div>
              </td>
              <td style={{ width: '25%', border: '1px solid #000', borderTop: 'none', borderLeft: 'none', padding: '8px', textAlign: 'center', verticalAlign: 'top' }}>
                <div style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 8 }}>Inspected By:</div>
                <div style={{ fontSize: 8, color: '#666', marginBottom: 6 }}>Warehouse Staff</div>
                <div style={{ borderTop: '1px solid #000', paddingTop: 6, minHeight: 28 }}>&nbsp;</div>
              </td>
              <td style={{ width: '25%', border: '1px solid #000', borderTop: 'none', borderLeft: 'none', padding: '8px', textAlign: 'center', verticalAlign: 'top' }}>
                <div style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 8 }}>Checked By:</div>
                <div style={{ fontSize: 8, color: '#666', marginBottom: 6 }}>Procurement Officer</div>
                <div style={{ borderTop: '1px solid #000', paddingTop: 6, minHeight: 28 }}>&nbsp;</div>
              </td>
              <td style={{ width: '25%', border: '1px solid #000', borderTop: 'none', borderLeft: 'none', padding: '8px', textAlign: 'center', verticalAlign: 'top' }}>
                <div style={{ fontSize: 8, fontWeight: 'bold', marginBottom: 8 }}>Noted By:</div>
                <div style={{ fontSize: 8, color: '#666', marginBottom: 6 }}>Department Head</div>
                <div style={{ borderTop: '1px solid #000', paddingTop: 6, minHeight: 28 }}>&nbsp;</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer note */}
        <div style={{ fontSize: 8, color: '#888', textAlign: 'right', marginTop: 6 }}>
          Printed: {format(new Date(), 'MM/dd/yyyy hh:mm a')} · Fortune Procurement System · GRN-v1
        </div>
      </div>
    </>
  );
}
