'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import { useAuth } from '@/context/AuthContext';
import { createSupplierProduct } from '@/lib/supplier-products';
import { ChevronLeft } from 'lucide-react';

export default function NewSupplierProductPage() {
  const router  = useRouter();
  const { profile } = useAuth();

  const [form, setForm] = useState({
    product_name:   '',
    product_code:   '',
    category:       '',
    description:    '',
    specifications: '',
  });
  const [busy, setBusy]           = useState(false);
  const [formError, setFormError] = useState('');

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
      setFormError('Product name is required.');
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      const created = await createSupplierProduct(
        {
          product_name:   form.product_name,
          product_code:   form.product_code.trim()   || null,
          category:       form.category.trim()       || null,
          description:    form.description.trim()    || null,
          specifications: form.specifications.trim() || null,
        },
        profile
      );
      router.push(`/supplier/products/${created.id}`);
    } catch (err: unknown) {
      setFormError((err as Error)?.message || 'Failed to create product.');
      setBusy(false);
    }
  };

  return (
    <AppShell title="Add Product">
      <div className="w-full max-w-5xl mx-auto px-4 sm:px-6">
        {/* Back link */}
        <div className="mb-4">
          <Link
            href="/supplier/products"
            className="inline-flex items-center gap-1 text-sm text-pq-neutral-500 hover:text-pq-neutral-900 transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Products
          </Link>
        </div>

        <PageHeader
          title="Add Product"
          description="Add a new product to your catalog. Save as draft, upload documents, then submit for Procurement verification when ready."
        />

        <div className="w-full bg-white rounded-md border border-pq-neutral-200 p-6 sm:p-8">
        {formError && (
          <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-md p-3 text-sm text-pq-danger-600 mb-5">
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
  label:    string;
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
