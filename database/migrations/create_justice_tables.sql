-- Create Warrants Table
CREATE TABLE IF NOT EXISTS warrants (
    id SERIAL PRIMARY KEY,
    guild_id TEXT NOT NULL,
    target_id TEXT NOT NULL, -- User being wanted
    issuer_id TEXT NOT NULL, -- Judge/Secretary who issued it
    type TEXT NOT NULL, -- 'APREHENSION', 'CATEO'
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'active', -- 'active', 'executed', 'cancelled'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    executed_at TIMESTAMP WITH TIME ZONE
);

-- Ensure profiles has stars (wanted level)
-- We assume 'profiles' table exists as it's core to the bot.
-- If profiles doesn't exist, we might have a problem, but based on context it should.
-- However, if 'profiles' is actually 'users' or 'economy_users', I need to be careful.
-- Previous files accessed 'citizen_dni' and 'user_economy' (via BillingService).
-- Let's check 'BillingService' to see what the main user table is.
-- Actually, let's create a 'criminal_records' table instead of modifying profiles if unsure.

CREATE TABLE IF NOT EXISTS criminal_records (
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    stars INTEGER DEFAULT 0,
    history TEXT[] DEFAULT '{}', -- Array of past crimes strings
    PRIMARY KEY (user_id, guild_id)
);
