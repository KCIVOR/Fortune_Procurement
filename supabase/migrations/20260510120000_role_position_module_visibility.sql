/*
  # role_position_module_visibility

  Admin-configurable sidebar module visibility by role and optional position.
  Does not affect route access, API permissions, or RLS.
*/

CREATE TABLE public.role_position_module_visibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles (id) ON DELETE CASCADE,
  position_id uuid REFERENCES public.positions (id) ON DELETE CASCADE,
  module_key text NOT NULL,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- CHECK cannot use subqueries in PostgreSQL; enforce with a trigger instead.
CREATE OR REPLACE FUNCTION public.rpamv_enforce_position_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.position_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.positions p
      WHERE p.id = NEW.position_id AND p.role_id = NEW.role_id
    ) THEN
      RAISE EXCEPTION 'position_id must reference a position whose role_id matches role_id';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER rpamv_enforce_position_role
  BEFORE INSERT OR UPDATE OF role_id, position_id ON public.role_position_module_visibility
  FOR EACH ROW
  EXECUTE PROCEDURE public.rpamv_enforce_position_role();

CREATE INDEX rpamv_role_id_idx ON public.role_position_module_visibility (role_id);
CREATE INDEX rpamv_lookup_idx ON public.role_position_module_visibility (role_id, module_key);

-- Role-wide default: one row per (role_id, module_key) when position_id is null
CREATE UNIQUE INDEX rpamv_unique_role_module_null_position
  ON public.role_position_module_visibility (role_id, module_key)
  WHERE position_id IS NULL;

-- Position override: one row per (role_id, position_id, module_key)
CREATE UNIQUE INDEX rpamv_unique_role_position_module
  ON public.role_position_module_visibility (role_id, position_id, module_key)
  WHERE position_id IS NOT NULL;

ALTER TABLE public.role_position_module_visibility ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY "Admins manage role_position_module_visibility"
  ON public.role_position_module_visibility
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles admin_profile
      JOIN public.roles admin_role ON admin_profile.role_id = admin_role.id
      WHERE admin_profile.id = auth.uid()
        AND admin_role.name = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles admin_profile
      JOIN public.roles admin_role ON admin_profile.role_id = admin_role.id
      WHERE admin_profile.id = auth.uid()
        AND admin_role.name = 'admin'
    )
  );

-- Non-admin: read rules that apply to their own role assignment
CREATE POLICY "Users read applicable module visibility rules"
  ON public.role_position_module_visibility
  FOR SELECT
  TO authenticated
  USING (
    role_id = (SELECT p.role_id FROM public.profiles p WHERE p.id = auth.uid())
    AND (
      position_id IS NULL
      OR position_id = (SELECT p.position_id FROM public.profiles p WHERE p.id = auth.uid())
    )
  );
