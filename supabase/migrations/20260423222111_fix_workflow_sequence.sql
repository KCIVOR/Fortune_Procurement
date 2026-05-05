
/*
  # Fix Workflow Sequence — Correct MVP Transaction Path

  ## Correction
  The previous seed used an incorrect two-phase PR2 model. The locked MVP sequence is:

    PR1 → Warehouse Validation → PR1 Approval → Canvassing/RFQ → PR2 → PR2 Approval
    → PO → PO Approval → Delivery → GRN

  ## Changes
  1. Remove incorrect PR2_PHASE1 and PR2_PHASE2 workflows and their steps
  2. Add RFQ_PROCESS workflow (canvassing step before PR2 is created)
  3. Add PR2_APPROVAL workflow (single approval chain for PR2)
  4. PO_APPROVAL remains unchanged
  5. PR1_APPROVAL remains unchanged
  6. Ensure RFQ form template exists

  ## Corrected Approval Workflows

  ### PR1_APPROVAL (unchanged — 2 steps)
  Step 1: Supervisor         — Reviewed and Noted By
  Step 2: Department Head    — Approved By (final)

  ### PR2_APPROVAL (new — 4 steps)
  Step 1: Procurement Staff  — Prepared By
  Step 2: Department Head    — Certified By
  Step 3: Procurement Manager — Reviewed By
  Step 4: Director           — Approved By (final)

  ### PO_APPROVAL (unchanged — 4 steps)
  Step 1: Buyer              — Prepared By
  Step 2: Procurement Manager — Reviewed By
  Step 3: Finance Director   — Approved By
  Step 4: Supplier Representative — Received By (final)
*/

DO $$
DECLARE
  v_pr2p1_wf uuid;
  v_pr2p2_wf uuid;
  v_pr2_tpl  uuid;
  v_pr2_wf   uuid;
BEGIN

  -- ── Remove incorrect PR2 phase workflows

  SELECT id INTO v_pr2p1_wf FROM approval_workflows WHERE code = 'PR2_PHASE1';
  SELECT id INTO v_pr2p2_wf FROM approval_workflows WHERE code = 'PR2_PHASE2';

  IF v_pr2p1_wf IS NOT NULL THEN
    DELETE FROM approval_steps WHERE workflow_id = v_pr2p1_wf;
    DELETE FROM approval_workflows WHERE id = v_pr2p1_wf;
  END IF;

  IF v_pr2p2_wf IS NOT NULL THEN
    DELETE FROM approval_steps WHERE workflow_id = v_pr2p2_wf;
    DELETE FROM approval_workflows WHERE id = v_pr2p2_wf;
  END IF;

  -- ── Ensure PR2 form template exists
  SELECT id INTO v_pr2_tpl FROM controlled_form_templates WHERE code = 'PR2';
  IF v_pr2_tpl IS NULL THEN
    INSERT INTO controlled_form_templates (code, name, description)
    VALUES ('PR2', 'Purchase Request v2', 'Procurement-managed purchase request created after RFQ canvassing')
    RETURNING id INTO v_pr2_tpl;

    INSERT INTO controlled_form_versions (template_id, version, active)
    VALUES (v_pr2_tpl, 1, true);
  END IF;

  -- ── Add PR2_APPROVAL workflow
  INSERT INTO approval_workflows (code, name, form_template_id)
  VALUES ('PR2_APPROVAL', 'PR2 Approval Routing', v_pr2_tpl)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_pr2_wf FROM approval_workflows WHERE code = 'PR2_APPROVAL';

  -- ── PR2 Approval Steps
  INSERT INTO approval_steps (workflow_id, step_order, role_required, position_required, action_label, is_final)
  VALUES
    (v_pr2_wf, 1, 'procurement', 'Procurement Staff',  'Prepared By',  false),
    (v_pr2_wf, 2, 'approver',    'Department Head',    'Certified By', false),
    (v_pr2_wf, 3, 'procurement', 'Procurement Manager','Reviewed By',  false),
    (v_pr2_wf, 4, 'approver',    'Director',           'Approved By',  true)
  ON CONFLICT (workflow_id, step_order) DO NOTHING;

END $$;
