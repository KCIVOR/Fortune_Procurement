/*
  Allow PDF uploads alongside images on the two request-attachment buckets
  used by Employee (PR1) and Planning (raw-material PR2) request creation.

  Previously both buckets only accepted image/jpeg, image/png, image/gif,
  image/webp (set in 20260618000300_pr1_attachments.sql and
  20260728191734_raw_material_pr2_item_attachments.sql). Requestors need to
  attach quotes/specs that are often PDFs.

  File-size limit (10 MB) and the application-level 3-attachment cap are
  unaffected by this change.
*/

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf'
]::text[]
WHERE id IN ('pr1-attachments', 'pr2-item-attachments');
