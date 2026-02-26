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
  const messages = await prisma.message.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
  });

  if (messages.length === 0) return "Empty tangent thread";

  const conversation = messages
    .filter((m) => m.role !== "SYSTEM")
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  const { text } = await generateText({
    model: chatModel,
    prompt: `Summarize the following tangent conversation in one short sentence (max 80 characters). Focus on what was discussed and concluded:\n\n${conversation}`,
  });

  return text.trim();
}
