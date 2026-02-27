import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChatPage } from "@/components/chat/ChatPage";
import { reconstructTangentState } from "@/lib/tangent-utils";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { conversationId } = await params;

  // Fetch ALL threads (not just main) so we can reconstruct tangent state
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      threads: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!conversation || conversation.userId !== session.user.id) {
    redirect("/");
  }

  const mainThread = conversation.threads.find((t) => t.parentThreadId === null);
  if (!mainThread) redirect("/");

  // Fetch existing messages for the main thread
  const messages = await prisma.message.findMany({
    where: { threadId: mainThread.id },
    orderBy: { createdAt: "asc" },
  });

  const initialMessages = messages.map((m) => ({
    id: m.id,
    role: m.role.toLowerCase() as "user" | "assistant" | "system",
    content: m.content,
  }));

  // Reconstruct open tangent state from ACTIVE child threads
  const initialTangents = reconstructTangentState(
    conversation.threads,
    mainThread.id
  );

  return (
    <ChatPage
      conversationId={conversationId}
      mainThreadId={mainThread.id}
      initialMessages={initialMessages}
      initialTangents={initialTangents}
    />
  );
}
