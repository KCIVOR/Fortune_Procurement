import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';

const db = supabase as any;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ComplianceDocument {
  id:            string;
  po_id:         string;
  po_item_id:    string;
  supplier_id:   string;
  document_type: string;
  storage_path:  string;
  file_name:     string;
  file_size:     number | null;
  mime_type:     string | null;
  uploaded_at:   string;
  /** Signed download URL — populated by fetchComplianceDocsByPO */
  url?:          string;
}

export interface POItemWithCompliance {
  po_item_id:              string;
  item_order:              number;
  description:             string;
  requires_compliance_doc: boolean;
  documents:               ComplianceDocument[];
}

export interface CompliancePOSummary {
  po_id:       string;
  po_number:   string;
  supplier_id: string;
  status:      string;
  sent_at:     string | null;
  items:       POItemWithCompliance[];
}

// ─── Fetch: supplier's POs with compliance-flagged items ─────────────────────

/**
 * Fetch all sent/approved POs for `supplierId` that contain at least one PO
 * item flagged `requires_compliance_doc = true` (set by Procurement/Buyer
 * directly on `po_items` — see migration `compliance_doc_per_po_item`).
 *
 * An item only appears once a GRN has actually been created for it (proof
 * warehouse/procurement received the delivery) — checked via the
 * `po_items_with_grn` RPC rather than reading `grn_items` directly, since
 * suppliers have no RLS access to that table.
 */
export async function fetchSupplierCompliancePOs(
  supplierId: string,
): Promise<CompliancePOSummary[]> {
  // 1. Fetch relevant POs for this supplier
  const { data: pos, error: posErr } = await db
    .from('po_requests')
    .select('id, po_number, supplier_id, status, sent_at')
    .eq('supplier_id', supplierId)
    .in('status', ['approved', 'sent'])
    .order('created_at', { ascending: false });
  if (posErr) throw posErr;
  if (!pos || pos.length === 0) return [];

  const poIds = (pos as any[]).map((p) => p.id as string);

  // 2. Fetch PO items flagged as requiring a compliance document
  const { data: poItems, error: itemsErr } = await db
    .from('po_items')
    .select('id, po_id, item_order, description, requires_compliance_doc')
    .in('po_id', poIds)
    .eq('requires_compliance_doc', true)
    .order('item_order', { ascending: true });
  if (itemsErr) throw itemsErr;

  const flaggedItems = (poItems ?? []) as any[];
  if (flaggedItems.length === 0) return [];

  // 3. Of those, keep only items that already have a GRN (warehouse/procurement received it)
  const poItemIds = flaggedItems.map((i: any) => i.id as string);
  const { data: withGrn, error: grnErr } = await db.rpc('po_items_with_grn', {
    p_po_item_ids: poItemIds,
  });
  if (grnErr) throw grnErr;
  const itemsWithGrn = new Set<string>((withGrn ?? []) as string[]);

  const eligibleItems = flaggedItems.filter((i: any) => itemsWithGrn.has(i.id as string));
  if (eligibleItems.length === 0) return [];

  // 4. Fetch all compliance documents already uploaded for these PO items
  const eligibleItemIds = eligibleItems.map((i: any) => i.id as string);
  let docsByPoItemId: Record<string, ComplianceDocument[]> = {};

  const { data: docs, error: docsErr } = await db
    .from('compliance_documents')
    .select('id, po_id, po_item_id, supplier_id, document_type, storage_path, file_name, file_size, mime_type, uploaded_at')
    .in('po_item_id', eligibleItemIds)
    .order('uploaded_at', { ascending: false });
  if (docsErr) throw docsErr;

  for (const doc of (docs ?? []) as any[]) {
    const { data: signed } = await (supabase as any).storage
      .from('compliance-documents')
      .createSignedUrl(doc.storage_path, 3600);
    const url = signed?.signedUrl ?? '';
    const d: ComplianceDocument = { ...doc, url };
    if (!docsByPoItemId[doc.po_item_id]) docsByPoItemId[doc.po_item_id] = [];
    docsByPoItemId[doc.po_item_id].push(d);
  }

  // 5. Assemble per-PO summary
  const results: CompliancePOSummary[] = [];

  for (const po of pos as any[]) {
    const items: POItemWithCompliance[] = eligibleItems
      .filter((i: any) => i.po_id === po.id)
      .map((i: any) => ({
        po_item_id:              i.id as string,
        item_order:              i.item_order as number,
        description:             i.description as string,
        requires_compliance_doc: true,
        documents:               docsByPoItemId[i.id] ?? [],
      }));

    if (items.length === 0) continue; // nothing eligible yet for this PO

    results.push({
      po_id:       po.id,
      po_number:   po.po_number,
      supplier_id: po.supplier_id,
      status:      po.status,
      sent_at:     po.sent_at ?? null,
      items,
    });
  }

  return results;
}

export interface SupplierComplianceCounts {
  total_pos:      number;
  pending_items:  number;
  uploaded_items: number;
}

export function summarizeSupplierComplianceCounts(
  pos: CompliancePOSummary[],
): SupplierComplianceCounts {
  let pending_items = 0, uploaded_items = 0;
  for (const po of pos) {
    for (const item of po.items) {
      if (item.documents.length > 0) uploaded_items += 1;
      else pending_items += 1;
    }
  }
  return { total_pos: pos.length, pending_items, uploaded_items };
}

export async function fetchSupplierCompliancePOById(
  supplierId: string,
  poId:       string,
): Promise<CompliancePOSummary | null> {
  const all = await fetchSupplierCompliancePOs(supplierId);
  return all.find(p => p.po_id === poId) ?? null;
}

// ─── Procurement: toggle per-item compliance requirement ─────────────────────

export async function updatePOItemComplianceRequirement(
  poItemId: string,
  requires: boolean,
  profile:  UserProfile,
): Promise<void> {
  if (profile.role !== 'procurement' && profile.role !== 'admin') {
    throw new Error('Only Procurement can set compliance document requirements.');
  }

  const { error } = await db
    .from('po_items')
    .update({ requires_compliance_doc: requires })
    .eq('id', poItemId);
  if (error) throw error;
}

// ─── Procurement: dedicated compliance-documents overview ────────────────────

export type ProcurementComplianceItemStatus = 'awaiting_grn' | 'pending_upload' | 'uploaded';

export interface ProcurementComplianceItem {
  po_item_id:  string;
  item_order:  number;
  description: string;
  status:      ProcurementComplianceItemStatus;
  documents:   ComplianceDocument[];
}

export interface ProcurementCompliancePO {
  po_id:              string;
  po_number:          string;
  supplier_id:        string | null;
  supplier_name:      string;
  status:              string;
  sent_at:             string | null;
  created_at:          string;
  items:               ProcurementComplianceItem[];
  awaiting_grn_count:  number;
  pending_upload_count: number;
  uploaded_count:      number;
}

export interface ProcurementComplianceCounts {
  total_pos:       number;
  awaiting_grn:    number;
  pending_upload:  number;
  uploaded:        number;
}

/**
 * Every PO carrying at least one item flagged `requires_compliance_doc = true`,
 * across the whole system (Procurement's global view — unlike the supplier's
 * own queue, this includes items still awaiting a GRN, so Procurement can see
 * the full lifecycle: flagged → GRN received → uploaded).
 */
export async function fetchAllProcurementCompliancePOs(): Promise<ProcurementCompliancePO[]> {
  // 1. All PO items flagged as requiring a compliance document
  const { data: poItems, error: itemsErr } = await db
    .from('po_items')
    .select('id, po_id, item_order, description, requires_compliance_doc')
    .eq('requires_compliance_doc', true)
    .order('item_order', { ascending: true });
  if (itemsErr) throw itemsErr;

  const flaggedItems = (poItems ?? []) as any[];
  if (flaggedItems.length === 0) return [];

  const poIds = Array.from(new Set(flaggedItems.map((i: any) => i.po_id as string)));
  const poItemIds = flaggedItems.map((i: any) => i.id as string);

  // 2. Parent POs
  const { data: pos, error: posErr } = await db
    .from('po_requests')
    .select('id, po_number, supplier_id, supplier_name_snapshot, status, sent_at, created_at')
    .in('id', poIds)
    .order('created_at', { ascending: false });
  if (posErr) throw posErr;

  // 3. Which flagged items already have a GRN
  const { data: withGrn, error: grnErr } = await db.rpc('po_items_with_grn', {
    p_po_item_ids: poItemIds,
  });
  if (grnErr) throw grnErr;
  const itemsWithGrn = new Set<string>((withGrn ?? []) as string[]);

  // 4. Uploaded documents for these items
  const { data: docs, error: docsErr } = await db
    .from('compliance_documents')
    .select('id, po_id, po_item_id, supplier_id, document_type, storage_path, file_name, file_size, mime_type, uploaded_at')
    .in('po_item_id', poItemIds)
    .order('uploaded_at', { ascending: false });
  if (docsErr) throw docsErr;

  const docsByPoItemId: Record<string, ComplianceDocument[]> = {};
  for (const doc of (docs ?? []) as any[]) {
    const { data: signed } = await (supabase as any).storage
      .from('compliance-documents')
      .createSignedUrl(doc.storage_path, 3600);
    const d: ComplianceDocument = { ...doc, url: signed?.signedUrl ?? '' };
    if (!docsByPoItemId[doc.po_item_id]) docsByPoItemId[doc.po_item_id] = [];
    docsByPoItemId[doc.po_item_id].push(d);
  }

  // 5. Assemble
  const results: ProcurementCompliancePO[] = [];
  for (const po of (pos ?? []) as any[]) {
    const items: ProcurementComplianceItem[] = flaggedItems
      .filter((i: any) => i.po_id === po.id)
      .map((i: any) => {
        const documents = docsByPoItemId[i.id] ?? [];
        const status: ProcurementComplianceItemStatus = !itemsWithGrn.has(i.id)
          ? 'awaiting_grn'
          : documents.length > 0 ? 'uploaded' : 'pending_upload';
        return {
          po_item_id:  i.id as string,
          item_order:  i.item_order as number,
          description: i.description as string,
          status,
          documents,
        };
      });

    if (items.length === 0) continue;

    results.push({
      po_id:                po.id,
      po_number:            po.po_number,
      supplier_id:          po.supplier_id ?? null,
      supplier_name:        po.supplier_name_snapshot,
      status:               po.status,
      sent_at:              po.sent_at ?? null,
      created_at:           po.created_at,
      items,
      awaiting_grn_count:   items.filter(i => i.status === 'awaiting_grn').length,
      pending_upload_count: items.filter(i => i.status === 'pending_upload').length,
      uploaded_count:       items.filter(i => i.status === 'uploaded').length,
    });
  }

  return results;
}

export function summarizeProcurementComplianceCounts(
  pos: ProcurementCompliancePO[],
): ProcurementComplianceCounts {
  let awaiting_grn = 0, pending_upload = 0, uploaded = 0;
  for (const po of pos) {
    awaiting_grn   += po.awaiting_grn_count;
    pending_upload += po.pending_upload_count;
    uploaded       += po.uploaded_count;
  }
  return { total_pos: pos.length, awaiting_grn, pending_upload, uploaded };
}

export async function fetchProcurementCompliancePOById(
  poId: string,
): Promise<ProcurementCompliancePO | null> {
  const all = await fetchAllProcurementCompliancePOs();
  return all.find(p => p.po_id === poId) ?? null;
}

// ─── Fetch: compliance docs for a single PO (Procurement view) ───────────────

export async function fetchComplianceDocsByPO(poId: string): Promise<ComplianceDocument[]> {
  const { data, error } = await db
    .from('compliance_documents')
    .select('id, po_id, po_item_id, supplier_id, document_type, storage_path, file_name, file_size, mime_type, uploaded_at')
    .eq('po_id', poId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;

  const docs: ComplianceDocument[] = [];
  for (const doc of (data ?? []) as any[]) {
    const { data: signed } = await (supabase as any).storage
      .from('compliance-documents')
      .createSignedUrl(doc.storage_path, 3600);
    docs.push({ ...doc, url: signed?.signedUrl ?? '' });
  }
  return docs;
}

// ─── Upload a compliance document ────────────────────────────────────────────

export async function uploadComplianceDocument(
  poId:       string,
  poItemId:   string,
  file:       File,
  profile:    UserProfile,
): Promise<ComplianceDocument> {
  if (profile.role !== 'supplier') {
    throw new Error('Only suppliers can upload compliance documents.');
  }

  const ts        = Date.now();
  const safeName  = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `compliance-documents/${poId}/${poItemId}/${ts}_${safeName}`;

  const { error: uploadErr } = await (supabase as any).storage
    .from('compliance-documents')
    .upload(storagePath, file, { upsert: false });
  if (uploadErr) throw uploadErr;

  const { data, error: insertErr } = await db
    .from('compliance_documents')
    .insert({
      po_id:         poId,
      po_item_id:    poItemId,
      supplier_id:   profile.id,
      document_type: 'compliance',
      storage_path:  storagePath,
      file_name:     file.name,
      file_size:     file.size,
      mime_type:     file.type || null,
    })
    .select()
    .single();
  if (insertErr) throw insertErr;

  return data as ComplianceDocument;
}

// ─── Delete a compliance document ────────────────────────────────────────────

export async function deleteComplianceDocument(
  docId:       string,
  storagePath: string,
  profile:     UserProfile,
): Promise<void> {
  if (profile.role !== 'supplier' && profile.role !== 'admin') {
    throw new Error('Only the uploader or an admin can delete compliance documents.');
  }

  const { error: storageErr } = await (supabase as any).storage
    .from('compliance-documents')
    .remove([storagePath]);
  if (storageErr) throw storageErr;

  const { error: deleteErr } = await db
    .from('compliance_documents')
    .delete()
    .eq('id', docId);
  if (deleteErr) throw deleteErr;
}
