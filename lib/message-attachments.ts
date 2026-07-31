import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types/auth';
import type { MessageAttachment } from '@/types/database';

/**
 * Message Attachments Library
 * 
 * Bucket defined in:
 * supabase/migrations/20260520110000_message_attachments_storage.sql
 *
 * Path convention:
 *   messages/{conversation_id}/{message_id}/{timestamp}_{filename}
 *
 * Limits:
 *   - Max file size: 10 MB
 *   - Max attachments per message: 5
 *   - Allowed types: Images (JPEG, PNG, GIF, WebP), PDF, Office docs
 */

export const MESSAGE_ATTACHMENTS_BUCKET = 'message-attachments' as const;

// ─── Configuration ────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',       // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
]);

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_ATTACHMENTS_PER_MESSAGE = 3;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeFilename(filename: string): string {
  const base = filename.trim() || 'file';
  const noPath = base.replace(/[/\\]/g, '_');
  return noPath.replace(/[^\w.\-() ]+/g, '_').slice(0, 200);
}

function buildStoragePath(
  conversationId: string,
  messageId: string,
  filename: string
): string {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const safe = sanitizeFilename(filename);
  return `messages/${conversationId}/${messageId}/${ts}_${safe}`;
}

function validateFile(file: File): void {
  const mime = file.type || '';
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    throw new Error(
      'File type not allowed. Supported: Images (JPEG, PNG, GIF, WebP), PDF, Word, Excel, PowerPoint'
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('File must be 10 MB or smaller');
  }
  if (file.size === 0) {
    throw new Error('File is empty');
  }
}

function validateUUID(id: string, label: string): void {
  if (!UUID_RE.test(id.trim())) {
    throw new Error(`Invalid ${label}`);
  }
}

// ─── File Type Utilities ──────────────────────────────────────────────────────

export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

export function isPdfMimeType(mimeType: string): boolean {
  return mimeType === 'application/pdf';
}

export function isOfficeMimeType(mimeType: string): boolean {
  return mimeType.startsWith('application/vnd.openxmlformats-officedocument.');
}

export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// ─── Upload Attachment ────────────────────────────────────────────────────────

const db = supabase as any;

/**
 * Uploads a file attachment to a message.
 * 
 * @param conversationId - The conversation the message belongs to
 * @param messageId - The message to attach the file to
 * @param file - The file to upload
 * @param profile - The current user's profile
 * @returns The created attachment record
 * 
 * @throws Error if file validation fails
 * @throws Error if attachment limit exceeded
 * @throws Error if upload fails
 */
export async function uploadMessageAttachment(
  conversationId: string,
  messageId: string,
  file: File,
  profile: UserProfile
): Promise<MessageAttachment> {
  // Validate inputs
  validateUUID(conversationId, 'conversation id');
  validateUUID(messageId, 'message id');
  validateFile(file);

  // Check attachment limit
  const { count, error: countErr } = await db
    .from('message_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('message_id', messageId);

  if (countErr) throw new Error('Failed to check attachment count');
  if ((count ?? 0) >= MAX_ATTACHMENTS_PER_MESSAGE) {
    throw new Error(`Maximum ${MAX_ATTACHMENTS_PER_MESSAGE} attachments per message`);
  }

  // Build storage path
  const storagePath = buildStoragePath(
    conversationId.trim(),
    messageId.trim(),
    file.name
  );

  // Upload to storage bucket
  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });

  if (uploadErr) throw new Error(uploadErr.message || 'Upload failed');
  if (!uploadData?.path) throw new Error('Upload failed: no path returned');

  // Insert metadata record
  const { data, error } = await db
    .from('message_attachments')
    .insert({
      message_id: messageId.trim(),
      conversation_id: conversationId.trim(),
      file_name: file.name,
      file_path: uploadData.path,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: profile.id,
    })
    .select()
    .single();

  if (error) {
    // Attempt to clean up the uploaded file if DB insert fails
    await supabase.storage
      .from(MESSAGE_ATTACHMENTS_BUCKET)
      .remove([uploadData.path])
      .catch(() => {}); // Ignore cleanup errors
    throw new Error(error.message || 'Failed to save attachment record');
  }

  return data as MessageAttachment;
}

// ─── Get Attachments ──────────────────────────────────────────────────────────

/**
 * Fetches all attachments for a specific message.
 * 
 * @param messageId - The message ID to fetch attachments for
 * @returns Array of attachment records
 */
export async function getMessageAttachments(
  messageId: string
): Promise<MessageAttachment[]> {
  validateUUID(messageId, 'message id');

  const { data, error } = await db
    .from('message_attachments')
    .select('*')
    .eq('message_id', messageId.trim())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as MessageAttachment[];
}

/**
 * Fetches all attachments for a conversation.
 * Useful for media galleries or attachment search.
 * 
 * @param conversationId - The conversation ID
 * @param limit - Maximum number of attachments to return (default 50)
 * @returns Array of attachment records, newest first
 */
export async function getConversationAttachments(
  conversationId: string,
  limit = 50
): Promise<MessageAttachment[]> {
  validateUUID(conversationId, 'conversation id');

  const { data, error } = await db
    .from('message_attachments')
    .select('*')
    .eq('conversation_id', conversationId.trim())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as MessageAttachment[];
}

// ─── Signed URLs ──────────────────────────────────────────────────────────────

/**
 * Generates a signed URL for downloading/viewing an attachment.
 * 
 * @param filePath - The storage path of the file
 * @param ttlSecs - Time-to-live in seconds (default 5 minutes)
 * @returns Signed URL string
 */
export async function getAttachmentSignedUrl(
  filePath: string,
  ttlSecs: number = 300
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .createSignedUrl(filePath, ttlSecs);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error('No signed URL returned');
  return data.signedUrl;
}

/**
 * Generates signed URLs for multiple attachments at once.
 * More efficient than calling getAttachmentSignedUrl in a loop.
 * 
 * @param filePaths - Array of storage paths
 * @param ttlSecs - Time-to-live in seconds (default 5 minutes)
 * @returns Map of file path to signed URL
 */
export async function getAttachmentSignedUrls(
  filePaths: string[],
  ttlSecs: number = 300
): Promise<Map<string, string>> {
  const results = new Map<string, string>();
  
  // Supabase doesn't have a batch signed URL API, so we parallelize
  const promises = filePaths.map(async (path) => {
    try {
      const url = await getAttachmentSignedUrl(path, ttlSecs);
      results.set(path, url);
    } catch {
      // Skip failed URLs
    }
  });

  await Promise.all(promises);
  return results;
}

// ─── Delete Attachment ────────────────────────────────────────────────────────

/**
 * Deletes an attachment (both storage file and database record).
 * RLS ensures only the uploader can delete their own attachments.
 * 
 * @param attachmentId - The attachment ID to delete
 */
export async function deleteMessageAttachment(
  attachmentId: string
): Promise<void> {
  validateUUID(attachmentId, 'attachment id');

  // Get file path before deleting record
  const { data: attachment, error: fetchErr } = await db
    .from('message_attachments')
    .select('file_path')
    .eq('id', attachmentId.trim())
    .single();

  if (fetchErr || !attachment) {
    throw new Error('Attachment not found or access denied');
  }

  // Delete from storage
  const { error: storageErr } = await supabase.storage
    .from(MESSAGE_ATTACHMENTS_BUCKET)
    .remove([(attachment as any).file_path]);

  if (storageErr) {
    console.error('Failed to delete file from storage:', storageErr);
    // Continue to delete the record even if storage delete fails
  }

  // Delete database record (RLS enforces ownership)
  const { error: deleteErr } = await db
    .from('message_attachments')
    .delete()
    .eq('id', attachmentId.trim());

  if (deleteErr) throw deleteErr;
}

// ─── Attachment Count ─────────────────────────────────────────────────────────

/**
 * Gets the attachment count for a message.
 * Useful when you only need the count without fetching all attachments.
 * 
 * @param messageId - The message ID
 * @returns Number of attachments
 */
export async function getMessageAttachmentCount(
  messageId: string
): Promise<number> {
  validateUUID(messageId, 'message id');

  const { count, error } = await db
    .from('message_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('message_id', messageId.trim());

  if (error) throw error;
  return count ?? 0;
}

// ─── Constants Export ─────────────────────────────────────────────────────────

export const MESSAGE_ATTACHMENT_LIMITS = {
  maxFileSize: MAX_FILE_BYTES,
  maxFileSizeMB: MAX_FILE_BYTES / (1024 * 1024),
  maxAttachmentsPerMessage: MAX_ATTACHMENTS_PER_MESSAGE,
  allowedMimeTypes: Array.from(ALLOWED_MIME_TYPES),
} as const;
