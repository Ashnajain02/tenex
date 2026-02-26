import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { executeCode } from "@/lib/e2b";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { conversationId, code } = await req.json();

  if (!conversationId || typeof code !== "string" || !code.trim()) {
    return Response.json(
      { error: "Missing conversationId or code" },
      { status: 400 }
    );
  }

  // Verify conversation ownership
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation || conversation.userId !== session.user.id) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (!process.env.E2B_API_KEY) {
    return Response.json(
      { error: "Code execution is not configured. Add E2B_API_KEY to your .env file." },
      { status: 503 }
    );
  }

  try {
    const result = await executeCode(conversationId, code);
    return Response.json(result);
  } catch (err: unknown) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Execution failed" },
      { status: 500 }
    );
  }
}
