"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

export function useThreadChat(threadId: string) {
  return useChat({
    id: `thread-${threadId}`,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      body: { threadId },
    }),
  });
}
