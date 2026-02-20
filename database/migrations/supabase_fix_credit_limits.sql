-- FIX: Actualizar límites de crédito históricos incorrectos
-- Este script alinea la columna `card_limit` con el `card_type` actual de cada tarjeta.

BEGIN;

-- 1. NMX Start ($15,000)
UPDATE credit_cards 
SET card_limit = 15000 
WHERE card_type = 'NMX Start' AND card_limit != 15000;

-- 2. NMX Básica ($30,000)
UPDATE credit_cards 
SET card_limit = 30000 
WHERE card_type = 'NMX Básica' AND card_limit != 30000;

-- 3. NMX Plus ($50,000)
UPDATE credit_cards 
SET card_limit = 50000 
WHERE card_type = 'NMX Plus' AND card_limit != 50000;

-- 4. NMX Plata ($100,000)
UPDATE credit_cards 
SET card_limit = 100000 
WHERE card_type = 'NMX Plata' AND card_limit != 100000;

-- 5. NMX Oro ($250,000)
UPDATE credit_cards 
SET card_limit = 250000 
WHERE card_type = 'NMX Oro' AND card_limit != 250000;

-- 6. NMX Rubí ($500,000)
UPDATE credit_cards 
SET card_limit = 500000 
WHERE card_type = 'NMX Rubí' AND card_limit != 500000;

-- 7. NMX Black ($1,000,000)
UPDATE credit_cards 
SET card_limit = 1000000 
WHERE card_type = 'NMX Black' AND card_limit != 1000000;

-- 8. NMX Diamante ($2,000,000)
UPDATE credit_cards 
SET card_limit = 2000000 
WHERE card_type = 'NMX Diamante' AND card_limit != 2000000;

-- 9. NMX Zafiro ($5,000,000)
UPDATE credit_cards 
SET card_limit = 5000000 
WHERE card_type = 'NMX Zafiro' AND card_limit != 5000000;

-- 10. NMX Platino Elite ($10,000,000)
UPDATE credit_cards 
SET card_limit = 10000000 
WHERE card_type = 'NMX Platino Elite' AND card_limit != 10000000;

COMMIT;

-- Verificación rápida
SELECT card_type, count(*) as cantidad_actualizada 
FROM credit_cards 
GROUP BY card_type;
