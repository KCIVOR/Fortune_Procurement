-- ============================================================================
-- RAW MATERIAL PR2 ITEM ATTACHMENTS — TABLE, STORAGE BUCKET & RLS
-- ============================================================================
-- Mirrors pr1_attachments / pr1-attachments exactly, scoped to raw-material
-- PR2 items instead of PR1 items (Planning's PR2-direct raw material path
-- has no PR1 to attach to).
-- Storage path convention: pr2/{pr2_id}/{pr2_item_id}/{ts}_{filename}
-- ============================================================================

CREATE OR REPLACE FUNCTION public.can_read_pr2_raw_material(p_pr2_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.pr2_requests pr2
    WHERE pr2.id = p_pr2_id
      AND pr2.request_type = 'raw_material'
      AND (
        pr2.requisitioner_id = auth.uid()
        OR public.is_role('admin')
        OR public.is_role('procurement')
        OR (
          public.is_role('approver')
          AND (
            EXISTS (
              SELECT 1
              FROM public.profiles p
              LEFT JOIN public.positions pos ON pos.id = p.position_id
              WHERE p.id = auth.uid()
                AND pos.title IN ('Director', 'Finance Director', 'Operations Manager')
            )
            OR pr2.department_id = (
              SELECT department_id FROM public.profiles WHERE id = auth.uid()
            )
          )
        )
        OR public.is_supplier_assigned_to_pr2(p_pr2_id)
      )
  );
$function$;

-- ─── Link table ─────────────────────────────────────────────────────────────

CREATE TABLE public.pr2_item_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr2_id       uuid NOT NULL REFERENCES public.pr2_requests(id) ON DELETE CASCADE, -- denormalized for RLS
  pr2_item_id  uuid NOT NULL REFERENCES public.pr2_items(id)    ON DELETE CASCADE,
  uploaded_by  uuid NOT NULL REFERENCES auth.users(id),
  storage_path text NOT NULL,   -- pr2/{pr2_id}/{pr2_item_id}/{ts}_{filename}
  file_name    text NOT NULL,
  file_size    bigint,
  mime_type    text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX pr2_item_attachments_pr2_id_idx  ON public.pr2_item_attachments(pr2_id);
CREATE INDEX pr2_item_attachments_item_id_idx ON public.pr2_item_attachments(pr2_item_id);

ALTER TABLE public.pr2_item_attachments ENABLE ROW LEVEL SECURITY;

-- SELECT: anyone who can read the parent raw-material PR2 may read its attachments
CREATE POLICY "pr2_item_attachments_select"
ON public.pr2_item_attachments FOR SELECT TO authenticated
USING (public.can_read_pr2_raw_material(pr2_id));

-- INSERT: requisitioner may attach while the PR2 is in draft state
CREATE POLICY "pr2_item_attachments_insert"
ON public.pr2_item_attachments FOR INSERT TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.pr2_requests pr2
    WHERE pr2.id = pr2_id
      AND pr2.request_type = 'raw_material'
      AND pr2.requisitioner_id = auth.uid()
      AND pr2.status = 'draft'
  )
);

-- DELETE: uploader or admin
CREATE POLICY "pr2_item_attachments_delete"
ON public.pr2_item_attachments FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.is_role('admin')
);

-- ─── STORAGE BUCKET ─────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pr2-item-attachments',
  'pr2-item-attachments',
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

-- Upload: requisitioner may write to their own PR2/item folder while draft
CREATE POLICY "pr2_item_attachments_storage_upload"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pr2-item-attachments'
  AND split_part(name, '/', 1) = 'pr2'
  AND split_part(name, '/', 2) <> ''   -- pr2_id
  AND split_part(name, '/', 3) <> ''   -- pr2_item_id
  AND split_part(name, '/', 4) <> ''   -- filename
  AND split_part(name, '/', 5) = ''    -- no extra segments
  AND EXISTS (
    SELECT 1 FROM public.pr2_requests pr2
    WHERE pr2.id = split_part(name, '/', 2)::uuid
      AND pr2.request_type = 'raw_material'
      AND pr2.requisitioner_id = auth.uid()
      AND pr2.status = 'draft'
  )
);

-- Download: anyone authorised to read the raw-material PR2 may download its files
CREATE POLICY "pr2_item_attachments_storage_download"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pr2-item-attachments'
  AND split_part(name, '/', 1) = 'pr2'
  AND public.can_read_pr2_raw_material(split_part(name, '/', 2)::uuid)
);

-- Delete: uploader or admin
CREATE POLICY "pr2_item_attachments_storage_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'pr2-item-attachments'
  AND (
    owner = auth.uid()
    OR public.is_role('admin')
  )
);
