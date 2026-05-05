/*
  # PO Number: switch from auto-generated to buyer-entered

  ## Summary
  The business requirement is that the Buyer manually enters the PO number.
  Previously a BEFORE INSERT trigger auto-generated it when the field was empty.
  This migration drops that trigger so the application must supply the value.

  The UNIQUE constraint on po_number is retained — duplicate PO numbers are
  still rejected at the DB level.

  ## Changes
  - Drop trg_po_number trigger on po_requests
  - Drop generate_po_number function
  - The po_number column remains NOT NULL UNIQUE — application must provide it
*/

DROP TRIGGER IF EXISTS trg_po_number ON po_requests;
DROP FUNCTION IF EXISTS generate_po_number();
