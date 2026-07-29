/*
  # Add Services Delivery Forwarding to Procurement

  1. New Columns:
    - `forwarded_to_procurement` (boolean, default false)
    - `forwarded_at` (timestamptz)

  2. Purpose:
    Aligns Services delivery handoff with Section 5.7 of docs/Final_Workflow.md,
    allowing Warehouse staff to receive delivery arrivals and forward them to
    Procurement for GRN processing.
*/

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS forwarded_to_procurement boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS forwarded_at timestamptz;

-- Update RLS policies on deliveries to allow Warehouse & Procurement to update forwarding status
DROP POLICY IF EXISTS "Warehouse can update deliveries" ON public.deliveries;
CREATE POLICY "Warehouse can update deliveries"
  ON public.deliveries FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name IN ('warehouse', 'procurement', 'admin')
    )
  );
