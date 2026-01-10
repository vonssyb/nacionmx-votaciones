-- ⚠️ SQL CLEANUP SCRIPT FOR CK'D USERS ⚠️
-- Este script elimina tarjetas y deudas de usuarios que ya NO tienen DNI (CK aplicado).
-- Ejecutar en el Editor SQL de Supabase.

BEGIN;

-- 1. Eliminar Tarjetas de Crédito de Usuarios sin DNI (CK)
DELETE FROM credit_cards
WHERE user_id NOT IN (SELECT user_id FROM citizen_dni);

-- 2. Eliminar Tarjetas de Débito de Usuarios sin DNI (CK)
-- Asumiendo que debit_cards se vincula por discord_id
DELETE FROM debit_cards
WHERE discord_id NOT IN (SELECT user_id FROM citizen_dni);

-- 3. (Opcional) Eliminar Saldos Locales (Si se usa user_balances)
DELETE FROM user_balances
WHERE user_id NOT IN (SELECT user_id FROM citizen_dni);

-- 4. (Opcional) Eliminar Historial de Transacciones de usuarios inexistentes
-- DELETE FROM transaction_logs WHERE discord_user_id NOT IN (SELECT user_id FROM citizen_dni);

COMMIT;

-- Nota: El dinero de UnbelievaBoat NO se puede borrar con SQL. 
-- El bot corregido ahora lo hará automáticamente en futuros CKs.
