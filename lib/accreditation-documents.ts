import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type { SupplierDocument } from '@/types/database';
import { createNotification } from '@/lib/notifications';

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
const MAX_FILE_BYTES     = 10 * 1024 * 1024; // 10 MB
const MAX_DOCS_PER_ENTITY = 3;

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
  if (file.size > MAX_FILE_BYTES)     throw new Error('File must be 10 MB or smaller.');
}

/** Counts existing rows matching an equality filter set, throws once at MAX_DOCS_PER_ENTITY. */
async function assertUnderDocLimit(filters: Record<string, string>): Promise<void> {
  const db = supabase as any;
  let query = db.from('supplier_documents').select('id', { count: 'exact', head: true });
  for (const [col, val] of Object.entries(filters)) query = query.eq(col, val);
  const { count, error } = await query;
  if (error) throw error;
  if ((count ?? 0) >= MAX_DOCS_PER_ENTITY) {
    throw new Error(`Maximum ${MAX_DOCS_PER_ENTITY} documents reached. Remove one before uploading another.`);
  }
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

const CLOSED_ACCREDITATION_STATUSES = new Set(['withdrawn', 'rejected', 'expired']);

export async function uploadSupplierAccreditationDocument(
  accreditationId: string,
  file:            File,
  documentType:    string,
  profile:         UserProfile
): Promise<UploadResult> {
  validateUploadArgs(accreditationId, file);
  await assertUnderDocLimit({ accreditation_id: accreditationId, document_type: documentType });

  const db = supabase as any;
  const { data: acc, error: accErr } = await db
    .from('supplier_accreditations')
    .select('status')
    .eq('id', accreditationId.trim())
    .maybeSingle();
  if (accErr) throw accErr;
  if (!acc) throw new Error('Accreditation not found.');
  if (CLOSED_ACCREDITATION_STATUSES.has((acc as any).status as string)) {
    throw new Error('This application is closed. Start a new application to upload documents.');
  }

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
  await assertUnderDocLimit({ supplier_product_id: productId, document_type: documentType });

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

  await assertUnderDocLimit({
    supplier_product_id: (rse as any).supplier_product_id as string,
    document_type:        'rse_report',
  });

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

// ─── Procurement: verify / reject / edit expiry (accreditation application docs) ─
// DB values stay uploaded|accepted|rejected|expired (UI: Pending|Verified|…).
// Scope: accreditation_id set AND supplier_product_id null (not product/RSE rows).

function assertAccreditationApplicationDoc(row: {
  accreditation_id: string | null;
  supplier_product_id: string | null;
}): void {
  if (!row.accreditation_id || row.supplier_product_id) {
    throw new Error('Only accreditation application documents can be verified here.');
  }
}

function assertFutureDateOrThrow(expiresAt: string): void {
  const chosen = new Date(`${expiresAt}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (Number.isNaN(chosen.getTime()) || chosen <= today) {
    throw new Error('Expiry date must be a valid date in the future.');
  }
}

/** uploaded | accepted → accepted + expires_at (required future date). */
export async function verifyAccreditationDocument(
  documentId: string,
  expiresAt: string,
  profile: UserProfile
): Promise<void> {
  if (!expiresAt?.trim()) {
    throw new Error('Expiry date is required to verify a document.');
  }
  assertFutureDateOrThrow(expiresAt.trim());

  const db = supabase as any;
  const { data: row, error: fetchErr } = await db
    .from('supplier_documents')
    .select('id, accreditation_id, supplier_product_id, status, supplier_id')
    .eq('id', documentId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) throw new Error('Document not found.');
  assertAccreditationApplicationDoc(row);
  const status = (row as any).status as string;
  if (status !== 'uploaded' && status !== 'accepted') {
    throw new Error('Only pending or verified documents can be verified / re-verified.');
  }

  const now = new Date().toISOString();
  const { data: updated, error } = await db
    .from('supplier_documents')
    .update({
      status: 'accepted',
      expires_at: expiresAt.trim(),
      // New/changed expiry → next 2-month cron pass evaluates it fresh.
      notified_60d_at: null,
      notified_30d_at: null,
      notified_15d_at: null,
      notified_0d_at: null,
      updated_at: now,
    })
    .eq('id', documentId)
    .in('status', ['uploaded', 'accepted'])
    .select('id');
  if (error) throw error;
  if (!updated || updated.length === 0) {
    throw new Error('This document was already changed by someone else. Please refresh and try again.');
  }

  try {
    await db.from('audit_logs').insert({
      actor_id: profile.id,
      action: 'ACCREDITATION_DOCUMENT_VERIFIED',
      document_type: 'ACCREDITATION_DOCUMENT',
      document_id: documentId,
      payload: {
        reviewer: profile.full_name,
        expires_at: expiresAt.trim(),
        accreditation_id: (row as any).accreditation_id,
      },
    });
    // NOTE (Phase 2, item 3): verifyAccreditationDocument notification is a bonus
    // beyond the core reject/revision ask — drop this block if not wanted.
    await createNotification({
      user_id:       (row as any).supplier_id as string,
      title:         'Document Verified',
      body:          'Your accreditation document has been verified by Procurement.',
      type:          'approved',
      document_type: 'ACCREDITATION_DOCUMENT',
      document_id:   documentId,
      action_url:    '/supplier/accreditation',
    });
  } catch {
    /* best-effort */
  }
}

/** uploaded | accepted → rejected + required remark; clears expires_at. */
export async function rejectAccreditationDocument(
  documentId: string,
  profile: UserProfile,
  reason: string
): Promise<void> {
  if (!reason?.trim()) {
    throw new Error('A reason is required to reject a document.');
  }

  const db = supabase as any;
  const { data: row, error: fetchErr } = await db
    .from('supplier_documents')
    .select('id, accreditation_id, supplier_product_id, status, supplier_id')
    .eq('id', documentId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) throw new Error('Document not found.');
  assertAccreditationApplicationDoc(row);
  if (!['uploaded', 'accepted'].includes((row as any).status as string)) {
    throw new Error('Only pending or verified documents can be rejected.');
  }

  const now = new Date().toISOString();
  const note = reason.trim();
  const { data: updated, error } = await db
    .from('supplier_documents')
    .update({
      status: 'rejected',
      revision_note: note,
      expires_at: null,
      notified_60d_at: null,
      notified_30d_at: null,
      notified_15d_at: null,
      notified_0d_at: null,
      updated_at: now,
    })
    .eq('id', documentId)
    .in('status', ['uploaded', 'accepted'])
    .select('id');
  if (error) throw error;
  if (!updated || updated.length === 0) {
    throw new Error('This document was already changed by someone else. Please refresh and try again.');
  }

  try {
    await db.from('audit_logs').insert({
      actor_id: profile.id,
      action: 'ACCREDITATION_DOCUMENT_REJECTED',
      document_type: 'ACCREDITATION_DOCUMENT',
      document_id: documentId,
      payload: {
        reviewer: profile.full_name,
        reason: note,
        accreditation_id: (row as any).accreditation_id,
      },
    });
    await createNotification({
      user_id:       (row as any).supplier_id as string,
      title:         'Document Rejected',
      body:          note
        ? `Your accreditation document was rejected. Reason: "${note}"`
        : 'Your accreditation document has been rejected by Procurement.',
      type:          'rejected',
      document_type: 'ACCREDITATION_DOCUMENT',
      document_id:   documentId,
      action_url:    '/supplier/accreditation',
    });
  } catch {
    /* best-effort */
  }
}

/** Edit expires_at on accepted (verified) docs only. */
export async function updateAccreditationDocumentExpiry(
  documentId: string,
  expiresAt: string,
  profile: UserProfile
): Promise<void> {
  if (!expiresAt?.trim()) throw new Error('Expiry date is required.');
  assertFutureDateOrThrow(expiresAt.trim());

  const db = supabase as any;
  const { data: row, error: fetchErr } = await db
    .from('supplier_documents')
    .select('id, accreditation_id, supplier_product_id, status, expires_at')
    .eq('id', documentId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) throw new Error('Document not found.');
  assertAccreditationApplicationDoc(row);
  if ((row as any).status !== 'accepted') {
    throw new Error('Only verified documents can have expiry edited.');
  }

  const now = new Date().toISOString();
  const oldExpires = (row as any).expires_at ?? null;
  const { data: updated, error } = await db
    .from('supplier_documents')
    .update({
      expires_at: expiresAt.trim(),
      notified_60d_at: null,
      notified_30d_at: null,
      notified_15d_at: null,
      notified_0d_at: null,
      updated_at: now,
    })
    .eq('id', documentId)
    .eq('status', 'accepted')
    .select('id');
  if (error) throw error;
  if (!updated || updated.length === 0) {
    throw new Error('This document was already changed by someone else. Please refresh and try again.');
  }

  try {
    await db.from('audit_logs').insert({
      actor_id: profile.id,
      action: 'ACCREDITATION_DOCUMENT_EXPIRY_UPDATED',
      document_type: 'ACCREDITATION_DOCUMENT',
      document_id: documentId,
      payload: {
        updated_by: profile.full_name,
        old_expires_at: oldExpires,
        new_expires_at: expiresAt.trim(),
        accreditation_id: (row as any).accreditation_id,
      },
    });
  } catch {
    /* best-effort */
  }
}

/** uploaded | accepted → needs_revision + required remarks; clears expires_at. Application unchanged. */
export async function requestAccreditationDocumentRevision(
  documentId: string,
  remarks: string,
  profile: UserProfile
): Promise<void> {
  if (!remarks?.trim()) {
    throw new Error('Remarks are required when requesting document revision.');
  }

  const db = supabase as any;
  const { data: row, error: fetchErr } = await db
    .from('supplier_documents')
    .select('id, accreditation_id, supplier_product_id, status, supplier_id')
    .eq('id', documentId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) throw new Error('Document not found.');
  assertAccreditationApplicationDoc(row);
  if (!['uploaded', 'accepted'].includes((row as any).status as string)) {
    throw new Error('Only pending or verified documents can be marked for revision.');
  }

  const now = new Date().toISOString();
  const note = remarks.trim();
  const { data: updated, error } = await db
    .from('supplier_documents')
    .update({
      status: 'needs_revision',
      revision_note: note,
      expires_at: null,
      notified_60d_at: null,
      notified_30d_at: null,
      notified_15d_at: null,
      notified_0d_at: null,
      updated_at: now,
    })
    .eq('id', documentId)
    .in('status', ['uploaded', 'accepted'])
    .select('id');
  if (error) throw error;
  if (!updated || updated.length === 0) {
    throw new Error('This document was already changed by someone else. Please refresh and try again.');
  }

  try {
    await db.from('audit_logs').insert({
      actor_id: profile.id,
      action: 'ACCREDITATION_DOCUMENT_NEEDS_REVISION',
      document_type: 'ACCREDITATION_DOCUMENT',
      document_id: documentId,
      payload: {
        reviewer: profile.full_name,
        revision_note: note,
        accreditation_id: (row as any).accreditation_id,
      },
    });
    await createNotification({
      user_id:       (row as any).supplier_id as string,
      title:         'Document Needs Revision',
      body:          note
        ? `Revision requested on your accreditation document. Reason: "${note}"`
        : 'Procurement has requested a revision on your accreditation document.',
      type:          'action_required',
      document_type: 'ACCREDITATION_DOCUMENT',
      document_id:   documentId,
      action_url:    '/supplier/accreditation',
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Supplier resubmits a file on an uploaded (Pending), needs_revision, or
 * rejected accreditation doc (same row) → uploaded, clears revision_note.
 * Does not change application status. Rejected is treated as a harder
 * needs-revision: no separate "why" carried forward beyond the remark
 * already shown before resubmission. Pending just lets the supplier swap
 * a file before procurement has acted on it, instead of uploading a
 * duplicate row of the same document_type.
 */
export async function resubmitAccreditationDocument(
  documentId: string,
  file: File,
  profile: UserProfile
): Promise<void> {
  validateUploadArgs(documentId, file);

  const db = supabase as any;
  const { data: row, error: fetchErr } = await db
    .from('supplier_documents')
    .select(
      'id, accreditation_id, supplier_product_id, status, file_path, supplier_id, document_type'
    )
    .eq('id', documentId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;
  if (!row) throw new Error('Document not found.');
  assertAccreditationApplicationDoc(row);
  const priorStatus = (row as any).status as string;
  if (!['uploaded', 'needs_revision', 'rejected'].includes(priorStatus)) {
    throw new Error('Only Pending, Needs revision, or Rejected documents can be resubmitted.');
  }
  if ((row as any).supplier_id !== profile.id) {
    throw new Error('You can only replace your own documents.');
  }

  const accreditationId = (row as any).accreditation_id as string;
  const oldPath = (row as any).file_path as string;
  const objectPath = buildObjectPath(
    'supplier-accreditations',
    accreditationId,
    'documents',
    file.name
  );

  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from(ACCREDITATION_DOCS_BUCKET)
    .upload(objectPath, file, { contentType: file.type, upsert: false });
  if (uploadErr) throw new Error(uploadErr.message || 'Upload failed.');
  if (!uploadData?.path) throw new Error('Upload failed: no path returned.');

  const now = new Date().toISOString();
  const { data: updated, error } = await db
    .from('supplier_documents')
    .update({
      file_name: file.name,
      file_path: uploadData.path,
      mime_type: file.type || null,
      file_size: file.size,
      status: 'uploaded',
      revision_note: null,
      expires_at: null,
      notified_60d_at: null,
      notified_30d_at: null,
      notified_15d_at: null,
      notified_0d_at: null,
      uploaded_by: profile.id,
      uploaded_at: now,
      updated_at: now,
    })
    .eq('id', documentId)
    .in('status', ['uploaded', 'needs_revision', 'rejected'])
    .select('id');
  if (error || !updated || updated.length === 0) {
    // Row didn't move (lost race or stale status) — the old file_path is still
    // the row of record, so only the just-uploaded file is garbage; never touch oldPath.
    try {
      await supabase.storage.from(ACCREDITATION_DOCS_BUCKET).remove([uploadData.path]);
    } catch {
      /* best-effort cleanup */
    }
    throw error ?? new Error('This document is no longer awaiting resubmission. Please refresh and try again.');
  }

  if (oldPath && oldPath !== uploadData.path) {
    try {
      await supabase.storage.from(ACCREDITATION_DOCS_BUCKET).remove([oldPath]);
    } catch {
      /* best-effort — storage DELETE may be denied by RLS */
    }
  }

  try {
    await db.from('audit_logs').insert({
      actor_id: profile.id,
      action: 'ACCREDITATION_DOCUMENT_RESUBMITTED',
      document_type: 'ACCREDITATION_DOCUMENT',
      document_id: documentId,
      payload: {
        supplier: profile.full_name,
        accreditation_id: accreditationId,
        prior_status: priorStatus,
        old_file_path: oldPath,
        new_file_path: uploadData.path,
      },
    });
  } catch {
    /* best-effort */
  }
}
