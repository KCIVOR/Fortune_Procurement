import { supabase } from '@/lib/supabase';
import type { AppRole } from '@/types/auth';

const db = supabase as any;

/** Anchor for compliance traceability — separate from PR1→GRN ChainDocType. */
export type ComplianceAnchor =
  | { kind: 'product'; id: string }
  | { kind: 'accreditation'; id: string };

export interface ComplianceTraceRow {
  key:    string;
  label:  string;
  detail: string | null;
  status: string | null;
  /** null = display-only (no navigation) */
  href:   string | null;
  hint?:  string;
}

function productHref(role: AppRole, productId: string): string {
  if (role === 'supplier') return `/supplier/products/${productId}`;
  return `/accreditation/products/${productId}`;
}

function accreditationHref(role: AppRole, accreditationId: string): string {
  if (role === 'supplier') return '/supplier/accreditation';
  return `/accreditation/${accreditationId}`;
}

function statusHintProduct(status: string): string {
  if (status === 'verified') {
    return 'Verified — can be offered in RFQ. When linked on a quote line, Procurement can award after requestor rules are met.';
  }
  if (status === 'inactive') {
    return 'Inactive — deactivated. Cannot be offered on new quotes until reactivated.';
  }
  if (status === 'rejected') {
    return 'Rejected — cannot be awarded on RFQ until addressed and re-verified.';
  }
  return 'Pending validation — cannot be awarded on RFQ until verified.';
}

/**
 * Read-only traceability links for accreditation / products.
 * Does not modify PR1–GRN document chain. Fails silently to [] on error.
 */
export async function fetchComplianceTraceability(
  anchor: ComplianceAnchor,
  role:   AppRole
): Promise<ComplianceTraceRow[]> {
  try {
    if (anchor.kind === 'product') {
      return await traceFromProduct(anchor.id, role);
    }
    return await traceFromAccreditation(anchor.id, role);
  } catch {
    return [];
  }
}

async function traceFromProduct(productId: string, role: AppRole): Promise<ComplianceTraceRow[]> {
  const rows: ComplianceTraceRow[] = [];
  const { data: product } = await db
    .from('supplier_products')
    .select('id, product_name, status, accreditation_id, supplier_id')
    .eq('id', productId)
    .maybeSingle();
  if (!product) return rows;

  if (product.accreditation_id) {
    const { data: acc } = await db
      .from('supplier_accreditations')
      .select('id, status')
      .eq('id', product.accreditation_id)
      .maybeSingle();
    if (acc) {
      rows.push({
        key:    `acc-${acc.id}`,
        label:  'Supplier accreditation',
        detail: 'Linked accreditation',
        status: acc.status as string,
        href:   accreditationHref(role, acc.id as string),
        hint:   'TSQA validates products only. Accreditation approval remains a Procurement decision.',
      });
    }
  }

  const st = product.status as string;
  rows.push({
    key:    `product-${product.id}`,
    label:  'Product catalog record',
    detail: product.product_name as string,
    status: st,
    href:   productHref(role, product.id as string),
    hint:   statusHintProduct(st),
  });

  return rows;
}

async function traceFromAccreditation(accreditationId: string, role: AppRole): Promise<ComplianceTraceRow[]> {
  const rows: ComplianceTraceRow[] = [];
  const { data: acc } = await db
    .from('supplier_accreditations')
    .select('id, status')
    .eq('id', accreditationId)
    .maybeSingle();
  if (!acc) return rows;

  rows.push({
    key:    `acc-${acc.id}`,
    label:  'This accreditation',
    detail: 'Supplier accreditation',
    status: acc.status as string,
    href:   accreditationHref(role, acc.id as string),
    hint:   'Accreditation approval is independent of individual product verification.',
  });

  const { data: products } = await db
    .from('supplier_products')
    .select('id, product_name, status')
    .eq('accreditation_id', accreditationId)
    .order('created_at', { ascending: false })
    .limit(12);

  for (const p of (products ?? []) as any[]) {
    rows.push({
      key:    `product-${p.id}`,
      label:  'Linked product',
      detail: p.product_name as string,
      status: p.status as string,
      href:   productHref(role, p.id as string),
      hint:   statusHintProduct(p.status as string),
    });
  }

  return rows;
}
