/*
  # Remove invoice_no from GRN

  ## Overview
  Client confirmed that Invoice No. is not part of the GRN workflow.
  This migration removes the invoice_no column from grn_receipts.

  ## Changes
  - Drop invoice_no column from grn_receipts table
*/

-- Drop the invoice_no column
ALTER TABLE grn_receipts DROP COLUMN IF EXISTS invoice_no;
