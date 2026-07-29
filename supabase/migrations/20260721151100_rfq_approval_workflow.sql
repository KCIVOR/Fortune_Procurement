-- Phase 4: RFQ_APPROVAL workflow (Procurement Manager → Director)

DO $$
DECLARE
  v_rfq_tpl uuid;
  v_rfq_wf  uuid;
BEGIN
  SELECT id INTO v_rfq_tpl FROM controlled_form_templates WHERE code = 'RFQ';

  INSERT INTO approval_workflows (code, name, form_template_id, active)
  VALUES ('RFQ_APPROVAL', 'RFQ Approval Routing', v_rfq_tpl, true)
  ON CONFLICT (code) DO UPDATE
    SET name = EXCLUDED.name,
        form_template_id = COALESCE(EXCLUDED.form_template_id, approval_workflows.form_template_id),
        active = true;

  SELECT id INTO v_rfq_wf FROM approval_workflows WHERE code = 'RFQ_APPROVAL';

  DELETE FROM approval_steps WHERE workflow_id = v_rfq_wf;

  INSERT INTO approval_steps (workflow_id, step_order, role_required, position_required, action_label, is_final)
  VALUES
    (v_rfq_wf, 1, 'procurement', 'Procurement Manager', 'Reviewed By',  false),
    (v_rfq_wf, 2, 'approver',    'Director',            'Approved By',  true);
END $$;
