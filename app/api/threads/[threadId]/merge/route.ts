import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateMergeSummary } from "@/lib/merge";

// POST: Merge this tangent thread into its parent
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  

  const { threadId } = await params;

  // Fetch thread + latest parent message in parallel
  const [thread, latestParentMessage] = await Promise.all([
    prisma.thread.findUnique({
      where: { id: threadId },
      include: { conversation: { select: { userId: true, id: true } } },
    }),
    // We need the threadId's parentThreadId for this query, but we can't
    // use it before the first query completes. Instead, do a sub-select:
    prisma.thread.findUnique({
      where: { id: threadId },
      select: { parentThreadId: true },
    }).then((t) =>
      t?.parentThreadId
        ? prisma.message.findFirst({
            where: { threadId: t.parentThreadId },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          })
        : null
    ),
  ]);

  if (!thread || thread.conversation.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  if (!thread.parentThreadId) {
    return NextResponse.json(
      { error: "Cannot merge the main thread" },
      { status: 400 }
    );
  }

  if (thread.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Thread is already merged or archived" },
      { status: 400 }
    );
  }

  if (!latestParentMessage) {
    return NextResponse.json(
      { error: "Parent thread has no messages" },
      { status: 400 }
    );
  }

  // Batch-fetch ALL active descendants in ONE query instead of N+1 BFS
  const allActiveThreads = await prisma.thread.findMany({
    where: {
      conversationId: thread.conversation.id,
      status: "ACTIVE",
    },
    select: { id: true, parentThreadId: true },
  });

  // Build parent→children map and walk it in-memory
  const childrenMap = new Map<string, string[]>();
  for (const t of allActiveThreads) {
    if (t.parentThreadId) {
      const existing = childrenMap.get(t.parentThreadId) || [];
      existing.push(t.id);
      childrenMap.set(t.parentThreadId, existing);
    }
  }

  const toArchive: string[] = [];
  const queue = [threadId];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = childrenMap.get(currentId) || [];
    for (const childId of children) {
      toArchive.push(childId);
      queue.push(childId);
    }
  }

  // Single transaction: create merge event (no summary yet) + update statuses
  const mergeEvent = await prisma.$transaction(async (tx) => {
    const event = await tx.mergeEvent.create({
      data: {
        sourceThreadId: threadId,
        targetThreadId: thread.parentThreadId!,
        afterMessageId: latestParentMessage.id,
        summary: null, // filled in asynchronously below
      },
    });

    await tx.thread.update({
      where: { id: threadId },
      data: { status: "MERGED", mergedAt: new Date() },
    });

    if (toArchive.length > 0) {
      await tx.thread.updateMany({
        where: { id: { in: toArchive } },
        data: { status: "ARCHIVED" },
      });
    }

    return event;
  });

  // Fire-and-forget: generate AI summary and backfill it
  generateMergeSummary(threadId)
    .then((summary) =>
      prisma.mergeEvent.update({
        where: { id: mergeEvent.id },
        data: { summary },
      })
    )
    .catch(() => {}); // non-critical

  return NextResponse.json(mergeEvent);
}
