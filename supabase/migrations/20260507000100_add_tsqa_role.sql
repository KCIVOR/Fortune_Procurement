/*
  # Add TSQA Role and Position

  ## Summary
  Adds the TSQA (Technical and Scientific Quality Assurance) role to the system.
  Required for the Supplier Accreditation + RSE + TSQA workflow (Phase 1).

  ## New Data
  - roles.name: tsqa
  - positions.title: TSQA Staff (linked to tsqa role)

  ## Notes
  - Does NOT remove or rename any existing role.
  - Existing role behavior is NOT changed.
  - No demo user is seeded here — create TSQA users via the Admin → User Management UI.
  - Admin role management RLS (20260429171158) already allows admin to manage roles
    through application layer; this migration only inserts the new data.
*/

DO $$
DECLARE
  v_tsqa_role_id uuid;
  v_pos_tsqa_staff uuid;
BEGIN

  -- ── Insert tsqa role if not present ──────────────────────────────────────
  SELECT id INTO v_tsqa_role_id FROM roles WHERE name = 'tsqa';
  IF v_tsqa_role_id IS NULL THEN
    INSERT INTO roles (name)
    VALUES ('tsqa')
    RETURNING id INTO v_tsqa_role_id;
  END IF;

  -- ── Insert TSQA Staff position if not present ─────────────────────────────
  SELECT id INTO v_pos_tsqa_staff FROM positions WHERE title = 'TSQA Staff';
  IF v_pos_tsqa_staff IS NULL THEN
    INSERT INTO positions (title, role_id)
    VALUES ('TSQA Staff', v_tsqa_role_id)
    RETURNING id INTO v_pos_tsqa_staff;
  END IF;

END $$;
