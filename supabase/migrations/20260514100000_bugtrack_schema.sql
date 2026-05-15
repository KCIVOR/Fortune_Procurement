-- Create bug_reports table
CREATE TABLE IF NOT EXISTS public.bug_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT, -- "What I See"
    expected_behavior TEXT, -- "Expected"
    error_message TEXT,
    affected_user TEXT,
    location TEXT,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high')) DEFAULT 'medium',
    status TEXT CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')) DEFAULT 'open',
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    ai_prompt TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Everyone can view all bugs (Global tracking)
CREATE POLICY "Everyone can view all bugs" 
ON public.bug_reports FOR SELECT 
USING (true);

-- 2. Authenticated users can create bugs
CREATE POLICY "Authenticated users can create bugs" 
ON public.bug_reports FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Only admins can update status/severity or delete
CREATE POLICY "Admins can update bugs" 
ON public.bug_reports FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        JOIN public.roles ON profiles.role_id = roles.id
        WHERE profiles.id = auth.uid() 
        AND roles.name = 'admin'
    )
);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bug_reports_updated_at
    BEFORE UPDATE ON public.bug_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
