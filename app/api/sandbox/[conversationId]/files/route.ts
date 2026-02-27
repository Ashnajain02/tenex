import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listSandboxDir, readSandboxFile } from "@/lib/e2b";

export async function GET(
  req: Request,
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

  const url = new URL(req.url);
  const path = url.searchParams.get("path");
  if (!path) {
    return Response.json({ error: "Missing path parameter" }, { status: 400 });
  }

  // Try listing as a directory first; if that fails, read as a file
  try {
    const entries = await listSandboxDir(conversationId, path);
    // Sort: directories first, then files, alphabetically within each group
    entries.sort((a, b) => {
      if (a.type === "dir" && b.type !== "dir") return -1;
      if (a.type !== "dir" && b.type === "dir") return 1;
      return a.name.localeCompare(b.name);
    });
    return Response.json({ type: "directory", entries });
  } catch {
    // Not a directory — try reading as a file
    try {
      const content = await readSandboxFile(conversationId, path);
      return Response.json({ type: "file", content });
    } catch (err: unknown) {
      return Response.json(
        { error: err instanceof Error ? err.message : "Path not found" },
        { status: 404 }
      );
    }
  }
}
