'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import SupplierPaymentTermsForm from '@/components/admin/SupplierPaymentTermsForm';
import type { SupplierAccount, SupplierAccreditationStatus } from '@/lib/procurement-suppliers';
import { ArrowRight, ExternalLink } from 'lucide-react';

interface SupplierAccountDetailProps {
  supplier: SupplierAccount;
  onPaymentTermsUpdated?: (paymentTerms: string | null) => void;
}

const ACCRED_LABELS: Record<SupplierAccreditationStatus, string> = {
  none: 'No application submitted yet',
  draft: 'Draft — not yet submitted',
  submitted: 'Submitted — awaiting review',
  under_review: 'Under procurement review',
  missing_documents: 'Missing documents requested',
  approved: 'Accredited',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export default function SupplierAccountDetail({
  supplier,
  onPaymentTermsUpdated,
}: SupplierAccountDetailProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-white rounded-lg border border-pq-neutral-200 p-4">
          <p className="text-xs font-medium text-pq-neutral-500 mb-2">Company</p>
          <p className="text-sm font-semibold text-pq-neutral-900">{supplier.full_name}</p>
        </Card>

        <Card className="bg-white rounded-lg border border-pq-neutral-200 p-4">
          <p className="text-xs font-medium text-pq-neutral-500 mb-2">Account Status</p>
          {supplier.active ? (
            <span className="inline-flex px-2 py-1 bg-pq-success-100 text-pq-success-600 rounded text-xs font-medium">
              Active
            </span>
          ) : (
            <span className="inline-flex px-2 py-1 bg-pq-neutral-100 text-pq-neutral-500 rounded text-xs font-medium">
              Inactive
            </span>
          )}
        </Card>

        <Card className="bg-white rounded-lg border border-pq-neutral-200 p-4">
          <p className="text-xs font-medium text-pq-neutral-500 mb-2">Email</p>
          <p className="text-sm font-mono text-pq-neutral-900 break-all">{supplier.email}</p>
        </Card>

        <Card className="bg-white rounded-lg border border-pq-neutral-200 p-4">
          <p className="text-xs font-medium text-pq-neutral-500 mb-2">Member Since</p>
          <p className="text-sm text-pq-neutral-900">
            {supplier.created_at ? format(new Date(supplier.created_at), 'PPP') : 'Unknown'}
          </p>
        </Card>
      </div>

      <Card className="bg-white rounded-lg border border-pq-neutral-200 p-6">
        <h3 className="text-sm font-semibold text-pq-neutral-900 mb-1">Accreditation</h3>
        <p className="text-xs text-pq-neutral-500 mb-4">
          Application review is managed separately from login accounts.
        </p>
        <p className="text-sm text-pq-neutral-900 mb-4">
          {ACCRED_LABELS[supplier.accreditation_status]}
        </p>
        <div className="flex flex-wrap gap-3">
          {supplier.accreditation_id ? (
            <Link href={`/accreditation/${supplier.accreditation_id}`}>
              <Button variant="outline" size="sm" className="text-xs gap-1.5">
                View accreditation application
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          ) : null}
          <Link href="/accreditation/products">
            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              Product review queue
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
        <p className="text-xs text-pq-neutral-400 mt-3">
          {supplier.product_count} product{supplier.product_count === 1 ? '' : 's'} in catalog
        </p>
      </Card>

      <Card className="bg-white rounded-lg border border-pq-neutral-200 p-6">
        <h3 className="text-sm font-semibold text-pq-neutral-900 mb-1">Default Payment Terms</h3>
        <p className="text-xs text-pq-neutral-500 mb-4">
          Prefilled when procurement generates a purchase order for this supplier.
        </p>
        <SupplierPaymentTermsForm
          userId={supplier.id}
          initialPaymentTerms={supplier.payment_terms}
          onSuccess={onPaymentTermsUpdated}
        />
      </Card>
    </div>
  );
}
