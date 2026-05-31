/*
  # Remove Department Head from PR2 Phase 1 Approval Workflow

  ## Summary
  Removes the Department Head step (Step 2 - "Certified By") from the
  PR2_PHASE1 approval workflow. This goes hand-in-hand with the removal
  of the auto-approval logic in `lib/pr2-approvals.ts`.

  ## Before (4 steps)
    Step 1: Procurement Staff   — Prepared By
    Step 2: Department Head     — Certified By   ← REMOVED
    Step 3: Procurement Manager — Reviewed By
    Step 4: Director            — Approved By (final)

  ## After (3 steps)
    Step 1: Procurement Staff   — Prepared By
    Step 2: Procurement Manager — Reviewed By     (renumbered from 3)
    Step 3: Director            — Approved By     (renumbered from 4, final)

  ## Migration Strategy
  1. Renumber `approval_actions.step_order` for historical records:
       - Existing step_order = 3  →  2
       - Existing step_order = 4  →  3
     (Existing step_order = 2 records, including auto-approved
      "Department Head (auto)" entries, are preserved as-is for audit
      history. After step renumbering they no longer reference a live
      workflow step but remain visible in the timeline.)

  2. Update `approval_instances.current_step` for ACTIVE Phase 1 runs:
       - current_step = 2  →  2 (skip Dept Head, advance to new Procurement Manager step)
       - current_step = 3  →  2
       - current_step = 4  →  3

  3. Delete `approval_steps` row for Step 2 (Department Head).

  4. Renumber remaining `approval_steps` rows:
       - step_order = 3  →  2
       - step_order = 4  →  3

  5. Insert audit log entry recording this schema change.

  ## Idempotency
  Wrapped in DO $$ ... $$ with guards. Safe to re-run; if Step 2 is
  already absent the renumbering is a no-op.

  ## Notes
  - `approval_steps.UNIQUE (workflow_id, step_order)` — handled by
    deleting Step 2 BEFORE renumbering Steps 3/4 down.
  - `approval_actions` are renumbered using a temporary offset to
    avoid colliding with the soon-to-be-deleted step_order = 2 rows
    when historical actions exist at multiple steps for the same
    instance.
*/

DO $$
DECLARE
  v_pr2p1_wf      uuid;
  v_step2_exists  boolean;
  v_active_at_2   int;
BEGIN
  -- Locate the PR2_PHASE1 workflow
  SELECT id
    INTO v_pr2p1_wf
    FROM approval_workflows
   WHERE code = 'PR2_PHASE1'
   LIMIT 1;

  IF v_pr2p1_wf IS NULL THEN
    RAISE NOTICE 'PR2_PHASE1 workflow not found — skipping migration.';
    RETURN;
  END IF;

  -- Detect whether Step 2 still exists (idempotency guard)
  SELECT EXISTS (
    SELECT 1
      FROM approval_steps
     WHERE workflow_id = v_pr2p1_wf
       AND step_order  = 2
       AND position_required = 'Department Head'
  ) INTO v_step2_exists;

  IF NOT v_step2_exists THEN
    RAISE NOTICE 'PR2_PHASE1 Step 2 (Department Head) already removed — skipping.';
    RETURN;
  END IF;

  -- 1) Renumber historical approval_actions
  --    Use a high temporary offset so we never collide with existing
  --    rows during the two-stage renumber.
  UPDATE approval_actions
     SET step_order = step_order + 100
   WHERE step_order IN (3, 4)
     AND instance_id IN (
       SELECT id FROM approval_instances WHERE workflow_id = v_pr2p1_wf
     );

  --    103 → 2, 104 → 3
  UPDATE approval_actions
     SET step_order = 2
   WHERE step_order = 103
     AND instance_id IN (
       SELECT id FROM approval_instances WHERE workflow_id = v_pr2p1_wf
     );

  UPDATE approval_actions
     SET step_order = 3
   WHERE step_order = 104
     AND instance_id IN (
       SELECT id FROM approval_instances WHERE workflow_id = v_pr2p1_wf
     );

  -- 2) Update active approval_instances current_step
  --    a) Anything currently sitting at the (about-to-be-deleted)
  --       Department Head step advances to the new Procurement
  --       Manager step (new step_order = 2).
  SELECT COUNT(*)
    INTO v_active_at_2
    FROM approval_instances
   WHERE workflow_id = v_pr2p1_wf
     AND current_step = 2
     AND status = 'active';

  IF v_active_at_2 > 0 THEN
    RAISE NOTICE 'Advancing % active PR2 Phase 1 instance(s) past the removed Department Head step.', v_active_at_2;
  END IF;

  --    Use the same offset trick to renumber active instances
  UPDATE approval_instances
     SET current_step = current_step + 100
   WHERE workflow_id = v_pr2p1_wf
     AND current_step IN (2, 3, 4)
     AND status = 'active';

  --    102 → 2 (was Dept Head, now Procurement Manager)
  --    103 → 2 (was Procurement Manager, still Procurement Manager)
  --    104 → 3 (was Director, still Director)
  UPDATE approval_instances
     SET current_step = 2
   WHERE workflow_id = v_pr2p1_wf
     AND current_step IN (102, 103)
     AND status = 'active';

  UPDATE approval_instances
     SET current_step = 3
   WHERE workflow_id = v_pr2p1_wf
     AND current_step = 104
     AND status = 'active';

  -- 3) Delete Step 2 (Department Head)
  DELETE FROM approval_steps
   WHERE workflow_id = v_pr2p1_wf
     AND step_order = 2;

  -- 4) Renumber remaining steps (3 → 2, 4 → 3) using offset
  UPDATE approval_steps
     SET step_order = step_order + 100
   WHERE workflow_id = v_pr2p1_wf
     AND step_order IN (3, 4);

  UPDATE approval_steps
     SET step_order = 2
   WHERE workflow_id = v_pr2p1_wf
     AND step_order = 103;

  UPDATE approval_steps
     SET step_order = 3
   WHERE workflow_id = v_pr2p1_wf
     AND step_order = 104;

  -- 5) Audit log
  INSERT INTO audit_logs (action, document_type, payload)
  VALUES (
    'WORKFLOW_MODIFIED',
    'PR2',
    jsonb_build_object(
      'workflow_code',  'PR2_PHASE1',
      'change',         'Removed Step 2 (Department Head — Certified By)',
      'reason',         'Streamline PR2 Phase 1 approval; remove auto-approval special case',
      'before_steps',   4,
      'after_steps',    3,
      'migrated_at',    now()
    )
  );

  RAISE NOTICE 'PR2_PHASE1 successfully reduced from 4 steps to 3 steps.';
END $$;

-- ─── Verification queries (run manually after migration) ─────────────────────
-- SELECT step_order, role_required, position_required, action_label, is_final
--   FROM approval_steps
--  WHERE workflow_id = (SELECT id FROM approval_workflows WHERE code = 'PR2_PHASE1')
--  ORDER BY step_order;
--
-- Expected result:
--   1 | procurement | Procurement Staff   | Prepared By | false
--   2 | procurement | Procurement Manager | Reviewed By | false
--   3 | approver    | Director            | Approved By | true
