'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import SupplierPaymentTermsForm from '@/components/admin/SupplierPaymentTermsForm';
import SupplierSupplyTypeForm from '@/components/admin/SupplierSupplyTypeForm';
import SupplierVatStatusForm from '@/components/admin/SupplierVatStatusForm';
import UserDeactivateDialog from '@/components/admin/UserDeactivateDialog';
import UserReactivateDialog from '@/components/admin/UserReactivateDialog';
import { setUserActiveStatus } from '@/lib/admin-users';
import type { AdminUser } from '@/lib/admin-users';
import type {
  SupplierAccount,
  SupplierAccreditationStatus,
  SupplierSupplyType,
} from '@/lib/procurement-suppliers';
import { ArrowRight, ExternalLink, Power, PowerOff } from 'lucide-react';

interface SupplierAccountDetailProps {
  supplier: SupplierAccount;
  onPaymentTermsUpdated?: (paymentTerms: string | null) => void;
  onVatStatusUpdated?: (isVatRegistered: boolean) => void;
  onSupplyTypeUpdated?: (supplyType: SupplierSupplyType | null) => void;
  onStatusChanged?: (active: boolean) => void;
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
  expired: 'Expired',
};

function toDialogUser(supplier: SupplierAccount): AdminUser {
  return {
    id: supplier.id,
    full_name: supplier.full_name,
    email: supplier.email,
    role_id: null,
    role_name: 'supplier',
    position_id: null,
    position_title: null,
    department_id: null,
    department_name: null,
    payment_terms: supplier.payment_terms,
    created_at: supplier.created_at,
    active: supplier.active,
  };
}

export default function SupplierAccountDetail({
  supplier,
  onPaymentTermsUpdated,
  onVatStatusUpdated,
  onSupplyTypeUpdated,
  onStatusChanged,
}: SupplierAccountDetailProps) {
  const [deactivateDialogOpen, setDeactivateDialogOpen] = useState(false);
  const [reactivateDialogOpen, setReactivateDialogOpen] = useState(false);
  const [isStatusLoading, setIsStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const dialogUser = toDialogUser(supplier);

  async function handleDeactivate() {
    setIsStatusLoading(true);
    setStatusError(null);
    const result = await setUserActiveStatus(supplier.id, false);
    if (!result.success) {
      setStatusError(result.error ?? 'Failed to deactivate supplier');
      setIsStatusLoading(false);
      return;
    }
    setDeactivateDialogOpen(false);
    onStatusChanged?.(false);
    setIsStatusLoading(false);
  }

  async function handleReactivate() {
    setIsStatusLoading(true);
    setStatusError(null);
    const result = await setUserActiveStatus(supplier.id, true);
    if (!result.success) {
      setStatusError(result.error ?? 'Failed to reactivate supplier');
      setIsStatusLoading(false);
      return;
    }
    setReactivateDialogOpen(false);
    onStatusChanged?.(true);
    setIsStatusLoading(false);
  }

  return (
    <div className="space-y-6">
      {statusError && (
        <div className="bg-pq-danger-100 border border-pq-danger-100 rounded-lg p-4">
          <p className="text-sm text-pq-danger-600">{statusError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-white rounded-lg border border-pq-neutral-200 p-4">
          <p className="text-xs font-medium text-pq-neutral-500 mb-2">Company</p>
          <p className="text-sm font-semibold text-pq-neutral-900">{supplier.full_name}</p>
        </Card>

        <Card className="bg-white rounded-lg border border-pq-neutral-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
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
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              {supplier.active ? (
                <Button
                  onClick={() => setDeactivateDialogOpen(true)}
                  className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs h-8"
                >
                  <PowerOff className="w-3.5 h-3.5 mr-1.5" />
                  Deactivate
                </Button>
              ) : (
                <Button
                  onClick={() => setReactivateDialogOpen(true)}
                  className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs h-8"
                >
                  <Power className="w-3.5 h-3.5 mr-1.5" />
                  Reactivate
                </Button>
              )}
            </div>
          </div>
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

      <UserDeactivateDialog
        user={dialogUser}
        isOpen={deactivateDialogOpen}
        isLoading={isStatusLoading}
        onConfirm={handleDeactivate}
        onCancel={() => {
          if (!isStatusLoading) setDeactivateDialogOpen(false);
        }}
      />

      <UserReactivateDialog
        user={dialogUser}
        isOpen={reactivateDialogOpen}
        isLoading={isStatusLoading}
        onConfirm={handleReactivate}
        onCancel={() => {
          if (!isStatusLoading) setReactivateDialogOpen(false);
        }}
      />

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

      <Card className="bg-white rounded-lg border border-pq-neutral-200 p-6">
        <h3 className="text-sm font-semibold text-pq-neutral-900 mb-1">VAT Registration</h3>
        <p className="text-xs text-pq-neutral-500 mb-4">
          Controls whether this supplier can select VAT-Inclusive / VAT-Exclusive on quotations.
        </p>
        <SupplierVatStatusForm
          userId={supplier.id}
          initialIsVatRegistered={supplier.is_vat_registered}
          onSuccess={onVatStatusUpdated}
        />
      </Card>

      <Card className="bg-white rounded-lg border border-pq-neutral-200 p-6">
        <h3 className="text-sm font-semibold text-pq-neutral-900 mb-1">Supplier Supply Type</h3>
        <p className="text-xs text-pq-neutral-500 mb-4">
          Marks whether this account is a raw mat supplier, non raw mat supplier, or service supplier.
          New suppliers default to non raw mat supplier.
        </p>
        <SupplierSupplyTypeForm
          userId={supplier.id}
          initialSupplyType={supplier.supplier_supply_type}
          onSuccess={onSupplyTypeUpdated}
        />
      </Card>
    </div>
  );
}
