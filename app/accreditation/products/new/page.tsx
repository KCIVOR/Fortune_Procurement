'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import PickRawMatSupplierModal from '@/components/procurement/PickRawMatSupplierModal';
import { useAuth } from '@/context/AuthContext';
import { listSupplierAccountsWithCount } from '@/lib/procurement-suppliers';
import type { SupplierAccount } from '@/lib/procurement-suppliers';
import { ChevronLeft, Search } from 'lucide-react';

function canCreateProducts(role: string | undefined): boolean {
  return role === 'procurement' || role === 'admin';
}

export default function NewProcurementProductPage() {
  const router = useRouter();
  const { profile, session, loading: authLoading } = useAuth();

  const [suppliers, setSuppliers] = useState<SupplierAccount[]>([]);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [supplierId, setSupplierId] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [form, setForm] = useState({
    product_name:   '',
    product_code:   '',
    category:       '',
    description:    '',
    specifications: '',
  });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');

  const allowed = canCreateProducts(profile?.role);
  const selectedSupplier = useMemo(
    () => suppliers.find(s => s.id === supplierId) ?? null,
    [suppliers, supplierId],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!profile || !allowed) {
      setSuppliersLoading(false);
      return;
    }

    let cancelled = false;
    setSuppliersLoading(true);
    listSupplierAccountsWithCount({ limit: 500, offset: 0, status: 'all' })
      .then(result => {
        if (cancelled) return;
        const rawMat = result.suppliers.filter(s => s.supplier_supply_type === 'raw_material');
        setSuppliers(rawMat);
      })
      .catch(() => {
        if (!cancelled) setFormError('Failed to load suppliers.');
      })
      .finally(() => {
        if (!cancelled) setSuppliersLoading(false);
      });

    return () => { cancelled = true; };
  }, [authLoading, profile, allowed]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token) {
      setFormError('Not authenticated.');
      return;
    }
    if (!supplierId) {
      setFormError('Please select a supplier.');
      return;
    }
    if (!form.product_name.trim()) {
      setFormError('Product name is required.');
      return;
    }

    setBusy(true);
    setFormError('');
    try {
      const res = await fetch('/api/procurement/products/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          supplier_id:    supplierId,
          product_name:   form.product_name.trim(),
          product_code:   form.product_code.trim() || null,
          category:       form.category.trim() || null,
          description:    form.description.trim() || null,
          specifications: form.specifications.trim() || null,
          item_type:      'goods',
        }),
      });

      let data: { success?: boolean; error?: string; product?: { id: string } } = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(`Invalid server response (HTTP ${res.status}).`);
      }

      if (!res.ok || !data.success || !data.product?.id) {
        throw new Error(data.error || 'Failed to create product.');
      }

      router.push(`/accreditation/products/${data.product.id}`);
    } catch (err: unknown) {
      setFormError((err as Error)?.message || 'Failed to create product.');
      setBusy(false);
    }
  };

  if (authLoading) {
    return (
      <AppShell title="Add Product">
        <LoadingState message="Loading…" />
      </AppShell>
    );
  }

  if (!profile || !allowed) {
    return (
      <AppShell title="Add Product">
        <div className="space-y-6">
          <PageHeader
            title="Add Product"
            description="Create a verified catalog product for a raw-material supplier."
          />
          <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Access Denied</h3>
            <p className="text-sm text-pq-danger-600">
              Only procurement staff or admins can add verified catalog products.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Add Product">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6">
        <div className="mb-4">
          <Link
            href="/accreditation/products"
            className="inline-flex items-center gap-1 text-sm text-pq-neutral-500 hover:text-pq-neutral-900 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Product Catalog
          </Link>
        </div>

        <PageHeader
          title="Add Verified Product"
          description="Create a goods product in a raw-material supplier's catalog. It is saved as verified and available for RFQ quotes. Services RFQs use manual entry — catalog services are not created."
        />

        <div className="w-full bg-white rounded-md border border-pq-neutral-200 p-6 sm:p-8">
          {formError && (
            <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-3 text-sm text-pq-danger-600 mb-5">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField label="Supplier" required>
              {suppliersLoading ? (
                <p className="text-sm text-pq-neutral-400">Loading suppliers…</p>
              ) : suppliers.length === 0 ? (
                <p className="text-sm text-pq-neutral-500">
                  No raw-material suppliers found. Set a supplier&apos;s supply type to Raw mat first.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedSupplier ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-md border border-pq-neutral-200 bg-pq-neutral-50/50 px-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-pq-neutral-900 truncate">
                          {selectedSupplier.full_name}
                        </p>
                        <p className="text-xs text-pq-neutral-500 font-mono truncate">
                          {selectedSupplier.email}
                        </p>
                        <p className="text-[11px] text-pq-neutral-400 mt-1">
                          {selectedSupplier.product_count} product
                          {selectedSupplier.product_count === 1 ? '' : 's'} in catalog
                          {' · '}
                          {selectedSupplier.active ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPickerOpen(true)}
                        className="shrink-0 px-3 py-2 text-xs font-semibold rounded-md border border-pq-neutral-200 bg-white text-pq-neutral-700 hover:bg-pq-neutral-100 transition"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-md border border-pq-neutral-200 bg-white text-pq-neutral-800 hover:bg-pq-neutral-50 transition"
                    >
                      <Search className="w-4 h-4 text-pq-neutral-500" />
                      Select raw mat supplier
                    </button>
                  )}
                </div>
              )}
            </FormField>

            <FormField label="Product Name" required>
              <input
                type="text"
                name="product_name"
                value={form.product_name}
                onChange={handleChange}
                placeholder="e.g. Sodium Chloride ACS Grade"
                className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] bg-white"
              />
            </FormField>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <FormField label="Product Code / SKU">
                <input
                  type="text"
                  name="product_code"
                  value={form.product_code}
                  onChange={handleChange}
                  placeholder="e.g. NaCl-ACS-001"
                  className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] bg-white"
                />
              </FormField>
              <FormField label="Category">
                <input
                  type="text"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  placeholder="e.g. Chemicals, Reagents"
                  className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] bg-white"
                />
              </FormField>
            </div>

            <FormField label="Description">
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                placeholder="Short description of the product"
                className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
              />
            </FormField>

            <FormField label="Specifications">
              <textarea
                name="specifications"
                value={form.specifications}
                onChange={handleChange}
                rows={5}
                placeholder="Technical specifications: purity, grade, packaging, storage conditions, etc."
                className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
              />
            </FormField>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={busy || suppliersLoading || suppliers.length === 0}
                className="px-5 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
              >
                {busy ? 'Creating…' : 'Create Verified Product'}
              </button>
              <Link
                href="/accreditation/products"
                className="px-5 py-2 text-sm font-medium text-pq-neutral-500 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md hover:bg-pq-neutral-200 transition"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>

      <PickRawMatSupplierModal
        open={pickerOpen}
        suppliers={suppliers}
        selectedId={supplierId}
        onClose={() => setPickerOpen(false)}
        onConfirm={id => {
          setSupplierId(id);
          setPickerOpen(false);
          setFormError('');
        }}
      />
    </AppShell>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
        {label}
        {required && <span className="text-pq-danger-600 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
