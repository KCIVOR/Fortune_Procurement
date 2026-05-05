/*
  # Add Manual Priority to PR1

  ## Summary
  Adds persistent priority field to PR1 requests, allowing authorized users
  to manually set and override PR1 priority levels for workflow optimization
  and expedited processing.

  ## Changes

  ### 1. pr1_requests priority column
  - `priority` (text, default 'normal')
    - Allowed values: 'normal', 'urgent', 'critical'
    - CHECK constraint enforces enum values
    - Default 'normal' for backward compatibility with existing PR1s
    - Applies to all PR1 states (draft, submitted, approved, etc.)
    - Reusable across dashboards and reports

  ## Backward Compatibility
  - Existing PR1s automatically default to 'normal' priority
  - No data migration needed
  - Priority can be updated on any PR1 (authorization handled in application layer)

  ## Security Notes
  - RLS policies for priority updates will be added in a separate phase
  - Current authorization checks will be enforced at the application layer
*/

-- Add priority column to pr1_requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pr1_requests' AND column_name = 'priority'
  ) THEN
    ALTER TABLE pr1_requests
      ADD COLUMN priority text DEFAULT 'normal'
        CHECK (priority IN ('normal', 'urgent', 'critical'));
  END IF;
END $$;
