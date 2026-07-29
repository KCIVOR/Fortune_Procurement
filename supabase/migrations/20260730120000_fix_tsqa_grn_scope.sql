/*
  Two problems found together:

  1. Drift: "TSQA can read all GRNs" / "TSQA can read GRN items" /
     "TSQA can update GRN items" exist live in the database but were never
     captured in a migration file. They grant TSQA unrestricted read (and,
     for grn_items, unrestricted UPDATE) on every GRN/item regardless of
     whether it requires QA — a least-privilege violation.

  2. The actual reported bug: "Send to QA" works for both goods and
     services GRNs (app/grn/[id]/page.tsx), but the *intended* scoped TSQA
     policies ("TSQA can read goods GRNs pending QA" etc.) only covered
     request_type = 'goods'. Services GRNs sent to QA were invisible to
     TSQA's queue via the scoped policies, and only "worked" by accident
     because of the overly-broad drifted policies above.

  Fix: drop the overly-broad drifted policies and replace the scoped
  policies with versions that drop the goods-only restriction (visibility
  is already correctly gated by requires_qa / qa_status), so both goods
  and services GRNs with QA-flagged items are visible/updatable by TSQA,
  and nothing else is.
*/

DROP POLICY IF EXISTS "TSQA can read all GRNs" ON public.grn_receipts;
DROP POLICY IF EXISTS "TSQA can read GRN items" ON public.grn_items;
DROP POLICY IF EXISTS "TSQA can update GRN items" ON public.grn_items;

DROP POLICY IF EXISTS "TSQA can read goods GRNs pending QA" ON public.grn_receipts;
CREATE POLICY "TSQA can read GRNs pending QA"
  ON public.grn_receipts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND (
      status = 'pending_qa'
      OR public.grn_has_pending_qa_item(id)
      OR public.grn_has_qa_item(id)
    )
  );

DROP POLICY IF EXISTS "TSQA can read goods GRN items pending QA" ON public.grn_items;
CREATE POLICY "TSQA can read GRN items requiring QA"
  ON public.grn_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND requires_qa = true
  );

DROP POLICY IF EXISTS "TSQA can update goods GRN items for QA" ON public.grn_items;
CREATE POLICY "TSQA can update GRN items for QA"
  ON public.grn_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND requires_qa = true
    AND qa_status = 'pending'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.roles r ON r.id = p.role_id
      WHERE p.id = auth.uid() AND r.name = 'tsqa'
    )
    AND requires_qa = true
  );
