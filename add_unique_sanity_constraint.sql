-- ENFORCE STRICT UNIQUENESS FOR SANCTIONS
-- Run this in your Supabase SQL Editor to prevent "double-click" or "double-bot" duplicates permanently.

-- FIX: We cast created_at to UTC to make the expression IMMUTABLE (required for indexes).
-- 1. Create a unique index that allows only ONE sanction per user, per moderator, per reason, PER MINUTE.
CREATE UNIQUE INDEX IF NOT EXISTS unique_sanction_per_minute 
ON public.sanctions (
    discord_user_id, 
    moderator_id, 
    reason, 
    (date_trunc('minute', created_at AT TIME ZONE 'UTC'))
);
