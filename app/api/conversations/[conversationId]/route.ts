import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { closeSandbox } from "@/lib/e2b";

// GET: Get conversation with its thread tree
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { conversationId } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      threads: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!conversation || conversation.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  return NextResponse.json(conversation);
}

// PATCH: Update conversation title
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { conversationId } = await params;
  const { title } = await req.json();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation || conversation.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { title },
  });

  return NextResponse.json(updated);
}

// DELETE: Delete conversation and all related data
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { conversationId } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { threads: { select: { id: true } } },
  });

  if (!conversation || conversation.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  const threadIds = conversation.threads.map((t) => t.id);

  await prisma.$transaction(async (tx) => {
    // 1. Delete merge events — they reference Thread and Message with no cascade
    if (threadIds.length > 0) {
      await tx.mergeEvent.deleteMany({
        where: {
          OR: [
            { sourceThreadId: { in: threadIds } },
            { targetThreadId: { in: threadIds } },
          ],
        },
      });

      // 2. Clear self-referential FKs on threads (parentThreadId, parentMessageId)
      //    so the cascade delete can proceed without FK constraint violations
      await tx.thread.updateMany({
        where: { conversationId },
        data: { parentThreadId: null, parentMessageId: null },
      });
    }

    // 3. Delete conversation — now cascades cleanly to threads → messages
    await tx.conversation.delete({ where: { id: conversationId } });
  });

  // Kill any active sandbox for this conversation
  await closeSandbox(conversationId).catch(() => {});

  return new Response(null, { status: 204 });
}
