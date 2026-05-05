/*
  # Add Active Flags to Master Data Tables

  1. New Columns
    - `roles.active` (boolean, DEFAULT true, NOT NULL)
    - `positions.active` (boolean, DEFAULT true, NOT NULL)
    - `departments.active` (boolean, DEFAULT true, NOT NULL)
  2. Migration Strategy
    - All existing records default to active=true (no downtime)
    - Soft deactivate support for future management
    - Follows existing active pattern in controlled_form_templates and approval_workflows
  3. Safety
    - No RLS changes in this migration
    - No logic changes to approvals, workflows, or user assignments
    - Existing queries continue to work (active flag not yet filtered)
    - Active flag available for later filtering when UI implements deactivation
  4. Notes
    - Do NOT use hard delete in future; deactivate via active=false instead
    - Approval workflows reference role/position as TEXT and stored in snapshots; renaming will be handled separately
    - All existing records become active=true; provides foundation for soft deactivate strategy
*/

-- Add active column to roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'roles' AND column_name = 'active'
  ) THEN
    ALTER TABLE roles ADD COLUMN active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Add active column to positions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'positions' AND column_name = 'active'
  ) THEN
    ALTER TABLE positions ADD COLUMN active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Add active column to departments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'departments' AND column_name = 'active'
  ) THEN
    ALTER TABLE departments ADD COLUMN active boolean NOT NULL DEFAULT true;
  END IF;
END $$;
