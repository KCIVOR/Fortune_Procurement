-- Add rejection as a terminal QA outcome alongside approval.
-- A rejected item keeps the GRN header at pending_qa (treated as unresolved,
-- same as pending) until warehouse/procurement resolves it manually.

ALTER TABLE grn_items DROP CONSTRAINT IF EXISTS grn_items_qa_status_check;
ALTER TABLE grn_items ADD CONSTRAINT grn_items_qa_status_check
  CHECK (qa_status IS NULL OR qa_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE grn_items
  ADD COLUMN IF NOT EXISTS qa_rejection_reason text,
  ADD COLUMN IF NOT EXISTS qa_rejected_by_id uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS qa_rejected_at timestamptz;

-- Rejected items block GRN closure just like pending ones.
CREATE OR REPLACE FUNCTION public.sync_grn_qa_header_status(p_grn_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_has_unresolved boolean;
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
      AND gi.qa_status IN ('pending', 'rejected')
  ) INTO v_has_unresolved;

  IF v_has_unresolved THEN
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
