/*
  # Module Visibility "Add Mode" Enhancement
  
  Allows positions to ADD modules from other roles, not just hide modules from their own role.
  
  Changes:
  1. Add source_role_id column - when set, this module is "borrowed" from another role
  2. Update trigger to allow source_role_id to differ from role_id
  3. Add index for efficient lookups
  
  Use case: Buyer position has "approver" role but needs procurement modules (/po, /rfq, /pr2)
*/

-- Add source_role_id column for borrowed modules
ALTER TABLE public.role_position_module_visibility
ADD COLUMN IF NOT EXISTS source_role_id uuid REFERENCES public.roles (id) ON DELETE CASCADE;

-- Add comment explaining the column
COMMENT ON COLUMN public.role_position_module_visibility.source_role_id IS 
  'When set, indicates this module is borrowed from another role. The module_key should exist in that role''s navigation. When null, the rule applies to the current role''s own modules.';

-- Create index for efficient lookups of added modules
CREATE INDEX IF NOT EXISTS rpamv_source_role_idx 
  ON public.role_position_module_visibility (source_role_id) 
  WHERE source_role_id IS NOT NULL;

-- Create index for position-based added modules lookup
CREATE INDEX IF NOT EXISTS rpamv_position_added_modules_idx 
  ON public.role_position_module_visibility (position_id, source_role_id) 
  WHERE position_id IS NOT NULL AND source_role_id IS NOT NULL;
