-- =========================================================================================
-- SEMILLA DE MISIONES DIARIAS (50+ Misiones)
-- Ejecutar en Supabase SQL Editor para poblar la tabla daily_missions
-- =========================================================================================

-- Limpiar misiones antiguas (Opcional, descomentar si quieres reiniciar)
-- DELETE FROM daily_missions WHERE created_by = 'SEED_SCRIPT';

-- ==========================
-- 1. MISIONES DE SEGURIDAD (Solo Staff Policial)
-- ==========================
INSERT INTO daily_missions (title, description, difficulty, reward_money, reward_xp, requirements, allowed_roles, created_by)
VALUES
  -- TRÁFICO Y PATRULLAJE (EASY)
  ('Patrullaje Matutino', 'Realiza 15 minutos de patrullaje preventivo.', 'easy', 3000, 50, '{"type": "shift_minutes", "count": 15}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),
  ('Control de Velocidad', 'Realiza 2 multas de tránsito.', 'easy', 4000, 80, '{"type": "traffic_stop", "count": 2}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),
  ('Presencia Policial', 'Mantente en servicio 20 minutos para disuadir el crimen.', 'easy', 3500, 60, '{"type": "shift_minutes", "count": 20}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),
  ('Revisión de Rutina', 'Ejecuta 3 paradas de tránsito.', 'easy', 4500, 90, '{"type": "traffic_stop", "count": 3}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),
  ('Guardia en Comisaría', 'Permanece 10 minutos en servicio organizando reportes.', 'easy', 2500, 40, '{"type": "shift_minutes", "count": 10}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),

  -- OPERATIVOS (MEDIUM)
  ('Cero Tolerancia', 'Realiza 1 arresto justificado.', 'medium', 6000, 150, '{"type": "arrests", "count": 1}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),
  ('Operativo Alcoholímetro', 'Realiza 5 paradas de tránsito buscando conductores ebrios.', 'medium', 7000, 140, '{"type": "traffic_stop", "count": 5}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),
  ('Respuesta a Emergencias', 'Atiende 2 llamados de emergencia.', 'medium', 6500, 130, '{"type": "calls", "count": 2}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),
  ('Patrullaje Intensivo', 'Cumple con 45 minutos de servicio activo.', 'medium', 8000, 160, '{"type": "shift_minutes", "count": 45}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),
  ('Orden Pública', 'Realiza 2 arrestos por alteraciones al orden.', 'medium', 8500, 170, '{"type": "arrests", "count": 2}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),
  ('Inspección Vehicular', 'Detén a 6 vehículos sospechosos.', 'medium', 7500, 150, '{"type": "traffic_stop", "count": 6}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),

  -- ALTO IMPACTO (HARD)
  ('Redada Contra el Crimen', 'Logra 3 arrestos de alto perfil.', 'hard', 12000, 300, '{"type": "arrests", "count": 3}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),
  ('Código 3 Constante', 'Responde a 5 llamados de emergencia.', 'hard', 13000, 320, '{"type": "calls", "count": 5}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),
  ('Turno Doble', 'Permanece en servicio 60 minutos continuos.', 'hard', 10000, 250, '{"type": "shift_minutes", "count": 60}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),
  ('Golpe al Narcotráfico', 'Realiza 4 arrestos relacionados con drogas o armas.', 'hard', 15000, 400, '{"type": "arrests", "count": 4}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),
  ('Seguridad Nacional', 'Patrullaje aéreo o terrestre de 90 minutos.', 'hard', 14000, 350, '{"type": "shift_minutes", "count": 90}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),

  -- EXTRA VARIACIONES
  ('Control de Tráfico Pesado', 'Realiza 4 multas a vehículos de carga o transporte.', 'medium', 6000, 120, '{"type": "traffic_stop", "count": 4}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),
  ('Noche de Arrestos', 'Realiza 2 arrestos en turno nocturno (RP).', 'medium', 9000, 180, '{"type": "arrests", "count": 2}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),
  ('Soporte a Unidades', 'Acude a 3 llamados de respaldo.', 'medium', 7000, 140, '{"type": "calls", "count": 3}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),
  ('Limpieza de Calles', 'Multa a 8 vehículos mal estacionados o infractores.', 'hard', 11000, 280, '{"type": "traffic_stop", "count": 8}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),
  ('Vigilancia Estratégica', '30 minutos de vigilancia en zonas rojas.', 'medium', 5500, 110, '{"type": "shift_minutes", "count": 30}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT'),
  ('Operación Relámpago', 'Responde a 4 llamadas en tiempo récord.', 'hard', 12500, 310, '{"type": "calls", "count": 4}', ARRAY['1412898905842122872','1412898908706963507','1457135315323195432','1412898911185797310','1412898916021829903','1455037616054341704','1416867605976715363','1450242487422812251'], 'SEED_SCRIPT');

-- ==========================
-- 2. MISIONES GENERALES (Civiles, Crimen, Todos)
-- ==========================
INSERT INTO daily_missions (title, description, difficulty, reward_money, reward_xp, requirements, allowed_roles, created_by)
VALUES
  -- SOCIAL Y EXPLORACIÓN (EASY)
  ('Ciudadano Ejemplar', 'Permanece activo en la ciudad por 30 minutos.', 'easy', 3000, 50, '{"type": "playtime_minutes", "count": 30}', NULL, 'SEED_SCRIPT'),
  ('Vida Social', 'Interactúa con 5 personas diferentes.', 'easy', 2500, 40, '{"type": "interactions", "count": 5}', NULL, 'SEED_SCRIPT'),
  ('Turista Local', 'Visita y permanece en la ciudad 45 minutos.', 'easy', 4000, 70, '{"type": "playtime_minutes", "count": 45}', NULL, 'SEED_SCRIPT'),
  ('Conociendo Vecinos', 'Saluda o interactúa con 10 ciudadanos.', 'easy', 3500, 60, '{"type": "interactions", "count": 10}', NULL, 'SEED_SCRIPT'),
  ('Paseo por la Plaza', 'Pasa 20 minutos activo cerca del centro.', 'easy', 2000, 30, '{"type": "playtime_minutes", "count": 20}', NULL, 'SEED_SCRIPT'),

  -- TRABAJOS LEGALES (MEDIUM)
  ('Cartero Veloz', 'Completa 3 entregas de correo.', 'medium', 5000, 100, '{"type": "job_deliveries", "count": 3}', NULL, 'SEED_SCRIPT'),
  ('Limpia la Ciudad', 'Completa 3 rutas de basurero.', 'medium', 5500, 110, '{"type": "job_deliveries", "count": 3}', NULL, 'SEED_SCRIPT'),
  ('Camionero Experto', 'Realiza 2 entregas de carga pesada.', 'medium', 6000, 120, '{"type": "job_deliveries", "count": 2}', NULL, 'SEED_SCRIPT'),
  ('Jornada Laboral', 'Completa 5 entregas de trabajo cualquiera.', 'medium', 7000, 150, '{"type": "job_deliveries", "count": 5}', NULL, 'SEED_SCRIPT'),
  ('Repartidor de Pizza', 'Entrega 4 pedidos de comida.', 'medium', 5000, 100, '{"type": "job_deliveries", "count": 4}', NULL, 'SEED_SCRIPT'),

  -- GENERAL HARD
  ('Maratón Urbano', 'Permanece conectado activamente por 120 minutos.', 'hard', 10000, 250, '{"type": "playtime_minutes", "count": 120}', NULL, 'SEED_SCRIPT'),
  ('Influencer', 'Interactúa con 25 personas distintas en un día.', 'hard', 9000, 220, '{"type": "interactions", "count": 25}', NULL, 'SEED_SCRIPT'),
  ('Empleado del Mes', 'Completa 10 entregas de trabajo en un día.', 'hard', 12000, 300, '{"type": "job_deliveries", "count": 10}', NULL, 'SEED_SCRIPT'),
  ('Supervivencia', 'Mantente activo 90 minutos sin ser arrestado ni abatido.', 'hard', 8000, 200, '{"type": "playtime_minutes", "count": 90}', NULL, 'SEED_SCRIPT'),

  -- VARIACIONES
  ('Ruta Matutina', 'Haz 2 entregas antes del mediodía (RP).', 'easy', 4000, 80, '{"type": "job_deliveries", "count": 2}', NULL, 'SEED_SCRIPT'),
  ('Turno Nocturno', 'Trabaja en entregas (4 viajes) durante la noche.', 'medium', 6500, 130, '{"type": "job_deliveries", "count": 4}', NULL, 'SEED_SCRIPT'),
  ('Vida Activa', '60 minutos de actividad en el servidor.', 'medium', 5000, 100, '{"type": "playtime_minutes", "count": 60}', NULL, 'SEED_SCRIPT'),
  ('Charla Comunitaria', 'Interactúa con 15 personas.', 'medium', 6000, 140, '{"type": "interactions", "count": 15}', NULL, 'SEED_SCRIPT'),
  ('Abastecimiento Total', '8 entregas de suministros o carga.', 'hard', 10500, 260, '{"type": "job_deliveries", "count": 8}', NULL, 'SEED_SCRIPT'),
  ('Residente Permanente', 'Acumula 150 minutos (2.5 horas) en la ciudad.', 'hard', 15000, 400, '{"type": "playtime_minutes", "count": 150}', NULL, 'SEED_SCRIPT');

SELECT 'Misiones insertadas exitosamente.' as status;
