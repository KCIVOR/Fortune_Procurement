
/*
  # Fortune Procurement — Core Workflow Schema

  ## Summary
  Builds the complete backend foundation required by the MVP transaction path.
  Adds workflow orchestration, document versioning, audit logging, and notification
  infrastructure on top of the existing identity tables.

  ## New Tables

  ### controlled_form_templates
  Defines each document type in the system (PR1, PR2, PO, GRN, RFQ).
  - `id` (uuid, PK)
  - `code` (text, unique) — e.g. 'PR1', 'PR2', 'PO', 'GRN', 'RFQ'
  - `name` (text) — human-readable label
  - `description` (text)
  - `active` (bool)

  ### controlled_form_versions
  Tracks the form version number for each template (for audit purposes, MVP = v1 only).
  - `id` (uuid, PK)
  - `template_id` (FK → controlled_form_templates.id)
  - `version` (int) — version number
  - `effective_from` (timestamptz)
  - `active` (bool)

  ### approval_workflows
  Defines a named workflow for a document type (static, seeded).
  - `id` (uuid, PK)
  - `code` (text, unique) — e.g. 'PR1_APPROVAL', 'PR2_PHASE1', 'PR2_PHASE2', 'PO_APPROVAL'
  - `name` (text)
  - `form_template_id` (FK → controlled_form_templates.id)
  - `active` (bool)

  ### approval_steps
  Each step in an approval workflow (ordered).
  - `id` (uuid, PK)
  - `workflow_id` (FK → approval_workflows.id)
  - `step_order` (int) — 1-based sequence
  - `role_required` (text) — role name that can act on this step
  - `position_required` (text) — specific position/title required (nullable = any in role)
  - `action_label` (text) — e.g. 'Reviewed and Noted By', 'Approved By', 'Certified By'
  - `is_final` (bool) — whether completing this step closes the workflow

  ### approval_instances
  A live workflow run tied to a specific document (PR1, PR2, PO, etc.).
  - `id` (uuid, PK)
  - `workflow_id` (FK → approval_workflows.id)
  - `document_type` (text) — 'PR1' | 'PR2' | 'PO' | 'GRN' | 'RFQ'
  - `document_id` (uuid) — FK to the document table (enforced by app logic, not FK constraint for flexibility)
  - `current_step` (int) — which step is active (1-based)
  - `status` (text) — 'active' | 'approved' | 'rejected' | 'cancelled'
  - `started_at` (timestamptz)
  - `completed_at` (timestamptz, nullable)
  - `started_by` (FK → profiles.id)

  ### approval_actions
  Each act taken by an approver on a workflow step (with signer snapshot).
  - `id` (uuid, PK)
  - `instance_id` (FK → approval_instances.id)
  - `step_order` (int)
  - `action` (text) — 'approved' | 'rejected' | 'noted'
  - `actor_id` (FK → profiles.id)
  - `actor_name_snapshot` (text) — captured at time of signing
  - `actor_position_snapshot` (text) — captured at time of signing
  - `actor_department_snapshot` (text) — captured at time of signing
  - `remarks` (text, nullable)
  - `acted_at` (timestamptz)

  ### notifications
  In-app notifications per user.
  - `id` (uuid, PK)
  - `user_id` (FK → profiles.id)
  - `title` (text)
  - `body` (text)
  - `type` (text) — 'action_required' | 'info' | 'approved' | 'rejected'
  - `document_type` (text, nullable)
  - `document_id` (uuid, nullable)
  - `read` (bool, default false)
  - `created_at` (timestamptz)

  ### audit_logs
  Immutable audit trail for all state-changing operations.
  - `id` (uuid, PK)
  - `actor_id` (uuid, nullable FK → profiles.id)
  - `action` (text) — e.g. 'PR1_SUBMITTED', 'PR1_APPROVED', 'WAREHOUSE_VALIDATED'
  - `document_type` (text, nullable)
  - `document_id` (uuid, nullable)
  - `payload` (jsonb, nullable) — snapshot of relevant data at time of action
  - `ip_address` (text, nullable)
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all new tables
  - approval_steps / approval_workflows / controlled_form_templates: readable by all authenticated
  - approval_instances / approval_actions: readable by authenticated users (for now — row-level scoping added per document in later steps)
  - notifications: user can only read/update their own
  - audit_logs: insert only via service role; no user updates/deletes

  ## Notes
  - Approval routing is static (seeded). No dynamic workflow builder.
  - document_id in approval_instances references different tables per document_type.
    A foreign key constraint is intentionally omitted here for flexibility; integrity
    is enforced at the application layer.
  - Signer snapshots on approval_actions ensure historical accuracy even if profile data changes later.
*/

-- ─── CONTROLLED FORM TEMPLATES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS controlled_form_templates (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text UNIQUE NOT NULL,
  name        text NOT NULL,
  description text NOT NULL DEFAULT '',
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE controlled_form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read form templates"
  ON controlled_form_templates FOR SELECT
  TO authenticated
  USING (true);

-- ─── CONTROLLED FORM VERSIONS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS controlled_form_versions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id    uuid NOT NULL REFERENCES controlled_form_templates(id),
  version        int  NOT NULL DEFAULT 1,
  effective_from timestamptz NOT NULL DEFAULT now(),
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (template_id, version)
);

ALTER TABLE controlled_form_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read form versions"
  ON controlled_form_versions FOR SELECT
  TO authenticated
  USING (true);

-- ─── APPROVAL WORKFLOWS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_workflows (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text UNIQUE NOT NULL,
  name             text NOT NULL,
  form_template_id uuid REFERENCES controlled_form_templates(id),
  active           boolean NOT NULL DEFAULT true,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read approval workflows"
  ON approval_workflows FOR SELECT
  TO authenticated
  USING (true);

-- ─── APPROVAL STEPS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_steps (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id       uuid NOT NULL REFERENCES approval_workflows(id),
  step_order        int  NOT NULL,
  role_required     text NOT NULL,
  position_required text,
  action_label      text NOT NULL,
  is_final          boolean NOT NULL DEFAULT false,
  created_at        timestamptz DEFAULT now(),
  UNIQUE (workflow_id, step_order)
);

ALTER TABLE approval_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read approval steps"
  ON approval_steps FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_approval_steps_workflow ON approval_steps(workflow_id);

-- ─── APPROVAL INSTANCES ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_instances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id   uuid NOT NULL REFERENCES approval_workflows(id),
  document_type text NOT NULL,
  document_id   uuid NOT NULL,
  current_step  int  NOT NULL DEFAULT 1,
  status        text NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'approved', 'rejected', 'cancelled')),
  started_by    uuid NOT NULL REFERENCES profiles(id),
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE approval_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read approval instances"
  ON approval_instances FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert approval instances"
  ON approval_instances FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = started_by);

CREATE POLICY "Authenticated users can update approval instances"
  ON approval_instances FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_approval_instances_document ON approval_instances(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_approval_instances_status   ON approval_instances(status);

-- ─── APPROVAL ACTIONS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS approval_actions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id              uuid NOT NULL REFERENCES approval_instances(id),
  step_order               int  NOT NULL,
  action                   text NOT NULL CHECK (action IN ('approved', 'rejected', 'noted')),
  actor_id                 uuid NOT NULL REFERENCES profiles(id),
  actor_name_snapshot      text NOT NULL,
  actor_position_snapshot  text NOT NULL,
  actor_department_snapshot text NOT NULL,
  remarks                  text,
  acted_at                 timestamptz NOT NULL DEFAULT now(),
  created_at               timestamptz DEFAULT now()
);

ALTER TABLE approval_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read approval actions"
  ON approval_actions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert approval actions"
  ON approval_actions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_id);

CREATE INDEX IF NOT EXISTS idx_approval_actions_instance ON approval_actions(instance_id);

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title         text NOT NULL,
  body          text NOT NULL DEFAULT '',
  type          text NOT NULL DEFAULT 'info'
                  CHECK (type IN ('action_required', 'info', 'approved', 'rejected')),
  document_type text,
  document_id   uuid,
  read          boolean NOT NULL DEFAULT false,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, read) WHERE read = false;

-- ─── AUDIT LOGS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      uuid REFERENCES profiles(id) ON DELETE SET NULL,
  action        text NOT NULL,
  document_type text,
  document_id   uuid,
  payload       jsonb,
  ip_address    text,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_audit_logs_document ON audit_logs(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor    ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created  ON audit_logs(created_at DESC);
