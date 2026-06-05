'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import { useAuth } from '@/context/AuthContext';
import {
  fetchSupplierQuoteDetail,
  submitSupplierQuotation,
} from '@/lib/canvassing';
import type { SupplierQuoteDetail, QuoteDraft } from '@/lib/canvassing';
import {
  getActiveProductsForCurrentSupplier,
  createAndSubmitSupplierProductForRFQ,
  type RFQProductProposalInput,
} from '@/lib/supplier-products';
import type { SupplierProduct } from '@/types/database';
import {
  ChevronLeft,
  CircleCheck as CheckCircle2,
  TriangleAlert as AlertTriangle,
  CalendarDays,
  FileText,
  Send,
  Info,
  Package,
  PlusCircle,
  Ban,
  X,
  Loader,
  Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import RawMaterialBadge from '@/components/shared/RawMaterialBadge';

const VERIFIED_PRODUCT_PICKER_PAGE_SIZE = 10;

const UNCATEGORIZED_CATEGORY_KEY = '__uncat__';

/** Preset labels stored as `no_quote_reason` (plus free text when "Other"). */
const NO_QUOTE_REASON_PRESETS = [
  'Not available',
  'Not in product line',
  'Cannot meet required lead time',
  'MOQ not met',
  'Discontinued',
] as const;

const NO_QUOTE_OTHER = '__other__';

function noQuoteReasonSelectValue(draft: QuoteDraft): string {
  const r = (draft.no_quote_reason ?? '').trim();
  if (!r) return '';
  if ((NO_QUOTE_REASON_PRESETS as readonly string[]).includes(r)) return r;
  return NO_QUOTE_OTHER;
}

function supplierProductCategoryKey(p: SupplierProduct): string {
  const t = p.category?.trim();
  return t ? t : UNCATEGORIZED_CATEGORY_KEY;
}

function categoryOptionLabel(key: string): string {
  return key === UNCATEGORIZED_CATEGORY_KEY ? 'Uncategorized' : key;
}

function previewField(val: string | null, maxLen: number): string {
  if (!val?.trim()) return '—';
  const t = val.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Per-item UI mode: how the supplier is filling this line.
 *
 * Phase 5 (Raw Mats): added `manual_entry`. Suppliers may now fill a line
 * without picking from their catalog (no `supplier_product_id`). The
 * pick-from-catalog mode (`select_verified`) accepts both verified AND
 * in-flight products under the new rule; the existing label is kept for
 * UX continuity but the underlying picker is broadened.
 */
type LineMode = 'select_verified' | 'manual_entry' | 'propose_new' | 'no_quote';

/** Phase 5 (Raw Mats): visual treatment for the catalog product status. */
type ProductBadgeKind = 'verified' | 'pending' | 'unknown';

function describeProductStatus(status: string | null | undefined): {
  kind: ProductBadgeKind;
  label: string;
} {
  switch (status) {
    case 'verified':
      return { kind: 'verified', label: 'Verified' };
    case 'submitted':
      return { kind: 'pending', label: 'Pending review' };
    case 'under_review':
      return { kind: 'pending', label: 'Under review' };
    case 'pending_tsqa':
      return { kind: 'pending', label: 'Pending TSQA' };
    default:
      return { kind: 'unknown', label: status ? status.replace(/_/g, ' ') : 'Unknown' };
  }
}

/** Pending proposal form state per item. */
interface ProposalForm {
  product_name:   string;
  product_code:   string;
  category:       string;
  description:    string;
  specifications: string;
}

const EMPTY_PROPOSAL: ProposalForm = {
  product_name:   '',
  product_code:   '',
  category:       '',
  description:    '',
  specifications: '',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupplierQuotationPage() {
  const { rfqSupplierId } = useParams<{ rfqSupplierId: string }>();
  const { profile } = useAuth();

  const [detail, setDetail]         = useState<SupplierQuoteDetail | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [drafts, setDrafts]         = useState<QuoteDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitted, setSubmitted]   = useState(false);

  // Phase 5 (Raw Mats): renamed from `verifiedProducts`. Now contains
  // verified AND in-flight catalog products (submitted / under_review /
  // pending_tsqa) so suppliers can offer them in the relaxed picker.
  const [availableProducts, setAvailableProducts] = useState<SupplierProduct[]>([]);
  const [productsLoaded,   setProductsLoaded]   = useState(false);

  // Phase 8: per-item UI mode and proposal state
  const [lineModes,       setLineModes]       = useState<LineMode[]>([]);
  const [proposalForms,   setProposalForms]   = useState<ProposalForm[]>([]);
  const [proposalBusy,    setProposalBusy]    = useState<boolean[]>([]);
  const [proposalErrors,  setProposalErrors]  = useState<string[]>([]);
  // Tracks proposed (pending) products attached to a line (not yet verified)
  const [pendingProducts, setPendingProducts] = useState<Record<number, SupplierProduct>>({});

  // Catalog product picker modal (per RFQ line)
  const [pickerLineIndex, setPickerLineIndex] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCategory, setPickerCategory] = useState<string>('__all__');
  const [pickerPage, setPickerPage] = useState(1);

  useEffect(() => {
    if (!rfqSupplierId || !profile) return;

    Promise.all([
      fetchSupplierQuoteDetail(rfqSupplierId, profile.id),
      getActiveProductsForCurrentSupplier(profile),
    ])
      .then(([d, products]) => {
        if (!d) { setError('RFQ not found or access denied.'); return; }
        setDetail(d);
        setAvailableProducts(products);
        setProductsLoaded(true);

        const initialDrafts: QuoteDraft[] = d.items.map(item => {
          const existing = d.quotes.find(q => q.pr1_item_id === item.id);
          const isNoQuote = existing?.response_status === 'no_quote';
          return {
            pr1_item_id:         item.id,
            quoted_description:  isNoQuote
              ? 'No quote'
              : (existing?.quoted_description ?? item.description),
            is_alternative:      existing?.is_alternative ?? false,
            unit_price:          existing ? Number(existing.unit_price) : 0,
            lead_time_days:      existing?.lead_time_days ?? 0,
            remarks:             existing?.remarks ?? '',
            supplier_product_id: isNoQuote ? null : (existing?.supplier_product_id ?? null),
            response_status:     isNoQuote ? 'no_quote' : 'quoted',
            no_quote_reason:     isNoQuote ? (existing?.no_quote_reason ?? null) : null,
          };
        });
        setDrafts(initialDrafts);

        // Determine initial line mode (Phase 5 update — manual entries are
        // first-class, and the picker carries verified + in-flight products).
        const initialModes: LineMode[] = initialDrafts.map(draft => {
          if (draft.response_status === 'no_quote') return 'no_quote';
          if (!draft.supplier_product_id) {
            // No product link: brand-new lines start at the catalog picker;
            // existing quotes that the supplier filled manually before reload
            // come back as manual_entry. We detect "filled manually" by
            // checking that the line already has a price.
            return draft.unit_price > 0 ? 'manual_entry' : 'select_verified';
          }
          const inActiveCatalog = products.some(p => p.id === draft.supplier_product_id);
          return inActiveCatalog ? 'select_verified' : 'propose_new';
        });
        setLineModes(initialModes);
        setProposalForms(d.items.map(() => ({ ...EMPTY_PROPOSAL })));
        setProposalBusy(d.items.map(() => false));
        setProposalErrors(d.items.map(() => ''));

        if (d.rfqSupplier.status === 'submitted') setSubmitted(true);
      })
      .catch(() => setError('Failed to load RFQ details.'))
      .finally(() => setLoading(false));
  }, [rfqSupplierId, profile]);

  // ── Draft helpers ────────────────────────────────────────────────────────────

  const updateDraft = (index: number, field: keyof QuoteDraft, value: unknown) => {
    setDrafts(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleProductSelect = (index: number, productId: string) => {
    const product = availableProducts.find(p => p.id === productId) ?? null;
    setDrafts(prev => {
      const next = [...prev];
      const currentDesc = next[index].quoted_description;
      next[index] = {
        ...next[index],
        supplier_product_id: productId || null,
        is_alternative:      false,
        response_status:     'quoted',
        no_quote_reason:     null,
        // Always sync quoted line text to the newly selected verified product name so
        // switching A → B updates the field (previously only updated when description
        // was still empty or equal to the PR1 item description).
        quoted_description:
          productId && product ? product.product_name : currentDesc,
      };
      return next;
    });
  };

  const openProductPicker = (lineIndex: number) => {
    setPickerLineIndex(lineIndex);
    setPickerSearch('');
    setPickerCategory('__all__');
    setPickerPage(1);
  };

  const closeProductPicker = () => {
    setPickerLineIndex(null);
  };

  const confirmPickerProduct = (productId: string) => {
    if (pickerLineIndex === null) return;
    handleProductSelect(pickerLineIndex, productId);
    closeProductPicker();
  };

  useEffect(() => {
    setPickerPage(1);
  }, [pickerSearch, pickerCategory]);

  const pickerCategoryKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const p of availableProducts) {
      keys.add(supplierProductCategoryKey(p));
    }
    return Array.from(keys).sort((a, b) => {
      if (a === UNCATEGORIZED_CATEGORY_KEY) return 1;
      if (b === UNCATEGORIZED_CATEGORY_KEY) return -1;
      return a.localeCompare(b);
    });
  }, [availableProducts]);

  const pickerFilteredProducts = useMemo(() => {
    let list = availableProducts;
    if (pickerCategory !== '__all__') {
      list = list.filter(p => supplierProductCategoryKey(p) === pickerCategory);
    }
    const q = pickerSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(p => {
        const blob = [
          p.product_name,
          p.product_code ?? '',
          p.category ?? '',
          p.description ?? '',
          p.specifications ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      });
    }
    return list;
  }, [availableProducts, pickerCategory, pickerSearch]);

  const pickerTotalPages = Math.max(
    1,
    Math.ceil(pickerFilteredProducts.length / VERIFIED_PRODUCT_PICKER_PAGE_SIZE)
  );
  const pickerPageClamped = Math.min(pickerPage, pickerTotalPages);
  const pickerPageItems = useMemo(() => {
    const start = (pickerPageClamped - 1) * VERIFIED_PRODUCT_PICKER_PAGE_SIZE;
    return pickerFilteredProducts.slice(start, start + VERIFIED_PRODUCT_PICKER_PAGE_SIZE);
  }, [pickerFilteredProducts, pickerPageClamped]);

  // ── Line mode toggle ─────────────────────────────────────────────────────────

  const switchToVerifiedSelect = (index: number) => {
    setLineModes(prev => { const n = [...prev]; n[index] = 'select_verified'; return n; });
    setProposalErrors(prev => { const n = [...prev]; n[index] = ''; return n; });
    setPendingProducts(prev => { const n = { ...prev }; delete n[index]; return n; });
    setDrafts(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        supplier_product_id: null,
        is_alternative:      false,
        response_status:     'quoted',
        no_quote_reason:     null,
      };
      return next;
    });
  };

  // Phase 5 (Raw Mats): manual-entry mode. Supplier fills price/lead/desc
  // without picking from the catalog. The quote stores `supplier_product_id = null`
  // and keeps `response_status = 'quoted'`. Procurement sees this as a
  // "manual entry" verification status during canvassing (Phase 6) and may
  // award only after providing a justification when the line is raw mats
  // (Phase 7).
  const switchToManualEntry = (index: number) => {
    setLineModes(prev => { const n = [...prev]; n[index] = 'manual_entry'; return n; });
    setProposalErrors(prev => { const n = [...prev]; n[index] = ''; return n; });
    setPendingProducts(prev => { const n = { ...prev }; delete n[index]; return n; });
    setDrafts(prev => {
      const next = [...prev];
      const fallbackDesc = detail?.items[index]?.description ?? next[index].quoted_description;
      next[index] = {
        ...next[index],
        supplier_product_id: null,
        response_status:     'quoted',
        no_quote_reason:     null,
        // If the supplier had a verified product selected, swap the line
        // text to the original PR1 description so the manual mode starts
        // from a sensible default rather than the previous product name.
        quoted_description:
          next[index].quoted_description.trim().length === 0
            ? fallbackDesc
            : next[index].quoted_description,
      };
      return next;
    });
  };

  const switchToProposeNew = (index: number) => {
    setLineModes(prev => { const n = [...prev]; n[index] = 'propose_new'; return n; });
    const hasPending = pendingProducts[index];
    setDrafts(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        response_status: 'quoted',
        no_quote_reason: null,
        ...(!hasPending ? { supplier_product_id: null } : {}),
      };
      return next;
    });
  };

  const switchToNoQuote = (index: number) => {
    setLineModes(prev => { const n = [...prev]; n[index] = 'no_quote'; return n; });
    setProposalErrors(prev => { const n = [...prev]; n[index] = ''; return n; });
    setPendingProducts(prev => { const n = { ...prev }; delete n[index]; return n; });
    setDrafts(prev => {
      const next = [...prev];
      next[index] = {
        ...next[index],
        response_status:     'no_quote',
        supplier_product_id: null,
        unit_price:          0,
        lead_time_days:      0,
        is_alternative:      false,
        quoted_description:  'No quote',
        no_quote_reason:     null,
      };
      return next;
    });
  };

  // ── Proposal form ────────────────────────────────────────────────────────────

  const updateProposalForm = (index: number, field: keyof ProposalForm, value: string) => {
    setProposalForms(prev => {
      const n = [...prev];
      n[index] = { ...n[index], [field]: value };
      return n;
    });
  };

  const handlePropose = async (index: number) => {
    if (!profile) return;
    const form = proposalForms[index];
    if (!form.product_name.trim()) {
      setProposalErrors(prev => { const n = [...prev]; n[index] = 'Product name is required.'; return n; });
      return;
    }

    setProposalBusy(prev => { const n = [...prev]; n[index] = true; return n; });
    setProposalErrors(prev => { const n = [...prev]; n[index] = ''; return n; });

    try {
      const input: RFQProductProposalInput = {
        product_name:   form.product_name.trim(),
        product_code:   form.product_code.trim()   || null,
        category:       form.category.trim()       || null,
        description:    form.description.trim()    || null,
        specifications: form.specifications.trim() || null,
      };
      const product = await createAndSubmitSupplierProductForRFQ(input, profile);

      // Attach to the quote draft line
      setPendingProducts(prev => ({ ...prev, [index]: product }));
      setDrafts(prev => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          supplier_product_id: product.id,
          response_status:     'quoted',
          no_quote_reason:     null,
          quoted_description:  product.product_name,
        };
        return next;
      });
      // Clear form
      setProposalForms(prev => {
        const n = [...prev];
        n[index] = { ...EMPTY_PROPOSAL };
        return n;
      });
    } catch (err: unknown) {
      setProposalErrors(prev => {
        const n = [...prev];
        n[index] = (err as Error)?.message || 'Failed to propose product.';
        return n;
      });
    } finally {
      setProposalBusy(prev => { const n = [...prev]; n[index] = false; return n; });
    }
  };

  const cancelProposal = (index: number) => {
    setPendingProducts(prev => { const n = { ...prev }; delete n[index]; return n; });
    setProposalForms(prev => {
      const n = [...prev];
      n[index] = { ...EMPTY_PROPOSAL };
      return n;
    });
    setProposalErrors(prev => { const n = [...prev]; n[index] = ''; return n; });
    updateDraft(index, 'supplier_product_id', null);
    updateDraft(index, 'is_alternative', false);
    updateDraft(index, 'response_status', 'quoted');
    updateDraft(index, 'no_quote_reason', null);
    updateDraft(index, 'quoted_description', detail?.items[index]?.description ?? '');
  };

  const everyLineResponded = useMemo(() => {
    if (!detail || !productsLoaded) return false;
    return drafts.every((d, i) => {
      const mode = lineModes[i] ?? 'select_verified';
      if (mode === 'no_quote') {
        return (d.no_quote_reason?.trim() ?? '').length > 0;
      }
      // Phase 5 (Raw Mats): manual entry is now valid without supplier_product_id.
      // Catalog modes (select_verified / propose_new) still require a product link.
      if (mode !== 'manual_entry' && !d.supplier_product_id) return false;
      // Manual entry needs a non-empty description so procurement sees something
      // beyond the original PR1 line label.
      if (mode === 'manual_entry' && d.quoted_description.trim().length === 0) return false;
      return d.unit_price > 0;
    });
  }, [drafts, lineModes, productsLoaded, detail]);

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!detail) return;

    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      const mode = lineModes[i] ?? 'select_verified';
      if (mode === 'no_quote') {
        if (!(d.no_quote_reason?.trim() ?? '')) {
          setSubmitError('Please select or enter a reason for each line marked “No Quote”.');
          return;
        }
        continue;
      }
      // Phase 5: catalog modes still need a product link; manual entry doesn't.
      if (mode !== 'manual_entry' && !d.supplier_product_id) {
        setSubmitError(
          'Please select a catalog product, propose a new one, fill it manually, or mark “No Quote” on each line.'
        );
        return;
      }
      if (mode === 'manual_entry' && d.quoted_description.trim().length === 0) {
        setSubmitError('Please describe the item for each manual-entry line.');
        return;
      }
      if (d.unit_price <= 0) {
        setSubmitError('Please enter a unit price greater than 0 for each quoted line.');
        return;
      }
    }

    setSubmitting(true);
    setSubmitError('');
    try {
      await submitSupplierQuotation(rfqSupplierId, drafts);
      setSubmitted(true);
    } catch (e: unknown) {
      setSubmitError((e as Error)?.message ?? 'Failed to submit quotation.');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render guards ────────────────────────────────────────────────────────────

  if (loading) return (
    <AppShell title="Submit Quotation">
      <div className="flex items-center justify-center h-64">
        <LoadingState message="Loading RFQ..." />
      </div>
    </AppShell>
  );

  if (error || !detail) return (
    <AppShell title="Submit Quotation">
      <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-4 text-sm text-pq-danger-600">
        {error || 'RFQ not found.'}
      </div>
    </AppShell>
  );

  const { rfq, pr1, items } = detail;
  const isClosed   = rfq.status === 'closed';
  const canSubmit  = rfq.status === 'open' && !isClosed;
  const isReadOnly = isClosed;

  return (
    <AppShell title="Submit Quotation">
      <div className="mb-2">
        <Link
          href="/supplier/quotations"
          className="inline-flex items-center gap-1 text-xs text-pq-neutral-500 hover:text-pq-neutral-900 transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to RFQ Inbox
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-pq-neutral-900 font-mono">{rfq.rfq_number}</h1>
            <span className={`inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-1 ${
              rfq.status === 'open'   ? 'bg-pq-warning-100 text-pq-warning-600 border-pq-warning-100' :
              rfq.status === 'closed' ? 'bg-pq-success-100 text-pq-success-600 border-pq-success-100' :
              'bg-pq-neutral-50 text-pq-neutral-500 border-pq-neutral-200'
            }`}>
              {rfq.status.charAt(0).toUpperCase() + rfq.status.slice(1)}
            </span>
            {submitted && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2.5 py-1 bg-pq-success-100 text-pq-success-600 border-pq-success-100">
                <CheckCircle2 className="w-3 h-3" />
                Quotation Submitted
              </span>
            )}
          </div>
          <p className="text-sm text-pq-neutral-500">
            {pr1.department_name_snapshot} · {pr1.purpose}
          </p>
        </div>
      </div>

      {/* Status banners */}
      {submitted && canSubmit && (
        <div className="flex items-start gap-3 bg-pq-success-100 border border-pq-success-100 rounded-md px-5 py-4 mb-6">
          <CheckCircle2 className="w-4 h-4 text-pq-success-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-pq-success-600">Quotation submitted successfully</p>
            <p className="text-xs text-pq-success-600 mt-0.5">
              You can update your prices below and resubmit before the deadline.
            </p>
          </div>
        </div>
      )}
      {isClosed && (
        <div className="flex items-start gap-3 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md px-5 py-4 mb-6">
          <Info className="w-4 h-4 text-pq-neutral-500 mt-0.5 shrink-0" />
          <p className="text-sm text-pq-neutral-500">
            This RFQ is closed. Procurement has finalised their selection.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-md border border-pq-neutral-200 p-5 space-y-3">
            <h2 className="text-xs font-bold text-pq-neutral-500 uppercase tracking-wide">RFQ Details</h2>
            <InfoField icon={FileText}    label="PR1 Number" value={pr1.pr1_number} mono />
            <InfoField icon={FileText}    label="Purpose"    value={pr1.purpose} />
            {rfq.deadline && (
              <InfoField
                icon={CalendarDays}
                label="Deadline"
                value={format(new Date(rfq.deadline), 'MMM d, yyyy')}
              />
            )}
            {rfq.notes && (
              <div>
                <p className="text-xs font-semibold text-pq-neutral-400 uppercase tracking-wide mb-0.5">
                  Procurement Notes
                </p>
                <p className="text-sm text-pq-neutral-900 leading-snug">{rfq.notes}</p>
              </div>
            )}
          </div>

          {!isReadOnly && (
            <div className="bg-pq-warning-100 border border-pq-warning-100 rounded-md p-4">
              <p className="text-xs font-semibold text-pq-warning-600 mb-1">Instructions</p>
              <ul className="text-xs text-pq-warning-600 space-y-1 list-disc list-inside">
                <li>Per item, choose: <strong>catalog product</strong>, <strong>manual entry</strong>, <strong>propose new product</strong>, or <strong>No Quote</strong></li>
                <li>Quoted lines need price and lead time</li>
                <li>Catalog products may be verified or pending — procurement sees the status during canvassing</li>
                <li>Proposed products await Procurement validation before award</li>
                <li>Mark &ldquo;Alternative item&rdquo; when offering a substitute — requestor must approve before award</li>
              </ul>
            </div>
          )}

          {productsLoaded && availableProducts.length > 0 && !isReadOnly && (
            <div className="bg-white rounded-md border border-pq-neutral-200 p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Package className="w-3.5 h-3.5 text-pq-neutral-400" />
                <p className="text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                  Catalog Products
                </p>
              </div>
              <p className="text-xs text-pq-neutral-400">
                {availableProducts.length} available for selection
                {(() => {
                  const verifiedCount = availableProducts.filter(p => p.status === 'verified').length;
                  const pendingCount = availableProducts.length - verifiedCount;
                  return pendingCount > 0
                    ? ` · ${verifiedCount} verified, ${pendingCount} pending`
                    : ' · all verified';
                })()}
              </p>
            </div>
          )}
        </div>

        {/* Main form */}
        <div className="lg:col-span-3 space-y-4">
          {items.map((item, index) => {
            const draft         = drafts[index];
            const mode          = lineModes[index] ?? 'select_verified';
            const proposalForm  = proposalForms[index] ?? EMPTY_PROPOSAL;
            const pendingProduct = pendingProducts[index] ?? null;
            if (!draft) return null;

            const selectedCatalog = availableProducts.find(
              p => p.id === draft.supplier_product_id
            ) ?? null;
            const isProposedCatalogLine =
              mode !== 'no_quote' &&
              mode !== 'manual_entry' &&
              (mode === 'propose_new' ||
                (!!draft.supplier_product_id &&
                  !availableProducts.some(p => p.id === draft.supplier_product_id)));
            const hideQuotePricing =
              mode === 'no_quote' ||
              (isReadOnly && draft.response_status === 'no_quote');

            return (
              <div
                key={item.id}
                className="bg-white rounded-md border border-pq-neutral-200 overflow-hidden"
              >
                {/* Item header */}
                <div className="flex items-center gap-3 px-5 py-3.5 bg-pq-neutral-50 border-b border-pq-neutral-200">
                  <span className="w-6 h-6 rounded-full bg-pq-neutral-200 text-pq-neutral-500 text-xs font-bold flex items-center justify-center shrink-0">
                    {item.item_order}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-pq-neutral-900">{item.description}</p>
                      <RawMaterialBadge isRawMaterial={item.is_raw_material} size="sm" />
                    </div>
                    <p className="text-xs text-pq-neutral-400">
                      {item.item_code && <span className="font-mono">{item.item_code} · </span>}
                      Qty: <strong>{item.quantity_requested}</strong> {item.unit_of_measure}
                    </p>
                  </div>
                </div>

                <div className="p-5 space-y-4">

                  {isReadOnly && draft.response_status === 'no_quote' && (
                    <div className="rounded-md border border-rose-100 bg-rose-50/80 px-4 py-3">
                      <p className="text-[10px] font-semibold text-rose-800 uppercase tracking-wide">No Quote</p>
                      <p className="text-xs text-rose-900 mt-0.5 font-semibold">Cannot supply</p>
                      <p className="text-sm text-pq-neutral-900 mt-2">{draft.no_quote_reason?.trim() || '—'}</p>
                    </div>
                  )}

                  {/* ── Phase 5/7/8: product section ── */}
                  {!isReadOnly && productsLoaded && (
                    <>
                      {/* Mode tabs */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => switchToVerifiedSelect(index)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
                            mode === 'select_verified'
                              ? 'bg-pq-primary-600 text-white border-pq-primary-600'
                              : 'bg-white text-pq-neutral-500 border-pq-neutral-200 hover:bg-pq-neutral-50'
                          }`}
                        >
                          <Package className="inline w-3 h-3 mr-1" />
                          Select Catalog Product
                        </button>
                        <button
                          type="button"
                          onClick={() => switchToManualEntry(index)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
                            mode === 'manual_entry'
                              ? 'bg-pq-primary-600 text-white border-pq-primary-600'
                              : 'bg-white text-pq-neutral-500 border-pq-neutral-200 hover:bg-pq-neutral-50'
                          }`}
                        >
                          <FileText className="inline w-3 h-3 mr-1" />
                          Manual Entry
                        </button>
                        <button
                          type="button"
                          onClick={() => switchToProposeNew(index)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
                            mode === 'propose_new'
                              ? 'bg-pq-primary-600 text-white border-pq-primary-600'
                              : 'bg-white text-pq-neutral-500 border-pq-neutral-200 hover:bg-pq-neutral-50'
                          }`}
                        >
                          <PlusCircle className="inline w-3 h-3 mr-1" />
                          Propose New Product
                        </button>
                        <button
                          type="button"
                          onClick={() => switchToNoQuote(index)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-md border transition ${
                            mode === 'no_quote'
                              ? 'bg-slate-700 text-white border-slate-700'
                              : 'bg-white text-pq-neutral-500 border-pq-neutral-200 hover:bg-pq-neutral-50'
                          }`}
                        >
                          <Ban className="inline w-3 h-3 mr-1" />
                          No Quote
                        </button>
                      </div>

                      {/* Phase 5: raw-mats inline warning when supplier picks
                          unverified or manual entry on a raw-mats line. The
                          warning is informational — submission still proceeds. */}
                      {item.is_raw_material && mode !== 'no_quote' && (() => {
                        const showWarn =
                          mode === 'manual_entry' ||
                          (mode === 'select_verified' && selectedCatalog && selectedCatalog.status !== 'verified') ||
                          mode === 'propose_new';
                        if (!showWarn) return null;
                        return (
                          <div className="flex items-start gap-2 rounded-md border border-pq-warning-100 bg-pq-warning-100/60 px-3 py-2 text-xs text-pq-warning-700">
                            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                            <span>
                              This is a <strong>raw material</strong> line. You may submit with a
                              {mode === 'manual_entry'
                                ? ' manual entry'
                                : mode === 'propose_new'
                                  ? ' newly proposed product (pending validation)'
                                  : ' product still pending verification'}
                              ; procurement will see the verification status during canvassing
                              and may request justification before awarding.
                            </span>
                          </div>
                        );
                      })()}

                      {/* Select catalog product panel (Phase 5: verified + in-flight) */}
                      {mode === 'select_verified' && (
                        <div>
                          {availableProducts.length === 0 ? (
                            <div className="flex items-center gap-2 px-3 py-2 border border-pq-neutral-200 bg-pq-neutral-50 rounded-md text-xs text-pq-neutral-600">
                              <Info className="w-3.5 h-3.5 shrink-0" />
                              No catalog products yet.{' '}
                              <Link href="/supplier/products" className="underline font-medium">
                                Add to your Product Catalog
                              </Link>{' '}
                              or use &ldquo;Manual Entry&rdquo;, &ldquo;Propose New Product&rdquo;, or &ldquo;No Quote&rdquo; above.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {selectedCatalog ? (
                                (() => {
                                  const productBadge = describeProductStatus(selectedCatalog.status);
                                  const isUnverified = productBadge.kind !== 'verified';
                                  const cardTone = isUnverified
                                    ? 'border-pq-warning-100 bg-pq-warning-100/50'
                                    : 'border-pq-success-100 bg-pq-success-100/80';
                                  const badgeClass = isUnverified
                                    ? 'border-pq-warning-200 text-pq-warning-700 bg-white'
                                    : 'border-pq-success-200 text-pq-success-600 bg-white';
                                  const footerNote = isUnverified
                                    ? 'Procurement will see this product as unverified during canvassing. Award may require justification.'
                                    : 'Can be awarded when procurement selects this line.';
                                  return (
                                    <div className={`rounded-md border px-4 py-3 ${cardTone}`}>
                                      <p className="text-[10px] font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                                        Selected product
                                      </p>
                                      <div className="flex flex-wrap items-center gap-2 text-sm text-pq-neutral-900">
                                        <span className="font-semibold">{selectedCatalog.product_name}</span>
                                        {selectedCatalog.product_code && (
                                          <>
                                            <span className="text-pq-neutral-400">·</span>
                                            <span className="font-mono text-xs text-pq-neutral-500">
                                              {selectedCatalog.product_code}
                                            </span>
                                          </>
                                        )}
                                        <span className="text-pq-neutral-400">·</span>
                                        <span className="text-xs text-pq-neutral-500">
                                          {categoryOptionLabel(supplierProductCategoryKey(selectedCatalog))}
                                        </span>
                                        <span className="text-pq-neutral-400">·</span>
                                        <Badge
                                          variant="outline"
                                          className={`text-[10px] ${badgeClass}`}
                                        >
                                          {productBadge.label}
                                        </Badge>
                                      </div>
                                      <p className={`text-xs mt-2 flex items-center gap-1 ${isUnverified ? 'text-pq-warning-700' : 'text-pq-success-600'}`}>
                                        {isUnverified ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                                        {footerNote}
                                      </p>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="mt-3 h-8 text-xs border-pq-neutral-200"
                                        onClick={() => openProductPicker(index)}
                                      >
                                        Change Product
                                      </Button>
                                    </div>
                                  );
                                })()
                              ) : (
                                <Button
                                  type="button"
                                  className="w-full sm:w-auto h-10 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold"
                                  onClick={() => openProductPicker(index)}
                                >
                                  <Package className="w-4 h-4 mr-2" />
                                  Choose Catalog Product
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Manual entry panel (Phase 5) — explanation only;
                          the existing description / price / lead time inputs
                          below already accept manual values. */}
                      {mode === 'manual_entry' && (
                        <div className="rounded-md border border-pq-neutral-200 bg-pq-neutral-50 px-4 py-3 text-xs text-pq-neutral-600 flex items-start gap-2">
                          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-pq-neutral-400" />
                          <span>
                            <strong>Manual entry.</strong> Fill the description, unit
                            price, and lead time below without picking a catalog
                            product. Procurement will see this line as “Manual entry”
                            during canvassing.
                          </span>
                        </div>
                      )}

                      {/* Propose new product panel */}
                      {mode === 'propose_new' && (
                        <div className="border border-pq-neutral-200 rounded-md overflow-hidden">
                          <div className="px-4 py-3 bg-pq-primary-50 border-b border-pq-neutral-200 flex items-center justify-between">
                            <p className="text-xs font-semibold text-pq-primary-600">
                              <PlusCircle className="inline w-3.5 h-3.5 mr-1" />
                              Propose New Product for Validation
                            </p>
                            <p className="text-xs text-pq-primary-600">
                              Product will be submitted to Procurement for review.
                              Award is blocked until verified.
                            </p>
                          </div>

                          {/* Pending proposal already submitted for this line */}
                          {pendingProduct ? (
                            <div className="px-4 py-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                                  <div>
                                    <p className="text-sm font-semibold text-pq-neutral-900">
                                      {pendingProduct.product_name}
                                    </p>
                                    <p className="text-xs text-pq-warning-600 font-medium">
                                      Pending Procurement/TSQA validation · Procurement may need to justify before awarding
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => cancelProposal(index)}
                                  className="text-xs text-pq-neutral-400 hover:text-pq-danger-600 transition flex items-center gap-0.5"
                                >
                                  <X className="w-3.5 h-3.5" /> Remove
                                </button>
                              </div>
                              <p className="text-xs text-pq-neutral-400">
                                This proposal has been submitted to your Product Catalog.
                                Procurement will review and may verify directly or request a TSQA evaluation.
                              </p>
                            </div>
                          ) : (
                            <div className="p-4 space-y-3">
                              <ProposalField label="Product Name *">
                                <input
                                  type="text"
                                  value={proposalForm.product_name}
                                  onChange={e => updateProposalForm(index, 'product_name', e.target.value)}
                                  placeholder="e.g. Rust Inhibitor Primer Type B"
                                  className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF]"
                                />
                              </ProposalField>
                              <div className="grid grid-cols-2 gap-3">
                                <ProposalField label="Product Code (optional)">
                                  <input
                                    type="text"
                                    value={proposalForm.product_code}
                                    onChange={e => updateProposalForm(index, 'product_code', e.target.value)}
                                    placeholder="SKU or part number"
                                    className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF]"
                                  />
                                </ProposalField>
                                <ProposalField label="Category (optional)">
                                  <input
                                    type="text"
                                    value={proposalForm.category}
                                    onChange={e => updateProposalForm(index, 'category', e.target.value)}
                                    placeholder="e.g. Chemicals, Hardware"
                                    className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF]"
                                  />
                                </ProposalField>
                              </div>
                              <ProposalField label="Description (optional)">
                                <textarea
                                  rows={2}
                                  value={proposalForm.description}
                                  onChange={e => updateProposalForm(index, 'description', e.target.value)}
                                  placeholder="Brief product description..."
                                  className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none"
                                />
                              </ProposalField>
                              <ProposalField label="Specifications (optional)">
                                <textarea
                                  rows={2}
                                  value={proposalForm.specifications}
                                  onChange={e => updateProposalForm(index, 'specifications', e.target.value)}
                                  placeholder="Technical specs, standards, grades..."
                                  className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none"
                                />
                              </ProposalField>

                              {proposalErrors[index] && (
                                <p className="text-xs text-pq-danger-600 flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  {proposalErrors[index]}
                                </p>
                              )}

                              <button
                                type="button"
                                onClick={() => handlePropose(index)}
                                disabled={proposalBusy[index]}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-xs font-semibold rounded-md transition disabled:opacity-50"
                              >
                                {proposalBusy[index] ? (
                                  <><Loader className="w-3.5 h-3.5 animate-spin" /> Submitting…</>
                                ) : (
                                  <><PlusCircle className="w-3.5 h-3.5" /> Submit Proposal</>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* No quote / cannot supply */}
                      {mode === 'no_quote' && (
                        <div className="rounded-md border border-pq-neutral-200 bg-pq-neutral-50 px-4 py-4 space-y-3">
                          <p className="text-xs font-semibold text-pq-neutral-800">
                            <Ban className="inline w-3.5 h-3.5 mr-1" />
                            Cannot supply this line — procurement will see your reason.
                          </p>
                          <ProposalField label="Reason *">
                            <select
                              value={noQuoteReasonSelectValue(draft)}
                              onChange={e => {
                                const v = e.target.value;
                                if (v === NO_QUOTE_OTHER) {
                                  updateDraft(index, 'no_quote_reason', '');
                                } else {
                                  updateDraft(index, 'no_quote_reason', v);
                                }
                              }}
                              className="w-full h-10 rounded-md border border-pq-neutral-200 bg-white px-3 text-sm text-pq-neutral-900"
                              aria-label="Reason for no quote"
                            >
                              <option value="">Select a reason…</option>
                              {NO_QUOTE_REASON_PRESETS.map(preset => (
                                <option key={preset} value={preset}>
                                  {preset}
                                </option>
                              ))}
                              <option value={NO_QUOTE_OTHER}>Other</option>
                            </select>
                          </ProposalField>
                          {noQuoteReasonSelectValue(draft) === NO_QUOTE_OTHER && (
                            <ProposalField label="Describe (required) *">
                              <textarea
                                rows={2}
                                value={draft.no_quote_reason ?? ''}
                                onChange={e => updateDraft(index, 'no_quote_reason', e.target.value)}
                                placeholder="Brief explanation…"
                                className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none"
                              />
                            </ProposalField>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* Read-only: show linked product */}
                  {isReadOnly && draft.supplier_product_id && (
                    <div className={`flex items-center gap-2 text-xs rounded-md px-3 py-2 border ${
                      isProposedCatalogLine
                        ? 'text-pq-warning-600 bg-pq-warning-100 border-pq-warning-100'
                        : 'text-pq-success-600 bg-pq-success-100 border-pq-success-100'
                    }`}>
                      <Package className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-semibold">
                        {isProposedCatalogLine ? 'Proposed Product:' : 'Catalog Product:'}
                      </span>
                      {selectedCatalog?.product_name ?? pendingProducts[index]?.product_name ?? draft.supplier_product_id}
                      {isProposedCatalogLine && (
                        <span className="ml-1 font-semibold">(Pending validation)</span>
                      )}
                    </div>
                  )}

                  {!hideQuotePricing && (
                    <>
                  {/* Alternative item toggle — available for all quoted response modes */}
                  {!isReadOnly && (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={draft.is_alternative}
                          onChange={e => updateDraft(index, 'is_alternative', e.target.checked)}
                          disabled={isReadOnly}
                          className="sr-only"
                        />
                        <div className={`w-10 h-5 rounded-full transition ${draft.is_alternative ? 'bg-orange-500' : 'bg-pq-neutral-200'}`} />
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${draft.is_alternative ? 'translate-x-5' : ''}`} />
                      </div>
                      <span className="text-sm font-medium text-pq-neutral-900">
                        Alternative / substitute item
                        {draft.is_alternative && (
                          <span className="ml-1 text-orange-600 font-semibold">
                            (will flag for requestor review)
                          </span>
                        )}
                      </span>
                    </label>
                  )}

                  {/* Quoted description */}
                  <div>
                    <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                      Quoted Item / Specification <span className="text-pq-danger-600">*</span>
                    </label>
                    <input
                      type="text"
                      value={draft.quoted_description}
                      onChange={e => updateDraft(index, 'quoted_description', e.target.value)}
                      disabled={isReadOnly}
                      placeholder="Brand, model, exact specification..."
                      className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] disabled:bg-pq-neutral-50 disabled:text-pq-neutral-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                        Unit Price (₱) <span className="text-pq-danger-600">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-sm text-pq-neutral-400 pointer-events-none">₱</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.unit_price || ''}
                          onChange={e => updateDraft(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          disabled={isReadOnly}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] disabled:bg-pq-neutral-50"
                        />
                      </div>
                      {draft.unit_price > 0 && (
                        <p className="text-xs text-pq-neutral-400 mt-1">
                          Total: ₱{(draft.unit_price * item.quantity_requested).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                        Lead Time (days) <span className="text-pq-danger-600">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={draft.lead_time_days || ''}
                        onChange={e => updateDraft(index, 'lead_time_days', parseInt(e.target.value, 10) || 0)}
                        disabled={isReadOnly}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] disabled:bg-pq-neutral-50"
                      />
                    </div>
                  </div>
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide mb-1.5">
                      Remarks <span className="text-pq-neutral-400 font-normal normal-case">(optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={draft.remarks}
                      onChange={e => updateDraft(index, 'remarks', e.target.value)}
                      disabled={isReadOnly}
                      placeholder="Warranty, MOQ, delivery conditions..."
                      className="w-full px-3 py-2 border border-pq-neutral-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none disabled:bg-pq-neutral-50 disabled:text-pq-neutral-500"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Submit */}
          {canSubmit && (
            <div className="bg-white rounded-md border border-pq-neutral-200 px-5 py-4">
              {submitError && (
                <div className="flex items-center gap-2 bg-pq-danger-100 border border-pq-danger-100 text-pq-danger-600 text-sm rounded-md px-4 py-3 mb-4">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {submitError}
                </div>
              )}
              {!everyLineResponded && productsLoaded && (
                <div className="flex items-center gap-2 bg-pq-warning-100 border border-pq-warning-100 text-pq-warning-600 text-xs rounded-md px-4 py-3 mb-4">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Each line needs a complete response: quote with product and price, propose a product, or No Quote with a reason.
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-sm text-pq-neutral-500">
                  {submitted
                    ? 'Your quotation is on record. You may update and resubmit.'
                    : 'Review all items above before submitting.'}
                </p>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || !everyLineResponded}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Submitting...' : submitted ? 'Update Quotation' : 'Submit Quotation'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={pickerLineIndex !== null && availableProducts.length > 0}
        onOpenChange={open => {
          if (!open) closeProductPicker();
        }}
      >
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden sm:rounded-lg border-pq-neutral-200 bg-white">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-pq-neutral-200 shrink-0 text-left space-y-1.5">
            <DialogTitle className="text-lg font-semibold text-pq-neutral-900">
              Select Catalog Product
            </DialogTitle>
            <DialogDescription className="text-sm text-pq-neutral-500">
              Choose a verified or in-flight product from your catalog. Procurement will see the verification state during canvassing.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-3 border-b border-pq-neutral-200 shrink-0 flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Search name, code, category, description, specifications…"
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              className="text-sm border-pq-neutral-200 flex-1"
              aria-label="Search catalog products"
            />
            <select
              value={pickerCategory}
              onChange={e => setPickerCategory(e.target.value)}
              className="h-10 rounded-md border border-pq-neutral-200 bg-white px-3 text-sm text-pq-neutral-900 min-w-[11rem]"
              aria-label="Filter by category"
            >
              <option value="__all__">All categories</option>
              {pickerCategoryKeys.map(key => (
                <option key={key} value={key}>
                  {categoryOptionLabel(key)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-h-0 overflow-auto px-6 py-3">
            {pickerFilteredProducts.length === 0 ? (
              <p className="text-sm text-pq-neutral-500 text-center py-10">
                No matching catalog products found.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-pq-neutral-200">
                    <TableHead className="text-[10px] uppercase text-pq-neutral-500 font-semibold">
                      Product name
                    </TableHead>
                    <TableHead className="text-[10px] uppercase text-pq-neutral-500 font-semibold w-[100px]">
                      Code
                    </TableHead>
                    <TableHead className="text-[10px] uppercase text-pq-neutral-500 font-semibold hidden md:table-cell">
                      Category
                    </TableHead>
                    <TableHead className="text-[10px] uppercase text-pq-neutral-500 font-semibold hidden lg:table-cell max-w-[140px]">
                      Description
                    </TableHead>
                    <TableHead className="text-[10px] uppercase text-pq-neutral-500 font-semibold hidden lg:table-cell max-w-[140px]">
                      Specifications
                    </TableHead>
                    <TableHead className="text-[10px] uppercase text-pq-neutral-500 font-semibold w-[88px]">
                      Status
                    </TableHead>
                    <TableHead className="text-[10px] uppercase text-pq-neutral-500 font-semibold w-[104px] hidden sm:table-cell">
                      Verified
                    </TableHead>
                    <TableHead className="w-[100px] text-right text-[10px] uppercase text-pq-neutral-500 font-semibold">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pickerPageItems.map(p => (
                    <TableRow key={p.id} className="border-pq-neutral-200">
                      <TableCell className="font-medium text-pq-neutral-900 align-top">
                        {p.product_name}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-pq-neutral-500 align-top">
                        {p.product_code?.trim() ? p.product_code : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-pq-neutral-500 align-top hidden md:table-cell">
                        {categoryOptionLabel(supplierProductCategoryKey(p))}
                      </TableCell>
                      <TableCell className="text-xs text-pq-neutral-500 align-top hidden lg:table-cell max-w-[140px]">
                        {previewField(p.description, 80)}
                      </TableCell>
                      <TableCell className="text-xs text-pq-neutral-500 align-top hidden lg:table-cell max-w-[140px]">
                        {previewField(p.specifications, 80)}
                      </TableCell>
                      <TableCell className="align-top">
                        {(() => {
                          const badge = describeProductStatus(p.status);
                          const cls = badge.kind === 'verified'
                            ? 'border-pq-success-200 text-pq-success-600'
                            : badge.kind === 'pending'
                              ? 'border-pq-warning-200 text-pq-warning-700'
                              : 'border-pq-neutral-200 text-pq-neutral-600';
                          return (
                            <Badge
                              variant="outline"
                              className={`text-[10px] whitespace-nowrap ${cls}`}
                            >
                              {badge.label}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-xs text-pq-neutral-500 align-top hidden sm:table-cell tabular-nums whitespace-nowrap">
                        {p.verified_at
                          ? format(new Date(p.verified_at), 'MMM d, yyyy')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs border-pq-neutral-200"
                          onClick={() => confirmPickerProduct(p.id)}
                        >
                          Select
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="px-6 py-3 border-t border-pq-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 bg-pq-neutral-50">
            <p className="text-xs text-pq-neutral-500">
              Page {pickerPageClamped} of {pickerTotalPages}
              <span className="text-pq-neutral-400 mx-1">·</span>
              {pickerFilteredProducts.length} product
              {pickerFilteredProducts.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 border-pq-neutral-200"
                disabled={pickerPageClamped <= 1}
                onClick={() => setPickerPage(pp => Math.max(1, pp - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 border-pq-neutral-200"
                disabled={pickerPageClamped >= pickerTotalPages}
                onClick={() => setPickerPage(pp => pp + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoField({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon:  React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className="w-3.5 h-3.5 text-pq-neutral-400" />
        <p className="text-xs font-semibold text-pq-neutral-400 uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-sm text-pq-neutral-900 ${mono ? 'font-mono font-semibold' : 'font-medium'}`}>
        {value}
      </p>
    </div>
  );
}

function ProposalField({
  label,
  children,
}: {
  label:    string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}
