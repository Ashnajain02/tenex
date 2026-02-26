import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChatPage } from "@/components/chat/ChatPage";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { conversationId } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      threads: {
        where: { parentThreadId: null },
        take: 1,
      },
    },
  });

  if (!conversation || conversation.userId !== session.user.id) {
    redirect("/");
  }

  const mainThread = conversation.threads[0];
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

  return (
    <ChatPage
      conversationId={conversationId}
      mainThreadId={mainThread.id}
      initialMessages={initialMessages}
    />
  );
}
