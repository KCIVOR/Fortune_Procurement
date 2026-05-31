/*
  # Update GRN Number Format

  ## Overview
  Change GRN number format from GRN-YYYYMM-XXXX to GRN-YYYY-XXXX
  to match the format used by PR1, PR2, and PO numbers.

  ## Changes
  - Update generate_grn_number() function to use YYYY instead of YYYYMM
  
  ## Note
  - Existing GRN numbers will keep their old format
  - Only new GRNs will use the new format (GRN-YYYY-XXXX)
*/

-- Update the GRN number generation function
CREATE OR REPLACE FUNCTION generate_grn_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_seq int;
  v_prefix text;
BEGIN
  v_seq    := nextval('grn_number_seq');
  v_prefix := 'GRN-' || to_char(now(), 'YYYY');
  RETURN v_prefix || '-' || lpad(v_seq::text, 4, '0');
END;
$$;
