/*
  # Add active flag to profiles

  1. New Column
    - profiles.active (boolean, NOT NULL, DEFAULT true)
  2. Safety
    - All existing users remain active (default true)
    - No RLS changes — admin writes go through service-role API (Phase 3)
    - No changes to auth.users
    - Column-level GRANT on profiles (full_name only) unchanged
  3. Notes
    - Soft deactivate only; never hard-delete profiles
    - Follows departments/positions active pattern (20260429163647)
    - Idempotent: safe to re-run if column already exists
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'active'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN active boolean NOT NULL DEFAULT true;
  END IF;
END $$;
