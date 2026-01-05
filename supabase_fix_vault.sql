-- Add cash_saved and bank_saved columns to privacy_vault
-- Run this AFTER supabase_privacy_system.sql

ALTER TABLE privacy_vault ADD COLUMN IF NOT EXISTS cash_saved NUMERIC DEFAULT 0;
ALTER TABLE privacy_vault ADD COLUMN IF NOT EXISTS bank_saved NUMERIC DEFAULT 0;
    