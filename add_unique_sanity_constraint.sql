-- ENFORCE STRICT UNIQUENESS FOR SANCTIONS
-- Run this in your Supabase SQL Editor to prevent "double-click" or "double-bot" duplicates permanently.

-- 1. Create a unique index that allows only ONE sanction per user, per moderator, per reason, PER MINUTE.
-- This effectively kills race conditions where two identical requests come in at the same second.
CREATE UNIQUE INDEX IF NOT EXISTS unique_sanction_per_minute 
ON public.sanctions (
    discord_user_id, 
    moderator_id, 
    reason, 
    date_trunc('minute', created_at)
);

-- 2. (Optional) Constraint to prevent identical active sanctions regardless of time?
-- Usually not recommended because a user CAN be sanctioned for the same thing twice on different days.
-- The per-minute constraint is enough to stop accidental duplication.
