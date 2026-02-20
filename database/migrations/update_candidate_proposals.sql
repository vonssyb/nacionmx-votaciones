-- Migration: update_candidate_proposals.sql
-- Description: Actualiza las propuestas de los candidatos presidenciales (Camilo Cruz y Brandon Hernandez)

-- 1. Actualizar Propuestas de Brandon Hernandez (Movimiento Ciudadano)
UPDATE election_candidates 
SET proposals = 'Nuestra visión de gobierno se basa en resultados y compromiso con la nación. Fortaleceremos la seguridad mediante nuevas instituciones y coordinación directa con la Defensa. Impulsaremos un sistema de salud sólido, con instituciones y servicios de emergencia que garanticen atención rápida y digna. Aseguraremos una justicia firme, transparente y libre de corrupción. Escucharemos a la ciudadanía para convertir sus ideas en acciones reales. Modernizaremos la infraestructura y los servicios públicos para un crecimiento ordenado y funcional. Este es un proyecto que no se queda en palabras: este partido no promete, actúa.'
WHERE name = 'Brandon Hernandez' AND party = 'Movimiento Ciudadano';

-- 2. Actualizar Propuestas de Camilo Cruz (Partido Verde)
UPDATE election_candidates 
SET proposals = 'Nuestro compromiso es construir un país más justo, seguro y con oportunidades para todas y todos. Impulsaremos el aumento de salarios para mejorar la calidad de vida de las familias. Fortaleceremos los servicios públicos para que sean eficientes y accesibles. Combatiremos la criminalidad con prevención y acciones firmes. Brindaremos apoyos directos a quienes más lo necesiten. Fomentaremos la unión social mediante actividades comunitarias. Actuaremos con transparencia y sanciones claras contra la corrupción policial. Gobernaremos escuchando a la ciudadanía, porque solo así lograremos un futuro con bienestar, justicia y seguridad para nuestra nación.'
WHERE name = 'Camilo Cruz' AND party = 'Partido Verde';
