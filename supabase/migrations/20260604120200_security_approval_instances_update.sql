/*
  Phase 1C — Restrict approval_instances UPDATE (F2)

  Replaces global UPDATE with approver + procurement only.
  INSERT/SELECT unchanged; app layer still enforces step authority via canActOnStep.
*/

DROP POLICY IF EXISTS "Authenticated users can update approval instances"
  ON public.approval_instances;

CREATE POLICY "Approvers can update approval instances"
  ON public.approval_instances
  FOR UPDATE
  TO authenticated
  USING (public.is_role('approver'))
  WITH CHECK (public.is_role('approver'));

CREATE POLICY "Procurement can update approval instances"
  ON public.approval_instances
  FOR UPDATE
  TO authenticated
  USING (public.is_role('procurement'))
  WITH CHECK (public.is_role('procurement'));
