/*
  # Substitute item decisions

  1. New Tables
    - `substitute_decisions`
      - `id` (uuid, primary key)
      - `rfq_item_quote_id` (uuid, FK → rfq_item_quotes.id, UNIQUE — one decision per quoted alternative)
      - `pr1_id` (uuid, FK → pr1_requests.id — denormalised for requestor RLS scoping)
      - `decision` (text, check in 'accepted' | 'rejected')
      - `decided_by` (uuid, FK → profiles.id — the requestor who decided)
      - `decided_at` (timestamptz)
      - `notes` (text, optional rationale)
      - `created_at` (timestamptz, default now)

  2. Purpose
    When a supplier submits a quotation with `is_alternative = true`, the original
    PR1 requestor must accept or reject the substitute before procurement can
    select that quote as the winning bid for the item.

  3. Security
    - RLS enabled
    - Requestor (PR1 owner) can SELECT / INSERT / UPDATE decisions for their own PR1
    - Procurement can SELECT all decisions (to block/allow winner selection in the matrix)
    - No DELETE policies — decisions are an audit trail
*/

CREATE TABLE IF NOT EXISTS substitute_decisions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_item_quote_id  uuid NOT NULL UNIQUE REFERENCES rfq_item_quotes(id) ON DELETE CASCADE,
  pr1_id             uuid NOT NULL REFERENCES pr1_requests(id) ON DELETE CASCADE,
  decision           text NOT NULL CHECK (decision IN ('accepted','rejected')),
  decided_by         uuid NOT NULL REFERENCES profiles(id),
  decided_at         timestamptz NOT NULL DEFAULT now(),
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS substitute_decisions_pr1_id_idx ON substitute_decisions(pr1_id);
CREATE INDEX IF NOT EXISTS substitute_decisions_quote_id_idx ON substitute_decisions(rfq_item_quote_id);

ALTER TABLE substitute_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Requestor can view own substitute decisions" ON substitute_decisions;
CREATE POLICY "Requestor can view own substitute decisions"
  ON substitute_decisions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pr1_requests pr
      WHERE pr.id = substitute_decisions.pr1_id
        AND pr.requisitioner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Procurement can view all substitute decisions" ON substitute_decisions;
CREATE POLICY "Procurement can view all substitute decisions"
  ON substitute_decisions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'procurement'
    )
  );

DROP POLICY IF EXISTS "Requestor can insert substitute decisions" ON substitute_decisions;
CREATE POLICY "Requestor can insert substitute decisions"
  ON substitute_decisions FOR INSERT
  TO authenticated
  WITH CHECK (
    decided_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM pr1_requests pr
      WHERE pr.id = substitute_decisions.pr1_id
        AND pr.requisitioner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Requestor can update own substitute decisions" ON substitute_decisions;
CREATE POLICY "Requestor can update own substitute decisions"
  ON substitute_decisions FOR UPDATE
  TO authenticated
  USING (
    decided_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM pr1_requests pr
      WHERE pr.id = substitute_decisions.pr1_id
        AND pr.requisitioner_id = auth.uid()
    )
  )
  WITH CHECK (
    decided_by = auth.uid()
  );
