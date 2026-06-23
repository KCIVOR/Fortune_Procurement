-- ============================================================================
-- PR1 ATTACHMENTS - TABLE, STORAGE BUCKET & RLS
-- ============================================================================
-- Migration: 20260618000300_pr1_attachments
-- Description:
--   Creates 'pr1_attachments' link table for image attachments on PR1 requests.
--   Creates 'pr1-attachments' private storage bucket.
--   Adds RLS policies for both storage objects and the link table.
--
-- Path convention: pr1/{pr1_id}/{timestamp}_{filename}
--   split_part indices: 1=pr1, 2=pr1_id (uuid), 3=filename
--
-- Access control mirrors can_read_pr1(): requisitioner + procurement + approver
--   (when approval instance exists) + warehouse (when validation exists / pending).
-- ============================================================================

-- ─── Link table ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pr1_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr1_id       uuid NOT NULL REFERENCES public.pr1_requests(id) ON DELETE CASCADE,
  uploaded_by  uuid NOT NULL REFERENCES auth.users(id),
  storage_path text NOT NULL,          -- e.g. pr1/{pr1_id}/{ts}_{filename}
  file_name    text NOT NULL,          -- original filename (display only)
  file_size    bigint,
  mime_type    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookup by PR1
CREATE INDEX IF NOT EXISTS pr1_attachments_pr1_id_idx ON public.pr1_attachments(pr1_id);

-- Enable RLS
ALTER TABLE public.pr1_attachments ENABLE ROW LEVEL SECURITY;

-- ─── TABLE RLS policies ──────────────────────────────────────────────────────

-- SELECT: any user who can read the parent PR1 may see its attachments
CREATE POLICY "pr1_attachments_select"
ON public.pr1_attachments
FOR SELECT TO authenticated
USING (public.can_read_pr1(pr1_id));

-- INSERT: only the PR1 owner (requisitioner) can attach files, and only while
--         the PR1 is in draft or revision_requested state.
CREATE POLICY "pr1_attachments_insert"
ON public.pr1_attachments
FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.pr1_requests pr
    WHERE pr.id = pr1_id
      AND pr.requisitioner_id = auth.uid()
      AND pr.status IN ('draft', 'revision_requested')
  )
);

-- DELETE: uploader or admin may remove attachments while PR1 is editable
CREATE POLICY "pr1_attachments_delete"
ON public.pr1_attachments
FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.is_role('admin')
);

-- ─── STORAGE BUCKET ─────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pr1-attachments',
  'pr1-attachments',
  FALSE,
  10485760, -- 10 MB per file
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── STORAGE OBJECT RLS ─────────────────────────────────────────────────────

-- Upload: requisitioner may upload to their own PR1 folder while it is editable
CREATE POLICY "pr1_attachments_storage_upload"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pr1-attachments'
  AND split_part(name, '/', 1) = 'pr1'
  AND split_part(name, '/', 2) <> ''   -- pr1_id segment must exist
  AND split_part(name, '/', 3) <> ''   -- filename segment must exist
  AND split_part(name, '/', 4) = ''    -- no extra path segments
  AND EXISTS (
    SELECT 1 FROM public.pr1_requests pr
    WHERE pr.id = split_part(name, '/', 2)::uuid
      AND pr.requisitioner_id = auth.uid()
      AND pr.status IN ('draft', 'revision_requested')
  )
);

-- Download: any user authorised to read the PR1 may download its attachments
CREATE POLICY "pr1_attachments_storage_download"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'pr1-attachments'
  AND split_part(name, '/', 1) = 'pr1'
  AND public.can_read_pr1(split_part(name, '/', 2)::uuid)
);

-- Delete: uploader or admin
CREATE POLICY "pr1_attachments_storage_delete"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'pr1-attachments'
  AND (
    owner = auth.uid()
    OR public.is_role('admin')
  )
);

-- ============================================================================
-- ROLLBACK (reference only)
-- ----------------------------------------------------------------------------
-- DROP POLICY IF EXISTS "pr1_attachments_storage_delete"   ON storage.objects;
-- DROP POLICY IF EXISTS "pr1_attachments_storage_download" ON storage.objects;
-- DROP POLICY IF EXISTS "pr1_attachments_storage_upload"   ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'pr1-attachments';
-- DROP TABLE IF EXISTS public.pr1_attachments;
-- ============================================================================
