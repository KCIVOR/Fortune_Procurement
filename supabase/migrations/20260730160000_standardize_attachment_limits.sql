/*
  Standardize file-size limits across all attachment/document storage buckets
  to 10 MB, matching the other five buckets (pr1-attachments, pr2-item-
  attachments, rfq-attachments, message-attachments, delivery-receipts).

  'compliance-documents' and 'supplier-accreditation-documents' were the only
  two buckets set to 20 MB — no functional reason for the discrepancy, just
  drift between migrations authored at different times. Per-request/per-item
  attachment COUNT caps (3 max) are enforced in application code (component
  state for multi-select surfaces, a pre-insert count check in
  lib/accreditation-documents.ts for the single-file-at-a-time surfaces) —
  Supabase Storage bucket config has no native "max objects per prefix"
  setting, so count limits can't be expressed here.
*/

UPDATE storage.buckets
SET file_size_limit = 10485760 -- 10 MB
WHERE id IN ('compliance-documents', 'supplier-accreditation-documents');
