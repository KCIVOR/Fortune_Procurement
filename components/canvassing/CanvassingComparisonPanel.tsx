'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import {
  Trophy,
  Users,
  Store,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Info,
} from 'lucide-react';
import type { RfqDetailView, QuoteMatrixRow } from '@/types/canvassing';
import DetailInfoField from '@/components/shared/DetailInfoField';
import RawMaterialBadge from '@/components/shared/RawMaterialBadge';
import RequestorRemarks from '@/components/shared/RequestorRemarks';
import { PR1AttachmentsGallery } from '@/components/pr1/PR1AttachmentsSection';
import QuoteAttachmentPills from '@/components/rfq/QuoteAttachmentPills';
import { formatCommercialAmount } from '@/lib/price-visibility';
import { FileText, Building2, CalendarDays } from 'lucide-react';

const SUPPLIER_STATUS_COLOR: Record<string, string> = {
  invited:   'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100',
  submitted: 'bg-pq-success-100 text-pq-success-600 border-pq-success-100',
  declined:  'bg-pq-danger-100 text-pq-danger-600 border-pq-danger-100',
};

interface CanvassingComparisonPanelProps {
  detail: RfqDetailView;
  matrix: QuoteMatrixRow[];
  canViewPrices: boolean;
  /** Link for procurement to edit canvassing on the RFQ page. */
  editHref?: string | null;
}

export default function CanvassingComparisonPanel({
  detail,
  matrix,
  canViewPrices,
  editHref,
}: CanvassingComparisonPanelProps) {
  const { rfq, pr1, items, suppliers } = detail;
  const submittedSuppliers = suppliers.filter(s => s.status === 'submitted').length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold text-pq-neutral-900">Supplier Canvassing</h2>
          <p className="text-xs text-pq-neutral-500 mt-0.5">
            RFQ {rfq.rfq_number} · {rfq.status === 'closed' ? 'Canvassing closed' : 'In progress'}
          </p>
        </div>
        {editHref && (
          <Link
            href={editHref}
            className="text-xs font-semibold text-pq-primary-600 hover:underline shrink-0"
          >
            Open RFQ workspace →
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-3">
            <h3 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">RFQ Summary</h3>
            <DetailInfoField
              icon={<FileText className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="RFQ Number"
              value={rfq.rfq_number}
              labelTone="muted"
              labelSpacing="compact"
              valueClassName="font-mono font-semibold"
            />
            <DetailInfoField
              icon={<Building2 className="w-3.5 h-3.5 text-pq-neutral-400" />}
              label="Department"
              value={pr1.department_name_snapshot}
              labelTone="muted"
              labelSpacing="compact"
            />
            {rfq.deadline && (
              <DetailInfoField
                icon={<CalendarDays className="w-3.5 h-3.5 text-pq-neutral-400" />}
                label="RFQ Deadline"
                value={format(new Date(rfq.deadline), 'MMM d, yyyy')}
                labelTone="muted"
                labelSpacing="compact"
              />
            )}
          </div>

          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-pq-neutral-200">
              <Users className="w-4 h-4 text-pq-neutral-400" />
              <h3 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">
                Suppliers ({suppliers.length})
              </h3>
            </div>
            {suppliers.length === 0 ? (
              <p className="text-xs text-pq-neutral-400 px-5 py-4">No suppliers assigned.</p>
            ) : (
              <div className="divide-y divide-pq-neutral-200 max-h-[320px] overflow-y-auto">
                {suppliers.map(s => (
                  <div key={s.id} className="px-5 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium text-pq-neutral-900">{s.supplier_name_snapshot}</p>
                      {s.is_external && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5">
                          <Store className="w-2.5 h-2.5 shrink-0" />
                          External
                        </span>
                      )}
                    </div>
                    <span className={`inline-block mt-1 text-[10px] font-medium border rounded-full px-2 py-0.5 ${SUPPLIER_STATUS_COLOR[s.status] ?? SUPPLIER_STATUS_COLOR.invited}`}>
                      {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-pq-neutral-200">
              <h3 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">Items ({items.length})</h3>
            </div>
            <div className="divide-y divide-pq-neutral-200">
              {items.map(item => (
                <div key={item.id} className="px-5 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-pq-neutral-900">{item.description}</p>
                    <RawMaterialBadge isRawMaterial={item.is_raw_material} size="sm" />
                  </div>
                  <p className="text-xs text-pq-neutral-400 mt-0.5">
                    {item.quantity_requested} {item.unit_of_measure}
                  </p>
                  {item.remarks && <RequestorRemarks text={item.remarks} />}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-pq-neutral-200 flex-wrap">
              <Trophy className="w-4 h-4 text-pq-neutral-400" />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-pq-neutral-900">Quotation Comparison</h3>
                <p className="text-[10px] text-pq-neutral-400 mt-0.5">
                  Highlighted cells are the selected winning suppliers per item.
                </p>
              </div>
              <span className="text-xs text-pq-neutral-400 shrink-0">
                {submittedSuppliers}/{suppliers.length} responded
              </span>
            </div>

            {suppliers.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-pq-neutral-400">No suppliers assigned yet.</p>
              </div>
            ) : matrix.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-pq-neutral-400">No quotation data available.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-sm w-max min-w-full table-fixed">
                  <colgroup>
                    <col className="w-[200px]" />
                    {suppliers.map(s => (
                      <col key={s.id} className="w-[220px]" />
                    ))}
                  </colgroup>
                  <thead>
                    <tr className="bg-pq-neutral-50 border-b border-pq-neutral-200">
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-pq-neutral-500">Item</th>
                      {suppliers.map(s => (
                        <th key={s.id} className="text-left px-3 py-2.5 text-xs font-semibold text-pq-neutral-500 border-l border-pq-neutral-200">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{s.supplier_name_snapshot}</span>
                            {s.is_external && (
                              <span className="shrink-0 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1 py-0.5">
                                Ext
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pq-neutral-200">
                    {matrix.map(row => (
                      <ReadOnlyMatrixRow
                        key={row.item.id}
                        row={row}
                        suppliers={suppliers}
                        canViewPrices={canViewPrices}
                        requestType={pr1.request_type ?? 'goods'}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyMatrixRow({
  row,
  suppliers,
  canViewPrices,
  requestType,
}: {
  row: QuoteMatrixRow;
  suppliers: { id: string; supplier_name_snapshot: string; is_external?: boolean }[];
  canViewPrices: boolean;
  requestType: 'goods' | 'services' | 'raw_material';
}) {
  return (
    <tr className="hover:bg-pq-neutral-50 transition">
      <td className="px-3 py-2.5 align-top">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-pq-neutral-900 text-xs leading-snug">{row.item.description}</p>
              <RawMaterialBadge isRawMaterial={row.item.is_raw_material} size="sm" />
            </div>
            <p className="text-xs text-pq-neutral-400 mt-0.5">
              {row.item.quantity_requested} {row.item.unit_of_measure}
            </p>
            {row.item.remarks && <RequestorRemarks text={row.item.remarks} />}
          </div>
          {row.item.attachments && row.item.attachments.length > 0 && (
            <div className="shrink-0 mt-0.5">
              <PR1AttachmentsGallery attachments={row.item.attachments} />
            </div>
          )}
        </div>
      </td>
      {suppliers.map(supplier => {
        const quote = row.quotes.find(q => q.rfq_supplier_id === supplier.id);
        const isSelected = row.selected_rfq_supplier_id === supplier.id;
        const explicitNoQuote = quote?.response_status === 'no_quote';

        return (
          <td
            key={supplier.id}
            className={`px-3 py-2.5 align-top border-l border-pq-neutral-200 ${isSelected ? 'bg-pq-success-100' : ''}`}
          >
            {!quote?.quote_id ? (
              <p className="text-xs text-pq-neutral-400 italic">No quote</p>
            ) : explicitNoQuote ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-rose-700">No Quote</p>
                <p className="text-xs text-pq-neutral-500">{quote.no_quote_reason?.trim() || '—'}</p>
              </div>
            ) : quote.unit_price === 0 ? (
              <p className="text-xs text-pq-neutral-400 italic">No quote</p>
            ) : (
              <ReadOnlyQuoteCell quote={quote} row={row} canViewPrices={canViewPrices} requestType={requestType} isSelected={isSelected} />
            )}
          </td>
        );
      })}
    </tr>
  );
}

function ReadOnlyQuoteCell({
  quote,
  row,
  canViewPrices,
  requestType,
  isSelected,
}: {
  quote: QuoteMatrixRow['quotes'][number];
  row: QuoteMatrixRow;
  canViewPrices: boolean;
  requestType: 'goods' | 'services' | 'raw_material';
  isSelected: boolean;
}) {
  const productName = quote.supplier_product_name?.trim() ?? '';
  const quotedDesc = quote.quoted_description?.trim() ?? '';
  const showQuotedDesc = quotedDesc.length > 0 && quotedDesc.toLowerCase() !== productName.toLowerCase();
  const hasProduct = !!quote.supplier_product_id;
  const isVerified = quote.supplier_product_status === 'verified';
  const verification = quote.verification_status;
  const isRawMats = row.item.is_raw_material === true;
  // Catalog products are only ever categorized 'goods' | 'services' — raw
  // material requests are catalogued as 'goods', so compare against that.
  const catalogRequestType = requestType === 'raw_material' ? 'goods' : requestType;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {hasProduct && isVerified ? (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded px-1.5 py-0.5">
            <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate max-w-[140px]">{productName || 'Verified product'}</span>
          </span>
        ) : verification === 'manual' ? (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold border rounded px-1.5 py-0.5 bg-pq-neutral-50 text-pq-neutral-600 border-pq-neutral-200">
            <Info className="w-2.5 h-2.5 shrink-0" />
            Manual entry
          </span>
        ) : verification === 'unverified' ? (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-pq-neutral-50 text-pq-neutral-600 border border-pq-neutral-200 rounded px-1.5 py-0.5">
            <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
            Unverified
          </span>
        ) : null}
        {quote.is_alternative && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-orange-600 bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
            Alt.
          </span>
        )}
        {quote.is_alternative && quote.substitute_decision === 'accepted' && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-pq-success-600 bg-pq-success-100 border border-pq-success-100 rounded px-1.5 py-0.5">
            <CheckCircle2 className="w-2.5 h-2.5" /> Accepted
          </span>
        )}
        {quote.is_alternative && quote.substitute_decision === 'rejected' && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5">
            <XCircle className="w-2.5 h-2.5" /> Rejected
          </span>
        )}
        {quote.is_alternative && quote.substitute_decision === null && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-pq-warning-600 bg-pq-warning-100 border border-pq-warning-100 rounded px-1.5 py-0.5">
            <Clock className="w-2.5 h-2.5" /> Pending
          </span>
        )}
        {isSelected && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-pq-success-700 bg-pq-success-100 border border-pq-success-200 rounded px-1.5 py-0.5">
            <CheckCircle2 className="w-2.5 h-2.5" /> Selected
          </span>
        )}
      </div>

      {showQuotedDesc && (
        <p className="text-xs text-pq-neutral-500 leading-snug">{quotedDesc}</p>
      )}

      <div className="text-xs text-pq-neutral-500 leading-snug">
        <p className="font-bold text-sm text-pq-neutral-900">
          {formatCommercialAmount(quote.unit_price, canViewPrices)}
          {canViewPrices && (
            <span className="text-xs font-normal text-pq-neutral-400"> / {row.item.unit_of_measure}</span>
          )}
        </p>
        <p>
          Total {formatCommercialAmount(quote.total_price, canViewPrices)} · Lead {quote.lead_time_days}d
        </p>
      </div>

      {quote.remarks && (
        <p className="text-xs text-pq-neutral-400 italic leading-snug">&ldquo;{quote.remarks}&rdquo;</p>
      )}

      {quote.attachments && quote.attachments.length > 0 && (
        <QuoteAttachmentPills attachments={quote.attachments} />
      )}

      {quote.supplier_product_item_type !== null && quote.supplier_product_item_type !== catalogRequestType && (
        <p className="text-[10px] font-semibold text-pq-warning-700 flex items-center gap-0.5">
          <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
          Type mismatch
        </p>
      )}

      {isRawMats && verification === 'unverified' && (
        <p className="text-[10px] text-pq-warning-700">Raw material — unverified quote</p>
      )}
    </div>
  );
}
