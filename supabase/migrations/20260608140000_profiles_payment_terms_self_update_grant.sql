/*
  # Allow suppliers to update own payment_terms on profiles

  ## Problem
  Migration 20260430023558 restricted authenticated UPDATE on profiles to
  full_name only. payment_terms was added later (20260506103000) but never
  granted, so suppliers saving default payment terms get:
  "permission denied for table profiles".

  ## Solution
  Grant column-level UPDATE on payment_terms for authenticated users.
  RLS "Users can update own profile" still requires auth.uid() = id.
  role_id / position_id / department_id remain non-updatable by users.

  Admin supplier payment-term overrides continue via service-role API.
*/

GRANT UPDATE (payment_terms) ON public.profiles TO authenticated;
