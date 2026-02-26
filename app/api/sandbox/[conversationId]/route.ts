import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSandboxInfo } from "@/lib/e2b";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId } = await params;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation || conversation.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const info = await getSandboxInfo(conversationId);
  if (!info) {
    return Response.json({ active: false });
  }

  return Response.json({ active: true, sandboxId: info.sandboxId });
}
