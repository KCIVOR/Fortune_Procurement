-- Phase 0 (Goods workflow alignment): add Operations Manager position for PR2_FINAL workflow.

INSERT INTO positions (title, role_id, active)
SELECT 'Operations Manager', r.id, true
FROM roles r
WHERE r.name = 'approver'
  AND NOT EXISTS (SELECT 1 FROM positions WHERE title = 'Operations Manager');
