/*
  # PR1 assignment to buyer

  1. Changes
    - Add `assigned_buyer_id` (nullable FK → profiles.id) to `pr1_requests`
    - Add `assigned_buyer_name_snapshot` (denormalized, matches the existing
      `requisitioner_name_snapshot` / `department_name_snapshot` convention on this table)
    - Add `assigned_at` (timestamptz) and `assigned_by` (nullable FK → profiles.id, who made
      the assignment — for audit/trace, per Rev #2's "useful for tracing" requirement)
    - Index `assigned_buyer_id` for the new "Assigned to Me" / "Unassigned" filter on /rfq

  2. Rationale (Rev #2)
    Procurement wants to manually assign a PR1 (at the canvassing/RFQ stage) to a specific
    procurement staff member, purely for visibility/tracing — not an authorization gate.
    No RLS change needed: procurement already has unrestricted UPDATE on pr1_requests via
    the existing "Procurement and approvers can update PR1 priority" policy, and the /rfq
    route is already procurement-only (config/route-access.ts).

  3. Security
    - No RLS policy changes
    - `assigned_buyer_id` / `assigned_by` use ON DELETE SET NULL so a deleted profile
      doesn't break the PR1 row
*/

ALTER TABLE public.pr1_requests
  ADD COLUMN IF NOT EXISTS assigned_buyer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_buyer_name_snapshot text,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pr1_requests_assigned_buyer_id ON public.pr1_requests(assigned_buyer_id);
