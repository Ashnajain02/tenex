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

  // Fetch the thread and verify ownership
  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: { conversation: true },
  });

  if (!thread || thread.conversation.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  // Must be a tangent thread (has a parent)
  if (!thread.parentThreadId) {
    return NextResponse.json(
      { error: "Cannot merge the main thread" },
      { status: 400 }
    );
  }

  // Must be active
  if (thread.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "Thread is already merged or archived" },
      { status: 400 }
    );
  }

  // Find the latest message in the parent thread (merge indicator position)
  const latestParentMessage = await prisma.message.findFirst({
    where: { threadId: thread.parentThreadId },
    orderBy: { createdAt: "desc" },
  });

  if (!latestParentMessage) {
    return NextResponse.json(
      { error: "Parent thread has no messages" },
      { status: 400 }
    );
  }

  // Generate a summary of the tangent conversation
  let summary: string | null = null;
  try {
    summary = await generateMergeSummary(threadId);
  } catch {
    // If summary generation fails, proceed without it
  }

  // Create the merge event and update thread status in a transaction
  const mergeEvent = await prisma.$transaction(async (tx) => {
    const event = await tx.mergeEvent.create({
      data: {
        sourceThreadId: threadId,
        targetThreadId: thread.parentThreadId!,
        afterMessageId: latestParentMessage.id,
        summary,
      },
    });

    await tx.thread.update({
      where: { id: threadId },
      data: {
        status: "MERGED",
        mergedAt: new Date(),
      },
    });

    return event;
  });

  return NextResponse.json(mergeEvent);
}
