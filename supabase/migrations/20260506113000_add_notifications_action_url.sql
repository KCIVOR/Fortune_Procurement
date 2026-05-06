-- Add nullable action_url to notifications for direct inbox navigation links.
-- No RLS changes, no index, no other tables modified.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS action_url TEXT;
