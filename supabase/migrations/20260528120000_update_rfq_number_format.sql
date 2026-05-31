/*
  # Update RFQ Number Format

  ## Overview
  Change RFQ number format from RFQ-YYYYMMDD-XXXX to RFQ-YYYY-XXXX
  to match the format used by PR1, PO, and GRN numbers.

  ## Changes
  - Update generate_rfq_number() function to use YYYY instead of YYYYMMDD
  
  ## Note
  - Existing RFQ numbers will keep their old format
  - Only new RFQs will use the new format (RFQ-YYYY-XXXX)
  - PR2 numbers are derived from RFQ numbers, so they will automatically
    use the new format (PR2-YYYY-XXXX) for new PR2s
*/

-- Update the RFQ number generation function
CREATE OR REPLACE FUNCTION generate_rfq_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 'RFQ-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('rfq_number_seq')::text, 4, '0');
$$;
