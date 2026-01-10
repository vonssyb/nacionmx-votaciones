-- ⚠️ SQL CLEANUP SCRIPT V2 (ADVANCED - TIME BASED) ⚠️
-- Este script elimina tarjetas "Viejas" (Anteriores al CK) incluso si el usuario ya creó un nuevo DNI.
-- Compara la fecha de creación de la tarjeta vs la fecha del último CK.

BEGIN;

-- 1. Eliminar Tarjetas de Crédito "Muertas" (Creadas ANTES del último CK del usuario)
DELETE FROM credit_cards
WHERE id IN (
    SELECT cc.id
    FROM credit_cards cc
    JOIN ck_registry ck ON cc.user_id = ck.user_id  -- Usamos user_id (Discord ID) para relacionar
    WHERE cc.created_at < ck.created_at -- La tarjeta es más vieja que la muerte
);

-- 2. Eliminar Tarjetas de Débito "Muertas"
DELETE FROM debit_cards
WHERE id IN (
    SELECT dc.id
    FROM debit_cards dc
    JOIN ck_registry ck ON dc.discord_user_id = ck.user_id -- Usar columna correcta de Discord ID en debit_cards
    WHERE dc.created_at < ck.created_at
);

COMMIT;

-- NOTA IMPORTANTE SOBRE EL DINERO:
-- El dinero está en UnbelievaBoat (Sistema Externo), NO en la base de datos SQL.
-- SQL NO puede borrar el dinero de UnbelievaBoat.
-- Para los usuarios que YA fueron CK y conservan dinero, debes retirarlo manualmente:
-- Comando Discord: /remove-money user:@Usuario cash:Todo bank:Todo
-- O bien, el usuario debe "donarlo" o se le retira por administración.
