/*
  # Migrate Priority Values: urgent → medium, critical → high

  1. Overview
    - Migrate all pr1_requests.priority values from urgent/critical to medium/high
    - Keep normal unchanged
    - Update CHECK constraint to allow only: normal, medium, high

  2. Changes
    - UPDATE pr1_requests: urgent → medium, critical → high
    - Update CHECK constraint on pr1_requests.priority
    - Default remains: normal

  3. Data Safety
    - All existing records preserved with new values
    - No records deleted
    - Backward compatibility maintained through data transformation

  4. Important Notes
    - This is a one-way data migration
    - No application logic changes (only data values)
    - All references to urgent/critical in code must be updated separately
*/

-- First, drop the existing CHECK constraint
ALTER TABLE pr1_requests
DROP CONSTRAINT IF EXISTS pr1_requests_priority_check;

-- Migrate existing priority values
UPDATE pr1_requests
SET priority = 'medium'
WHERE priority = 'urgent';

UPDATE pr1_requests
SET priority = 'high'
WHERE priority = 'critical';

-- Add new CHECK constraint with updated allowed values
ALTER TABLE pr1_requests
ADD CONSTRAINT pr1_requests_priority_check
CHECK (priority IN ('normal', 'medium', 'high'));
