-- Habilitar extensión pgvector si no existe
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- Añadir columna de embedding a ai_memory (text-embedding-004 de Gemini usa 768 dimensiones)
ALTER TABLE public.ai_memory 
ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Crear un índice IVFFlat para búsquedas rápidas (mejora rendimiento)
-- Note: 'lists' depends on rows. 100 lists is a good default for < 1M rows
CREATE INDEX IF NOT EXISTS ai_memory_embedding_idx 
ON public.ai_memory USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- Función RPC para buscar memorias similares usando distancia de coseno
CREATE OR REPLACE FUNCTION match_ai_memories (
  query_embedding vector(768),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  summary text,
  tags text[],
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    ai_memory.id,
    ai_memory.summary,
    ai_memory.tags,
    1 - (ai_memory.embedding <=> query_embedding) AS similarity
  FROM ai_memory
  WHERE 1 - (ai_memory.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
$$;
