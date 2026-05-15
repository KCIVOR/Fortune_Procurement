CREATE TABLE IF NOT EXISTS public.bugtrack_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_email TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure only one row exists using a unique constraint on a constant value
-- PostgreSQL allows indexing on expressions
CREATE UNIQUE INDEX bugtrack_settings_single_row_idx ON public.bugtrack_settings ((true));

-- Seed the initial row
INSERT INTO public.bugtrack_settings (notification_email) VALUES (NULL);

-- Enable RLS
ALTER TABLE public.bugtrack_settings ENABLE ROW LEVEL SECURITY;

-- 1. Everyone can view settings
CREATE POLICY "Everyone can view bugtrack settings" 
ON public.bugtrack_settings FOR SELECT 
USING (true);

-- 2. Only admins can update
CREATE POLICY "Admins can update bugtrack settings" 
ON public.bugtrack_settings FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        JOIN public.roles ON profiles.role_id = roles.id
        WHERE profiles.id = auth.uid() 
        AND roles.name = 'admin'
    )
);

CREATE TRIGGER update_bugtrack_settings_updated_at
    BEFORE UPDATE ON public.bugtrack_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
