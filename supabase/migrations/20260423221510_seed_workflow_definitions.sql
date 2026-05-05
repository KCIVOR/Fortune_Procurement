
/*
  # Seed Workflow Definitions

  ## Summary
  Seeds all static document templates and approval workflow routing for the
  MVP transaction path. All routing is fixed — no dynamic configuration.

  ## Document Templates Seeded
  - PR1 — Purchase Request (employee-initiated)
  - PR2 — Purchase Request v2 (procurement-managed, 2 phases)
  - RFQ — Request for Quotation
  - PO  — Purchase Order
  - GRN — Goods Receipt Note

  ## Approval Workflows Seeded

  ### PR1_APPROVAL (PR1 → 2 steps)
  Step 1: Supervisor          — Reviewed and Noted By
  Step 2: Department Head     — Approved By (final)

  ### PR2_PHASE1 (PR2 Phase 1 → 4 steps)
  Step 1: Procurement Staff / Authorized Personnel — Prepared By
  Step 2: Department Head     — Certified By
  Step 3: Procurement Manager — Reviewed By
  Step 4: Director            — Approved By (final)

  ### PR2_PHASE2 (PR2 Phase 2 → 3 steps)
  Step 1: Buyer               — Prepared By
  Step 2: Procurement Manager — Reviewed By
  Step 3: Director            — Approved By (final)

  ### PO_APPROVAL (PO → 4 steps)
  Step 1: Buyer               — Prepared By
  Step 2: Procurement Manager — Reviewed By
  Step 3: Finance Director    — Approved By
  Step 4: Supplier Representative — Received By (final)
*/

DO $$
DECLARE
  v_pr1_tpl  uuid;
  v_pr2_tpl  uuid;
  v_rfq_tpl  uuid;
  v_po_tpl   uuid;
  v_grn_tpl  uuid;

  v_pr1_wf   uuid;
  v_pr2p1_wf uuid;
  v_pr2p2_wf uuid;
  v_po_wf    uuid;
BEGIN

  -- ── Form Templates
  INSERT INTO controlled_form_templates (code, name, description)
  VALUES
    ('PR1', 'Purchase Request',              'Employee-initiated request for goods or services'),
    ('PR2', 'Purchase Request v2',           'Procurement-managed purchase request with dual-phase approval'),
    ('RFQ', 'Request for Quotation',         'Formal solicitation sent to suppliers for pricing'),
    ('PO',  'Purchase Order',                'Formal order issued to a supplier'),
    ('GRN', 'Goods Receipt Note',            'Acknowledgment of goods received from supplier')
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_pr1_tpl FROM controlled_form_templates WHERE code = 'PR1';
  SELECT id INTO v_pr2_tpl FROM controlled_form_templates WHERE code = 'PR2';
  SELECT id INTO v_rfq_tpl FROM controlled_form_templates WHERE code = 'RFQ';
  SELECT id INTO v_po_tpl  FROM controlled_form_templates WHERE code = 'PO';
  SELECT id INTO v_grn_tpl FROM controlled_form_templates WHERE code = 'GRN';

  -- ── Form Versions (v1 for all)
  INSERT INTO controlled_form_versions (template_id, version, active)
  VALUES
    (v_pr1_tpl, 1, true),
    (v_pr2_tpl, 1, true),
    (v_rfq_tpl, 1, true),
    (v_po_tpl,  1, true),
    (v_grn_tpl, 1, true)
  ON CONFLICT (template_id, version) DO NOTHING;

  -- ── Approval Workflows
  INSERT INTO approval_workflows (code, name, form_template_id)
  VALUES
    ('PR1_APPROVAL', 'PR1 Approval Routing',         v_pr1_tpl),
    ('PR2_PHASE1',   'PR2 Phase 1 Approval Routing', v_pr2_tpl),
    ('PR2_PHASE2',   'PR2 Phase 2 Approval Routing', v_pr2_tpl),
    ('PO_APPROVAL',  'PO Approval Routing',           v_po_tpl)
  ON CONFLICT (code) DO NOTHING;

  SELECT id INTO v_pr1_wf   FROM approval_workflows WHERE code = 'PR1_APPROVAL';
  SELECT id INTO v_pr2p1_wf FROM approval_workflows WHERE code = 'PR2_PHASE1';
  SELECT id INTO v_pr2p2_wf FROM approval_workflows WHERE code = 'PR2_PHASE2';
  SELECT id INTO v_po_wf    FROM approval_workflows WHERE code = 'PO_APPROVAL';

  -- ── PR1 Approval Steps
  INSERT INTO approval_steps (workflow_id, step_order, role_required, position_required, action_label, is_final)
  VALUES
    (v_pr1_wf, 1, 'approver', 'Supervisor',       'Reviewed and Noted By', false),
    (v_pr1_wf, 2, 'approver', 'Department Head',  'Approved By',           true)
  ON CONFLICT (workflow_id, step_order) DO NOTHING;

  -- ── PR2 Phase 1 Approval Steps
  INSERT INTO approval_steps (workflow_id, step_order, role_required, position_required, action_label, is_final)
  VALUES
    (v_pr2p1_wf, 1, 'procurement', 'Procurement Staff', 'Prepared By',  false),
    (v_pr2p1_wf, 2, 'approver',    'Department Head',   'Certified By', false),
    (v_pr2p1_wf, 3, 'procurement', 'Procurement Manager','Reviewed By', false),
    (v_pr2p1_wf, 4, 'approver',    'Director',          'Approved By',  true)
  ON CONFLICT (workflow_id, step_order) DO NOTHING;

  -- ── PR2 Phase 2 Approval Steps
  INSERT INTO approval_steps (workflow_id, step_order, role_required, position_required, action_label, is_final)
  VALUES
    (v_pr2p2_wf, 1, 'procurement', 'Buyer',              'Prepared By',  false),
    (v_pr2p2_wf, 2, 'procurement', 'Procurement Manager','Reviewed By',  false),
    (v_pr2p2_wf, 3, 'approver',    'Director',           'Approved By',  true)
  ON CONFLICT (workflow_id, step_order) DO NOTHING;

  -- ── PO Approval Steps
  INSERT INTO approval_steps (workflow_id, step_order, role_required, position_required, action_label, is_final)
  VALUES
    (v_po_wf, 1, 'procurement', 'Buyer',                    'Prepared By',  false),
    (v_po_wf, 2, 'procurement', 'Procurement Manager',      'Reviewed By',  false),
    (v_po_wf, 3, 'approver',    'Finance Director',         'Approved By',  false),
    (v_po_wf, 4, 'supplier',    'Supplier Representative',  'Received By',  true)
  ON CONFLICT (workflow_id, step_order) DO NOTHING;

END $$;
