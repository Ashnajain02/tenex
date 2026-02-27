import type { TangentWindowState } from "@/types";

interface ThreadData {
  id: string;
  parentThreadId: string | null;
  parentMessageId: string | null;
  highlightedText: string | null;
  depth: number;
  status: string;
}

/**
 * Reconstruct open tangent state from a flat list of threads.
 * Filters for ACTIVE child threads with valid ancestor chains.
 * Used by both the server component (page.tsx) and the client (ChatPage).
 */
export function reconstructTangentState(
  threads: ThreadData[],
  mainThreadId: string
): TangentWindowState[] {
  const activeChildThreads = threads.filter(
    (t) => t.parentThreadId !== null && t.status === "ACTIVE"
  );

  const activeById = new Map(activeChildThreads.map((t) => [t.id, t]));
  const result: TangentWindowState[] = [];

  for (const thread of activeChildThreads) {
    let current = thread;
    let valid = true;
    const visited = new Set<string>();

    while (
      current.parentThreadId !== null &&
      current.parentThreadId !== mainThreadId
    ) {
      if (visited.has(current.id)) {
        valid = false;
        break;
      }
      visited.add(current.id);
      const parent = activeById.get(current.parentThreadId);
      if (!parent) {
        valid = false;
        break;
      }
      current = parent;
    }

    if (valid) {
      result.push({
        threadId: thread.id,
        parentThreadId:
          thread.parentThreadId === mainThreadId
            ? "main"
            : thread.parentThreadId!,
        parentMessageId: thread.parentMessageId ?? "",
        highlightedText: thread.highlightedText ?? "",
        depth: thread.depth,
      });
    }
  }

  return result;
}
