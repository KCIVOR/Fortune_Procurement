/*
  Fix public.next_pr2_sequence(int)

  Bug: `substring(pr2_number from '-(\d+)$')` matched suffixes of ANY digit
  length, including malformed data (e.g. "PR2-2026-00240024", an 8-digit
  suffix). That inflated v_max to 240024, and `lpad((v_max+1)::text, 4, '0')`
  silently TRUNCATES strings already longer than the target width instead of
  expanding it — so '240025' got truncated down to '2400', which coincidentally
  matched an already-used PR2 number and caused the "already in use" duplicate
  error on every page load.

  Fix: restrict the suffix match to 1-4 digits (matching the PR2-YYYY-####
  format the app actually generates), so malformed/oversized suffixes are
  ignored instead of corrupting the max. Also widen lpad's target length to
  never truncate, as defense in depth once the sequence passes 9999.
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
    v_num := substring(r.pr2_number from '-(\d{1,4})$');
    IF v_num IS NOT NULL THEN
      v_seq := v_num::int;
      IF v_seq > v_max THEN
        v_max := v_seq;
      END IF;
    END IF;
  END LOOP;

  RETURN lpad((v_max + 1)::text, GREATEST(4, length((v_max + 1)::text)), '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_pr2_sequence(int) TO authenticated;
