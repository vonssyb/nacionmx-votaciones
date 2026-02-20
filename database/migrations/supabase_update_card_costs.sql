    -- Updates for Credit Card Costs and Limits in database if they are stored there.
-- Assuming table 'store_items' or 'card_types' exists.
-- Based on user request.

-- 1. Debit Cards
UPDATE store_items SET price = 100 WHERE name = 'NMX Débito';
UPDATE store_items SET price = 500 WHERE name = 'NMX Débito Plus';
UPDATE store_items SET price = 1000 WHERE name = 'NMX Débito Gold';

-- 2. Personal Credit Cards
UPDATE store_items SET price = 2000 WHERE name = 'NMX Start';
UPDATE store_items SET price = 4000 WHERE name = 'NMX Básica';
UPDATE store_items SET price = 6000 WHERE name = 'NMX Plus';
UPDATE store_items SET price = 10000 WHERE name = 'NMX Plata';
UPDATE store_items SET price = 15000 WHERE name = 'NMX Oro';
UPDATE store_items SET price = 25000 WHERE name = 'NMX Rubí';
UPDATE store_items SET price = 40000 WHERE name = 'NMX Black';
UPDATE store_items SET price = 60000 WHERE name = 'NMX Diamante';
UPDATE store_items SET price = 100000 WHERE name = 'NMX Zafiro';
UPDATE store_items SET price = 150000 WHERE name = 'NMX Platino Elite';

-- 3. Business Cards
UPDATE store_items SET price = 8000 WHERE name = 'NMX Business Start';
UPDATE store_items SET price = 15000 WHERE name = 'NMX Business Gold';
UPDATE store_items SET price = 20000 WHERE name = 'NMX Business Platinum';
UPDATE store_items SET price = 35000 WHERE name = 'NMX Business Elite';
UPDATE store_items SET price = 50000 WHERE name = 'NMX Corporate';
UPDATE store_items SET price = 100000 WHERE name = 'NMX Corporate Plus';
UPDATE store_items SET price = 200000 WHERE name = 'NMX Enterprise';
UPDATE store_items SET price = 350000 WHERE name = 'NMX Conglomerate';
UPDATE store_items SET price = 500000 WHERE name = 'NMX Supreme';
