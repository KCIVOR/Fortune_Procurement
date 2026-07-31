-- Migration: 20260731080000_fix_pr2_archive_constraint.sql

ALTER TABLE pr2_requests_archive 
  DROP CONSTRAINT IF EXISTS pr2_requests_archive_status_check;

ALTER TABLE pr2_requests_archive
  ADD CONSTRAINT pr2_requests_archive_status_check 
  CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'revision_requested'));
