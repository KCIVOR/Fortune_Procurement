'use client';

import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/shared/EmptyState';
import { TableSkeleton } from '@/components/shared/structural-skeletons';
import { format } from 'date-fns';
import { Eye } from 'lucide-react';
import type { SupplierAccount, SupplierAccreditationStatus } from '@/lib/procurement-suppliers';
import { supplyTypeLabel } from '@/lib/supplier-supply-type';

interface SupplierAccountsTableProps {
  suppliers: SupplierAccount[];
  isLoading?: boolean;
}

const ACCRED_LABELS: Record<SupplierAccreditationStatus, string> = {
  none: 'No application',
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  missing_documents: 'Missing documents',
  approved: 'Accredited',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

function accreditationBadgeClass(status: SupplierAccreditationStatus): string {
  if (status === 'approved') return 'bg-pq-success-100 text-pq-success-600';
  if (status === 'none' || status === 'draft') return 'bg-pq-neutral-100 text-pq-neutral-500';
  if (status === 'rejected' || status === 'withdrawn') return 'bg-pq-danger-100 text-pq-danger-600';
  return 'bg-pq-warning-100 text-pq-warning-600';
}

export default function SupplierAccountsTable({
  suppliers,
  isLoading = false,
}: SupplierAccountsTableProps) {
  if (isLoading) {
    return <TableSkeleton rows={5} cols={9} />;
  }

  if (suppliers.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-pq-neutral-200 p-8 text-center">
        <EmptyState title="No supplier accounts found" className="py-0 px-0" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-pq-neutral-200 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-pq-neutral-200 bg-pq-neutral-50">
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Company</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Email</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Supply type</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Status</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Accreditation</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Products</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Payment Terms</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500">Added</TableHead>
              <TableHead className="text-xs font-semibold text-pq-neutral-500 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {suppliers.map((supplier) => (
              <TableRow
                key={supplier.id}
                className={`border-b border-pq-neutral-200 hover:bg-pq-neutral-50 transition ${!supplier.active ? 'opacity-60' : ''}`}
              >
                <TableCell className="text-xs text-pq-neutral-900 font-medium">
                  {supplier.full_name}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500 font-mono">{supplier.email}</TableCell>
                <TableCell className="text-xs text-pq-neutral-700 whitespace-nowrap">
                  {supplyTypeLabel(supplier.supplier_supply_type)}
                </TableCell>
                <TableCell className="text-xs">
                  {supplier.active ? (
                    <span className="px-2 py-1 bg-pq-success-100 text-pq-success-600 rounded text-xs font-medium">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-pq-neutral-100 text-pq-neutral-500 rounded text-xs font-medium">
                      Inactive
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${accreditationBadgeClass(supplier.accreditation_status)}`}
                  >
                    {ACCRED_LABELS[supplier.accreditation_status]}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500">{supplier.product_count}</TableCell>
                <TableCell className="text-xs text-pq-neutral-500 max-w-[140px] truncate">
                  {supplier.payment_terms?.trim() || '—'}
                </TableCell>
                <TableCell className="text-xs text-pq-neutral-500">
                  {supplier.created_at ? format(new Date(supplier.created_at), 'MMM d, yyyy') : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/suppliers/${supplier.id}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-pq-primary-600 hover:text-pq-neutral-900 hover:bg-pq-primary-50"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
