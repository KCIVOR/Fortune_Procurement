/*
  Fix: Operations Manager final-approves Goods PR2 but cannot SELECT pr2_items when
  the PR2 belongs to another department (approval page shows ITEMS 0).

  pr2_requests RLS was updated in 20260721150200 to treat Operations Manager as
  org-wide (like Director). pr2_items still used the older dept-scoped policy from
  20260619000100 without Operations Manager in the org-wide exempt list.
*/

DROP POLICY IF EXISTS "Approvers can read own department PR2 items" ON public.pr2_items;

CREATE POLICY "Approvers can read own department PR2 items"
  ON public.pr2_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pr2_requests pr2
      JOIN public.profiles p ON p.id = auth.uid()
      JOIN public.roles r ON r.id = p.role_id
      LEFT JOIN public.positions pos ON pos.id = p.position_id
      WHERE pr2.id = pr2_items.pr2_id
        AND r.name = 'approver'
        AND (
          pos.title IN ('Director', 'Finance Director', 'Operations Manager')
          OR p.department_id = pr2.department_id
        )
    )
  );
