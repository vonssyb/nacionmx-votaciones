-- ⚠️ SQL CLEANUP SCRIPT FOR CK'D USERS (CORRECTED) ⚠️
-- Este script elimina tarjetas y deudas de usuarios que ya NO tienen DNI (CK aplicado).
-- Ejecutar en el Editor SQL de Supabase.

BEGIN;

-- 1. Eliminar Tarjetas de Crédito de Usuarios sin DNI (CK)
-- Las tarjetas de crédito se vinculan por citizen_id
DELETE FROM credit_cards
WHERE citizen_id IN (
    SELECT id FROM citizens 
    WHERE discord_id NOT IN (SELECT user_id FROM citizen_dni)
);

-- 2. Eliminar Tarjetas de Débito de Usuarios sin DNI (CK)
-- Opción A: Por citizen_id (Si existe la relación)
DELETE FROM debit_cards
WHERE citizen_id IN (
    SELECT id FROM citizens 
    WHERE discord_id NOT IN (SELECT user_id FROM citizen_dni)
);

-- Opción B: Por discord_user_id (Si la columna existe y es directa)
-- Esto atrapa tarjetas que quizás no tengan citizen_id válido pero sí discord ID
DELETE FROM debit_cards
WHERE discord_user_id NOT IN (SELECT user_id FROM citizen_dni);

-- 3. (Opcional) Eliminar Saldos Locales (Si se usa user_balances)
-- Comentado porque la tabla puede no existir en este entorno
-- DELETE FROM user_balances
-- WHERE user_id NOT IN (SELECT user_id FROM citizen_dni);

COMMIT;

-- Nota: El dinero de UnbelievaBoat NO se puede borrar con SQL. 
-- El bot corregido (ck.js) ahora lo hará automáticamente en futuros CKs usando setBalance(0).
