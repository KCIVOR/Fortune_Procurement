/*
  # RFQ number generator function
  Creates a stable SQL function that returns the next RFQ number using the sequence.
  Called from the app via supabase.rpc('generate_rfq_number').
*/
CREATE OR REPLACE FUNCTION generate_rfq_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 'RFQ-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('rfq_number_seq')::text, 4, '0');
$$;
