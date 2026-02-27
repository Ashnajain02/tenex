import { generateText } from "ai";
import { chatModel } from "./ai";
import { prisma } from "./prisma";

/**
 * Generates a concise summary of a tangent thread's conversation.
 * Used when merging to provide a human-readable merge indicator.
 */
export async function generateMergeSummary(
  threadId: string
): Promise<string> {
  // Only load last 10 non-system messages to limit token usage
  const messages = await prisma.message.findMany({
    where: { threadId, role: { not: "SYSTEM" } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { role: true, content: true },
  });

  if (messages.length === 0) return "Empty tangent thread";

  // Reverse to chronological, truncate long individual messages
  const conversation = messages
    .reverse()
    .map((m) => `${m.role}: ${m.content.slice(0, 500)}`)
    .join("\n");

  const { text } = await generateText({
    model: chatModel,
    prompt: `Summarize the following tangent conversation in one short sentence (max 80 characters). Focus on what was discussed and concluded:\n\n${conversation}`,
  });

  return text.trim();
}
