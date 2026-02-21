-- ============================================
-- NMX-CÓRTEX RAG MEMORY - FULL SETUP
-- ============================================

-- 1. Activar la extensión vectorial
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Eliminar tabla vieja si existe pero estaba mal hecha
DROP TABLE IF EXISTS ai_memory CASCADE;

-- 3. Crear la tabla ai_memory con TODAS las columnas necesarias
CREATE TABLE ai_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,
    summary TEXT NOT NULL,
    source_id TEXT NOT NULL,
    user_id TEXT,
    tags TEXT[],
    confidence FLOAT DEFAULT 1.0,
    embedding vector(3072), -- Gemini Embeddings
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Crear índices para buscar más rápido
CREATE INDEX IF NOT EXISTS idx_ai_memory_category ON ai_memory(category);
CREATE INDEX IF NOT EXISTS idx_ai_memory_user_id ON ai_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_memory_source_id ON ai_memory(source_id);

-- 5. Crear la función de búsqueda de memoria (RAG)
CREATE OR REPLACE FUNCTION match_ai_memories(
  query_embedding vector(3072),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  category text,
  summary text,
  source_id text,
  user_id text,
  tags text[],
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ai_memory.id,
    ai_memory.category,
    ai_memory.summary,
    ai_memory.source_id,
    ai_memory.user_id,
    ai_memory.tags,
    1 - (ai_memory.embedding <=> query_embedding) as similarity
  FROM ai_memory
  WHERE 1 - (ai_memory.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
