-- Phase 5: manual PO send audit (Goods workflow)
ALTER TABLE po_requests
  ADD COLUMN IF NOT EXISTS sent_by_id uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;
