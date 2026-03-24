-- AlterTable: add structured knowledge field
ALTER TABLE "threads" ADD COLUMN "knowledge" JSONB;

-- Enable pgvector extension (Neon supports this natively)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column for semantic similarity search
ALTER TABLE "messages" ADD COLUMN "embedding" vector(1536);

-- HNSW index for fast cosine similarity queries
-- HNSW is preferred over IVFFlat: no training data required, better recall
CREATE INDEX "messages_embedding_hnsw_idx"
  ON "messages"
  USING hnsw ("embedding" vector_cosine_ops);
