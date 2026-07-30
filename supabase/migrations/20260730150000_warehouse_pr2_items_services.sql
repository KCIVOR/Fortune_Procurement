/*
  # Warehouse PR2 item creation — extend to Services

  Companion fix to 20260729181026_warehouse_pr2_requests_services.sql, which
  broadened warehouse's INSERT/UPDATE policies on `pr2_requests` to cover
  `pr1.request_type = 'services'` but missed the sibling `pr2_items` INSERT
  policy (`warehouse_insert_pr2_items_goods`), which stayed goods-only.

  Effect of the gap: when warehouse validated a services PR1 as
  'insufficient', `createPR2FromWarehouseValidation` (lib/pr2-warehouse.ts)
  successfully inserted the `pr2_requests` row, then RLS silently blocked the
  `pr2_items` insert — leaving an orphaned draft PR2 with zero items, the PR1
  stuck on `approved_for_warehouse`, and (compounded by a separate write-order
  bug in lib/warehouse.ts, fixed alongside this) the warehouse_validations
  row already marked decision='insufficient' and permanently read-only.

  Broadens the existing goods-only policy to also allow 'services', same
  warehouse-role check, same pr1_id join — no other condition changes.
*/

DROP POLICY IF EXISTS "warehouse_insert_pr2_items_goods" ON public.pr2_items;

CREATE POLICY "warehouse_insert_pr2_items_goods"
  ON public.pr2_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      JOIN pr2_requests pr2 ON pr2.id = pr2_items.pr2_id
      JOIN pr1_requests pr1 ON pr1.id = pr2.pr1_id
      WHERE p.id = auth.uid()
        AND r.name = 'warehouse'
        AND pr1.request_type IN ('goods', 'services')
    )
  );
