/*
  Warehouse PR1 reject / revision requested

  - Extend warehouse_validations.decision to include rejected and revision_requested
  - Allow warehouse to transition pending_warehouse → rejected | revision_requested
  - Allow employees to edit line items while PR1 is revision_requested
  - RPC to reset warehouse validation when employee resubmits after revision
*/

-- ─── Extend warehouse decision CHECK ─────────────────────────────────────────
ALTER TABLE public.warehouse_validations
  DROP CONSTRAINT IF EXISTS warehouse_validations_decision_check;

ALTER TABLE public.warehouse_validations
  ADD CONSTRAINT warehouse_validations_decision_check
  CHECK (decision IN ('sufficient', 'insufficient', 'rejected', 'revision_requested'));

-- ─── Warehouse may reject or send back for revision ─────────────────────────
DROP POLICY IF EXISTS "Warehouse can transition PR1 status from pending_warehouse"
  ON public.pr1_requests;

CREATE POLICY "Warehouse can transition PR1 status from pending_warehouse"
  ON public.pr1_requests
  FOR UPDATE
  TO authenticated
  USING (status = 'pending_warehouse')
  WITH CHECK (status IN (
    'resolved_internal',
    'pending_approval',
    'rejected',
    'revision_requested'
  ));

-- ─── Employees may edit items on revision_requested PR1s ─────────────────────
DROP POLICY IF EXISTS "PR1 owners can delete items on draft PR1s"
  ON public.pr1_items;

CREATE POLICY "PR1 owners can delete items on editable PR1s"
  ON public.pr1_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pr1_requests r
      WHERE r.id = pr1_id
        AND r.requisitioner_id = auth.uid()
        AND r.status IN ('draft', 'revision_requested')
    )
  );

-- ─── Reset validation when employee resubmits after revision ─────────────────
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
      AND status = 'revision_requested'
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
