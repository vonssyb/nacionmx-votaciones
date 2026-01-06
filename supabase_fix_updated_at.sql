-- Add missing updated_at columns to tables
-- Use DO block for safety

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_cards' AND column_name = 'updated_at') THEN
        ALTER TABLE credit_cards ADD COLUMN updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'credit_cards' AND column_name = 'guild_id') THEN
        ALTER TABLE credit_cards ADD COLUMN guild_id text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citizens' AND column_name = 'updated_at') THEN
        ALTER TABLE citizens ADD COLUMN updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'citizens' AND column_name = 'guild_id') THEN
        ALTER TABLE citizens ADD COLUMN guild_id text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'card_transactions' AND column_name = 'updated_at') THEN
        ALTER TABLE card_transactions ADD COLUMN updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'card_transactions' AND column_name = 'guild_id') THEN
        ALTER TABLE card_transactions ADD COLUMN guild_id text;
    END IF;
END $$;
