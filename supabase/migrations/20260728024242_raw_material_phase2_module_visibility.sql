-- Raw Materials Phase 2 (Bundle B): hide the new "Raw Material Requests"
-- nav item from employees by default; show it only for Planning Staff.
DO $$
DECLARE
  v_role_employee uuid;
  v_pos_planning_staff uuid;
BEGIN
  SELECT id INTO v_role_employee FROM roles WHERE name = 'employee';
  SELECT id INTO v_pos_planning_staff FROM positions WHERE title = 'Planning Staff';

  IF v_role_employee IS NULL OR v_pos_planning_staff IS NULL THEN
    RAISE NOTICE 'Skipping planning_pr2 module visibility seed — role/position missing';
    RETURN;
  END IF;

  INSERT INTO role_position_module_visibility (role_id, position_id, module_key, is_visible)
  VALUES (v_role_employee, NULL, 'planning_pr2', false)
  ON CONFLICT (role_id, module_key) WHERE position_id IS NULL DO NOTHING;

  INSERT INTO role_position_module_visibility (role_id, position_id, module_key, is_visible)
  VALUES (v_role_employee, v_pos_planning_staff, 'planning_pr2', true)
  ON CONFLICT (role_id, position_id, module_key) WHERE position_id IS NOT NULL DO NOTHING;
END $$;
