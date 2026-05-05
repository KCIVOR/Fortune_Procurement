/*
  # Enforce one RFQ per PR1

  1. Changes
    - Add UNIQUE constraint on rfq_batches(pr1_id) so the database rejects any
      attempt to create a second RFQ for the same PR1, even under concurrent inserts.

  2. Safety
    - The migration checks for duplicate pr1_id rows first and deduplicates by
      keeping only the most-recently created row before adding the constraint.
    - Uses IF NOT EXISTS to be idempotent.
*/

-- Remove any duplicate rfq_batches rows for the same pr1_id, keeping newest.
DELETE FROM rfq_batches
WHERE id NOT IN (
  SELECT DISTINCT ON (pr1_id) id
  FROM rfq_batches
  ORDER BY pr1_id, created_at DESC
);

-- Add unique constraint (idempotent via DO block check).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'rfq_batches'
      AND constraint_name = 'rfq_batches_pr1_id_key'
  ) THEN
    ALTER TABLE rfq_batches ADD CONSTRAINT rfq_batches_pr1_id_key UNIQUE (pr1_id);
  END IF;
END $$;
