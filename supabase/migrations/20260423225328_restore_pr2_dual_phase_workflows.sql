/*
  # Restore PR2 Dual-Phase Approval Workflows

  ## Correction
  The migration fix_workflow_sequence incorrectly collapsed PR2 into a single
  PR2_APPROVAL workflow. The locked MVP requires two separate approval phases:

  Locked sequence:
  PR1 → Warehouse Validation → PR1 Approval → Canvassing/RFQ →
  PR2 → PR2 Approval Phase 1 → PR2 Approval Phase 2 → PO → PO Approval → Delivery → GRN

  ## Changes
  1. Delete incorrect PR2_APPROVAL workflow and its steps
  2. Restore PR2_PHASE1 (4 steps) — post-canvassing PR2 creation approval
  3. Restore PR2_PHASE2 (3 steps) — pre-PO buyer approval
  4. RFQ remains a form template only (canvassing process step, no approval workflow)
  5. PR1_APPROVAL and PO_APPROVAL unchanged

  ## PR2_PHASE1 — Prepared By chain (4 steps)
  Step 1: Procurement Staff / Authorized Personnel — Prepared By
  Step 2: Department Head                          — Certified By
  Step 3: Procurement Manager                      — Reviewed By
  Step 4: Director                                 — Approved By (final)

  ## PR2_PHASE2 — Buyer chain (3 steps)
  Step 1: Buyer               — Prepared By
  Step 2: Procurement Manager — Reviewed By
  Step 3: Director            — Approved By (final)
*/

DO $$
DECLARE
  v_pr2_approval_wf uuid;
  v_pr2_tpl         uuid;
  v_pr2p1_wf        uuid;
  v_pr2p2_wf        uuid;
BEGIN

  -- Step 1: Remove the incorrect single PR2_APPROVAL workflow
  SELECT id INTO v_pr2_approval_wf FROM approval_workflows WHERE code = 'PR2_APPROVAL';
  IF v_pr2_approval_wf IS NOT NULL THEN
    DELETE FROM approval_steps    WHERE workflow_id = v_pr2_approval_wf;
    DELETE FROM approval_workflows WHERE id          = v_pr2_approval_wf;
  END IF;

  -- Step 2: Get PR2 form template ID
  SELECT id INTO v_pr2_tpl FROM controlled_form_templates WHERE code = 'PR2';

  -- Step 3: Restore PR2_PHASE1
  INSERT INTO approval_workflows (code, name, form_template_id)
  VALUES ('PR2_PHASE1', 'PR2 Phase 1 Approval Routing', v_pr2_tpl)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_pr2p1_wf FROM approval_workflows WHERE code = 'PR2_PHASE1';

  DELETE FROM approval_steps WHERE workflow_id = v_pr2p1_wf;

  INSERT INTO approval_steps (workflow_id, step_order, role_required, position_required, action_label, is_final)
  VALUES
    (v_pr2p1_wf, 1, 'procurement', 'Procurement Staff',   'Prepared By',  false),
    (v_pr2p1_wf, 2, 'approver',    'Department Head',     'Certified By', false),
    (v_pr2p1_wf, 3, 'procurement', 'Procurement Manager', 'Reviewed By',  false),
    (v_pr2p1_wf, 4, 'approver',    'Director',            'Approved By',  true);

  -- Step 4: Restore PR2_PHASE2
  INSERT INTO approval_workflows (code, name, form_template_id)
  VALUES ('PR2_PHASE2', 'PR2 Phase 2 Approval Routing', v_pr2_tpl)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_pr2p2_wf FROM approval_workflows WHERE code = 'PR2_PHASE2';

  DELETE FROM approval_steps WHERE workflow_id = v_pr2p2_wf;

  INSERT INTO approval_steps (workflow_id, step_order, role_required, position_required, action_label, is_final)
  VALUES
    (v_pr2p2_wf, 1, 'procurement', 'Buyer',               'Prepared By', false),
    (v_pr2p2_wf, 2, 'procurement', 'Procurement Manager', 'Reviewed By', false),
    (v_pr2p2_wf, 3, 'approver',    'Director',            'Approved By', true);

END $$;
