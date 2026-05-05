/*
  # Add supplier_id to po_requests and fix supplier visibility RLS

  ## Problem
  The previous RLS policy "Supplier can read own linked POs" used a subquery that
  JOINed pr2_requests to check the rfq_suppliers chain. However, pr2_requests has no
  SELECT policy for the supplier role. When Supabase evaluates the subquery inside the
  po_requests RLS, it does so under the supplier's auth context — which means the
  pr2_requests scan returns zero rows, the EXISTS is false, and the supplier sees nothing.

  This is a cross-table RLS recursion problem: a policy on table A referencing table B
  only works if the user also has SELECT access on table B.

  ## Fix
  1. Add supplier_id UUID column to po_requests (FK to auth.users).
     This is the awarded supplier for this PO — set at PO generation time.
  2. Populate supplier_id for all existing POs using the supplier_name_snapshot
     matched against profiles.full_name.
  3. Drop the broken cross-table RLS policy and replace with a simple direct column check:
     supplier_id = auth.uid() AND status IN ('approved','sent').
  4. Drop and replace the supplier UPDATE policy the same way.

  ## Security
  - Supplier can only see their own POs (supplier_id = auth.uid())
  - Only approved/sent POs are visible (draft and for_approval are hidden)
  - Other suppliers cannot see each other's POs
*/

-- 1. Add supplier_id column
ALTER TABLE po_requests
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES auth.users(id);

-- 2. Populate supplier_id for existing POs by matching supplier_name_snapshot to profiles.full_name
UPDATE po_requests po
SET supplier_id = (
  SELECT profiles.id
  FROM profiles
  JOIN auth.users ON auth.users.id = profiles.id
  JOIN roles ON roles.id = profiles.role_id
  WHERE roles.name = 'supplier'
    AND profiles.full_name = po.supplier_name_snapshot
  LIMIT 1
)
WHERE supplier_id IS NULL
  AND supplier_name_snapshot IS NOT NULL
  AND supplier_name_snapshot <> '';

-- 3. Drop old broken cross-table RLS policies on po_requests for supplier
DROP POLICY IF EXISTS "Supplier can read own linked POs" ON po_requests;
DROP POLICY IF EXISTS "Supplier can update linked approved POs" ON po_requests;

-- 4. New simple supplier SELECT: direct supplier_id match, only approved/sent
CREATE POLICY "Supplier can read own approved POs"
  ON po_requests
  FOR SELECT
  TO authenticated
  USING (
    supplier_id = auth.uid()
    AND status IN ('approved', 'sent')
  );

-- 5. New simple supplier UPDATE: direct supplier_id match, only when approved
CREATE POLICY "Supplier can acknowledge own approved POs"
  ON po_requests
  FOR UPDATE
  TO authenticated
  USING (
    supplier_id = auth.uid()
    AND status = 'approved'
  )
  WITH CHECK (
    supplier_id = auth.uid()
  );

-- 6. Index for supplier_id lookups
CREATE INDEX IF NOT EXISTS idx_po_requests_supplier_id ON po_requests(supplier_id);
