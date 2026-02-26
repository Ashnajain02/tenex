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
