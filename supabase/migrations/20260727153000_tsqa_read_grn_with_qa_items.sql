/*
  TSQA lost SELECT on grn_receipts after approving the last QA item because the
  policy only allowed pending_qa / pending items. After sync_grn_qa_header_status
  flips status to open, fetchGRNById returned null and the detail page errored.

  Allow TSQA to read goods GRNs that have any QA-flagged line items (pending or
  approved) so the detail page can show the completion state. The queue still
  filters to pending items only.
*/

CREATE OR REPLACE FUNCTION public.grn_has_qa_item(p_grn_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.grn_items gi
    WHERE gi.grn_id = p_grn_id
      AND gi.requires_qa = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.grn_has_qa_item(uuid) TO authenticated;

DROP POLICY IF EXISTS "TSQA can read goods GRNs pending QA" ON public.grn_receipts;

CREATE POLICY "TSQA can read goods GRNs pending QA"
  ON public.grn_receipts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND public.request_type_for_delivery(delivery_id) = 'goods'
    AND (
      status = 'pending_qa'
      OR public.grn_has_pending_qa_item(id)
      OR public.grn_has_qa_item(id)
    )
  );
