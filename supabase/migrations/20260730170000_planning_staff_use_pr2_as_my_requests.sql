/*
  Planning Staff requisition directly via PR2 (/planning/pr2) and never file a
  PR1, so the "My Requests" (/pr1) nav entry is dead weight for them. Hide it
  for that position only — every other employee position keeps it.

  The PR2 list is relabelled "My Requests" in config/navigation.ts, so Planning
  Staff end up with a single, correctly-named requests page.

  Scoping note: `my_requests` has no role-default row, and
  getRoleDefaultVisibility() treats "no row" as visible — so a position-scoped
  row with is_visible = false is exactly the right override here, and it leaves
  the employee role default untouched.
*/

DELETE FROM public.role_position_module_visibility
WHERE module_key = 'my_requests'
  AND role_id     = (SELECT id FROM public.roles     WHERE name  = 'employee')
  AND position_id = (SELECT id FROM public.positions WHERE title = 'Planning Staff');

INSERT INTO public.role_position_module_visibility (role_id, position_id, module_key, is_visible)
SELECT r.id, p.id, 'my_requests', false
FROM public.roles r
CROSS JOIN public.positions p
WHERE r.name = 'employee'
  AND p.title = 'Planning Staff';
