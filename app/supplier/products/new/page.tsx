'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { createSupplierProduct } from '@/lib/supplier-products';
import { ChevronLeft } from 'lucide-react';

type ItemType = 'goods' | 'services';

export default function NewSupplierProductPage() {
  const router      = useRouter();
  const { profile } = useAuth();

  const [itemType, setItemType] = useState<ItemType>('goods');
  const [form, setForm] = useState({
    product_name:   '',
    product_code:   '',
    category:       '',
    description:    '',
    specifications: '',
  });
  const [busy, setBusy]           = useState(false);
  const [formError, setFormError] = useState('');

  const isService = itemType === 'services';

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!form.product_name.trim()) {
      setFormError(isService ? 'Service name is required.' : 'Product name is required.');
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      const created = await createSupplierProduct(
        {
          product_name:   form.product_name,
          product_code:   isService ? null : (form.product_code.trim() || null),
          category:       form.category.trim()       || null,
          description:    form.description.trim()    || null,
          specifications: form.specifications.trim() || null,
          item_type:      itemType,
        },
        profile
      );
      router.push(`/supplier/products/${created.id}`);
    } catch (err: unknown) {
      setFormError((err as Error)?.message || `Failed to create ${isService ? 'service offering' : 'product'}.`);
      setBusy(false);
    }
  };

  return (
    <AppShell title={isService ? 'Add Service Offering' : 'Add Product'}>
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6">
        {/* Back link */}
        <div className="mb-4">
          <Link
            href="/supplier/products"
            className="inline-flex items-center gap-1 text-sm text-pq-neutral-500 hover:text-pq-neutral-900 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Catalog
          </Link>
        </div>

        <PageHeader
          title={isService ? 'Add Service Offering' : 'Add Product'}
          description={
            isService
              ? 'Register a service your company provides. Save as draft, upload supporting documents, then submit for Procurement verification.'
              : 'Add a new product to your catalog. Save as draft, upload documents, then submit for Procurement verification when ready.'
          }
        />

        <div className="w-full bg-white rounded-md border border-pq-neutral-200 p-6 sm:p-8">
          {formError && (
            <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-3 text-sm text-pq-danger-600 mb-5">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Offering type toggle */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-pq-neutral-500 uppercase tracking-wide">
                Offering Type
              </label>
              <div className="flex rounded-md border border-pq-neutral-200 overflow-hidden w-fit">
                {(['goods', 'services'] as ItemType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setItemType(t)}
                    className={`px-5 py-2 text-sm font-medium transition ${
                      itemType === t
                        ? 'bg-pq-primary-600 text-white'
                        : 'bg-white text-pq-neutral-500 hover:bg-pq-neutral-50'
                    }`}
                  >
                    {t === 'goods' ? 'Goods' : 'Services'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-pq-neutral-400">
                {isService
                  ? 'Register a service offering (consulting, maintenance, support, etc.).'
                  : 'Register a physical product for procurement.'}
              </p>
            </div>

            {/* Name */}
            <FormField label={isService ? 'Service Name' : 'Product Name'} required>
              <input
                type="text"
                name="product_name"
                value={form.product_name}
                onChange={handleChange}
                placeholder={
                  isService
                    ? 'e.g. Annual Preventive Maintenance, IT Consulting'
                    : 'e.g. Sodium Chloride ACS Grade'
                }
                className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] bg-white"
              />
            </FormField>

            {/* Code + Category — code hidden for services */}
            <div className={`grid grid-cols-1 gap-5 ${isService ? '' : 'md:grid-cols-2'}`}>
              {!isService && (
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
              )}
              <FormField label="Category">
                <input
                  type="text"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  placeholder={
                    isService
                      ? 'e.g. Maintenance, Consulting, Security, IT Services'
                      : 'e.g. Chemicals, Reagents'
                  }
                  className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] bg-white"
                />
              </FormField>
            </div>

            {/* Description / Scope */}
            <FormField label={isService ? 'Scope of Service' : 'Description'}>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={3}
                placeholder={
                  isService
                    ? 'Describe what is included in this service offering'
                    : 'Short description of the product'
                }
                className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
              />
            </FormField>

            {/* Specifications / Terms */}
            <FormField label={isService ? 'Terms & Conditions / SLA' : 'Specifications'}>
              <textarea
                name="specifications"
                value={form.specifications}
                onChange={handleChange}
                rows={5}
                placeholder={
                  isService
                    ? 'SLA, billing model, coverage period, support hours, exclusions, response time, etc.'
                    : 'Technical specifications: purity, grade, packaging, storage conditions, etc.'
                }
                className="w-full px-3 py-2 text-sm border border-pq-neutral-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
              />
            </FormField>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2 bg-pq-primary-600 hover:bg-pq-neutral-900 text-white text-sm font-semibold rounded-md transition disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save as Draft'}
              </button>
              <Link
                href="/supplier/products"
                className="px-5 py-2 text-sm font-medium text-pq-neutral-500 bg-pq-neutral-50 border border-pq-neutral-200 rounded-md hover:bg-pq-neutral-200 transition"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

// ─── Form field wrapper ───────────────────────────────────────────────────────

function FormField({
  label,
  required,
  children,
}: {
  label:     string;
  required?: boolean;
  children:  React.ReactNode;
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
