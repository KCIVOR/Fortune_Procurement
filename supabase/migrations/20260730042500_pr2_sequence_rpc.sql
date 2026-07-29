/*
  # PR2 Sequence Generation RPC

  Creates `public.next_pr2_sequence(p_year int)` SECURITY DEFINER RPC function.
  Bypasses RLS to scan all existing `pr2_number` suffixes in `pr2_requests` for
  a given year (matching both `PR2-{year}-%` and `PR2-RM-{year}-%`), and returns
  the next 4-digit padded suffix (e.g. '0003').
*/

CREATE OR REPLACE FUNCTION public.next_pr2_sequence(p_year int)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max int := 0;
  v_prefix1 text;
  v_prefix2 text;
  r RECORD;
  v_num text;
  v_seq int;
BEGIN
  v_prefix1 := 'PR2-' || p_year || '-%';
  v_prefix2 := 'PR2-RM-' || p_year || '-%';

  FOR r IN
    SELECT pr2_number
    FROM public.pr2_requests
    WHERE pr2_number ILIKE v_prefix1 OR pr2_number ILIKE v_prefix2
  LOOP
    -- Extract numeric suffix from end of pr2_number
    v_num := substring(r.pr2_number from '-(\d+)$');
    IF v_num IS NOT NULL THEN
      v_seq := v_num::int;
      IF v_seq > v_max THEN
        v_max := v_seq;
      END IF;
    END IF;
  END LOOP;

  RETURN lpad((v_max + 1)::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_pr2_sequence(int) TO authenticated;
