-- ⚠️ FORCE RELEASE BOT LOCK
-- Ejecuta esto en el Editor SQL de Supabase para matar el bloqueo de la instancia zombie.

DELETE FROM bot_heartbeats WHERE id = 'main_bot_lock';

-- Si quieres ver quién lo tiene antes de borrarlo:
-- SELECT * FROM bot_heartbeats;
