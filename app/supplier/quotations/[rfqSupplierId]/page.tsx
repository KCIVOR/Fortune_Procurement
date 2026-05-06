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
  getVerifiedProductsForCurrentSupplier,
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

const VERIFIED_PRODUCT_PICKER_PAGE_SIZE = 10;

const UNCATEGORIZED_CATEGORY_KEY = '__uncat__';

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

/** Per-item UI mode: how the supplier is filling this line. */
type LineMode = 'select_verified' | 'propose_new';

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

  // Phase 7: verified product catalog
  const [verifiedProducts, setVerifiedProducts] = useState<SupplierProduct[]>([]);
  const [productsLoaded,   setProductsLoaded]   = useState(false);

  // Phase 8: per-item UI mode and proposal state
  const [lineModes,       setLineModes]       = useState<LineMode[]>([]);
  const [proposalForms,   setProposalForms]   = useState<ProposalForm[]>([]);
  const [proposalBusy,    setProposalBusy]    = useState<boolean[]>([]);
  const [proposalErrors,  setProposalErrors]  = useState<string[]>([]);
  // Tracks proposed (pending) products attached to a line (not yet verified)
  const [pendingProducts, setPendingProducts] = useState<Record<number, SupplierProduct>>({});

  // Verified product picker modal (per RFQ line)
  const [pickerLineIndex, setPickerLineIndex] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCategory, setPickerCategory] = useState<string>('__all__');
  const [pickerPage, setPickerPage] = useState(1);

  useEffect(() => {
    if (!rfqSupplierId || !profile) return;

    Promise.all([
      fetchSupplierQuoteDetail(rfqSupplierId, profile.id),
      getVerifiedProductsForCurrentSupplier(profile),
    ])
      .then(([d, products]) => {
        if (!d) { setError('RFQ not found or access denied.'); return; }
        setDetail(d);
        setVerifiedProducts(products);
        setProductsLoaded(true);

        const initialDrafts: QuoteDraft[] = d.items.map(item => {
          const existing = d.quotes.find(q => q.pr1_item_id === item.id);
          return {
            pr1_item_id:         item.id,
            quoted_description:  existing?.quoted_description ?? item.description,
            is_alternative:      existing?.is_alternative ?? false,
            unit_price:          existing ? Number(existing.unit_price) : 0,
            lead_time_days:      existing?.lead_time_days ?? 0,
            remarks:             existing?.remarks ?? '',
            supplier_product_id: existing?.supplier_product_id ?? null,
          };
        });
        setDrafts(initialDrafts);

        // Determine initial line mode: if existing quote has a product that is
        // not in verified list, treat it as a pending proposal (propose mode)
        const initialModes: LineMode[] = initialDrafts.map(draft => {
          if (!draft.supplier_product_id) return 'select_verified';
          const inVerified = products.some(p => p.id === draft.supplier_product_id);
          return inVerified ? 'select_verified' : 'propose_new';
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
    const product = verifiedProducts.find(p => p.id === productId) ?? null;
    setDrafts(prev => {
      const next = [...prev];
      const currentDesc = next[index].quoted_description;
      next[index] = {
        ...next[index],
        supplier_product_id: productId || null,
        is_alternative:      false,
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
    for (const p of verifiedProducts) {
      keys.add(supplierProductCategoryKey(p));
    }
    return Array.from(keys).sort((a, b) => {
      if (a === UNCATEGORIZED_CATEGORY_KEY) return 1;
      if (b === UNCATEGORIZED_CATEGORY_KEY) return -1;
      return a.localeCompare(b);
    });
  }, [verifiedProducts]);

  const pickerFilteredProducts = useMemo(() => {
    let list = verifiedProducts;
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
  }, [verifiedProducts, pickerCategory, pickerSearch]);

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
    // Clear any pending product on this line
    setPendingProducts(prev => { const n = { ...prev }; delete n[index]; return n; });
    updateDraft(index, 'supplier_product_id', null);
    updateDraft(index, 'is_alternative', false);
  };

  const switchToProposeNew = (index: number) => {
    setLineModes(prev => { const n = [...prev]; n[index] = 'propose_new'; return n; });
    // Keep existing draft price/lead-time; clear product selection from verified
    if (!pendingProducts[index]) {
      updateDraft(index, 'supplier_product_id', null);
    }
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
          // Catalog proposals use Procurement/TSQA validation — not the requisitioner
          // substitute-decision workflow (is_alternative). Keeping false avoids blocking
          // award in saveItemSelection / RFQ matrix once the product is verified.
          is_alternative:      false,
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
    updateDraft(index, 'quoted_description', detail?.items[index]?.description ?? '');
  };

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!detail) return;

    const invalidPrice = drafts.filter(d => d.unit_price <= 0);
    if (invalidPrice.length > 0) {
      setSubmitError('Please enter a unit price greater than 0 for all items.');
      return;
    }

    // Phase 8: each line must have either a verified product OR a pending proposal
    const missing = drafts.filter(d => !d.supplier_product_id);
    if (productsLoaded && missing.length > 0) {
      setSubmitError(
        'Please select a verified product or propose a new product for each quoted line.'
      );
      return;
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
      <div className="bg-red-50 border border-red-200 rounded-[4px] p-4 text-sm text-red-700">
        {error || 'RFQ not found.'}
      </div>
    </AppShell>
  );

  const { rfq, pr1, items } = detail;
  const isClosed   = rfq.status === 'closed';
  const canSubmit  = rfq.status === 'open' && !isClosed;
  const isReadOnly = submitted || isClosed;

  // Can submit if every line either has a verified product OR a pending proposal
  const allLinesHaveProduct = drafts.every(d => !!d.supplier_product_id);

  return (
    <AppShell title="Submit Quotation">
      <div className="mb-2">
        <Link
          href="/supplier/quotations"
          className="inline-flex items-center gap-1 text-xs text-[#40527A] hover:text-[#0F1F3A] transition"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to RFQ Inbox
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold text-[#0F1F3A] font-mono">{rfq.rfq_number}</h1>
            <span className={`inline-flex items-center text-xs font-semibold border rounded-full px-2.5 py-1 ${
              rfq.status === 'open'   ? 'bg-amber-50 text-amber-700 border-amber-200' :
              rfq.status === 'closed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              'bg-[#F7F9FC] text-[#40527A] border-[#D8E2FF]'
            }`}>
              {rfq.status.charAt(0).toUpperCase() + rfq.status.slice(1)}
            </span>
            {submitted && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2.5 py-1 bg-emerald-50 text-emerald-700 border-emerald-200">
                <CheckCircle2 className="w-3 h-3" />
                Quotation Submitted
              </span>
            )}
          </div>
          <p className="text-sm text-[#40527A]">
            {pr1.department_name_snapshot} · {pr1.purpose}
          </p>
        </div>
      </div>

      {/* Status banners */}
      {submitted && canSubmit && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-[4px] px-5 py-4 mb-6">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Quotation submitted successfully</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              You can update your prices below and resubmit before the deadline.
            </p>
          </div>
        </div>
      )}
      {isClosed && (
        <div className="flex items-start gap-3 bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] px-5 py-4 mb-6">
          <Info className="w-4 h-4 text-[#40527A] mt-0.5 shrink-0" />
          <p className="text-sm text-[#40527A]">
            This RFQ is closed. Procurement has finalised their selection.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-5 space-y-3">
            <h2 className="text-xs font-bold text-[#40527A] uppercase tracking-wide">RFQ Details</h2>
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
                <p className="text-xs font-semibold text-[#BFC7D5] uppercase tracking-wide mb-0.5">
                  Procurement Notes
                </p>
                <p className="text-sm text-[#0F1F3A] leading-snug">{rfq.notes}</p>
              </div>
            )}
          </div>

          {!isReadOnly && (
            <div className="bg-amber-50 border border-amber-200 rounded-[4px] p-4">
              <p className="text-xs font-semibold text-amber-700 mb-1">Instructions</p>
              <ul className="text-xs text-amber-700 space-y-1 list-disc list-inside">
                <li>For each item, select a verified product <strong>or</strong> propose a new one</li>
                <li>Fill in price and lead time</li>
                <li>Proposed products await Procurement validation before award</li>
                <li>Mark &ldquo;Alternative item&rdquo; if quoting a substitute</li>
              </ul>
            </div>
          )}

          {productsLoaded && verifiedProducts.length > 0 && !isReadOnly && (
            <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Package className="w-3.5 h-3.5 text-[#BFC7D5]" />
                <p className="text-xs font-semibold text-[#40527A] uppercase tracking-wide">
                  Verified Products
                </p>
              </div>
              <p className="text-xs text-[#BFC7D5]">
                {verifiedProducts.length} available for selection
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

            const selectedVerified = verifiedProducts.find(
              p => p.id === draft.supplier_product_id
            ) ?? null;
            const isProposedCatalogLine =
              mode === 'propose_new' ||
              (!!draft.supplier_product_id &&
                !verifiedProducts.some(p => p.id === draft.supplier_product_id));

            return (
              <div
                key={item.id}
                className="bg-white rounded-[4px] border border-[#D8E2FF] overflow-hidden"
              >
                {/* Item header */}
                <div className="flex items-center gap-3 px-5 py-3.5 bg-[#F7F9FC] border-b border-[#D8E2FF]">
                  <span className="w-6 h-6 rounded-full bg-[#D8E2FF] text-[#40527A] text-xs font-bold flex items-center justify-center shrink-0">
                    {item.item_order}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#0F1F3A]">{item.description}</p>
                    <p className="text-xs text-[#BFC7D5]">
                      {item.item_code && <span className="font-mono">{item.item_code} · </span>}
                      Qty: <strong>{item.quantity_requested}</strong> {item.unit_of_measure}
                    </p>
                  </div>
                </div>

                <div className="p-5 space-y-4">

                  {/* ── Phase 7/8: product section ── */}
                  {!isReadOnly && productsLoaded && (
                    <>
                      {/* Mode tabs */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => switchToVerifiedSelect(index)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] border transition ${
                            mode === 'select_verified'
                              ? 'bg-[#1E4BFF] text-white border-[#1E4BFF]'
                              : 'bg-white text-[#40527A] border-[#D8E2FF] hover:bg-[#F7F9FC]'
                          }`}
                        >
                          <Package className="inline w-3 h-3 mr-1" />
                          Select Verified Product
                        </button>
                        <button
                          type="button"
                          onClick={() => switchToProposeNew(index)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] border transition ${
                            mode === 'propose_new'
                              ? 'bg-[#1E4BFF] text-white border-[#1E4BFF]'
                              : 'bg-white text-[#40527A] border-[#D8E2FF] hover:bg-[#F7F9FC]'
                          }`}
                        >
                          <PlusCircle className="inline w-3 h-3 mr-1" />
                          Propose New Product
                        </button>
                      </div>

                      {/* Select verified product panel */}
                      {mode === 'select_verified' && (
                        <div>
                          {verifiedProducts.length === 0 ? (
                            <div className="flex items-center gap-2 px-3 py-2 border border-amber-200 bg-amber-50 rounded-[4px] text-xs text-amber-700">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              No verified products available. Submit products for validation before
                              offering items in RFQ.{' '}
                              <Link href="/supplier/products" className="underline font-medium">
                                Go to Product Catalog
                              </Link>{' '}
                              or use &ldquo;Propose New Product&rdquo; above.
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {selectedVerified ? (
                                <div className="rounded-[4px] border border-emerald-200 bg-emerald-50/80 px-4 py-3">
                                  <p className="text-[10px] font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                                    Selected product
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2 text-sm text-[#0F1F3A]">
                                    <span className="font-semibold">{selectedVerified.product_name}</span>
                                    {selectedVerified.product_code && (
                                      <>
                                        <span className="text-[#BFC7D5]">·</span>
                                        <span className="font-mono text-xs text-[#40527A]">
                                          {selectedVerified.product_code}
                                        </span>
                                      </>
                                    )}
                                    <span className="text-[#BFC7D5]">·</span>
                                    <span className="text-xs text-[#40527A]">
                                      {categoryOptionLabel(supplierProductCategoryKey(selectedVerified))}
                                    </span>
                                    <span className="text-[#BFC7D5]">·</span>
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] border-emerald-300 text-emerald-800 bg-white"
                                    >
                                      Verified
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-emerald-700 mt-2 flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Can be awarded when procurement selects this line.
                                  </p>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="mt-3 h-8 text-xs border-[#D8E2FF]"
                                    onClick={() => openProductPicker(index)}
                                  >
                                    Change Product
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  type="button"
                                  className="w-full sm:w-auto h-10 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold"
                                  onClick={() => openProductPicker(index)}
                                >
                                  <Package className="w-4 h-4 mr-2" />
                                  Choose Verified Product
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Propose new product panel */}
                      {mode === 'propose_new' && (
                        <div className="border border-[#D8E2FF] rounded-[4px] overflow-hidden">
                          <div className="px-4 py-3 bg-blue-50 border-b border-[#D8E2FF] flex items-center justify-between">
                            <p className="text-xs font-semibold text-blue-800">
                              <PlusCircle className="inline w-3.5 h-3.5 mr-1" />
                              Propose New Product for Validation
                            </p>
                            <p className="text-xs text-blue-600">
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
                                    <p className="text-sm font-semibold text-[#0F1F3A]">
                                      {pendingProduct.product_name}
                                    </p>
                                    <p className="text-xs text-amber-600 font-medium">
                                      Pending Procurement/TSQA validation · Cannot be awarded yet
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => cancelProposal(index)}
                                  className="text-xs text-[#BFC7D5] hover:text-red-500 transition flex items-center gap-0.5"
                                >
                                  <X className="w-3.5 h-3.5" /> Remove
                                </button>
                              </div>
                              <p className="text-xs text-[#BFC7D5]">
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
                                  className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF]"
                                />
                              </ProposalField>
                              <div className="grid grid-cols-2 gap-3">
                                <ProposalField label="Product Code (optional)">
                                  <input
                                    type="text"
                                    value={proposalForm.product_code}
                                    onChange={e => updateProposalForm(index, 'product_code', e.target.value)}
                                    placeholder="SKU or part number"
                                    className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF]"
                                  />
                                </ProposalField>
                                <ProposalField label="Category (optional)">
                                  <input
                                    type="text"
                                    value={proposalForm.category}
                                    onChange={e => updateProposalForm(index, 'category', e.target.value)}
                                    placeholder="e.g. Chemicals, Hardware"
                                    className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF]"
                                  />
                                </ProposalField>
                              </div>
                              <ProposalField label="Description (optional)">
                                <textarea
                                  rows={2}
                                  value={proposalForm.description}
                                  onChange={e => updateProposalForm(index, 'description', e.target.value)}
                                  placeholder="Brief product description..."
                                  className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none"
                                />
                              </ProposalField>
                              <ProposalField label="Specifications (optional)">
                                <textarea
                                  rows={2}
                                  value={proposalForm.specifications}
                                  onChange={e => updateProposalForm(index, 'specifications', e.target.value)}
                                  placeholder="Technical specs, standards, grades..."
                                  className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none"
                                />
                              </ProposalField>

                              {proposalErrors[index] && (
                                <p className="text-xs text-red-600 flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  {proposalErrors[index]}
                                </p>
                              )}

                              <button
                                type="button"
                                onClick={() => handlePropose(index)}
                                disabled={proposalBusy[index]}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-xs font-semibold rounded-[4px] transition disabled:opacity-50"
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
                    </>
                  )}

                  {/* Read-only: show linked product */}
                  {isReadOnly && draft.supplier_product_id && (
                    <div className={`flex items-center gap-2 text-xs rounded-[4px] px-3 py-2 border ${
                      isProposedCatalogLine
                        ? 'text-amber-700 bg-amber-50 border-amber-200'
                        : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                    }`}>
                      <Package className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-semibold">
                        {isProposedCatalogLine ? 'Proposed Product:' : 'Catalog Product:'}
                      </span>
                      {selectedVerified?.product_name ?? pendingProducts[index]?.product_name ?? draft.supplier_product_id}
                      {isProposedCatalogLine && (
                        <span className="ml-1 font-semibold">(Pending validation)</span>
                      )}
                    </div>
                  )}

                  {/* Alternative item toggle — show only for select_verified mode or when already alternative */}
                  {(!isReadOnly && (mode === 'select_verified' || draft.is_alternative)) && (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={draft.is_alternative}
                          onChange={e => updateDraft(index, 'is_alternative', e.target.checked)}
                          disabled={isReadOnly || mode === 'propose_new'}
                          className="sr-only"
                        />
                        <div className={`w-10 h-5 rounded-full transition ${draft.is_alternative ? 'bg-orange-500' : 'bg-[#D8E2FF]'}`} />
                        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${draft.is_alternative ? 'translate-x-5' : ''}`} />
                      </div>
                      <span className="text-sm font-medium text-[#0F1F3A]">
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
                    <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                      Quoted Item / Specification <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={draft.quoted_description}
                      onChange={e => updateDraft(index, 'quoted_description', e.target.value)}
                      disabled={isReadOnly}
                      placeholder="Brand, model, exact specification..."
                      className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] disabled:bg-[#F7F9FC] disabled:text-[#40527A]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                        Unit Price (₱) <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-sm text-[#BFC7D5] pointer-events-none">₱</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.unit_price || ''}
                          onChange={e => updateDraft(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          disabled={isReadOnly}
                          placeholder="0.00"
                          className="w-full pl-7 pr-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] disabled:bg-[#F7F9FC]"
                        />
                      </div>
                      {draft.unit_price > 0 && (
                        <p className="text-xs text-[#BFC7D5] mt-1">
                          Total: ₱{(draft.unit_price * item.quantity_requested).toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                        Lead Time (days) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={draft.lead_time_days || ''}
                        onChange={e => updateDraft(index, 'lead_time_days', parseInt(e.target.value, 10) || 0)}
                        disabled={isReadOnly}
                        placeholder="0"
                        className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] disabled:bg-[#F7F9FC]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide mb-1.5">
                      Remarks <span className="text-[#BFC7D5] font-normal normal-case">(optional)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={draft.remarks}
                      onChange={e => updateDraft(index, 'remarks', e.target.value)}
                      disabled={isReadOnly}
                      placeholder="Warranty, MOQ, delivery conditions..."
                      className="w-full px-3 py-2 border border-[#D8E2FF] rounded-[4px] text-sm focus:outline-none focus:ring-2 focus:ring-[#1E4BFF] resize-none disabled:bg-[#F7F9FC] disabled:text-[#40527A]"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Submit */}
          {canSubmit && (
            <div className="bg-white rounded-[4px] border border-[#D8E2FF] px-5 py-4">
              {submitError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-[4px] px-4 py-3 mb-4">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {submitError}
                </div>
              )}
              {!allLinesHaveProduct && productsLoaded && (
                <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-[4px] px-4 py-3 mb-4">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Each item must have either a verified product selected or a new product proposed before submitting.
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-sm text-[#40527A]">
                  {submitted
                    ? 'Your quotation is on record. You may update and resubmit.'
                    : 'Review all items above before submitting.'}
                </p>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition disabled:opacity-50"
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
        open={pickerLineIndex !== null && verifiedProducts.length > 0}
        onOpenChange={open => {
          if (!open) closeProductPicker();
        }}
      >
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden sm:rounded-lg border-[#D8E2FF] bg-white">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#D8E2FF] shrink-0 text-left space-y-1.5">
            <DialogTitle className="text-lg font-semibold text-[#0F1F3A]">
              Select Verified Product
            </DialogTitle>
            <DialogDescription className="text-sm text-[#40527A]">
              Choose a validated product from your catalog for this RFQ line.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-3 border-b border-[#D8E2FF] shrink-0 flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Search name, code, category, description, specifications…"
              value={pickerSearch}
              onChange={e => setPickerSearch(e.target.value)}
              className="text-sm border-[#D8E2FF] flex-1"
              aria-label="Search verified products"
            />
            <select
              value={pickerCategory}
              onChange={e => setPickerCategory(e.target.value)}
              className="h-10 rounded-md border border-[#D8E2FF] bg-white px-3 text-sm text-[#0F1F3A] min-w-[11rem]"
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
              <p className="text-sm text-[#40527A] text-center py-10">
                No matching verified products found.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-[#D8E2FF]">
                    <TableHead className="text-[10px] uppercase text-[#40527A] font-semibold">
                      Product name
                    </TableHead>
                    <TableHead className="text-[10px] uppercase text-[#40527A] font-semibold w-[100px]">
                      Code
                    </TableHead>
                    <TableHead className="text-[10px] uppercase text-[#40527A] font-semibold hidden md:table-cell">
                      Category
                    </TableHead>
                    <TableHead className="text-[10px] uppercase text-[#40527A] font-semibold hidden lg:table-cell max-w-[140px]">
                      Description
                    </TableHead>
                    <TableHead className="text-[10px] uppercase text-[#40527A] font-semibold hidden lg:table-cell max-w-[140px]">
                      Specifications
                    </TableHead>
                    <TableHead className="text-[10px] uppercase text-[#40527A] font-semibold w-[88px]">
                      Status
                    </TableHead>
                    <TableHead className="text-[10px] uppercase text-[#40527A] font-semibold w-[104px] hidden sm:table-cell">
                      Verified
                    </TableHead>
                    <TableHead className="w-[100px] text-right text-[10px] uppercase text-[#40527A] font-semibold">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pickerPageItems.map(p => (
                    <TableRow key={p.id} className="border-[#D8E2FF]">
                      <TableCell className="font-medium text-[#0F1F3A] align-top">
                        {p.product_name}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[#40527A] align-top">
                        {p.product_code?.trim() ? p.product_code : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-[#40527A] align-top hidden md:table-cell">
                        {categoryOptionLabel(supplierProductCategoryKey(p))}
                      </TableCell>
                      <TableCell className="text-xs text-[#40527A] align-top hidden lg:table-cell max-w-[140px]">
                        {previewField(p.description, 80)}
                      </TableCell>
                      <TableCell className="text-xs text-[#40527A] align-top hidden lg:table-cell max-w-[140px]">
                        {previewField(p.specifications, 80)}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge
                          variant="outline"
                          className="text-[10px] border-emerald-300 text-emerald-800 whitespace-nowrap"
                        >
                          Verified
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-[#40527A] align-top hidden sm:table-cell tabular-nums whitespace-nowrap">
                        {p.verified_at
                          ? format(new Date(p.verified_at), 'MMM d, yyyy')
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs border-[#D8E2FF]"
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

          <div className="px-6 py-3 border-t border-[#D8E2FF] flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 bg-[#F7F9FC]">
            <p className="text-xs text-[#40527A]">
              Page {pickerPageClamped} of {pickerTotalPages}
              <span className="text-[#BFC7D5] mx-1">·</span>
              {pickerFilteredProducts.length} product
              {pickerFilteredProducts.length !== 1 ? 's' : ''}
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 border-[#D8E2FF]"
                disabled={pickerPageClamped <= 1}
                onClick={() => setPickerPage(pp => Math.max(1, pp - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 border-[#D8E2FF]"
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
        <Icon className="w-3.5 h-3.5 text-[#BFC7D5]" />
        <p className="text-xs font-semibold text-[#BFC7D5] uppercase tracking-wide">{label}</p>
      </div>
      <p className={`text-sm text-[#0F1F3A] ${mono ? 'font-mono font-semibold' : 'font-medium'}`}>
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
      <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}
