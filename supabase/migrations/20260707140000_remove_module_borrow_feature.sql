-- Remove the "borrow module from another role" half of the Module Visibility
-- feature. It was never enforced by the route-access layer (middleware /
-- use-require-roles are static role-based), so borrowed sidebar links always
-- dead-ended in access-denied. The hide/show half stays.
-- Verified before drop: zero rows had source_role_id set.

DELETE FROM public.role_position_module_visibility
WHERE source_role_id IS NOT NULL;

ALTER TABLE public.role_position_module_visibility
  DROP COLUMN IF EXISTS source_role_id;
