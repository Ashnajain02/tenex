import { prisma } from "./prisma";
import {
  findRelevantAncestorMessages,
  getAncestorThreadIds,
} from "./embeddings";
import {
  formatKnowledgeForContext,
  type ThreadKnowledge,
} from "./knowledge";

/**
 * Context builder with hierarchical compression and semantic retrieval.
 *
 * Architecture:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ Grandparent+ threads  →  Structured knowledge only         │
 *   │ Immediate parent      →  Knowledge + last N messages       │
 *   │ Current thread        →  ALL messages + merged tangents    │
 *   │ Semantic retrieval    →  Top-K relevant msgs from ancestors│
 *   └─────────────────────────────────────────────────────────────┘
 *
 * The semantic retrieval layer (pgvector cosine similarity) supplements
 * the hierarchical compression by cherry-picking the most relevant
 * ancestor messages — regardless of how far back they are — and
 * injecting them into the context. This means a tangent about
 * "RSA encryption" branched from a long CS lecture will pull in the
 * cryptography messages from 40 messages ago, not the unrelated
 * sorting algorithm discussion from 5 messages ago.
 */

interface ContextMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/** How many recent parent messages to keep verbatim (for immediate parent). */
const PARENT_RECENT_COUNT = 10;

/** Max semantically retrieved messages to inject from ancestors. */
const SEMANTIC_RETRIEVAL_LIMIT = 6;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Builds the full context message array for a given thread.
 *
 * @param threadId     - The thread to build context for
 * @param currentQuery - The latest user message (used as the semantic retrieval query).
 *                       When omitted, semantic retrieval is skipped.
 */
export async function buildContextForThread(
  threadId: string,
  currentQuery?: string
): Promise<ContextMessage[]> {
  const thread = await prisma.thread.findUniqueOrThrow({
    where: { id: threadId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
      mergesAsTarget: {
        include: {
          sourceThread: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const context: ContextMessage[] = [];

  // Track message IDs already included verbatim — used to deduplicate
  // against semantic retrieval results
  const includedMessageIds = new Set<string>();

  // ── Step 1: Ancestor context (compressed) ──────────────────────────

  if (thread.parentThreadId && thread.parentMessageId) {
    const ancestorMessages = await buildAncestorContext(
      thread.parentThreadId,
      thread.parentMessageId,
      thread.highlightedText
    );

    for (const msg of ancestorMessages) {
      context.push(msg.contextMessage);
      if (msg.messageId) includedMessageIds.add(msg.messageId);
    }
  }

  // ── Step 2: Current thread messages + merged tangent injection ─────

  const mergeMap = buildMergeMap(thread.mergesAsTarget);

  for (const msg of thread.messages) {
    context.push({
      role: msg.role.toLowerCase() as ContextMessage["role"],
      content: msg.content,
    });
    includedMessageIds.add(msg.id);

    const mergedContext = mergeMap.get(msg.id);
    if (mergedContext) {
      context.push(...mergedContext);
    }
  }

  // ── Step 3: Semantic retrieval from ancestor threads ───────────────
  //
  // This runs AFTER building the base context so we know which messages
  // are already included and can deduplicate. Retrieved messages are
  // injected as a clearly-labeled block before the current thread.

  if (currentQuery && thread.parentThreadId) {
    const ancestorIds = await getAncestorThreadIds(threadId);

    if (ancestorIds.length > 0) {
      const relevantMessages = await findRelevantAncestorMessages(
        currentQuery,
        ancestorIds,
        SEMANTIC_RETRIEVAL_LIMIT,
        Array.from(includedMessageIds)
      );

      if (relevantMessages.length > 0) {
        // Insert the semantic retrieval block just before the current
        // thread's messages (after ancestor context, before own messages)
        const insertIndex = context.length - thread.messages.length;
        const retrievalBlock = buildRetrievalBlock(relevantMessages);
        context.splice(insertIndex, 0, ...retrievalBlock);
      }
    }
  }

  return context;
}

// ---------------------------------------------------------------------------
// Ancestor context assembly (hierarchical compression)
// ---------------------------------------------------------------------------

interface TaggedContextMessage {
  contextMessage: ContextMessage;
  messageId?: string; // present for verbatim messages, absent for system markers
}

/**
 * Builds compressed context for the immediate parent thread.
 *
 * If the parent has structured knowledge: injects it + last N verbatim messages.
 * If no knowledge available: falls back to plain summary + last N messages.
 * If neither: includes all messages up to the cutoff (short thread).
 *
 * For grandparent+ ancestors, recursively emits knowledge-only context.
 */
async function buildAncestorContext(
  parentThreadId: string,
  parentMessageId: string,
  highlightedText: string | null
): Promise<TaggedContextMessage[]> {
  const parentThread = await prisma.thread.findUnique({
    where: { id: parentThreadId },
    select: {
      id: true,
      parentThreadId: true,
      parentMessageId: true,
      highlightedText: true,
      summary: true,
      knowledge: true,
      depth: true,
    },
  });

  if (!parentThread) return [];

  const result: TaggedContextMessage[] = [];

  // Recurse into grandparent+ (knowledge-only compression)
  if (parentThread.parentThreadId && parentThread.parentMessageId) {
    const grandparentContext = await buildGrandparentContext(
      parentThread.parentThreadId,
      parentThread.highlightedText
    );
    result.push(...grandparentContext);
  }

  // Fetch parent messages up to the branch point
  const parentMessages = await prisma.message.findMany({
    where: { threadId: parentThreadId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true },
  });

  const cutoffIndex = parentMessages.findIndex(
    (m) => m.id === parentMessageId
  );
  const relevantMessages = parentMessages.slice(0, cutoffIndex + 1);

  // Determine compression strategy based on available data
  const knowledge = parentThread.knowledge as ThreadKnowledge | null;
  const hasCompressedContext = knowledge || parentThread.summary;
  const isLongEnoughToCompress =
    relevantMessages.length > PARENT_RECENT_COUNT;

  if (hasCompressedContext && isLongEnoughToCompress) {
    // Inject compressed older context
    if (knowledge) {
      result.push({
        contextMessage: {
          role: "system",
          content: formatKnowledgeForContext(
            knowledge,
            `parent thread (depth ${parentThread.depth})`
          ),
        },
      });
    } else if (parentThread.summary) {
      result.push({
        contextMessage: {
          role: "system",
          content: `[Summary of earlier conversation in parent thread: ${parentThread.summary}]`,
        },
      });
    }

    // Include only the most recent messages verbatim
    const recentMessages = relevantMessages.slice(-PARENT_RECENT_COUNT);
    for (const msg of recentMessages) {
      result.push({
        contextMessage: {
          role: msg.role.toLowerCase() as ContextMessage["role"],
          content: msg.content,
        },
        messageId: msg.id,
      });
    }
  } else {
    // Thread is short or no compressed context available — include all
    for (const msg of relevantMessages) {
      result.push({
        contextMessage: {
          role: msg.role.toLowerCase() as ContextMessage["role"],
          content: msg.content,
        },
        messageId: msg.id,
      });
    }
  }

  // Tangent focus marker
  if (highlightedText) {
    result.push({
      contextMessage: {
        role: "system",
        content:
          `[Tangent thread opened. The user highlighted the following text to explore further: "${highlightedText}". ` +
          `Focus your responses on this topic. Use the same formatting rules as the main thread — ` +
          `all source citations must be clickable markdown links with real URLs, never plain text labels like [Source].]`,
      },
    });
  }

  return result;
}

/**
 * Builds knowledge-only context for grandparent and higher ancestors.
 * Recursively walks up the tree, emitting only structured knowledge
 * (or plain summary as fallback) for each ancestor.
 */
async function buildGrandparentContext(
  threadId: string,
  childHighlightedText: string | null
): Promise<TaggedContextMessage[]> {
  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    select: {
      id: true,
      parentThreadId: true,
      highlightedText: true,
      summary: true,
      knowledge: true,
      depth: true,
    },
  });

  if (!thread) return [];

  const result: TaggedContextMessage[] = [];

  // Recurse to higher ancestors first (so context reads top-down)
  if (thread.parentThreadId) {
    const higherContext = await buildGrandparentContext(
      thread.parentThreadId,
      thread.highlightedText
    );
    result.push(...higherContext);
  }

  // Emit this ancestor's knowledge or summary
  const knowledge = thread.knowledge as ThreadKnowledge | null;
  if (knowledge) {
    result.push({
      contextMessage: {
        role: "system",
        content: formatKnowledgeForContext(
          knowledge,
          `ancestor thread (depth ${thread.depth})`
        ),
      },
    });
  } else if (thread.summary) {
    result.push({
      contextMessage: {
        role: "system",
        content: `[Ancestor thread summary (depth ${thread.depth}): ${thread.summary}]`,
      },
    });
  }

  // Note the tangent transition
  if (childHighlightedText) {
    result.push({
      contextMessage: {
        role: "system",
        content: `[A tangent was opened from this thread to explore: "${childHighlightedText}"]`,
      },
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Semantic retrieval formatting
// ---------------------------------------------------------------------------

/**
 * Formats semantically retrieved messages into a labeled context block.
 */
function buildRetrievalBlock(
  messages: Array<{
    role: string;
    content: string;
    similarity: number;
  }>
): ContextMessage[] {
  const block: ContextMessage[] = [];

  block.push({
    role: "system",
    content:
      "[The following messages were retrieved from earlier in the conversation " +
      "because they are semantically relevant to the current discussion:]",
  });

  for (const msg of messages) {
    block.push({
      role: msg.role.toLowerCase() as ContextMessage["role"],
      content: msg.content,
    });
  }

  block.push({
    role: "system",
    content: "[End of retrieved context.]",
  });

  return block;
}

// ---------------------------------------------------------------------------
// Merged tangent handling
// ---------------------------------------------------------------------------

/**
 * Builds a map from afterMessageId → context messages for merged tangents.
 *
 * Prefers structured knowledge from the source thread when available,
 * falls back to the merge event's summary.
 */
function buildMergeMap(
  merges: Array<{
    afterMessageId: string;
    summary: string | null;
    sourceThread: {
      knowledge: unknown;
      summary: string | null;
    };
  }>
): Map<string, ContextMessage[]> {
  const mergeMap = new Map<string, ContextMessage[]>();

  for (const merge of merges) {
    const tangentContext: ContextMessage[] = [];
    const knowledge = merge.sourceThread.knowledge as ThreadKnowledge | null;

    if (knowledge) {
      tangentContext.push({
        role: "system",
        content: formatKnowledgeForContext(knowledge, "merged tangent"),
      });
    } else {
      const summary = merge.summary || merge.sourceThread.summary;
      if (summary) {
        tangentContext.push({
          role: "system",
          content: `[Merged tangent thread summary: ${summary}]`,
        });
      }
    }

    if (tangentContext.length > 0) {
      tangentContext.push({
        role: "system",
        content: "[End of merged tangent context.]",
      });

      const existing = mergeMap.get(merge.afterMessageId) || [];
      existing.push(...tangentContext);
      mergeMap.set(merge.afterMessageId, existing);
    }
  }

  return mergeMap;
}
