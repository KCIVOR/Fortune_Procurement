import { supabase } from '@/lib/supabase';

/** Bucket must match `supabase/migrations/20260506093000_delivery_receipts_storage_bucket.sql` */
export const DELIVERY_RECEIPTS_BUCKET = 'delivery-receipts' as const;

const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

const MAX_BYTES = 10 * 1024 * 1024;

/** UUID v4 layout (case-insensitive); mirrors delivery id format used in routes. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sanitizeOriginalFilename(filename: string): string {
  const base = filename.trim() || 'document';
  const noPath = base.replace(/[/\\]/g, '_');
  return noPath.replace(/[^\w.\-() ]+/g, '_').slice(0, 200);
}

function buildObjectPath(deliveryId: string, originalFilename: string): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const safe = sanitizeOriginalFilename(originalFilename);
  return `deliveries/${deliveryId}/dr/${ts}_${safe}`;
}

/**
 * Upload a delivery receipt file to private Storage. Does not write to `deliveries`.
 *
 * Path: `deliveries/{deliveryId}/dr/{isoTimestamp}_{sanitizedOriginalFilename}`
 *
 * @throws Error when validation fails or Supabase returns an error
 */
export async function uploadDeliveryReceipt(
  deliveryId: string,
  file: File
): Promise<{ path: string; filename: string }> {
  const id = deliveryId.trim();
  if (!UUID_RE.test(id)) {
    throw new Error('Invalid delivery id.');
  }

  const type = file.type || '';
  if (!ALLOWED_TYPES.has(type)) {
    throw new Error('Allowed types: PDF, JPG, or PNG only.');
  }

  if (file.size > MAX_BYTES) {
    throw new Error('File must be 10 MB or smaller.');
  }

  const objectPath = buildObjectPath(id, file.name);

  const { data, error } = await supabase.storage
    .from(DELIVERY_RECEIPTS_BUCKET)
    .upload(objectPath, file, {
      contentType: type,
      upsert: false,
    });

  if (error) {
    throw new Error(error.message || 'Upload failed.');
  }

  if (!data?.path) {
    throw new Error('Upload failed: no path returned.');
  }

  return {
    path: data.path,
    filename: file.name,
  };
}

/**
 * Temporary read URL for private bucket objects (e.g. after upload). Does not prefetch in UI — call on demand.
 */
export async function getDeliveryReceiptSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(DELIVERY_RECEIPTS_BUCKET)
    .createSignedUrl(path, 60 * 5); // 5 minutes

  if (error) throw error;

  if (!data?.signedUrl) {
    throw new Error('No signed URL returned.');
  }

  return data.signedUrl;
}
