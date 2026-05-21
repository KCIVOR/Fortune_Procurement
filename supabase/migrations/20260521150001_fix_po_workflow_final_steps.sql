-- Fix PO_APPROVAL workflow to have both Finance Director and Supplier as final steps
-- This is the correct configuration for PO workflow:
-- - Step 3 (Finance Director) = final internal approval
-- - Step 4 (Supplier Representative) = final acknowledgment step

-- Set Finance Director (step 3) as final
UPDATE approval_steps
SET is_final = TRUE
WHERE workflow_id = (
  SELECT id FROM approval_workflows WHERE code = 'PO_APPROVAL'
)
AND step_order = 3;

-- Ensure Supplier Representative (step 4) is also final
UPDATE approval_steps
SET is_final = TRUE
WHERE workflow_id = (
  SELECT id FROM approval_workflows WHERE code = 'PO_APPROVAL'
)
AND step_order = 4;

-- Add comment explaining the dual-final configuration
COMMENT ON TABLE approval_steps IS 'PO_APPROVAL workflow supports multiple final steps: Finance Director (step 3) for internal approval, Supplier Representative (step 4) for acknowledgment';
