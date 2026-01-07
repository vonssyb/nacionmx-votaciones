-- FIX: Actualizar límites de crédito históricos para TARJETAS EMPRESARIALES
-- Este script alinea la columna `card_limit` con el `card_type` para tarjetas de negocio.

BEGIN;

-- 11. NMX Business Start ($50,000)
UPDATE credit_cards 
SET card_limit = 50000 
WHERE card_type = 'NMX Business Start' AND card_limit != 50000;

-- 12. NMX Business Gold ($100,000)
UPDATE credit_cards 
SET card_limit = 100000 
WHERE card_type = 'NMX Business Gold' AND card_limit != 100000;

-- 13. NMX Business Platinum ($200,000)
UPDATE credit_cards 
SET card_limit = 200000 
WHERE card_type = 'NMX Business Platinum' AND card_limit != 200000;

-- 14. NMX Business Elite ($500,000)
UPDATE credit_cards 
SET card_limit = 500000 
WHERE card_type = 'NMX Business Elite' AND card_limit != 500000;

-- 15. NMX Corporate ($1,000,000)
UPDATE credit_cards 
SET card_limit = 1000000 
WHERE card_type = 'NMX Corporate' AND card_limit != 1000000;

-- 16. NMX Corporate Plus ($5,000,000)
UPDATE credit_cards 
SET card_limit = 5000000 
WHERE card_type = 'NMX Corporate Plus' AND card_limit != 5000000;

-- 17. NMX Enterprise ($10,000,000)
UPDATE credit_cards 
SET card_limit = 10000000 
WHERE card_type = 'NMX Enterprise' AND card_limit != 10000000;

-- 18. NMX Conglomerate ($25,000,000)
UPDATE credit_cards 
SET card_limit = 25000000 
WHERE card_type = 'NMX Conglomerate' AND card_limit != 25000000;

-- 19. NMX Supreme ($50,000,000)
UPDATE credit_cards 
SET card_limit = 50000000 
WHERE card_type = 'NMX Supreme' AND card_limit != 50000000;

COMMIT;

-- Verificación final
SELECT card_type, count(*) as cantidad_actualizada 
FROM credit_cards 
WHERE card_type LIKE '%Business%' OR card_type LIKE '%Corporate%' OR card_type LIKE '%Enterprise%' OR card_type LIKE '%Conglomerate%' OR card_type LIKE '%Supreme%'
GROUP BY card_type;
