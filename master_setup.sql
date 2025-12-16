-- MASTER SETUP SCRIPT
-- Run this in Supabase SQL Editor to fix EVERYTHING.

-- 1.2 Add discord_id to profiles (For Bot Shift Logging)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'discord_id') THEN
        ALTER TABLE profiles ADD COLUMN discord_id text UNIQUE;
    END IF;
END $$;

-- 2. CREATE (or Update) 'citizens' table
CREATE TABLE IF NOT EXISTS citizens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  dni text UNIQUE NOT NULL,
  full_name text NOT NULL,
  phone text,
  discord_id text, -- For Bot DMs
  dni_image_url text, -- Added column already included
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 2. Create 'credit_cards' table (if missing)
CREATE TABLE IF NOT EXISTS credit_cards (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  citizen_id uuid REFERENCES citizens(id) ON DELETE CASCADE NOT NULL,
  card_type text CHECK (card_type IN ('NMX Start', 'NMX Básica', 'NMX Plus', 'NMX Plata', 'NMX Oro', 'NMX Rubí', 'NMX Black', 'NMX Diamante')) NOT NULL,
  credit_limit numeric NOT NULL,
  current_balance numeric DEFAULT 0,
  interest_rate numeric NOT NULL,
  cut_day integer DEFAULT 7,
  has_loans boolean DEFAULT false,
  status text CHECK (status IN ('active', 'frozen', 'cancelled')) DEFAULT 'active',
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 2.5 Create 'card_transactions' table (History & Proofs)
CREATE TABLE IF NOT EXISTS card_transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id uuid REFERENCES credit_cards(id) ON DELETE CASCADE NOT NULL,
  amount numeric NOT NULL, -- Positive for Loans, Negative for Payments
  type text CHECK (type IN ('loan', 'payment', 'interest')) NOT NULL,
  proof_url text, -- Screenshot of log/transfer
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- 3. Enable RLS for new tables
ALTER TABLE citizens ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_transactions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies (Safe to run multiple times)
DROP POLICY IF EXISTS "Staff can view citizens" ON citizens;
CREATE POLICY "Staff can view citizens" ON citizens FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Staff can insert citizens" ON citizens;
CREATE POLICY "Staff can insert citizens" ON citizens FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Staff can update citizens" ON citizens;
CREATE POLICY "Staff can update citizens" ON citizens FOR UPDATE USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Staff can manage credit cards" ON credit_cards;
CREATE POLICY "Staff can manage credit cards" ON credit_cards FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Staff can manage transactions" ON card_transactions;
CREATE POLICY "Staff can manage transactions" ON card_transactions FOR ALL USING (auth.role() = 'authenticated');

-- 5. FIX ID GENERATION (Solve "Error al iniciar turno" and others)
-- Applies to existing tables too
ALTER TABLE time_logs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE activity_logs ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE bolos ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE applications ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 6. Add DNI Image column if table existed but column didn't (Safety)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citizens' AND column_name = 'dni_image_url') THEN
        ALTER TABLE citizens ADD COLUMN dni_image_url text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citizens' AND column_name = 'discord_id') THEN
        ALTER TABLE citizens ADD COLUMN discord_id text;
    END IF;
END $$;

-- 7. Storage Setup for DNI Images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('dni-images', 'dni-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('ledger-proofs', 'ledger-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- 8. Storage Policies
DROP POLICY IF EXISTS "Staff can upload dni images" ON storage.objects;
CREATE POLICY "Staff can upload dni images"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'dni-images' AND auth.role() = 'authenticated' );

DROP POLICY IF EXISTS "Public can view dni images" ON storage.objects;
CREATE POLICY "Public can view dni images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'dni-images' );

DROP POLICY IF EXISTS "Staff can upload proofs" ON storage.objects;
CREATE POLICY "Staff can upload proofs"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'ledger-proofs' AND auth.role() = 'authenticated' );

DROP POLICY IF EXISTS "Public can view proofs" ON storage.objects;
CREATE POLICY "Public can view proofs"
ON storage.objects FOR SELECT
USING ( bucket_id = 'ledger-proofs' );

-- 9. ENABLE REALTIME (Crucial for Bot to hear changes)

DO $$
BEGIN
    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE credit_cards;
    EXCEPTION WHEN duplicate_object THEN
        NULL; -- Ignore if already exists
    END;

    BEGIN
        ALTER PUBLICATION supabase_realtime ADD TABLE citizens;
    EXCEPTION WHEN duplicate_object THEN
        NULL; -- Ignore if already exists
    END;
END $$;
