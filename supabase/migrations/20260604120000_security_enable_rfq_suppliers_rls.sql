/*
  Phase 1A — Enable RLS on rfq_suppliers (F3)

  Policies already exist from canvassing migrations but RLS was never enabled.
  No policy changes; only activates existing procurement / supplier / requestor / Director rules.
*/

ALTER TABLE public.rfq_suppliers ENABLE ROW LEVEL SECURITY;
