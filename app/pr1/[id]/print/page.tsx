'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { fetchPR1ById } from '@/lib/pr1';
import type { PR1WithItems } from '@/types/pr1';
import { PR1_STATUS_LABELS } from '@/types/pr1';
import { format } from 'date-fns';

export default function PR1PrintPage() {
  const { id } = useParams<{ id: string }>();
  const [pr1, setPR1] = useState<PR1WithItems | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetchPR1ById(id)
      .then(setPR1)
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading && pr1) {
      setTimeout(() => window.print(), 300);
    }
  }, [loading, pr1]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-[#40527A]">Preparing print view...</p>
      </div>
    );
  }

  if (!pr1) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-[#40527A]">PR1 not found.</p>
      </div>
    );
  }

  // Pad items to at least 10 rows for the official form look
  const MINIMUM_ROWS = 10;
  const paddedItems = [
    ...pr1.items,
    ...Array(Math.max(0, MINIMUM_ROWS - pr1.items.length)).fill(null),
  ];

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
      <div className="no-print fixed top-0 left-0 right-0 bg-[#0F1F3A] text-white px-6 py-3 flex items-center justify-between z-10">
        <span className="text-sm font-medium">Print Preview — PR1 {pr1.pr1_number}</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="text-xs text-[#BFC7D5] hover:text-white transition"
          >
            ← Back
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-1.5 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-xs font-semibold rounded-[4px] transition"
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      {/* Print body */}
      <div className="no-print pt-12" />
      <div style={{ maxWidth: 740, margin: '0 auto', padding: '20px 0' }}>

        {/* Header */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 0 }}>
          <tbody>
            <tr>
              <td style={{ width: '20%', border: '1px solid #000', padding: '6px 8px', verticalAlign: 'middle' }}>
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 9 }}>FORTUNE</div>
                <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 9 }}>GROUP</div>
                <div style={{ textAlign: 'center', fontSize: 8, color: '#555' }}>of Companies</div>
              </td>
              <td style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'center', verticalAlign: 'middle' }}>
                <div style={{ fontSize: 15, fontWeight: 'bold', letterSpacing: 1 }}>PURCHASE REQUEST</div>
                <div style={{ fontSize: 9, marginTop: 2 }}>Fortune Procurement Automation System</div>
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
                  {item?.description || ''}
                </td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '3px 6px', fontSize: 9, textAlign: 'center' }}>
                  {item?.unit_of_measure || ''}
                </td>
                <td style={{ border: '1px solid #000', borderTop: 'none', padding: '3px 6px', fontSize: 9, textAlign: 'right' }}>
                  {item ? (
                    (item as any).validated_soh !== undefined && (item as any).validated_soh !== null
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
                <div style={{ borderTop: '1px solid #000', paddingTop: 3, color: '#999', fontStyle: 'italic' }}>Pending</div>
              </td>
              <td style={{ width: '25%', border: '1px solid #000', borderTop: 'none', padding: '6px 8px', fontSize: 9, verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', marginBottom: 20 }}>Approved By:</div>
                <div style={{ borderTop: '1px solid #000', paddingTop: 3, color: '#999', fontStyle: 'italic' }}>Pending</div>
              </td>
              <td style={{ width: '25%', border: '1px solid #000', borderTop: 'none', padding: '6px 8px', fontSize: 9, verticalAlign: 'top' }}>
                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>For Warehouse Use:</div>
                <div style={{ fontSize: 8, color: '#555', marginBottom: 16 }}>SOH Verified / Remarks:</div>
                <div style={{ borderTop: '1px solid #000', paddingTop: 3, color: '#999', fontStyle: 'italic' }}>Pending</div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ fontSize: 8, color: '#888', textAlign: 'right', marginTop: 6 }}>
          Printed: {format(new Date(), 'MM/dd/yyyy hh:mm a')} · Fortune Procurement Automation System · PR1-v1
        </div>
      </div>
    </>
  );
}
