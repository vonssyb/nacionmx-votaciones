-- ⚠️ SQL CLEANUP SCRIPT V2 (ADVANCED - TIME BASED) ⚠️
-- Este script elimina tarjetas "Viejas" (Anteriores al CK) incluso si el usuario ya creó un nuevo DNI.
-- Compara la fecha de creación de la tarjeta vs la fecha del último CK.

BEGIN;

-- 1. Eliminar Tarjetas de Crédito "Muertas" (Creadas ANTES del último CK del usuario)
-- CORRECCION: credit_cards usa citizen_id, no user_id. Hacemos JOIN via citizens.
DELETE FROM credit_cards
WHERE id IN (
    SELECT cc.id
    FROM credit_cards cc
    JOIN citizens c ON cc.citizen_id = c.id
    JOIN ck_registry ck ON c.discord_id = ck.user_id
    WHERE cc.created_at < ck.created_at
);

-- 2. Eliminar Tarjetas de Débito "Muertas"
-- CORRECCION: debit_cards usa discord_user_id (generalmente).
DELETE FROM debit_cards
WHERE id IN (
    SELECT dc.id
    FROM debit_cards dc
    JOIN ck_registry ck ON dc.discord_user_id = ck.user_id 
    WHERE dc.created_at < ck.created_at
);

COMMIT;

-- NOTA IMPORTANTE SOBRE EL DINERO:
-- El dinero está en UnbelievaBoat (Sistema Externo), NO en la base de datos SQL.
-- SQL NO puede borrar el dinero de UnbelievaBoat.
-- Para los usuarios que YA fueron CK y conservan dinero, debes retirarlo manualmente:
-- Comando Discord: /remove-money user:@Usuario cash:Todo bank:Todo
-- O bien, el usuario debe "donarlo" o se le retira por administración.
