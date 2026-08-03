/*
  PR2-native substitute decisions

  - Allow substitute_decisions rows keyed to pr2_requests (Planning-direct / raw-mat RFQs)
  - Keep all existing PR1 rows valid (pr1_id set, pr2_id null)
  - Exactly one parent enforced by CHECK
  - Add PR2 requestor SELECT/INSERT/UPDATE policies; leave PR1 + procurement policies untouched
*/

-- 1) Parent columns
ALTER TABLE public.substitute_decisions
  ALTER COLUMN pr1_id DROP NOT NULL;

ALTER TABLE public.substitute_decisions
  ADD COLUMN IF NOT EXISTS pr2_id uuid REFERENCES public.pr2_requests(id) ON DELETE CASCADE;

-- 2) Exactly one parent (PR1 XOR PR2)
ALTER TABLE public.substitute_decisions
  DROP CONSTRAINT IF EXISTS substitute_decisions_exactly_one_parent;

ALTER TABLE public.substitute_decisions
  ADD CONSTRAINT substitute_decisions_exactly_one_parent
  CHECK (
    (pr1_id IS NOT NULL AND pr2_id IS NULL)
    OR (pr1_id IS NULL AND pr2_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS substitute_decisions_pr2_id_idx
  ON public.substitute_decisions(pr2_id);

-- 3) PR2 requestor SELECT (additive — OR with existing policies)
DROP POLICY IF EXISTS "Requestor can view own pr2 substitute decisions" ON public.substitute_decisions;
CREATE POLICY "Requestor can view own pr2 substitute decisions"
  ON public.substitute_decisions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pr2_requests pr
      WHERE pr.id = substitute_decisions.pr2_id
        AND pr.requisitioner_id = auth.uid()
    )
  );

-- 4) PR2 requestor INSERT
DROP POLICY IF EXISTS "Requestor can insert pr2 substitute decisions" ON public.substitute_decisions;
CREATE POLICY "Requestor can insert pr2 substitute decisions"
  ON public.substitute_decisions FOR INSERT
  TO authenticated
  WITH CHECK (
    decided_by = auth.uid()
    AND pr2_id IS NOT NULL
    AND pr1_id IS NULL
    AND EXISTS (
      SELECT 1 FROM public.pr2_requests pr
      WHERE pr.id = substitute_decisions.pr2_id
        AND pr.requisitioner_id = auth.uid()
    )
  );

-- 5) PR2 requestor UPDATE (mirror PR1 override-friendly USING; attribution via WITH CHECK)
DROP POLICY IF EXISTS "Requestor can update own pr2 substitute decisions" ON public.substitute_decisions;
CREATE POLICY "Requestor can update own pr2 substitute decisions"
  ON public.substitute_decisions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pr2_requests pr
      WHERE pr.id = substitute_decisions.pr2_id
        AND pr.requisitioner_id = auth.uid()
    )
  )
  WITH CHECK (
    decided_by = auth.uid()
    AND pr2_id IS NOT NULL
    AND pr1_id IS NULL
  );
