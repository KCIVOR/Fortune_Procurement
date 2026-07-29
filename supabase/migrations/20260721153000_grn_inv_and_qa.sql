-- Phase 6 (D5): INV #, optional QA flags, pending_qa status

ALTER TABLE grn_receipts ADD COLUMN IF NOT EXISTS inv_no text;

ALTER TABLE grn_receipts DROP CONSTRAINT IF EXISTS grn_receipts_status_check;
ALTER TABLE grn_receipts ADD CONSTRAINT grn_receipts_status_check
  CHECK (status IN ('open', 'pending_qa', 'closed'));

ALTER TABLE grn_items
  ADD COLUMN IF NOT EXISTS requires_qa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS qa_status text CHECK (qa_status IS NULL OR qa_status IN ('pending', 'approved')),
  ADD COLUMN IF NOT EXISTS qa_approved_by_id uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS qa_approved_at timestamptz;

-- TSQA: read goods GRNs with pending QA work
DROP POLICY IF EXISTS "TSQA can read goods GRNs pending QA" ON grn_receipts;
CREATE POLICY "TSQA can read goods GRNs pending QA"
  ON grn_receipts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND public.request_type_for_grn(grn_receipts.id) = 'goods'
    AND (
      grn_receipts.status = 'pending_qa'
      OR EXISTS (
        SELECT 1 FROM grn_items gi
        WHERE gi.grn_id = grn_receipts.id
          AND gi.requires_qa = true
          AND gi.qa_status = 'pending'
      )
    )
  );

-- TSQA: approve QA on flagged line items
DROP POLICY IF EXISTS "TSQA can read goods GRN items pending QA" ON grn_items;
CREATE POLICY "TSQA can read goods GRN items pending QA"
  ON grn_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND public.request_type_for_grn(grn_items.grn_id) = 'goods'
    AND grn_items.requires_qa = true
  );

DROP POLICY IF EXISTS "TSQA can update goods GRN items for QA" ON grn_items;
CREATE POLICY "TSQA can update goods GRN items for QA"
  ON grn_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND public.request_type_for_grn(grn_items.grn_id) = 'goods'
    AND grn_items.requires_qa = true
    AND grn_items.qa_status = 'pending'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND public.request_type_for_grn(grn_items.grn_id) = 'goods'
    AND grn_items.requires_qa = true
  );
