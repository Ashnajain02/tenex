import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createConversationSchema } from "@/lib/validators";

// GET: List all conversations for the authenticated user
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const conversations = await prisma.conversation.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true, createdAt: true },
  });

  return NextResponse.json(conversations);
}

// POST: Create a new conversation with its main thread
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createConversationSchema.safeParse(body);
  const title = parsed.success ? parsed.data.title : undefined;

  const conversation = await prisma.conversation.create({
    data: {
      userId: session.user.id,
      title: title || "New Conversation",
      threads: {
        create: {
          depth: 0,
          status: "ACTIVE",
        },
      },
    },
    include: {
      threads: true,
    },
  });

  const mainThread = conversation.threads[0];

  return NextResponse.json({ conversation, mainThread }, { status: 201 });
}
