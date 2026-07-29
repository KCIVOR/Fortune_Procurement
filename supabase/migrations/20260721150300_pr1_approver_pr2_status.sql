-- Approvers may set PR1 → pr2_approved on Goods PR2 final approval
DROP POLICY IF EXISTS "Approvers can update PR1 after PR2 final" ON public.pr1_requests;
CREATE POLICY "Approvers can update PR1 after PR2 final"
  ON public.pr1_requests
  FOR UPDATE
  TO authenticated
  USING (
    status = 'pr2_pending_approval'
    AND EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'approver'
    )
  )
  WITH CHECK (
    status = ANY (ARRAY['pr2_approved'::text, 'pr2_pending_approval'::text])
  );
