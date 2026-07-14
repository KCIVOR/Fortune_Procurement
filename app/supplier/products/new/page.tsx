'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import { useAuth } from '@/context/AuthContext';

/**
 * Suppliers no longer create catalog products — Procurement adds them for
 * raw-material suppliers. Redirect away from the old create form.
 */
export default function NewSupplierProductPage() {
  const router = useRouter();
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile) return;
    if (profile.role === 'supplier' && profile.supplier_supply_type === 'raw_material') {
      router.replace('/supplier/products');
      return;
    }
    router.replace('/dashboard');
  }, [profile, router]);

  return (
    <AppShell title="Add Product">
      <PageHeader
        title="Add Product"
        description="Catalog products are added by Procurement for raw-material suppliers."
      />
      <div className="flex items-center justify-center h-48">
        <LoadingState message="Redirecting…" />
      </div>
    </AppShell>
  );
}
