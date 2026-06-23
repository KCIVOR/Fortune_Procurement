-- ============================================================================
-- PR1 ATTACHMENTS — PER ITEM (replaces 20260618000300)
-- ============================================================================
-- Drops the PR1-level attachment table and recreates it linked to pr1_items.
-- Storage path changes to: pr1/{pr1_id}/{pr1_item_id}/{ts}_{filename}
--   split_part indices: 1=pr1  2=pr1_id  3=pr1_item_id  4=filename
-- pr1_id is kept as a denormalized column for efficient RLS without joins.
-- ============================================================================

-- ─── Drop old storage policies ───────────────────────────────────────────────

DROP POLICY IF EXISTS "pr1_attachments_storage_upload"   ON storage.objects;
DROP POLICY IF EXISTS "pr1_attachments_storage_download" ON storage.objects;
DROP POLICY IF EXISTS "pr1_attachments_storage_delete"   ON storage.objects;

-- ─── Drop old table (was PR1-level; no production data yet) ──────────────────

DROP TABLE IF EXISTS public.pr1_attachments CASCADE;

-- ─── Recreate per-item ───────────────────────────────────────────────────────

CREATE TABLE public.pr1_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr1_id       uuid NOT NULL REFERENCES public.pr1_requests(id) ON DELETE CASCADE, -- denormalized for RLS
  pr1_item_id  uuid NOT NULL REFERENCES public.pr1_items(id)    ON DELETE CASCADE,
  uploaded_by  uuid NOT NULL REFERENCES auth.users(id),
  storage_path text NOT NULL,   -- pr1/{pr1_id}/{pr1_item_id}/{ts}_{filename}
  file_name    text NOT NULL,
  file_size    bigint,
  mime_type    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pr1_attachments_pr1_id_idx      ON public.pr1_attachments(pr1_id);
CREATE INDEX pr1_attachments_item_id_idx     ON public.pr1_attachments(pr1_item_id);

ALTER TABLE public.pr1_attachments ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone who can read the PR1 may read its attachments
CREATE POLICY "pr1_attachments_select"
ON public.pr1_attachments FOR SELECT TO authenticated
USING (public.can_read_pr1(pr1_id));

-- INSERT: requisitioner may attach while PR1 is in editable state
CREATE POLICY "pr1_attachments_insert"
ON public.pr1_attachments FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.pr1_requests pr
    WHERE pr.id = pr1_id
      AND pr.requisitioner_id = auth.uid()
      AND pr.status IN ('draft', 'revision_requested')
  )
);

-- DELETE: uploader or admin
CREATE POLICY "pr1_attachments_delete"
ON public.pr1_attachments FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.is_role('admin')
);

-- ─── Storage policies (new 4-segment path) ───────────────────────────────────

-- Upload: owner may write to their own PR1/item folder while PR1 is editable
CREATE POLICY "pr1_attachments_storage_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pr1-attachments'
  AND split_part(name, '/', 1) = 'pr1'
  AND split_part(name, '/', 2) <> ''   -- pr1_id
  AND split_part(name, '/', 3) <> ''   -- pr1_item_id
  AND split_part(name, '/', 4) <> ''   -- filename
  AND split_part(name, '/', 5) = ''    -- no extra segments
  AND EXISTS (
    SELECT 1 FROM public.pr1_requests pr
    WHERE pr.id  = split_part(name, '/', 2)::uuid
      AND pr.requisitioner_id = auth.uid()
      AND pr.status IN ('draft', 'revision_requested')
  )
);

-- Download: anyone authorised to read the PR1 may download its files
CREATE POLICY "pr1_attachments_storage_download"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pr1-attachments'
  AND split_part(name, '/', 1) = 'pr1'
  AND public.can_read_pr1(split_part(name, '/', 2)::uuid)
);

-- Delete: uploader or admin
CREATE POLICY "pr1_attachments_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'pr1-attachments'
  AND (
    owner = auth.uid()
    OR public.is_role('admin')
  )
);
