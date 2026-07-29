/*
  # Add priority column to pr2_requests table

  1. Changes
    - Add `priority` text column to `pr2_requests` table
    - Default value: 'normal'
    - Constraint: CHECK (priority IN ('normal', 'medium', 'high'))
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pr2_requests' AND column_name = 'priority'
  ) THEN
    ALTER TABLE pr2_requests
      ADD COLUMN priority text DEFAULT 'normal'
        CHECK (priority IN ('normal', 'medium', 'high'));
  END IF;
END $$;
