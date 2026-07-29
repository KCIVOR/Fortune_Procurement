-- Phase 1 (Goods workflow alignment): PR1 statuses for PR2-before-RFQ sequence.

ALTER TABLE pr1_requests
  DROP CONSTRAINT IF EXISTS pr1_requests_status_check;

ALTER TABLE pr1_requests
  ADD CONSTRAINT pr1_requests_status_check
  CHECK (status = ANY (ARRAY[
    'draft'::text,
    'pending_warehouse'::text,
    'pending_approval'::text,
    'approved_for_warehouse'::text,
    'resolved_internal'::text,
    'revision_requested'::text,
    'for_canvassing'::text,
    'canvassing_complete'::text,
    'pr2_pending_approval'::text,
    'pr2_approved'::text,
    'approved'::text,
    'completed'::text,
    'rejected'::text,
    'cancelled'::text
  ]));

-- Warehouse may transition Goods PR1 to pr2_pending_approval after creating PR2
DROP POLICY IF EXISTS "Warehouse can transition PR1 status" ON public.pr1_requests;

CREATE POLICY "Warehouse can transition PR1 status"
  ON public.pr1_requests
  FOR UPDATE
  TO authenticated
  USING (status IN ('pending_warehouse', 'approved_for_warehouse'))
  WITH CHECK (status IN (
    'resolved_internal',
    'for_canvassing',
    'pr2_pending_approval',
    'pending_approval',
    'rejected',
    'revision_requested'
  ));
