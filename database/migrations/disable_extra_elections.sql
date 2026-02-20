-- Migration: disable_extra_elections.sql
-- Description: Disable all elections except the Presidential one for 2026.

UPDATE elections
SET is_active = false
WHERE title != 'Elección Presidencial 2026';
