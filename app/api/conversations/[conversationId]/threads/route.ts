import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTangentSchema } from "@/lib/validators";

// POST: Create a new tangent thread
export async function POST(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { conversationId } = await params;

  // Verify conversation ownership
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation || conversation.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  const body = await req.json();
  const parsed = createTangentSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { parentThreadId, highlightedText } = parsed.data;

  // Validate parent thread belongs to this conversation
  const parentThread = await prisma.thread.findUnique({
    where: { id: parentThreadId },
  });

  if (!parentThread || parentThread.conversationId !== conversationId) {
    return NextResponse.json(
      { error: "Parent thread not found in this conversation" },
      { status: 400 }
    );
  }

  // Resolve the latest message in the parent thread server-side.
  // The client cannot reliably pass a DB message ID because the AI SDK
  // assigns its own ephemeral IDs to streamed messages.
  const latestMessage = await prisma.message.findFirst({
    where: { threadId: parentThreadId },
    orderBy: { createdAt: "desc" },
  });

  // Create the tangent thread
  const tangentThread = await prisma.thread.create({
    data: {
      conversationId,
      parentThreadId,
      parentMessageId: latestMessage?.id ?? null,
      highlightedText,
      depth: parentThread.depth + 1,
      status: "ACTIVE",
    },
  });

  return NextResponse.json(tangentThread, { status: 201 });
}
