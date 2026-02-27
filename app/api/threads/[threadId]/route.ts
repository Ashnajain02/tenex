import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Get thread details including merge events
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { threadId } = await params;

  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: {
      conversation: true,
      mergesAsTarget: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!thread || thread.conversation.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  return NextResponse.json(thread);
}

// PATCH: Archive a tangent thread (and cascade-archive its ACTIVE descendants)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { threadId } = await params;
  const body = await req.json();

  if (body.status !== "ARCHIVED") {
    return NextResponse.json(
      { error: "Only ARCHIVED status is supported" },
      { status: 400 }
    );
  }

  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: { conversation: true },
  });

  if (!thread || thread.conversation.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  if (!thread.parentThreadId) {
    return NextResponse.json(
      { error: "Cannot archive the main thread" },
      { status: 400 }
    );
  }

  if (thread.status !== "ACTIVE") {
    // Already archived or merged — treat as success (idempotent)
    return NextResponse.json({ archived: [] });
  }

  // BFS to collect all ACTIVE descendants
  const toArchive: string[] = [threadId];
  const queue: string[] = [threadId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const children = await prisma.thread.findMany({
      where: {
        parentThreadId: currentId,
        status: "ACTIVE",
        conversationId: thread.conversationId,
      },
      select: { id: true },
    });
    for (const child of children) {
      toArchive.push(child.id);
      queue.push(child.id);
    }
  }

  await prisma.thread.updateMany({
    where: { id: { in: toArchive } },
    data: { status: "ARCHIVED" },
  });

  return NextResponse.json({ archived: toArchive });
}
