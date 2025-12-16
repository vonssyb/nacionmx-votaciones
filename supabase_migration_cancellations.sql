-- Create table for Role Cancellations
CREATE TABLE IF NOT EXISTS public.rp_cancellations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    moderator_discord_id TEXT NOT NULL, -- Discord ID of the staff member
    moderator_name TEXT, -- Display name of the staff member
    target_user TEXT NOT NULL, -- Name/ID of the user who lost the role
    reason TEXT NOT NULL,
    location TEXT NOT NULL,
    proof_url_1 TEXT,
    proof_url_2 TEXT,
    proof_url_3 TEXT
);

-- Enable RLS
ALTER TABLE public.rp_cancellations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Enable read access for all users" ON public.rp_cancellations FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users only" ON public.rp_cancellations FOR INSERT WITH CHECK (auth.role() = 'authenticated' OR auth.role() = 'service_role');
CREATE POLICY "Enable update for service role only" ON public.rp_cancellations FOR UPDATE USING (auth.role() = 'service_role');

-- Create generic storage bucket for proofs if it doesn't exist (or just reuse existing logic in app)
-- We'll assume the 'cancellation-proofs' bucket needs to be created in the Supabase Dashboard, 
-- but we can add policies for it here just in case.

-- Grant access to service_role
GRANT ALL ON TABLE public.rp_cancellations TO service_role;
