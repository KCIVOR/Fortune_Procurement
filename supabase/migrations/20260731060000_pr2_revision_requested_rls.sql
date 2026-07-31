/*
  # Phase 5a — Widen Planning UPDATE policy to accept revision_requested

  Bug #6 / revision-workflow-fixes-plan.md Phase 5a, item 4.

  The "Planning can update own draft raw material PR2 requests" policy currently
  gates on `status = 'draft'` in its USING clause. Once Phase 5b writes
  `status = 'revision_requested'` for bounced-back PR2s, Planning users would
  be unable to edit their own revision-requested PR2s without this widening.

  This is a safe, no-op widening: nothing writes 'revision_requested' until
  Phase 5b lands, so this change is observable-inert on its own.

  The WITH CHECK clause is unchanged — it already does not restrict by status.
  The DELETE policy is intentionally left as `status = 'draft'` only:
  a PR2 that has been through an approval cycle should not be silently deletable.
*/

DROP POLICY IF EXISTS "Planning can update own draft raw material PR2 requests" ON public.pr2_requests;

CREATE POLICY "Planning can update own draft raw material PR2 requests"
  ON public.pr2_requests
  FOR UPDATE
  USING (
    requisitioner_id = auth.uid()
    AND request_type IN ('raw_material', 'services')
    AND status IN ('draft', 'revision_requested')
  )
  WITH CHECK (
    requisitioner_id = auth.uid()
    AND request_type IN ('raw_material', 'services')
  );
