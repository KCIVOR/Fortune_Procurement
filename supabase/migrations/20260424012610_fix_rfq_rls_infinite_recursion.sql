/*
  # Fix infinite recursion in rfq_batches and rfq_suppliers RLS policies

  1. Problem
    The "Requestors can view rfq_batches for their own PR1s" policy subquery is
    safe in isolation. However the "Requestors can view rfq_suppliers for their
    own PR1s" policy references rfq_batches in its USING clause. When Postgres
    evaluates that subquery it applies RLS to rfq_batches again, which triggers
    the rfq_batches requestor policy, which re-evaluates — infinite recursion.

    PostgreSQL error: 42P17 "infinite recursion detected in policy for relation rfq_batches"

  2. Fix
    Replace the plain subquery policies with SECURITY DEFINER helper functions
    that bypass RLS when called from within a policy predicate. This breaks the
    recursive evaluation cycle.

  3. Security
    The helper functions are read-only and parameterised by auth.uid() at call
    time, so they cannot be abused to read other users' data.
*/

-- ── Helper: does auth.uid() own a given rfq_batch? ───────────────────────────
CREATE OR REPLACE FUNCTION is_own_rfq_batch(batch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM pr1_requests
    WHERE id = (SELECT pr1_id FROM rfq_batches WHERE id = batch_id LIMIT 1)
      AND requisitioner_id = auth.uid()
  );
$$;

-- ── Helper: does auth.uid() own the PR1 behind a given rfq_supplier row? ─────
CREATE OR REPLACE FUNCTION is_own_rfq_supplier(rs_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM rfq_suppliers rs
    JOIN rfq_batches rb ON rb.id = rs.rfq_id
    JOIN pr1_requests pr ON pr.id = rb.pr1_id
    WHERE rs.id = rs_id
      AND pr.requisitioner_id = auth.uid()
  );
$$;

-- ── Rebuild rfq_batches requestor policy using the helper ────────────────────
DROP POLICY IF EXISTS "Requestors can view rfq_batches for their own PR1s" ON rfq_batches;
CREATE POLICY "Requestors can view rfq_batches for their own PR1s"
  ON rfq_batches FOR SELECT
  TO authenticated
  USING ( is_own_rfq_batch(id) );

-- ── Rebuild rfq_suppliers requestor policy using the helper ──────────────────
DROP POLICY IF EXISTS "Requestors can view rfq_suppliers for their own PR1s" ON rfq_suppliers;
CREATE POLICY "Requestors can view rfq_suppliers for their own PR1s"
  ON rfq_suppliers FOR SELECT
  TO authenticated
  USING ( is_own_rfq_supplier(id) );

-- ── Rebuild rfq_item_quotes requestor policy using the helper ────────────────
DROP POLICY IF EXISTS "Requestors can view quotes for their own PR1s" ON rfq_item_quotes;
CREATE POLICY "Requestors can view quotes for their own PR1s"
  ON rfq_item_quotes FOR SELECT
  TO authenticated
  USING ( is_own_rfq_supplier(rfq_supplier_id) );
