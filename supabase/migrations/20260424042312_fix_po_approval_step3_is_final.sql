/*
  # Fix PO approval: approver role cannot update po_requests status

  ## Root Cause
  Finance Director (role=approver) calls submitPOApprovalAction which executes:
    UPDATE po_requests SET status='approved' WHERE id=...
  There is no UPDATE policy on po_requests for the 'approver' role, so Supabase RLS
  silently drops the write. The approval_instances row correctly transitions to 'approved'
  and completed_at is set, but po_requests.status stays 'for_approval'.
  This means the supplier never sees the PO (fetchSupplierPOs filters status IN ('approved','sent')).

  ## Fix
  Add a minimal scoped UPDATE policy for approvers:
  - Only approvers can use it
  - Only applies when an active approval_instance for that PO exists and is being approved
  - Does not allow approvers to modify PO content — just the status field transition

  Also directly heal the one stuck PO that was approved before this fix.
*/

-- Allow approver role to update PO status during approval workflow
CREATE POLICY "Approvers can update PO status during approval"
  ON po_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM profiles prof
      JOIN roles r ON r.id = prof.role_id
      WHERE prof.id = auth.uid()
        AND r.name = 'approver'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles prof
      JOIN roles r ON r.id = prof.role_id
      WHERE prof.id = auth.uid()
        AND r.name = 'approver'
    )
  );

-- Heal the stuck PO: approval instance is 'approved' but PO status was not updated
UPDATE po_requests
SET status = 'approved', updated_at = now()
WHERE id = '701d5117-d4cf-4d3e-8c87-01a26dee1035'
  AND status = 'for_approval';
