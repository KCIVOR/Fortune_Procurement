-- Migration: 20260731084000_warehouse_pr2_archive_rls.sql

-- Allow warehouse to read pr2_requests_archive
CREATE POLICY "Warehouse can view pr2_requests_archive"
ON public.pr2_requests_archive
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'warehouse'
  )
);

-- Note: We might also need policies for pr2_items_archive if warehouse needs to read the items
CREATE POLICY "Warehouse can view pr2_items_archive"
ON public.pr2_items_archive
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON r.id = p.role_id
    WHERE p.id = auth.uid() AND r.name = 'warehouse'
  )
);
