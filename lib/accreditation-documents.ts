import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type { SupplierDocument } from '@/types/database';

/**
 * Bucket defined in:
 * supabase/migrations/20260507000300_supplier_accreditation_storage.sql
 *
 * Path conventions:
 *   supplier-accreditations/{accreditation_id}/documents/{ts}_{filename}
 *   supplier-products/{product_id}/documents/{ts}_{filename}
 *   rse/{rse_id}/reports/{ts}_{filename}
 */
export const ACCREDITATION_DOCS_BUCKET = 'supplier-accreditation-documents' as const;

const ALLOWED_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const MAX_FILE_BYTES     = 20 * 1024 * 1024; // 20 MB

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizeFilename(filename: string): string {
  const base   = filename.trim() || 'document';
  const noPath = base.replace(/[/\\]/g, '_');
  return noPath.replace(/[^\w.\-() ]+/g, '_').slice(0, 200);
}

function buildObjectPath(
  namespace: string,
  entityId:  string,
  subfolder: string,
  filename:  string
): string {
  const ts   = new Date().toISOString().replace(/[:.]/g, '-');
  const safe = sanitizeFilename(filename);
  return `${namespace}/${entityId}/${subfolder}/${ts}_${safe}`;
}

function validateUploadArgs(entityId: string, file: File): void {
  if (!UUID_RE.test(entityId.trim())) throw new Error('Invalid record id.');
  const mime = file.type || '';
  if (!ALLOWED_MIME_TYPES.has(mime))  throw new Error('Allowed types: PDF, JPG, or PNG only.');
  if (file.size > MAX_FILE_BYTES)     throw new Error('File must be 20 MB or smaller.');
}

// ─── Upload result type ───────────────────────────────────────────────────────

export interface UploadResult {
  path:       string;
  filename:   string;
  documentId: string;
}

// Fields the caller must supply; uploadAndRecord resolves file_path/mime/size/status itself.
interface DocumentInsertFields {
  supplier_id:         string;
  accreditation_id:    string | null;
  supplier_product_id: string | null;
  document_type:       string;
  file_name:           string;
  uploaded_by:         string;
  expires_at:          string | null;
}

// ─── Upload helper (internal) ────────────────────────────────────────────────

async function uploadAndRecord(
  objectPath: string,
  file:       File,
  docFields:  DocumentInsertFields
): Promise<UploadResult> {
  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from(ACCREDITATION_DOCS_BUCKET)
    .upload(objectPath, file, { contentType: file.type, upsert: false });

  if (uploadErr) throw new Error(uploadErr.message || 'Upload failed.');
  if (!uploadData?.path) throw new Error('Upload failed: no path returned.');

  const db  = supabase as any;
  const now = new Date().toISOString();
  const { data: docRow, error: insertErr } = await db
    .from('supplier_documents')
    .insert({
      ...docFields,
      file_path:   uploadData.path,
      mime_type:   file.type || null,
      file_size:   file.size,
      status:      'uploaded',
      created_at:  now,
      updated_at:  now,
    })
    .select('id')
    .single();
  if (insertErr) throw new Error(insertErr.message || 'Document record insert failed.');

  return {
    path:       uploadData.path,
    filename:   file.name,
    documentId: (docRow as any).id as string,
  };
}

// ─── Supplier: upload accreditation document ─────────────────────────────────

export async function uploadSupplierAccreditationDocument(
  accreditationId: string,
  file:            File,
  documentType:    string,
  profile:         UserProfile
): Promise<UploadResult> {
  validateUploadArgs(accreditationId, file);

  const objectPath = buildObjectPath(
    'supplier-accreditations',
    accreditationId.trim(),
    'documents',
    file.name
  );

  return uploadAndRecord(objectPath, file, {
    supplier_id:         profile.id,
    accreditation_id:    accreditationId,
    supplier_product_id: null,
    document_type:       documentType,
    file_name:           file.name,
    uploaded_by:         profile.id,
    expires_at:          null,
  });
}

// ─── Supplier / Procurement: upload product document ─────────────────────────

export async function uploadSupplierProductDocument(
  productId:    string,
  file:         File,
  documentType: string,
  profile:      UserProfile
): Promise<UploadResult> {
  validateUploadArgs(productId, file);

  // Fetch the owning supplier_id to store correctly on the document row
  const db = supabase as any;
  const { data: product, error: fetchErr } = await db
    .from('supplier_products')
    .select('supplier_id, accreditation_id')
    .eq('id', productId.trim())
    .maybeSingle();
  if (fetchErr || !product) throw new Error('Product not found or access denied.');

  const objectPath = buildObjectPath(
    'supplier-products',
    productId.trim(),
    'documents',
    file.name
  );

  return uploadAndRecord(objectPath, file, {
    supplier_id:         (product as any).supplier_id as string,
    accreditation_id:    (product as any).accreditation_id as string | null,
    supplier_product_id: productId,
    document_type:       documentType,
    file_name:           file.name,
    uploaded_by:         profile.id,
    expires_at:          null,
  });
}

// ─── TSQA: upload RSE evaluation report ──────────────────────────────────────

export async function uploadRSEReport(
  rseId:   string,
  file:    File,
  profile: UserProfile
): Promise<UploadResult> {
  validateUploadArgs(rseId, file);

  const db = supabase as any;
  const { data: rse, error: fetchErr } = await db
    .from('rse_records')
    .select('supplier_id, accreditation_id, supplier_product_id')
    .eq('id', rseId.trim())
    .maybeSingle();
  if (fetchErr || !rse) throw new Error('RSE record not found or access denied.');

  const objectPath = buildObjectPath('rse', rseId.trim(), 'reports', file.name);

  return uploadAndRecord(objectPath, file, {
    supplier_id:         (rse as any).supplier_id as string,
    accreditation_id:    (rse as any).accreditation_id as string | null,
    supplier_product_id: (rse as any).supplier_product_id as string,
    document_type:       'rse_report',
    file_name:           file.name,
    uploaded_by:         profile.id,
    expires_at:          null,
  });
}

// ─── Get signed URL for any document in the bucket ───────────────────────────

export async function getAccreditationDocumentSignedUrl(
  path:    string,
  ttlSecs: number = 300 // 5 minutes default
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(ACCREDITATION_DOCS_BUCKET)
    .createSignedUrl(path, ttlSecs);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('No signed URL returned.');
  return data.signedUrl;
}

// ─── List documents by accreditation id ──────────────────────────────────────

export async function getDocumentsByAccreditationId(
  accreditationId: string
): Promise<SupplierDocument[]> {
  const db = supabase as any;
  const { data, error } = await db
    .from('supplier_documents')
    .select('*')
    .eq('accreditation_id', accreditationId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupplierDocument[];
}

// ─── List documents by product id ────────────────────────────────────────────

export async function getDocumentsByProductId(
  productId: string
): Promise<SupplierDocument[]> {
  const db = supabase as any;
  const { data, error } = await db
    .from('supplier_documents')
    .select('*')
    .eq('supplier_product_id', productId)
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupplierDocument[];
}

// ─── List documents by RSE id ─────────────────────────────────────────────────

export async function getDocumentsByRSEId(
  rseId: string
): Promise<SupplierDocument[]> {
  const db = supabase as any;
  // RSE reports are linked via supplier_product_id (accreditation_id may vary).
  // Filter by document_type = rse_report within the product's documents isn't
  // reliable here, so we look up the RSE's product_id first then filter type.
  const { data: rse, error: rseErr } = await db
    .from('rse_records')
    .select('supplier_product_id')
    .eq('id', rseId)
    .maybeSingle();
  if (rseErr) throw rseErr;
  if (!rse) return [];

  const { data, error } = await db
    .from('supplier_documents')
    .select('*')
    .eq('supplier_product_id', (rse as any).supplier_product_id as string)
    .eq('document_type', 'rse_report')
    .order('uploaded_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as SupplierDocument[];
}
