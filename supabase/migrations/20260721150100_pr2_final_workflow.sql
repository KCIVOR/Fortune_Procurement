-- Phase 2 (Goods workflow alignment): PR2_FINAL = Dept Head → Operations Manager

DO $$
DECLARE
  v_pr2_tpl   uuid;
  v_pr2_final uuid;
BEGIN
  SELECT id INTO v_pr2_tpl FROM controlled_form_templates WHERE code = 'PR2';

  INSERT INTO approval_workflows (code, name, form_template_id, active)
  VALUES ('PR2_FINAL', 'PR2 Approval Routing (Goods)', v_pr2_tpl, true)
  ON CONFLICT (code) DO UPDATE
    SET name = EXCLUDED.name,
        form_template_id = COALESCE(EXCLUDED.form_template_id, approval_workflows.form_template_id),
        active = true;

  SELECT id INTO v_pr2_final FROM approval_workflows WHERE code = 'PR2_FINAL';

  DELETE FROM approval_steps WHERE workflow_id = v_pr2_final;

  INSERT INTO approval_steps (workflow_id, step_order, role_required, position_required, action_label, is_final)
  VALUES
    (v_pr2_final, 1, 'approver', 'Department Head',     'Certified By', false),
    (v_pr2_final, 2, 'approver', 'Operations Manager',  'Approved By',  true);
END $$;
