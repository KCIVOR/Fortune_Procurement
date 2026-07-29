-- Phase 3 (Goods workflow alignment): warehouse creates PR2 before RFQ

-- 1. PR2 can exist before RFQ
ALTER TABLE pr2_requests ALTER COLUMN rfq_id DROP NOT NULL;

-- 2. Warehouse provenance (Prepared By)
ALTER TABLE pr2_requests
  ADD COLUMN IF NOT EXISTS prepared_by_id uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS prepared_by_name_snapshot text,
  ADD COLUMN IF NOT EXISTS prepared_by_position_snapshot text,
  ADD COLUMN IF NOT EXISTS prepared_at timestamptz;

-- 3. Warehouse INSERT on pr2_requests (Goods)
DROP POLICY IF EXISTS "warehouse_insert_pr2_requests_goods" ON pr2_requests;
CREATE POLICY "warehouse_insert_pr2_requests_goods"
  ON pr2_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      JOIN pr1_requests pr1 ON pr1.id = pr2_requests.pr1_id
      WHERE p.id = auth.uid()
        AND r.name = 'warehouse'
        AND pr1.request_type = 'goods'
    )
  );

-- 4. Warehouse UPDATE (auto-submit draft → pending_approval)
DROP POLICY IF EXISTS "warehouse_update_pr2_requests_goods" ON pr2_requests;
CREATE POLICY "warehouse_update_pr2_requests_goods"
  ON pr2_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      JOIN pr1_requests pr1 ON pr1.id = pr2_requests.pr1_id
      WHERE p.id = auth.uid()
        AND r.name = 'warehouse'
        AND pr1.request_type = 'goods'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      JOIN pr1_requests pr1 ON pr1.id = pr2_requests.pr1_id
      WHERE p.id = auth.uid()
        AND r.name = 'warehouse'
        AND pr1.request_type = 'goods'
    )
  );

-- 5. Warehouse INSERT on pr2_items for Goods PR2s
DROP POLICY IF EXISTS "warehouse_insert_pr2_items_goods" ON pr2_items;
CREATE POLICY "warehouse_insert_pr2_items_goods"
  ON pr2_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      JOIN pr2_requests pr2 ON pr2.id = pr2_items.pr2_id
      JOIN pr1_requests pr1 ON pr1.id = pr2.pr1_id
      WHERE p.id = auth.uid()
        AND r.name = 'warehouse'
        AND pr1.request_type = 'goods'
    )
  );

-- 6. Operations Manager is org-wide (like Director) for PR2 read/update RLS
DROP POLICY IF EXISTS "Approvers can read own department PR2 requests" ON pr2_requests;
CREATE POLICY "Approvers can read own department PR2 requests"
  ON pr2_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON r.id = p.role_id
      LEFT JOIN positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid()
        AND r.name = 'approver'
        AND (
          pos.title = ANY (ARRAY[
            'Director'::text,
            'Finance Director'::text,
            'Operations Manager'::text
          ])
          OR p.department_id = pr2_requests.department_id
        )
    )
  );

DROP POLICY IF EXISTS "Approvers can update own department PR2 requests" ON pr2_requests;
CREATE POLICY "Approvers can update own department PR2 requests"
  ON pr2_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON r.id = p.role_id
      LEFT JOIN positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid()
        AND r.name = 'approver'
        AND (
          pos.title = ANY (ARRAY[
            'Director'::text,
            'Finance Director'::text,
            'Operations Manager'::text
          ])
          OR p.department_id = pr2_requests.department_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      JOIN roles r ON r.id = p.role_id
      LEFT JOIN positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid()
        AND r.name = 'approver'
        AND (
          pos.title = ANY (ARRAY[
            'Director'::text,
            'Finance Director'::text,
            'Operations Manager'::text
          ])
          OR p.department_id = pr2_requests.department_id
        )
    )
  );
