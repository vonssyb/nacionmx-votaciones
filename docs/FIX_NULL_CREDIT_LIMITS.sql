-- ⚠️ SQL SCRIPT TO FIX NULL CREDIT LIMITS ⚠️
-- Este script actualiza las tarjetas de crédito que tienen el límite en NULL
-- asignándoles el valor correcto según su tipo (card_type).

BEGIN;

-- NMX Plus: $50,000
UPDATE credit_cards SET credit_limit = 50000 WHERE card_type = 'NMX Plus' AND credit_limit IS NULL;

-- NMX Plata: $100,000
UPDATE credit_cards SET credit_limit = 100000 WHERE card_type = 'NMX Plata' AND credit_limit IS NULL;

-- NMX Oro: $500,000
UPDATE credit_cards SET credit_limit = 500000 WHERE card_type = 'NMX Oro' AND credit_limit IS NULL;

-- NMX Platino: $1,000,000
UPDATE credit_cards SET credit_limit = 1000000 WHERE card_type = 'NMX Platino' AND credit_limit IS NULL;

-- NMX Diamante: $2,000,000
UPDATE credit_cards SET credit_limit = 2000000 WHERE card_type = 'NMX Diamante' AND credit_limit IS NULL;

-- NMX Zafiro: $5,000,000
UPDATE credit_cards SET credit_limit = 5000000 WHERE card_type = 'NMX Zafiro' AND credit_limit IS NULL;

-- NMX Platino Elite: $10,000,000
UPDATE credit_cards SET credit_limit = 10000000 WHERE card_type = 'NMX Platino Elite' AND credit_limit IS NULL;

-- CORPORATE CARDS --

-- NMX Startup: $500,000
UPDATE credit_cards SET credit_limit = 500000 WHERE card_type = 'NMX Startup' AND credit_limit IS NULL;

-- NMX Corporate: $1,000,000
UPDATE credit_cards SET credit_limit = 1000000 WHERE card_type = 'NMX Corporate' AND credit_limit IS NULL;

-- NMX Corporate Plus: $5,000,000
UPDATE credit_cards SET credit_limit = 5000000 WHERE card_type = 'NMX Corporate Plus' AND credit_limit IS NULL;

-- NMX Black: $10,000,000
UPDATE credit_cards SET credit_limit = 10000000 WHERE card_type = 'NMX Black' AND credit_limit IS NULL;

-- NMX Supreme: $50,000,000
UPDATE credit_cards SET credit_limit = 50000000 WHERE card_type = 'NMX Supreme' AND credit_limit IS NULL;

COMMIT;
