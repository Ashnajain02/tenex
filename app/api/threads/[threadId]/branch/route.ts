import { NextResponse } from "next/server";
import { generateText } from "ai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chatModel } from "@/lib/ai";

// POST: Branch a tangent thread into its own standalone conversation.
// Copies the tangent's messages into a new main thread so the user can
// continue the conversation independently.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  const { threadId } = await params;

  // Fetch the source thread and its messages
  const sourceThread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      conversation: { select: { userId: true } },
    },
  });

  if (!sourceThread || sourceThread.conversation.userId !== userId) {
    return new Response("Not found", { status: 404 });
  }

  // Generate a short AI title from the highlighted text (same pattern as auto-title)
  let title = "Branched conversation";
  if (sourceThread.highlightedText) {
    try {
      const { text: rawTitle } = await generateText({
        model: chatModel,
        prompt: `In 4 words or fewer, write a short title for a conversation exploring this topic: "${sourceThread.highlightedText.slice(0, 300)}". Reply with only the title — no quotes, no punctuation at the end.`,
      });
      title = rawTitle.trim().replace(/^["']|["']$/g, "").slice(0, 50) || title;
    } catch {
      // fall back to a truncated version of the highlighted text
      title = sourceThread.highlightedText.slice(0, 50);
    }
  }

  // Copy only USER and ASSISTANT messages from the tangent (SYSTEM messages
  // in the source thread are context-builder artifacts, not stored messages,
  // but filter defensively anyway)
  const sourceMessages = sourceThread.messages
    .filter((m) => m.role !== "SYSTEM")
    .map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    }));

  // Preamble messages for the new thread:
  //   1. Hidden SYSTEM message — gives the AI full branching context
  //   2. Visible ASSISTANT context bubble — styled callout showing the highlighted text
  //
  // We anchor the preamble timestamps to BEFORE the first source message so
  // that sorting by createdAt ASC always puts the context bubble at the top.
  const firstMessageTime =
    sourceMessages[0]?.createdAt ?? new Date();
  const systemTime = new Date(firstMessageTime.getTime() - 2000); // 2 s before
  const bubbleTime = new Date(firstMessageTime.getTime() - 1000); // 1 s before

  const preamble: Array<{
    role: "SYSTEM" | "ASSISTANT";
    content: string;
    createdAt: Date;
  }> = sourceThread.highlightedText
    ? [
        {
          role: "SYSTEM",
          content: `This conversation was branched from a parent discussion to explore the following highlighted text: "${sourceThread.highlightedText}". The messages below are from the original tangent thread.`,
          createdAt: systemTime,
        },
        {
          role: "ASSISTANT",
          content: `> **Branched from:** "${sourceThread.highlightedText.replace(/\n/g, "\n> ")}"`,
          createdAt: bubbleTime,
        },
      ]
    : [];

  // Create a new conversation with a main thread
  const result = await prisma.$transaction(async (tx) => {
    const newConversation = await tx.conversation.create({
      data: {
        userId,
        title,
        threads: {
          create: {
            depth: 0,
            status: "ACTIVE",
            messages: {
              create: [...preamble, ...sourceMessages],
            },
          },
        },
      },
      select: { id: true, title: true, updatedAt: true, createdAt: true },
    });

    return { conversation: newConversation };
  });

  return NextResponse.json(result, { status: 201 });
}
