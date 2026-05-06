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
      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/supplier/products"
          className="inline-flex items-center gap-1 text-sm text-[#40527A] hover:text-[#0F1F3A] transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Products
        </Link>
      </div>

      <PageHeader
        title="Add Product"
        description="Add a new product to your catalog. Save as draft, upload documents, then submit for Procurement verification when ready."
      />

      <div className="bg-white rounded-[4px] border border-[#D8E2FF] p-6 max-w-2xl">
        {formError && (
          <div className="bg-red-50 border border-red-200 rounded-[4px] p-3 text-sm text-red-700 mb-5">
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
              className="w-full px-3 py-2 text-sm border border-[#D8E2FF] rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] bg-white"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <FormField label="Product Code / SKU">
              <input
                type="text"
                name="product_code"
                value={form.product_code}
                onChange={handleChange}
                placeholder="e.g. NaCl-ACS-001"
                className="w-full px-3 py-2 text-sm border border-[#D8E2FF] rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] bg-white"
              />
            </FormField>
            <FormField label="Category">
              <input
                type="text"
                name="category"
                value={form.category}
                onChange={handleChange}
                placeholder="e.g. Chemicals, Reagents"
                className="w-full px-3 py-2 text-sm border border-[#D8E2FF] rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] bg-white"
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
              className="w-full px-3 py-2 text-sm border border-[#D8E2FF] rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
            />
          </FormField>

          <FormField label="Specifications">
            <textarea
              name="specifications"
              value={form.specifications}
              onChange={handleChange}
              rows={5}
              placeholder="Technical specifications: purity, grade, packaging, storage conditions, etc."
              className="w-full px-3 py-2 text-sm border border-[#D8E2FF] rounded-[4px] focus:outline-none focus:ring-1 focus:ring-[#1E4BFF] resize-none bg-white"
            />
          </FormField>

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2 bg-[#1E4BFF] hover:bg-[#0F1F3A] text-white text-sm font-semibold rounded-[4px] transition disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save as Draft'}
            </button>
            <Link
              href="/supplier/products"
              className="px-5 py-2 text-sm font-medium text-[#40527A] bg-[#F7F9FC] border border-[#D8E2FF] rounded-[4px] hover:bg-[#E5EAFF] transition"
            >
              Cancel
            </Link>
          </div>
        </form>
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
      <label className="block text-xs font-semibold text-[#40527A] uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
