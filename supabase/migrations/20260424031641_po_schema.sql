/*
  # Purchase Order (PO) Schema

  ## Summary
  Creates the po_requests and po_items tables to support PO generation from
  approved PR2 documents. A Buyer manually fills in warehouse, terms, and
  packing details. Items are carried forward from the approved PR2.

  ## New Tables

  ### po_requests
  Header record for a Purchase Order.
  - id: UUID primary key
  - po_number: auto-generated sequential PO number (PO-YYYY-NNNN)
  - pr2_id: FK to pr2_requests (source document)
  - pr2_number_snapshot: snapshot of PR2 number at generation time
  - pr1_number_snapshot: snapshot of PR1 number
  - rfq_number_snapshot: snapshot of RFQ number
  - supplier_name_snapshot: supplier name from PR2 (single supplier per PO)
  - requisitioner_name_snapshot: from PR2
  - department_name_snapshot: from PR2
  - purpose: from PR2
  - date_required: from PR2
  - delivery_address: buyer-entered
  - warehouse: buyer-selected warehouse name
  - payment_terms: buyer-entered (e.g. "30 days net")
  - packing: buyer-entered packing instructions
  - remarks: optional notes
  - status: draft | for_approval | approved | sent | cancelled
  - generated_by: FK to auth.users (Buyer who created the PO)
  - generated_at: timestamp

  ### po_items
  Line items carried forward from PR2.
  - id: UUID primary key
  - po_id: FK to po_requests
  - pr2_item_id: FK to pr2_items (source item)
  - item_order: display order
  - item_code: from PR2 item
  - description: from PR2 item
  - unit_of_measure: from PR2 item
  - quantity_to_purchase: from PR2 item
  - unit_price: agreed price from PR2 item
  - total_price: computed = quantity_to_purchase * unit_price
  - supplier_name_snapshot: per-item supplier (supports multi-supplier POs in future)
  - remarks: optional

  ## Security
  - RLS enabled on both tables
  - procurement role: full read + insert + update own POs
  - approver role: read-only
  - All authenticated users can read (for cross-role visibility)

  ## Notes
  - One PO per PR2 (enforced by unique constraint on pr2_id)
  - po_number auto-generated via trigger
  - status 'draft' on creation; approval flow is Step 11
*/

-- ─── po_requests ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS po_requests (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number                   text NOT NULL UNIQUE,
  pr2_id                      uuid NOT NULL REFERENCES pr2_requests(id),
  pr2_number_snapshot         text NOT NULL DEFAULT '',
  pr1_number_snapshot         text NOT NULL DEFAULT '',
  rfq_number_snapshot         text NOT NULL DEFAULT '',
  supplier_name_snapshot      text NOT NULL DEFAULT '',
  requisitioner_name_snapshot text NOT NULL DEFAULT '',
  department_name_snapshot    text NOT NULL DEFAULT '',
  purpose                     text NOT NULL DEFAULT '',
  date_required               date NOT NULL,
  delivery_address            text NOT NULL DEFAULT '',
  warehouse                   text NOT NULL DEFAULT '',
  payment_terms               text NOT NULL DEFAULT '',
  packing                     text NOT NULL DEFAULT '',
  remarks                     text,
  status                      text NOT NULL DEFAULT 'draft',
  generated_by                uuid REFERENCES auth.users(id),
  generated_at                timestamptz NOT NULL DEFAULT now(),
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

-- One PO per PR2
CREATE UNIQUE INDEX IF NOT EXISTS po_requests_pr2_id_key ON po_requests(pr2_id);

-- ─── po_items ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS po_items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id                   uuid NOT NULL REFERENCES po_requests(id) ON DELETE CASCADE,
  pr2_item_id             uuid REFERENCES pr2_items(id),
  item_order              integer NOT NULL DEFAULT 1,
  item_code               text NOT NULL DEFAULT '',
  description             text NOT NULL DEFAULT '',
  unit_of_measure         text NOT NULL DEFAULT '',
  quantity_to_purchase    numeric(12,2) NOT NULL DEFAULT 0,
  unit_price              numeric(14,2) NOT NULL DEFAULT 0,
  total_price             numeric(14,2) NOT NULL DEFAULT 0,
  supplier_name_snapshot  text NOT NULL DEFAULT '',
  remarks                 text,
  created_at              timestamptz NOT NULL DEFAULT now()
);

-- ─── PO number generator ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  yr    text;
  seq   integer;
  newno text;
BEGIN
  yr  := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(
    CASE
      WHEN po_number ~ ('^PO-' || yr || '-[0-9]{4}$')
      THEN (regexp_match(po_number, '[0-9]{4}$'))[1]::integer
      ELSE 0
    END
  ), 0) + 1
  INTO seq
  FROM po_requests
  WHERE po_number LIKE 'PO-' || yr || '-%';

  newno := 'PO-' || yr || '-' || lpad(seq::text, 4, '0');
  NEW.po_number := newno;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_po_number ON po_requests;
CREATE TRIGGER trg_po_number
  BEFORE INSERT ON po_requests
  FOR EACH ROW
  WHEN (NEW.po_number IS NULL OR NEW.po_number = '')
  EXECUTE FUNCTION generate_po_number();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE po_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE po_items    ENABLE ROW LEVEL SECURITY;

-- po_requests: procurement can read all
CREATE POLICY "Procurement can read all POs"
  ON po_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- po_requests: approver can read all
CREATE POLICY "Approvers can read all POs"
  ON po_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'approver'
    )
  );

-- po_requests: procurement can insert
CREATE POLICY "Procurement can insert POs"
  ON po_requests FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- po_requests: procurement can update
CREATE POLICY "Procurement can update POs"
  ON po_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- po_items: procurement can read all
CREATE POLICY "Procurement can read all PO items"
  ON po_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- po_items: approver can read all
CREATE POLICY "Approvers can read all PO items"
  ON po_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'approver'
    )
  );

-- po_items: procurement can insert
CREATE POLICY "Procurement can insert PO items"
  ON po_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

-- po_items: procurement can update
CREATE POLICY "Procurement can update PO items"
  ON po_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );
