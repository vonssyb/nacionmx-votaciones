-- ================================================
-- MIGRACIÓN: Banco → Efectivo para usuarios sin tarjeta de débito
-- ================================================

-- Este script convierte el dinero del banco a efectivo
-- para todos los usuarios que NO tienen tarjeta de débito activa

-- EJECUTAR ESTO SOLO UNA VEZ O CUANDO SEA NECESARIO

-- Paso 1: Ver cuántos usuarios afectará
SELECT COUNT(DISTINCT discord_id) as usuarios_sin_tarjeta
FROM citizens c
WHERE NOT EXISTS (
    SELECT 1 FROM debit_cards dc 
    WHERE dc.discord_user_id = c.discord_id 
    AND dc.status = 'active'
);

-- Paso 2: Ver el total de dinero que se migrará
-- (Esto es solo informativo, no hace cambios)
SELECT 
    c.discord_id,
    c.full_name,
    -- Aquí necesitarías la columna de balance si existe en citizens
    'Ver balance en UnbelievaBoat' as nota
FROM citizens c
WHERE NOT EXISTS (
    SELECT 1 FROM debit_cards dc 
    WHERE dc.discord_user_id = c.discord_id 
    AND dc.status = 'active'
)
LIMIT 10;

-- ================================================
-- NOTA: La migración real del dinero debe hacerse
-- desde el bot usando UnbelievaBoat API porque
-- el balance está en su sistema, no en Supabase
-- ================================================

-- Script para el bot (pseudocódigo):
/*
1. Obtener todos usuarios sin tarjeta de débito
2. Para cada usuario:
   - balance = getUserBalance(user)
   - Si balance.bank > 0:
     - removeMoney(user, balance.bank, 'bank')
     - addMoney(user, balance.bank, 'cash')
     - Log: "Migrado $X de banco a efectivo"
*/
