/*
  # PR2 (Planning Direct) assignment to buyer

  Mirrors 20260706130000_pr1_assigned_buyer.sql, scoped to pr2_requests
  instead of pr1_requests, so the RFQ page's "Planning Direct" tab
  (PR2-native raw-material/services rows, no pr1_id) can get the same
  "Assigned To" visibility/tracing feature as the "RFQ Issued" tab already
  has for PR1-based rows.

  No RLS change needed: procurement already has unrestricted UPDATE on
  pr2_requests via the existing "Procurement can update PR2 requests" policy,
  and /rfq is already procurement-only.
*/

ALTER TABLE public.pr2_requests
  ADD COLUMN IF NOT EXISTS assigned_buyer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_buyer_name_snapshot text,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pr2_requests_assigned_buyer_id ON public.pr2_requests(assigned_buyer_id);
