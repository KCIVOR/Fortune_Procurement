-- Wishlist: owner-scoped improvement requests with an admin triage queue.

CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  category text,
  status text NOT NULL DEFAULT 'open',
  admin_notes text,
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wishlist_items_title_nonblank CHECK (length(btrim(title)) > 0),
  CONSTRAINT wishlist_items_title_length CHECK (length(title) <= 160),
  CONSTRAINT wishlist_items_description_nonblank CHECK (length(btrim(description)) > 0),
  CONSTRAINT wishlist_items_description_length CHECK (length(description) <= 4000),
  CONSTRAINT wishlist_items_category_length CHECK (category IS NULL OR length(category) <= 80),
  CONSTRAINT wishlist_items_admin_notes_length CHECK (admin_notes IS NULL OR length(admin_notes) <= 4000),
  CONSTRAINT wishlist_items_status_check CHECK (status IN ('open', 'planned', 'in_progress', 'completed', 'declined'))
);

CREATE INDEX IF NOT EXISTS wishlist_items_user_created_idx
  ON public.wishlist_items (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wishlist_items_status_created_idx
  ON public.wishlist_items (status, created_at DESC);

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_wishlist_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'admin'
  );
$$;

CREATE POLICY "Wishlist owners and admins can read"
  ON public.wishlist_items FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_wishlist_admin());

CREATE POLICY "Authenticated users can submit own wishlist items"
  ON public.wishlist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'open'
    AND admin_notes IS NULL
    AND updated_by IS NULL
  );

CREATE POLICY "Owners can update open wishlist items"
  ON public.wishlist_items FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'open')
  WITH CHECK (user_id = auth.uid() AND status = 'open');

CREATE POLICY "Admins can update all wishlist items"
  ON public.wishlist_items FOR UPDATE
  TO authenticated
  USING (public.is_wishlist_admin())
  WITH CHECK (public.is_wishlist_admin());

CREATE POLICY "Owners can delete open wishlist items"
  ON public.wishlist_items FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND status = 'open');

CREATE OR REPLACE FUNCTION public.guard_wishlist_owner_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.user_id = auth.uid() AND NOT public.is_wishlist_admin() THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.admin_notes IS DISTINCT FROM OLD.admin_notes
      OR NEW.updated_by IS DISTINCT FROM OLD.updated_by THEN
      RAISE EXCEPTION 'Only admins may change wishlist workflow fields';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wishlist_items_guard_fields ON public.wishlist_items;
CREATE TRIGGER wishlist_items_guard_fields
  BEFORE UPDATE ON public.wishlist_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_wishlist_owner_fields();
