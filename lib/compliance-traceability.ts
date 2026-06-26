import { supabase } from '@/lib/supabase';
import type { AppRole } from '@/types/auth';

const db = supabase as any;

/** Anchor for compliance traceability — separate from PR1→GRN ChainDocType. */
export type ComplianceAnchor =
  | { kind: 'product'; id: string }
  | { kind: 'accreditation'; id: string }
  | { kind: 'rse'; id: string };

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

function rseHref(role: AppRole, rseId: string, productId: string): string {
  if (role === 'tsqa' || role === 'admin') return `/tsqa/rse/${rseId}`;
  return productHref(role, productId);
}

function statusHintProduct(status: string): string {
  if (status === 'verified') {
    return 'Verified — can be offered in RFQ. When linked on a quote line, Procurement can award after requestor rules are met.';
  }
  if (status === 'inactive') {
    return 'Inactive — verification was revoked. Cannot be offered in RFQ until re-verified.';
  }
  if (status === 'rejected') {
    return 'Rejected — cannot be awarded on RFQ until addressed and re-verified.';
  }
  return 'Pending validation — cannot be awarded on RFQ until verified.';
}

/**
 * Read-only traceability links for accreditation / products / RSE / TSQA.
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
    if (anchor.kind === 'accreditation') {
      return await traceFromAccreditation(anchor.id, role);
    }
    return await traceFromRse(anchor.id, role);
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

  const { data: rseList } = await db
    .from('rse_records')
    .select('id, rse_number, status')
    .eq('supplier_product_id', product.id)
    .order('created_at', { ascending: false });

  for (const rse of (rseList ?? []) as any[]) {
    const { data: rev } = await db
      .from('tsqa_reviews')
      .select('result')
      .eq('rse_id', rse.id as string)
      .order('reviewed_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const tsqaLine = rev?.result
      ? `Latest TSQA result: ${rev.result}`
      : 'TSQA evaluation (if any) applies to this product/sample only.';
    rows.push({
      key:    `rse-${rse.id}`,
      label:  'RSE',
      detail: (rse.rse_number as string) ?? String(rse.id).slice(0, 8).toUpperCase(),
      status: rse.status as string,
      href:   rseHref(role, rse.id as string, product.id as string),
      hint:   tsqaLine,
    });
  }

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

  const productIds = (products ?? []).map((p: any) => p.id as string);
  if (productIds.length === 0) return rows;

  const { data: rses } = await db
    .from('rse_records')
    .select('id, rse_number, status, supplier_product_id')
    .in('supplier_product_id', productIds)
    .order('created_at', { ascending: false })
    .limit(15);

  for (const rse of (rses ?? []) as any[]) {
    rows.push({
      key:    `rse-${rse.id}`,
      label:  'RSE (linked product)',
      detail: (rse.rse_number as string) ?? String(rse.id).slice(0, 8),
      status: rse.status as string,
      href:   rseHref(role, rse.id as string, rse.supplier_product_id as string),
      hint:   'Technical evaluation tied to a catalog product.',
    });
  }

  return rows;
}

async function traceFromRse(rseId: string, role: AppRole): Promise<ComplianceTraceRow[]> {
  const rows: ComplianceTraceRow[] = [];
  const { data: rse } = await db
    .from('rse_records')
    .select('id, rse_number, status, supplier_product_id, accreditation_id')
    .eq('id', rseId)
    .maybeSingle();
  if (!rse) return rows;

  const productId = rse.supplier_product_id as string;

  if (rse.accreditation_id) {
    const { data: acc } = await db
      .from('supplier_accreditations')
      .select('id, status')
      .eq('id', rse.accreditation_id)
      .maybeSingle();
    if (acc) {
      rows.push({
        key:    `acc-${acc.id}`,
        label:  'Supplier accreditation',
        detail: 'Context',
        status: acc.status as string,
        href:   accreditationHref(role, acc.id as string),
        hint:   'Separate from TSQA product outcome.',
      });
    }
  }

  const { data: product } = await db
    .from('supplier_products')
    .select('id, product_name, status')
    .eq('id', productId)
    .maybeSingle();
  if (product) {
    rows.push({
      key:    `product-${product.id}`,
      label:  'Catalog product',
      detail: product.product_name as string,
      status: product.status as string,
      href:   productHref(role, product.id as string),
      hint:   statusHintProduct(product.status as string),
    });
  }

  rows.push({
    key:    `rse-${rse.id}`,
    label:  'This RSE',
    detail: (rse.rse_number as string) ?? String(rse.id).slice(0, 8),
    status: rse.status as string,
    href:   role === 'tsqa' || role === 'admin' ? `/tsqa/rse/${rse.id}` : null,
    hint:
      rse.status === 'passed' || rse.status === 'failed' || rse.status === 'cancelled'
        ? 'Completed — read-only record.'
        : 'Active evaluation — TSQA actions available when assigned.',
  });

  const { data: rev } = await db
    .from('tsqa_reviews')
    .select('result, remarks')
    .eq('rse_id', rseId)
    .order('reviewed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (rev) {
    rows.push({
      key:    `tsqa-${rseId}`,
      label:  'TSQA review',
      detail: rev.remarks ? String(rev.remarks).slice(0, 80) : null,
      status: rev.result as string,
      href:   null,
      hint:   'TSQA pass/fail applies to the product/sample, not supplier accreditation.',
    });
  }

  return rows;
}
