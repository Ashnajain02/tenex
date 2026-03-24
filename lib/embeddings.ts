import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { prisma } from "./prisma";
import { Prisma } from "@/lib/generated/prisma/client";

/**
 * Embedding service for semantic similarity search over the conversation tree.
 *
 * Architecture:
 *   - Embeddings are generated eagerly (fire-and-forget after message persistence)
 *   - Stored as pgvector columns on the messages table
 *   - Retrieved via HNSW-indexed cosine similarity queries
 *   - Scoped to ancestor thread chains (topology-aware, not flat)
 *
 * Model: text-embedding-3-small (1536 dimensions, $0.02/1M tokens)
 */

const embeddingModel = openai.embedding("text-embedding-3-small");

/** Minimum content length worth embedding — skip trivial messages like "ok" or "thanks" */
const MIN_CONTENT_LENGTH = 20;

/** Similarity threshold — don't inject messages below this relevance score */
const SIMILARITY_THRESHOLD = 0.6;

// ---------------------------------------------------------------------------
// Write path: generate and store embeddings
// ---------------------------------------------------------------------------

/**
 * Generates an embedding for a single message and stores it in the DB.
 * Intended to be called fire-and-forget after message persistence.
 *
 * Skips system messages and very short messages (below MIN_CONTENT_LENGTH)
 * since they add noise to retrieval without carrying much semantic signal.
 */
export async function embedMessage(messageId: string): Promise<void> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, content: true, role: true },
  });

  if (!message) return;
  if (message.role === "SYSTEM") return;
  if (message.content.length < MIN_CONTENT_LENGTH) return;

  // Truncate to ~8k chars (~2k tokens) — embedding models have input limits
  // and very long messages don't produce meaningfully better embeddings
  const text = message.content.slice(0, 8000);

  const { embedding } = await embed({
    model: embeddingModel,
    value: text,
  });

  const vectorString = `[${embedding.join(",")}]`;

  await prisma.$executeRaw`
    UPDATE "messages"
    SET "embedding" = ${vectorString}::vector
    WHERE "id" = ${messageId}
  `;
}

// ---------------------------------------------------------------------------
// Read path: semantic retrieval over ancestor threads
// ---------------------------------------------------------------------------

interface RetrievedMessage {
  id: string;
  role: string;
  content: string;
  threadId: string;
  similarity: number;
}

/**
 * Finds the most semantically relevant messages from a set of ancestor threads.
 *
 * This is the core of the "conversation-tree RAG" — instead of retrieving from
 * a flat document store, we scope the search to the specific ancestor chain
 * of the current thread, respecting the tree topology.
 *
 * @param query         - The current user message (used as the retrieval query)
 * @param threadIds     - Ancestor thread IDs to search within
 * @param limit         - Max number of messages to retrieve
 * @param excludeIds    - Message IDs to exclude (e.g., already included verbatim)
 * @returns             - Messages sorted by descending similarity, above threshold
 */
export async function findRelevantAncestorMessages(
  query: string,
  threadIds: string[],
  limit: number = 8,
  excludeIds: string[] = []
): Promise<RetrievedMessage[]> {
  if (threadIds.length === 0) return [];

  const { embedding } = await embed({
    model: embeddingModel,
    value: query.slice(0, 8000),
  });

  const vectorString = `[${embedding.join(",")}]`;

  // Build the query — scoped to ancestor threads, above similarity threshold,
  // excluding messages already present in the context window
  const results = await prisma.$queryRaw<RetrievedMessage[]>`
    SELECT
      "id",
      "role",
      "content",
      "thread_id" AS "threadId",
      1 - ("embedding" <=> ${vectorString}::vector) AS "similarity"
    FROM "messages"
    WHERE "thread_id" IN (${Prisma.join(threadIds)})
      AND "embedding" IS NOT NULL
      ${excludeIds.length > 0 ? Prisma.sql`AND "id" NOT IN (${Prisma.join(excludeIds)})` : Prisma.empty}
      AND 1 - ("embedding" <=> ${vectorString}::vector) > ${SIMILARITY_THRESHOLD}
    ORDER BY "embedding" <=> ${vectorString}::vector
    LIMIT ${limit}
  `;

  return results;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Collects all ancestor thread IDs for a given thread by walking up the tree.
 * Uses a recursive CTE for efficiency (single round-trip to the DB).
 *
 * Returns IDs in order from immediate parent to root.
 */
export async function getAncestorThreadIds(
  threadId: string
): Promise<string[]> {
  const ancestors = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH RECURSIVE ancestors AS (
      SELECT "parent_thread_id" AS "id"
      FROM "threads"
      WHERE "id" = ${threadId}
        AND "parent_thread_id" IS NOT NULL

      UNION ALL

      SELECT t."parent_thread_id"
      FROM "threads" t
      JOIN ancestors a ON t."id" = a."id"
      WHERE t."parent_thread_id" IS NOT NULL
    )
    SELECT "id" FROM ancestors
  `;

  return ancestors.map((a) => a.id);
}
