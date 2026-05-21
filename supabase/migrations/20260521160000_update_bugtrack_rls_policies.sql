-- Update Bug Track RLS Policies to restrict viewing to admins only
-- Drop existing policies
DROP POLICY IF EXISTS "Everyone can view all bugs" ON public.bug_reports;

-- Create new policies
-- 1. Only admins can view all bugs
CREATE POLICY "Admins can view all bugs" 
ON public.bug_reports FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        JOIN public.roles ON profiles.role_id = roles.id
        WHERE profiles.id = auth.uid() 
        AND (roles.name = 'admin' OR roles.name = 'superadmin')
    )
);

-- 2. Users can view only their own bug reports (optional - for transparency)
-- Uncomment if you want users to see their own submitted bugs
-- CREATE POLICY "Users can view their own bugs" 
-- ON public.bug_reports FOR SELECT 
-- USING (reporter_id = auth.uid());
