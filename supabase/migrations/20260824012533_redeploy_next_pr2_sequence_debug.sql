-- Diagnostic no-op redeploy of next_pr2_sequence while investigating the
-- PR2 auto-number bug (see 20260824012747_fix_next_pr2_sequence_lpad_truncation.sql
-- for the actual fix). Left as a migration for history parity with the remote project.
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
