/*
  Fix PR1 resubmit FK error when status is draft but warehouse validation still exists.

  Earlier save-draft flows could leave PR1 in draft while warehouse_validation_items
  still reference pr1_items. Broaden the reset RPC to allow draft + revision_requested.
*/

CREATE OR REPLACE FUNCTION public.reset_warehouse_validation_on_pr1_resubmit(p_pr1_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.pr1_requests
    WHERE id = p_pr1_id
      AND requisitioner_id = auth.uid()
      AND status IN ('draft', 'revision_requested')
  ) THEN
    RAISE EXCEPTION 'Not authorized to reset warehouse validation for this PR1';
  END IF;

  DELETE FROM public.warehouse_validation_items
  WHERE validation_id IN (
    SELECT id FROM public.warehouse_validations WHERE pr1_id = p_pr1_id
  );

  DELETE FROM public.warehouse_validations
  WHERE pr1_id = p_pr1_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_warehouse_validation_on_pr1_resubmit(uuid) TO authenticated;
