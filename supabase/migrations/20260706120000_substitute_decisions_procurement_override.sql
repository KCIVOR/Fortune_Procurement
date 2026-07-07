/*
  # Substitute decisions — procurement accept/reject on behalf of requestor

  1. Changes
    - Allow procurement to INSERT a substitute decision (decide on behalf of the requestor)
    - Allow procurement to UPDATE any substitute decision (override an existing decision)
    - Widen the requestor's own UPDATE policy so they can still change a decision after
      procurement acted on their behalf (drop the `decided_by = auth.uid()` restriction
      from USING; keep it in WITH CHECK so attribution always reflects the current actor)

  2. Rationale (Rev #5)
    Procurement needs to accept/reject a supplier's substitute on behalf of the requestor,
    and to override an existing decision either way (mutual override — confirmed with
    stakeholder). Postgres combines multiple permissive policies for the same command with
    OR, independently for USING and WITH CHECK. That means:
      - Combined USING  = is_role('procurement') OR owns_the_pr1
      - Combined WITH CHECK = decided_by = auth.uid()  (the role-qualified term is
        subsumed by the unconditional one below, so it collapses to this)
    i.e. anyone who can see the row (procurement, or the PR1 owner) can write it, and
    whoever writes it is always the one recorded as `decided_by` — correct attribution
    falls out of the policy combination automatically, no extra column needed.

  3. Security
    - No change to SELECT policies (already correct per prior audit)
    - No DELETE policy added — decisions remain an audit trail, unchanged
*/

DROP POLICY IF EXISTS "Procurement can insert substitute decisions" ON substitute_decisions;
CREATE POLICY "Procurement can insert substitute decisions"
  ON substitute_decisions FOR INSERT
  TO authenticated
  WITH CHECK (
    decided_by = auth.uid()
    AND is_role('procurement')
  );

DROP POLICY IF EXISTS "Procurement can update substitute decisions" ON substitute_decisions;
CREATE POLICY "Procurement can update substitute decisions"
  ON substitute_decisions FOR UPDATE
  TO authenticated
  USING (
    is_role('procurement')
  )
  WITH CHECK (
    decided_by = auth.uid()
    AND is_role('procurement')
  );

DROP POLICY IF EXISTS "Requestor can update own substitute decisions" ON substitute_decisions;
CREATE POLICY "Requestor can update own substitute decisions"
  ON substitute_decisions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pr1_requests pr
      WHERE pr.id = substitute_decisions.pr1_id
        AND pr.requisitioner_id = auth.uid()
    )
  )
  WITH CHECK (
    decided_by = auth.uid()
  );
