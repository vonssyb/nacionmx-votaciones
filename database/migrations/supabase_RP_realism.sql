-- Phase 3: Financial RP Realism Migration

-- 1. Stocks Market (Simple)
CREATE TABLE IF NOT EXISTS public.stocks (
    symbol TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price DECIMAL(15,2) NOT NULL,
    change_pct DECIMAL(5,2) DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. User Investments
CREATE TABLE IF NOT EXISTS public.user_investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    symbol TEXT REFERENCES public.stocks(symbol) ON DELETE CASCADE,
    shares DECIMAL(15,4) NOT NULL DEFAULT 0,
    price_avg DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Enhance Credit Cards for RP Realism
ALTER TABLE public.credit_cards ADD COLUMN IF NOT EXISTS card_number TEXT;
ALTER TABLE public.credit_cards ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE;

-- 4. Initial Stock Data
INSERT INTO public.stocks (symbol, name, price, change_pct) VALUES
('NMX', 'Nación MX Corp', 150.25, 1.5),
('GOLD', 'Minería Los Santos', 1250.00, -0.5),
('OIL', 'Petróleos Nacionales', 85.50, 2.1),
('TECH', 'Sistemas McQueen', 450.00, 0.0)
ON CONFLICT (symbol) DO NOTHING;

-- 5. Enable RLS
ALTER TABLE public.stocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Read Stocks" ON public.stocks FOR SELECT USING (true);
CREATE POLICY "Public Read Own Investments" ON public.user_investments FOR SELECT USING (true); -- Filtered by API
CREATE POLICY "Bot Manage" ON public.stocks FOR ALL USING (true);
CREATE POLICY "Bot Manage Investments" ON public.user_investments FOR ALL USING (true);
