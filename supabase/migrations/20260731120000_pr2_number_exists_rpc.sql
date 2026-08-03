-- Mirrors pr1_number_exists: planning users only see their own pr2_requests
-- under RLS ("Requestors can read own PR2 requests"), so a client-side
-- .eq('pr2_number', ...) duplicate check is blind to other users' numbers.
-- SECURITY DEFINER runs across all rows regardless of the caller's RLS.
CREATE OR REPLACE FUNCTION public.pr2_number_exists(p_number text, p_exclude_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pr2_requests
    WHERE lower(pr2_number) = lower(trim(p_number))
      AND (p_exclude_id IS NULL OR id <> p_exclude_id)
  );
$$;

GRANT EXECUTE ON FUNCTION public.pr2_number_exists(text, uuid) TO authenticated;
