import { generateText } from "ai";
import { chatModel } from "./ai";
import { prisma } from "./prisma";
import { distillThreadKnowledge } from "./knowledge";

/**
 * Eager thread summarization and knowledge distillation.
 *
 * Called fire-and-forget after every assistant response. Checks whether the
 * thread has accumulated enough new messages to warrant regeneration, then:
 *   1. Generates a plain-text summary (for human display + fallback)
 *   2. Distills structured knowledge (for LLM context injection)
 *
 * Both are stored on the Thread row for instant retrieval by the context builder.
 */

/** Regenerate after this many new messages since the last update */
const SUMMARY_THRESHOLD = 20;

/**
 * Checks whether a thread's summary/knowledge is stale and regenerates if needed.
 */
export async function maybeUpdateThreadSummary(
  threadId: string
): Promise<void> {
  const [messageCount, thread] = await Promise.all([
    prisma.message.count({ where: { threadId } }),
    prisma.thread.findUnique({
      where: { id: threadId },
      select: { summaryMessageCount: true },
    }),
  ]);

  if (!thread) return;

  const newSinceLastSummary = messageCount - thread.summaryMessageCount;

  // Don't process threads that are too short or haven't changed enough
  if (messageCount < SUMMARY_THRESHOLD || newSinceLastSummary < SUMMARY_THRESHOLD) {
    return;
  }

  console.log(
    `[summarizer] Thread ${threadId}: ${messageCount} msgs, ` +
    `${newSinceLastSummary} new since last summary. Regenerating...`
  );

  // Run both operations in parallel — they're independent
  const [summary, knowledge] = await Promise.all([
    generatePlainSummary(threadId),
    distillThreadKnowledge(threadId),
  ]);

  await prisma.thread.update({
    where: { id: threadId },
    data: {
      summary,
      knowledge: knowledge ? JSON.parse(JSON.stringify(knowledge)) : undefined,
      summaryMessageCount: messageCount,
    },
  });

  console.log(
    `[summarizer] Thread ${threadId}: updated ` +
    `(summary: ${summary.length} chars, ` +
    `knowledge: ${knowledge ? Object.keys(knowledge).length + " fields" : "skipped"})`
  );
}

/**
 * Generates a plain-text paragraph summary of a thread.
 * Kept alongside structured knowledge as a human-readable fallback.
 */
async function generatePlainSummary(threadId: string): Promise<string> {
  const messages = await prisma.message.findMany({
    where: { threadId, role: { not: "SYSTEM" } },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });

  if (messages.length === 0) return "Empty thread.";

  const transcript = messages
    .map((m) => `${m.role}: ${m.content.slice(0, 300)}`)
    .join("\n");

  const { text } = await generateText({
    model: chatModel,
    prompt:
      "Summarize the following conversation into a single paragraph (3-5 sentences). " +
      "Capture the key topics discussed, important conclusions, and decisions made. " +
      "Write in third person. Be specific — include names, numbers, and technical details.\n\n" +
      transcript,
  });

  return text.trim();
}
