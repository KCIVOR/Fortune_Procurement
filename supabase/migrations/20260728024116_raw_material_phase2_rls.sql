-- Raw Materials Phase 2 (Bundle B): RLS for Planning PR2-direct create/edit.
-- Read access already covered by existing "Requestors can read own PR2
-- requests/items" policies (requisitioner_id = auth.uid()).

-- pr2_requests: Planning may create a raw-material PR2 for themselves.
CREATE POLICY "Planning can insert raw material PR2 requests"
  ON pr2_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    request_type = 'raw_material'
    AND requisitioner_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON r.id = p.role_id
      LEFT JOIN positions pos ON pos.id = p.position_id
      LEFT JOIN departments d ON d.id = p.department_id
      WHERE p.id = auth.uid()
        AND r.name = 'employee'
        AND (pos.title = 'Planning Staff' OR d.code = 'PLAN')
    )
  );

-- pr2_requests: Planning may edit their own raw-material PR2 while draft.
CREATE POLICY "Planning can update own draft raw material PR2 requests"
  ON pr2_requests
  FOR UPDATE
  TO authenticated
  USING (
    requisitioner_id = auth.uid()
    AND request_type = 'raw_material'
    AND status = 'draft'
  )
  WITH CHECK (
    requisitioner_id = auth.uid()
    AND request_type = 'raw_material'
  );

-- pr2_items: Planning may insert lines on their own draft raw-material PR2.
CREATE POLICY "Planning can insert raw material PR2 items"
  ON pr2_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pr2_requests pr2
      WHERE pr2.id = pr2_items.pr2_id
        AND pr2.requisitioner_id = auth.uid()
        AND pr2.request_type = 'raw_material'
        AND pr2.status = 'draft'
    )
  );

-- pr2_items: Planning may edit/remove lines on their own draft raw-material PR2.
CREATE POLICY "Planning can update raw material PR2 items"
  ON pr2_items
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pr2_requests pr2
      WHERE pr2.id = pr2_items.pr2_id
        AND pr2.requisitioner_id = auth.uid()
        AND pr2.request_type = 'raw_material'
        AND pr2.status = 'draft'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM pr2_requests pr2
      WHERE pr2.id = pr2_items.pr2_id
        AND pr2.requisitioner_id = auth.uid()
        AND pr2.request_type = 'raw_material'
        AND pr2.status = 'draft'
    )
  );

CREATE POLICY "Planning can delete raw material PR2 items"
  ON pr2_items
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pr2_requests pr2
      WHERE pr2.id = pr2_items.pr2_id
        AND pr2.requisitioner_id = auth.uid()
        AND pr2.request_type = 'raw_material'
        AND pr2.status = 'draft'
    )
  );
