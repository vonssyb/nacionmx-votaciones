-- Fix: Allow moderator_discord_id to be NULL for web-based cancellations where the link is missing
ALTER TABLE public.rp_cancellations ALTER COLUMN moderator_discord_id DROP NOT NULL;

-- Also ensure RLS allows anonymous inserts if we want to be very lenient, but 'authenticated' is safer. 
-- If user is logged in to the Web Portal, they are 'authenticated'.

-- Verify/Update policy just in case
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.rp_cancellations;
CREATE POLICY "Enable insert for authenticated users only" ON public.rp_cancellations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
