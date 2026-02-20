-- =============================================
-- OVERHAUL DE PREGUNTAS DE POSTULACIÓN
-- SECCIONES I A X
-- =============================================

-- 1. Actualizar tabla de preguntas para soportar secciones
ALTER TABLE application_questions ADD COLUMN IF NOT EXISTS section_id INTEGER DEFAULT 1;
ALTER TABLE application_questions ADD COLUMN IF NOT EXISTS section_title TEXT DEFAULT 'General';

-- 2. Limpiar preguntas actuales para evitar conflictos
TRUNCATE TABLE application_questions;

-- 3. Insertar nuevas preguntas oficiales
INSERT INTO application_questions (section_id, section_title, question_key, question_text, question_type, placeholder, required, order_index) VALUES
-- SECCIÓN I — DATOS GENERALES
(1, 'SECCIÓN I — DATOS GENERALES', 'discord_user', 'Usuario de Discord', 'text', 'Ej: john_doe', true, 1),
(1, 'SECCIÓN I — DATOS GENERALES', 'discord_id_manual', 'ID de Discord', 'text', 'Ej: 123456789012345678', true, 2),
(1, 'SECCIÓN I — DATOS GENERALES', 'ic_name', 'Nombre IC principal', 'text', 'Nombre Completo del personaje', true, 3),
(1, 'SECCIÓN I — DATOS GENERALES', 'ooc_age', 'Edad OOC', 'number', 'Tu edad real', true, 4),
(1, 'SECCIÓN I — DATOS GENERALES', 'motivation_join', '¿Por qué deseas formar parte del staff de Nación MX RP?', 'textarea', 'Explícanos tus motivos razonadamente', true, 5),

-- SECCIÓN II — EXPERIENCIA PREVIA
(2, 'SECCIÓN II — EXPERIENCIA PREVIA', 'rp_time', '¿Desde hace cuánto juegas roleplay?', 'text', 'Ej: 2 años', true, 6),
(2, 'SECCIÓN II — EXPERIENCIA PREVIA', 'rp_platforms', '¿En qué plataformas has roleado? (FiveM, Roblox, otros)', 'text', 'Plataformas conocidas', true, 7),
(2, 'SECCIÓN II — EXPERIENCIA PREVIA', 'rp_servers', 'Enumera servidores en los que hayas participado.', 'textarea', 'Lista de servidores relevantes', true, 8),
(2, 'SECCIÓN II — EXPERIENCIA PREVIA', 'staff_history', '¿Has sido staff anteriormente? Indica servidor y rango.', 'textarea', 'Experiencia administrativa', true, 9),
(2, 'SECCIÓN II — EXPERIENCIA PREVIA', 'staff_exit_reason', 'Motivo de salida del último staff.', 'textarea', 'Sé honesto(a)', true, 10),
(2, 'SECCIÓN II — EXPERIENCIA PREVIA', 'sanctions_history', '¿Has recibido sanciones administrativas? Explica cuáles y por qué.', 'textarea', 'Historial de sanciones como jugador', true, 11),
(2, 'SECCIÓN II — EXPERIENCIA PREVIA', 'learnings', '¿Qué aprendiste de tus experiencias previas como staff o jugador?', 'textarea', 'Reflexión sobre tu trayectoria', true, 12),

-- SECCIÓN III — CONOCIMIENTOS BÁSICOS
(3, 'SECCIÓN III — CONOCIMIENTOS BÁSICOS', 'def_ic', '¿Qué es IC (In Character)?', 'textarea', 'Definición breve', true, 13),
(3, 'SECCIÓN III — CONOCIMIENTOS BÁSICOS', 'def_ooc', '¿Qué es OOC (Out of Character)?', 'textarea', 'Definición breve', true, 14),
(3, 'SECCIÓN III — CONOCIMIENTOS BÁSICOS', 'def_mg', 'Define Metagaming (MG).', 'textarea', 'Definición y ejemplo', true, 15),
(3, 'SECCIÓN III — CONOCIMIENTOS BÁSICOS', 'def_pg', 'Define Powergaming (PG).', 'textarea', 'Definición y ejemplo', true, 16),
(3, 'SECCIÓN III — CONOCIMIENTOS BÁSICOS', 'def_failrp', 'Define Fail RP.', 'textarea', 'Definición breve', true, 17),
(3, 'SECCIÓN III — CONOCIMIENTOS BÁSICOS', 'def_nlr', '¿Qué es NLR y cuándo se aplica?', 'textarea', 'New Life Rule', true, 18),
(3, 'SECCIÓN III — CONOCIMIENTOS BÁSICOS', 'def_ck', '¿Qué es CK y quién puede autorizarlo?', 'textarea', 'Character Kill', true, 19),
(3, 'SECCIÓN III — CONOCIMIENTOS BÁSICOS', 'def_pk', '¿Qué es PK y qué implica para el personaje?', 'textarea', 'Player Kill', true, 20),

-- SECCIÓN IV — CONOCIMIENTOS INTERMEDIOS
(4, 'SECCIÓN IV — CONOCIMIENTOS INTERMEDIOS', 'diff_agro_forced', 'Diferencia entre rol agresivo y rol forzado.', 'textarea', 'Explica con tus palabras', true, 21),
(4, 'SECCIÓN IV — CONOCIMIENTOS INTERMEDIOS', 'ignore_wounds_gravity', '¿Por qué ignorar heridas graves es una falta seria?', 'textarea', 'Interpretación de daños', true, 22),
(4, 'SECCIÓN IV — CONOCIMIENTOS INTERMEDIOS', 'ooc_info_ic_rule', '¿Por qué no se debe usar información de Discord dentro del rol IC?', 'textarea', 'Relación con el MG', true, 23),
(4, 'SECCIÓN IV — CONOCIMIENTOS INTERMEDIOS', 'mechanics_abuse_ex', 'Explica qué es abuso de mecánicas con un ejemplo.', 'textarea', 'Ejemplo práctico', true, 24),
(4, 'SECCIÓN IV — CONOCIMIENTOS INTERMEDIOS', 'impose_actions_rule', '¿Qué significa imponer acciones y por qué está prohibido?', 'textarea', 'Libertad de rol', true, 25),
(4, 'SECCIÓN IV — CONOCIMIENTOS INTERMEDIOS', 'passive_rp_def', '¿Qué es el rol pasivo y cuándo debe aplicarse?', 'textarea', 'Ambiente y entorno', true, 26),

-- SECCIÓN V — CONDUCTA ROLERA Y SANCIONES
(5, 'SECCIÓN V — CONDUCTA ROLERA Y SANCIONES', 'case_jump_arrest', 'Un jugador salta repetidamente para evitar ser arrestado. ¿Qué infracción es? ¿Cómo actúas?', 'textarea', 'Análisis y acción staff', true, 27),
(5, 'SECCIÓN V — CONDUCTA ROLERA Y SANCIONES', 'case_bugs_walls', 'Un usuario usa bugs para atravesar paredes. ¿Falta y sanción?', 'textarea', 'Análisis y acción staff', true, 28),
(5, 'SECCIÓN V — CONDUCTA ROLERA Y SANCIONES', 'case_dm_no_role', 'Un jugador mata sin rol previo ni motivo. Clasifica y explica sanción.', 'textarea', 'Análisis y acción staff', true, 29),
(5, 'SECCIÓN V — CONDUCTA ROLERA Y SANCIONES', 'case_bad_cop', 'Un policía encarcela sin pruebas ni rol previo. ¿Normas rotas?', 'textarea', 'Análisis y acción staff', true, 30),

-- SECCIÓN VI — CRIMINALIDAD Y LEGALIDAD
(6, 'SECCIÓN VI — CRIMINALIDAD Y LEGALIDAD', 'high_risk_crime_voters', '¿Quiénes pueden realizar crímenes de alto riesgo?', 'textarea', 'Requisitos de normativa', true, 31),
(6, 'SECCIÓN VI — CRIMINALIDAD Y LEGALIDAD', 'kidnap_reqs', 'Requisitos mínimos para un secuestro válido.', 'textarea', 'Normativa de secuestros', true, 32),
(6, 'SECCIÓN VI — CRIMINALIDAD Y LEGALIDAD', 'bad_robbery_id', '¿Cuándo un robo está mal roleado?', 'textarea', 'Errores comunes', true, 33),
(6, 'SECCIÓN VI — CRIMINALIDAD Y LEGALIDAD', 'civilian_terror', '¿Puede un civil realizar acciones terroristas? Justifica.', 'textarea', 'Respuesta normativa', true, 34),
(6, 'SECCIÓN VI — CRIMINALIDAD Y LEGALIDAD', 'impro_v_organized', '¿Qué diferencia hay entre crimen improvisado y crimen organizado?', 'textarea', 'Conceptos de rol criminal', true, 35),

-- SECCIÓN VII — CASOS PRÁCTICOS AVANZADOS
(7, 'SECCIÓN VII — CASOS PRÁCTICOS AVANZADOS', 'ooc_discuss_scene', 'Dos jugadores discuten OOC durante una escena activa. ¿Intervienes? ¿Cómo?', 'textarea', 'Manejo de conflictos en vivo', true, 36),
(7, 'SECCIÓN VII — CASOS PRÁCTICOS AVANZADOS', 'staff_taking_sides', 'Un staff entra a una escena y toma partido IC. ¿Es correcto? ¿Qué debió hacer?', 'textarea', 'Ética administrativa', true, 37),
(7, 'SECCIÓN VII — CASOS PRÁCTICOS AVANZADOS', 'threaten_leave_server', 'Un usuario amenaza con abandonar el servidor si es sancionado. ¿Cómo actúas?', 'textarea', 'Psicología y firmeza staff', true, 38),
(7, 'SECCIÓN VII — CASOS PRÁCTICOS AVANZADOS', 'stream_sniping_case', 'Un jugador usa información de un stream para localizar a otro. Falta y procedimiento.', 'textarea', 'Manejo de sniping', true, 39),

-- SECCIÓN VIII — CRITERIO Y ÉTICA DE STAFF
(8, 'SECCIÓN VIII — CRITERIO Y ÉTICA DE STAFF', 'staff_main_function', '¿Cuál es la función principal de un staff?', 'textarea', 'Visión del cargo', true, 40),
(8, 'SECCIÓN VIII — CRITERIO Y ÉTICA DE STAFF', 'sanction_v_educate', '¿Qué diferencia hay entre sancionar y educar?', 'textarea', 'Enfoque pedagógico', true, 41),
(8, 'SECCIÓN VIII — CRITERIO Y ÉTICA DE STAFF', 'escalate_case', '¿Cuándo se debe escalar un caso a un superior?', 'textarea', 'Protocolos internos', true, 42),
(8, 'SECCIÓN VIII — CRITERIO Y ÉTICA DE STAFF', 'staff_neutrality', '¿Por qué el staff debe ser neutral siempre?', 'textarea', 'Imparcialidad', true, 43),
(8, 'SECCIÓN VIII — CRITERIO Y ÉTICA DE STAFF', 'friend_breaks_rules', '¿Qué harías si un amigo rompe las reglas?', 'textarea', 'Objetividad', true, 44),

-- SECCIÓN IX — SITUACIONES DE ALTA DIFICULTAD
(9, 'SECCIÓN IX — SITUACIONES DE ALTA DIFICULTAD', 'admin_fault_public', 'Un administrador comete una falta grave delante de jugadores. ¿Cómo procedes?', 'textarea', 'Manejo de crisis interna', true, 45),
(9, 'SECCIÓN IX — SITUACIONES DE ALTA DIFICULTAD', 'rules_not_covering', 'El reglamento no cubre una situación específica. ¿Qué criterio aplicas?', 'textarea', 'Sentido común y lógica', true, 46),
(9, 'SECCIÓN IX — SITUACIONES DE ALTA DIFICULTAD', 'total_blacklist_case', '¿Cuándo se justifica una blacklist total?', 'textarea', 'Gravedad máxima', true, 47),
(9, 'SECCIÓN IX — SITUACIONES DE ALTA DIFICULTAD', 'no_ck_justification', '¿Cuándo NO se debe aplicar CK aunque el rol sea agresivo?', 'textarea', 'Excepciones de CK', true, 48),

-- SECCIÓN X — VALORES Y COMPROMISO
(10, 'SECCIÓN X — VALORES Y COMPROMISO', 'staff_values_list', 'Enumera al menos 5 valores que debe tener un staff de Nación MX RP.', 'textarea', 'Lista de valores', true, 49),
(10, 'SECCIÓN X — VALORES Y COMPROMISO', 'sacrifice_commitment', '¿Qué estás dispuesto a sacrificar por el bienestar del servidor?', 'textarea', 'Dedicación', true, 50),
(10, 'SECCIÓN X — VALORES Y COMPROMISO', 'diff_applicants', '¿Qué te diferencia de otros postulantes?', 'textarea', 'Valor añadido', true, 51),
(10, 'SECCIÓN X — VALORES Y COMPROMISO', 'final_declaration', 'DECLARACIÓN FINAL: ¿Aceptas que toda la información es verdadera y cumplirás el reglamento?', 'select', '', true, 52);

-- 4. Actualizar opciones para la declaración final
UPDATE application_questions 
SET validation_rules = '{"options": ["Acepto", "No acepto"]}'::jsonb
WHERE question_key = 'final_declaration';
