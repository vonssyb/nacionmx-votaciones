-- Enable UUID extension just in case
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Fix companies table default ID if necessary
ALTER TABLE companies ALTER COLUMN id SET DEFAULT uuid_generate_v4();

-- Ensure card_tier exists (Redundancy check)
ALTER TABLE debit_cards ADD COLUMN IF NOT EXISTS card_tier TEXT DEFAULT 'NMX Débito';

-- Ensure company_employees status check includes 'fired'
ALTER TABLE company_employees DROP CONSTRAINT IF EXISTS company_employees_status_check;
ALTER TABLE company_employees ADD CONSTRAINT company_employees_status_check CHECK (status IN ('active', 'on_leave', 'fired'));
