'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import AppShell from '@/components/layout/AppShell';
import LoadingState from '@/components/shared/LoadingState';
import PageHeader from '@/components/shared/PageHeader';
import SupplierAccountDetail from '@/components/procurement/SupplierAccountDetail';
import { Button } from '@/components/ui/button';
import { getSupplierAccountById } from '@/lib/procurement-suppliers';
import type { SupplierAccount } from '@/lib/procurement-suppliers';
import { ArrowLeft } from 'lucide-react';

function canManageSuppliers(role: string | undefined): boolean {
  return role === 'procurement' || role === 'admin';
}

export default function SupplierAccountDetailPage() {
  const params = useParams();
  const supplierId = params?.id as string;
  const { profile, loading: authLoading } = useAuth();
  const [supplier, setSupplier] = useState<SupplierAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!profile) {
      setError('Not authenticated');
      setIsLoading(false);
      return;
    }

    if (!canManageSuppliers(profile.role)) {
      setError('Access denied. Procurement role required.');
      setIsLoading(false);
      return;
    }

    loadSupplier();
  }, [authLoading, profile, supplierId]);

  async function loadSupplier() {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getSupplierAccountById(supplierId);

      if (!data) {
        setError('Supplier account not found');
      } else {
        setSupplier(data);
      }
    } catch (err) {
      console.error('Error loading supplier account:', err);
      setError('Failed to load supplier account');
    } finally {
      setIsLoading(false);
    }
  }

  if (authLoading) {
    return (
      <AppShell title="Supplier Account">
        <LoadingState message="Loading..." />
      </AppShell>
    );
  }

  if (error === 'Access denied. Procurement role required.') {
    return (
      <AppShell title="Supplier Account">
        <div className="space-y-6">
          <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">Access Denied</h3>
            <p className="text-sm text-pq-danger-600">
              You do not have permission to view supplier accounts. Only procurement staff can access this feature.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (isLoading) {
    return (
      <AppShell title="Supplier Account">
        <LoadingState message="Loading supplier account..." />
      </AppShell>
    );
  }

  if (error || !supplier) {
    return (
      <AppShell title="Supplier Account">
        <div className="space-y-6">
          <Link href="/suppliers">
            <Button variant="outline" className="text-sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Supplier Accounts
            </Button>
          </Link>
          <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-6">
            <h3 className="font-semibold text-red-900 mb-2">
              {error === 'Supplier account not found' ? 'Not Found' : 'Error'}
            </h3>
            <p className="text-sm text-pq-danger-600">
              {error ?? 'This supplier account could not be found.'}
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Supplier Account">
      <div className="space-y-6">
        <Link href="/suppliers">
          <Button variant="outline" className="text-sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Supplier Accounts
          </Button>
        </Link>

        <PageHeader title={supplier.full_name} description={supplier.email} />

        <SupplierAccountDetail
          supplier={supplier}
          onPaymentTermsUpdated={(paymentTerms) =>
            setSupplier((prev) => (prev ? { ...prev, payment_terms: paymentTerms } : prev))
          }
          onVatStatusUpdated={(isVatRegistered) =>
            setSupplier((prev) => (prev ? { ...prev, is_vat_registered: isVatRegistered } : prev))
          }
          onStatusChanged={(active) =>
            setSupplier((prev) => (prev ? { ...prev, active } : prev))
          }
        />
      </div>
    </AppShell>
  );
}
