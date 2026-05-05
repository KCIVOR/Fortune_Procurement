/*
  # Fix PO Approval Step 3 is_final flag

  ## Problem
  Step 3 (Finance Director / Approved By) has is_final=false, causing the approval
  instance to advance to step 4 instead of closing. As a result:
  - po_requests.status never transitions to 'approved'
  - Supplier cannot see the PO in their inbox (fetchSupplierPOs filters status IN ('approved','sent'))
  - Supplier acknowledgment guard (status !== 'approved') always throws

  ## Fix
  Set is_final=true on step 3 of PO_APPROVAL. Step 4 (Supplier / Received By) is handled
  out-of-band via acknowledgeSupplierPO, not via the sequential approval action path.
*/

UPDATE approval_steps
SET is_final = true
WHERE step_order = 3
  AND workflow_id = (
    SELECT id FROM approval_workflows WHERE code = 'PO_APPROVAL'
  );
