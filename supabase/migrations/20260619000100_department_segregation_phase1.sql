/*
  # Department Segregation — Phase 1: Schema, Indexes, Backfill & RLS

  Isolates approver-role users to their own department's PR1 / PR2 / PO records.
  Procurement, warehouse, and admin roles remain cross-department.
  Director and Finance Director positions are exempted (company-wide approvers).

  ## Changes

  ### 1a — Add department_id to po_requests
  po_requests is the only request table missing this column.
  Nullable so existing rows without a match do not break fetches.

  ### 1b — Performance indexes
  Indexes on the department_id column of all three request tables.

  ### 1c — Backfill po_requests.department_id
  Map from the source pr2_requests row via pr2_id.

  ### 1d — RLS policy updates
  - can_read_pr1: add department check for approver role
  - pr2_requests SELECT + UPDATE: replace blanket approver policy with dept-scoped one
  - pr2_items SELECT: replace blanket approver policy with dept-scoped one
  - po_requests SELECT + UPDATE: replace blanket approver policy with dept-scoped one
  - po_items SELECT: replace blanket approver policy with dept-scoped one
*/

-- ─── 1a: Add department_id to po_requests ────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'po_requests' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE public.po_requests
      ADD COLUMN department_id uuid REFERENCES public.departments(id);
  END IF;
END $$;

-- ─── 1b: Performance indexes ─────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_pr1_requests_department_id ON public.pr1_requests(department_id);
CREATE INDEX IF NOT EXISTS idx_pr2_requests_department_id ON public.pr2_requests(department_id);
CREATE INDEX IF NOT EXISTS idx_po_requests_department_id  ON public.po_requests(department_id);

-- ─── 1c: Backfill po_requests.department_id from pr2_requests ────────────────

UPDATE public.po_requests po
SET department_id = pr2.department_id
FROM public.pr2_requests pr2
WHERE po.pr2_id = pr2.id
  AND po.department_id IS NULL;

-- ─── 1d: Tighten RLS — PR1 ───────────────────────────────────────────────────
-- Add department filter to can_read_pr1 for the approver role.
-- Directors / Finance Directors remain unrestricted.

CREATE OR REPLACE FUNCTION public.can_read_pr1(p_pr1_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pr1_requests pr
    WHERE pr.id = p_pr1_id
      AND (
        pr.requisitioner_id = auth.uid()
        OR public.is_role('admin')
        OR public.is_role('procurement')
        OR (
          public.is_role('warehouse')
          AND (
            pr.status IN ('pending_warehouse', 'approved_for_warehouse')
            OR EXISTS (
              SELECT 1
              FROM public.warehouse_validations wv
              WHERE wv.pr1_id = pr.id
            )
          )
        )
        OR (
          public.is_role('approver')
          AND (
            -- Directors and Finance Directors see all departments
            EXISTS (
              SELECT 1
              FROM public.profiles p
              LEFT JOIN public.positions pos ON pos.id = p.position_id
              WHERE p.id = auth.uid()
                AND pos.title IN ('Director', 'Finance Director')
            )
            OR pr.department_id = (
              SELECT department_id FROM public.profiles WHERE id = auth.uid()
            )
          )
          AND EXISTS (
            SELECT 1
            FROM public.approval_instances ai
            WHERE ai.document_type = 'PR1'
              AND ai.document_id = pr.id
          )
        )
        OR public.is_supplier_assigned_to_pr1(p_pr1_id)
      )
  );
$$;

-- ─── 1d: Tighten RLS — PR2 requests ─────────────────────────────────────────

DROP POLICY IF EXISTS "Approvers can read all PR2 requests" ON public.pr2_requests;
CREATE POLICY "Approvers can read own department PR2 requests"
  ON public.pr2_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      LEFT JOIN public.positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid()
        AND r.name = 'approver'
        AND (
          pos.title IN ('Director', 'Finance Director')
          OR p.department_id = pr2_requests.department_id
        )
    )
  );

DROP POLICY IF EXISTS "Approvers can update PR2 request status" ON public.pr2_requests;
CREATE POLICY "Approvers can update own department PR2 requests"
  ON public.pr2_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      LEFT JOIN public.positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid()
        AND r.name = 'approver'
        AND (
          pos.title IN ('Director', 'Finance Director')
          OR p.department_id = pr2_requests.department_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      LEFT JOIN public.positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid()
        AND r.name = 'approver'
        AND (
          pos.title IN ('Director', 'Finance Director')
          OR p.department_id = pr2_requests.department_id
        )
    )
  );

-- ─── 1d: Tighten RLS — PR2 items ─────────────────────────────────────────────
-- Mirror parent PR2 access: approver only sees items belonging to their dept.

DROP POLICY IF EXISTS "Approvers can read all PR2 items" ON public.pr2_items;
CREATE POLICY "Approvers can read own department PR2 items"
  ON public.pr2_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pr2_requests pr2
      JOIN public.profiles p ON p.id = auth.uid()
      JOIN public.roles r ON r.id = p.role_id
      LEFT JOIN public.positions pos ON pos.id = p.position_id
      WHERE pr2.id = pr2_items.pr2_id
        AND r.name = 'approver'
        AND (
          pos.title IN ('Director', 'Finance Director')
          OR p.department_id = pr2.department_id
        )
    )
  );

-- ─── 1d: Tighten RLS — PO requests ───────────────────────────────────────────

DROP POLICY IF EXISTS "Approvers can read all POs" ON public.po_requests;
CREATE POLICY "Approvers can read own department POs"
  ON public.po_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      LEFT JOIN public.positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid()
        AND r.name = 'approver'
        AND (
          pos.title IN ('Director', 'Finance Director')
          OR po_requests.department_id IS NULL
          OR p.department_id = po_requests.department_id
        )
    )
  );

DROP POLICY IF EXISTS "Approvers can update PO status during approval" ON public.po_requests;
CREATE POLICY "Approvers can update own department POs during approval"
  ON public.po_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      LEFT JOIN public.positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid()
        AND r.name = 'approver'
        AND (
          pos.title IN ('Director', 'Finance Director')
          OR po_requests.department_id IS NULL
          OR p.department_id = po_requests.department_id
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      LEFT JOIN public.positions pos ON pos.id = p.position_id
      WHERE p.id = auth.uid()
        AND r.name = 'approver'
        AND (
          pos.title IN ('Director', 'Finance Director')
          OR po_requests.department_id IS NULL
          OR p.department_id = po_requests.department_id
        )
    )
  );

-- ─── 1d: Tighten RLS — PO items ───────────────────────────────────────────────
-- Mirror parent PO access: approver only sees items belonging to their dept.

DROP POLICY IF EXISTS "Approvers can read all PO items" ON public.po_items;
CREATE POLICY "Approvers can read own department PO items"
  ON public.po_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.po_requests po
      JOIN public.profiles p ON p.id = auth.uid()
      JOIN public.roles r ON r.id = p.role_id
      LEFT JOIN public.positions pos ON pos.id = p.position_id
      WHERE po.id = po_items.po_id
        AND r.name = 'approver'
        AND (
          pos.title IN ('Director', 'Finance Director')
          OR po.department_id IS NULL
          OR p.department_id = po.department_id
        )
    )
  );
