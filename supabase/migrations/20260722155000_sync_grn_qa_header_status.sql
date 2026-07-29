-- TSQA QA approval updates grn_items but could not flip grn_receipts.status
-- (no TSQA UPDATE policy). Header stayed pending_qa and blocked warehouse close.

CREATE OR REPLACE FUNCTION public.sync_grn_qa_header_status(p_grn_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_has_pending boolean;
BEGIN
  SELECT status INTO v_status FROM public.grn_receipts WHERE id = p_grn_id;
  IF v_status IS NULL OR v_status = 'closed' THEN
    RETURN v_status;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.grn_items gi
    WHERE gi.grn_id = p_grn_id
      AND gi.requires_qa = true
      AND gi.qa_status = 'pending'
  ) INTO v_has_pending;

  IF v_has_pending THEN
    IF v_status <> 'pending_qa' THEN
      UPDATE public.grn_receipts
      SET status = 'pending_qa', updated_at = now()
      WHERE id = p_grn_id;
    END IF;
    RETURN 'pending_qa';
  END IF;

  IF v_status = 'pending_qa' THEN
    UPDATE public.grn_receipts
    SET status = 'open', updated_at = now()
    WHERE id = p_grn_id;
    RETURN 'open';
  END IF;

  RETURN v_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_grn_qa_header_status(uuid) TO authenticated;
