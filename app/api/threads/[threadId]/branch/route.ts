import { NextResponse } from "next/server";
import { generateText } from "ai";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { chatModel } from "@/lib/ai";

// POST: Branch a tangent thread into its own standalone conversation.
// Copies the tangent's messages into a new main thread so the user can
// continue the conversation independently. Preserves merge events so
// the MergeIndicator UI works exactly the same.
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

  // Fetch the source thread with messages and any merge events targeting it
  const sourceThread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      conversation: { select: { userId: true } },
      mergesAsTarget: {
        orderBy: { createdAt: "asc" },
        select: {
          sourceThreadId: true,
          afterMessageId: true,
          summary: true,
        },
      },
    },
  });

  if (!sourceThread || sourceThread.conversation.userId !== userId) {
    return new Response("Not found", { status: 404 });
  }

  // Use highlighted text as immediate title — AI refinement happens async
  const title = sourceThread.highlightedText
    ? sourceThread.highlightedText.slice(0, 50)
    : "Branched conversation";

  // Copy only USER and ASSISTANT messages (filter out SYSTEM)
  const sourceMessages = sourceThread.messages
    .filter((m) => m.role !== "SYSTEM")
    .map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    }));

  // Track which old message IDs we need to map (for merge events)
  const oldMessageIds = sourceThread.messages
    .filter((m) => m.role !== "SYSTEM")
    .map((m) => m.id);

  // Preamble messages for the new thread
  const firstMessageTime = sourceMessages[0]?.createdAt ?? new Date();
  const systemTime = new Date(firstMessageTime.getTime() - 2000);
  const bubbleTime = new Date(firstMessageTime.getTime() - 1000);

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

  const preambleCount = preamble.length;

  // Create conversation + thread + messages, then replicate merge events
  const result = await prisma.$transaction(async (tx) => {
    // Create conversation with thread and messages
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
      include: {
        threads: {
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
              select: { id: true },
            },
          },
        },
      },
    });

    const newThread = newConversation.threads[0];
    const newMessageIds = newThread.messages.map((m) => m.id);

    // Build old→new message ID mapping (skip preamble messages)
    const oldToNewId = new Map<string, string>();
    for (let i = 0; i < oldMessageIds.length; i++) {
      const newIdx = preambleCount + i;
      if (newIdx < newMessageIds.length) {
        oldToNewId.set(oldMessageIds[i], newMessageIds[newIdx]);
      }
    }

    // Replicate merge events so MergeIndicator works identically
    for (const merge of sourceThread.mergesAsTarget) {
      const newAfterMessageId = oldToNewId.get(merge.afterMessageId);
      if (newAfterMessageId) {
        await tx.mergeEvent.create({
          data: {
            sourceThreadId: merge.sourceThreadId, // points to original merged thread (still in DB)
            targetThreadId: newThread.id,
            afterMessageId: newAfterMessageId,
            summary: merge.summary,
          },
        });
      }
    }

    return {
      conversation: {
        id: newConversation.id,
        title: newConversation.title,
        updatedAt: newConversation.updatedAt,
        createdAt: newConversation.createdAt,
      },
    };
  });

  // Fire-and-forget: generate a better AI title and backfill it
  if (sourceThread.highlightedText) {
    generateText({
      model: chatModel,
      prompt: `In 4 words or fewer, write a short title for a conversation exploring this topic: "${sourceThread.highlightedText.slice(0, 300)}". Reply with only the title — no quotes, no punctuation at the end.`,
    })
      .then(({ text: rawTitle }) => {
        const aiTitle = rawTitle.trim().replace(/^["']|["']$/g, "").slice(0, 50);
        if (aiTitle) {
          return prisma.conversation.update({
            where: { id: result.conversation.id },
            data: { title: aiTitle },
          });
        }
      })
      .catch(() => {}); // non-critical
  }

  return NextResponse.json(result, { status: 201 });
}
