-- Migration: 20260731073500_update_unwind_rpc_to_archive.sql

CREATE OR REPLACE FUNCTION public.unwind_pr2_to_warehouse(p_pr1_id uuid, p_terminal boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pr2_id uuid;
BEGIN
  -- Authorization: caller must be an approver, and this PR1 must actually be
  -- at the state this operation expects. Coarse-grained (role only, not
  -- position/department-precise) — matching the same rigor level as the
  -- existing reset_warehouse_validation_on_pr1_resubmit RPC, not a stricter
  -- model. Fine-grained step/position eligibility is already checked
  -- client-side by canActOnPR2Step before this is ever reached.
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'approver'
  ) THEN
    RAISE EXCEPTION 'Not authorized to unwind this PR2.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.pr1_requests
    WHERE id = p_pr1_id AND status = 'pr2_pending_approval'
  ) THEN
    RAISE EXCEPTION 'PR1 is not awaiting PR2 approval.';
  END IF;

  SELECT id INTO v_pr2_id FROM public.pr2_requests WHERE pr1_id = p_pr1_id;

  IF v_pr2_id IS NOT NULL THEN
    INSERT INTO public.pr2_requests_archive SELECT * FROM public.pr2_requests WHERE id = v_pr2_id;
    INSERT INTO public.pr2_items_archive SELECT * FROM public.pr2_items WHERE pr2_id = v_pr2_id;

    DELETE FROM public.pr2_items WHERE pr2_id = v_pr2_id;
    DELETE FROM public.pr2_requests WHERE id = v_pr2_id;
  END IF;

  -- Terminal (rejected): leave warehouse_validations alone — nothing more
  -- will happen with this PR1, no reason to erase the validator's record
  -- of what they did. Non-terminal (revision requested): clear it so
  -- Warehouse gets a genuinely clean slate to re-validate against.
  IF NOT p_terminal THEN
    DELETE FROM public.warehouse_validation_items
    WHERE validation_id IN (
      SELECT id FROM public.warehouse_validations WHERE pr1_id = p_pr1_id
    );
    DELETE FROM public.warehouse_validations WHERE pr1_id = p_pr1_id;
  END IF;

  UPDATE public.pr1_requests
  SET status = CASE WHEN p_terminal THEN 'rejected' ELSE 'approved_for_warehouse' END,
      updated_at = now()
  WHERE id = p_pr1_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.unwind_pr2_to_warehouse(uuid, boolean) TO authenticated;
