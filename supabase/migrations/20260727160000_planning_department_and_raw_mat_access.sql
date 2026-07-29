/*
  Planning department + Planning Staff position for raw-material requisitions.
  Only users in Planning (or with Planning Staff position) may flag PR1 lines
  as raw material — enforced in app layer (lib/raw-material-access.ts).
*/

INSERT INTO departments (name, code)
VALUES ('Planning', 'PLAN')
ON CONFLICT (code) DO NOTHING;

INSERT INTO positions (title, role_id, active)
SELECT 'Planning Staff', id, true
FROM roles
WHERE name = 'employee'
ON CONFLICT DO NOTHING;
