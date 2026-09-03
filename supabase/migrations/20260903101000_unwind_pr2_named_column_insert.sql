-- Migration: 20260903101000_unwind_pr2_named_column_insert.sql
--
-- Keep unwind_pr2_to_warehouse business rules identical.
-- Replace positional SELECT * copies with named columns so a future
-- live-only column cannot raise 42601. Refuse to run if column *names*
-- on live vs archive drift (named insert would otherwise drop data).

CREATE OR REPLACE FUNCTION public.unwind_pr2_to_warehouse(p_pr1_id uuid, p_terminal boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pr2_id uuid;
BEGIN
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
    IF EXISTS (
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pr2_requests'
      EXCEPT
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pr2_requests_archive'
    ) OR EXISTS (
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pr2_requests_archive'
      EXCEPT
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pr2_requests'
    ) THEN
      RAISE EXCEPTION 'pr2_requests and pr2_requests_archive column sets differ; refusing unwind';
    END IF;

    IF EXISTS (
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pr2_items'
      EXCEPT
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pr2_items_archive'
    ) OR EXISTS (
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pr2_items_archive'
      EXCEPT
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'pr2_items'
    ) THEN
      RAISE EXCEPTION 'pr2_items and pr2_items_archive column sets differ; refusing unwind';
    END IF;

    INSERT INTO public.pr2_requests_archive (
      id, pr2_number, pr1_id, rfq_id,
      requisitioner_id, requisitioner_name_snapshot,
      department_id, department_name_snapshot,
      purpose, date_required,
      pr1_number_snapshot, rfq_number_snapshot,
      remarks, status, generated_by, generated_at,
      created_at, updated_at,
      prepared_by_id, prepared_by_name_snapshot,
      prepared_by_position_snapshot, prepared_at,
      request_type, priority
    )
    SELECT
      id, pr2_number, pr1_id, rfq_id,
      requisitioner_id, requisitioner_name_snapshot,
      department_id, department_name_snapshot,
      purpose, date_required,
      pr1_number_snapshot, rfq_number_snapshot,
      remarks, status, generated_by, generated_at,
      created_at, updated_at,
      prepared_by_id, prepared_by_name_snapshot,
      prepared_by_position_snapshot, prepared_at,
      request_type, priority
    FROM public.pr2_requests
    WHERE id = v_pr2_id;

    INSERT INTO public.pr2_items_archive (
      id, pr2_id, item_order, item_code, description, unit_of_measure,
      pr1_item_id, quantity_requested, qty_on_hand, qty_incoming,
      quantity_to_purchase, selected_rfq_supplier_id, supplier_name_snapshot,
      quoted_description, is_alternative, unit_price, lead_time_days,
      total_price, remarks, created_at, is_raw_material, quote_justification,
      rfq_item_quote_id, vat_type, vat_rate_applied,
      pr1_remarks_snapshot, pr1_quantity_requested_snapshot,
      quantity_override_reason_snapshot, quantity_overridden_by_name_snapshot
    )
    SELECT
      id, pr2_id, item_order, item_code, description, unit_of_measure,
      pr1_item_id, quantity_requested, qty_on_hand, qty_incoming,
      quantity_to_purchase, selected_rfq_supplier_id, supplier_name_snapshot,
      quoted_description, is_alternative, unit_price, lead_time_days,
      total_price, remarks, created_at, is_raw_material, quote_justification,
      rfq_item_quote_id, vat_type, vat_rate_applied,
      pr1_remarks_snapshot, pr1_quantity_requested_snapshot,
      quantity_override_reason_snapshot, quantity_overridden_by_name_snapshot
    FROM public.pr2_items
    WHERE pr2_id = v_pr2_id;

    DELETE FROM public.pr2_items WHERE pr2_id = v_pr2_id;
    DELETE FROM public.pr2_requests WHERE id = v_pr2_id;
  END IF;

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
