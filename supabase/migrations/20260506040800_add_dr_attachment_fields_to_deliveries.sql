/*
  # Add DR attachment fields to deliveries

  ## Purpose
  Supports Delivery Receipt (DR) file attachment by the supplier
  when transitioning a delivery to in_transit status.

  ## Changes
  Adds three nullable columns to deliveries only.
  No existing columns, constraints, policies, or indexes are modified.
  delivery_status_history is not touched.

  ## New columns on deliveries
  - dr_document_path        : Supabase Storage path for the uploaded DR file
  - dr_document_filename    : Original filename as uploaded (for human-readable display)
  - dr_document_uploaded_at : Timestamp when the DR file was stored
*/

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS dr_document_path        TEXT,
  ADD COLUMN IF NOT EXISTS dr_document_filename    TEXT,
  ADD COLUMN IF NOT EXISTS dr_document_uploaded_at TIMESTAMPTZ;
