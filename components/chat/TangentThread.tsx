"use client";

import { useEffect, useRef } from "react";
import { useThreadChat } from "@/hooks/use-thread-chat";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import type { MergeEvent } from "@/types";

interface TangentThreadProps {
  threadId: string;
  parentThreadId: string;
  conversationId: string;
  activeChildMessageId?: string;
  activeHighlightedText?: string;
  /** Increment to trigger a re-fetch of messages from DB (e.g. after a child merges into this thread) */
  refreshTrigger?: number;
  /** Merge events where this thread is the target — shown as inline indicators */
  mergeEvents?: MergeEvent[];
  onOpenTangent: (
    threadId: string,
    messageId: string,
    selectedText: string,
    rect: DOMRect
  ) => void;
}

export function TangentThread({
  threadId,
  conversationId,
  activeChildMessageId,
  activeHighlightedText,
  refreshTrigger,
  mergeEvents = [],
  onOpenTangent,
}: TangentThreadProps) {
  const { messages, sendMessage, status, setMessages } = useThreadChat(threadId);

  const isLoading = status === "submitted" || status === "streaming";

  // Load messages from DB on mount — useChat starts empty, so we need to hydrate
  // from the API the first time the component appears (or reappears after being hidden).
  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    fetch(`/api/threads/${threadId}/messages`)
      .then((r) => r.json())
      .then(
        (dbMessages: Array<{ id: string; role: string; content: string; createdAt: string }>) => {
          if (dbMessages.length === 0) return;
          setMessages(
            dbMessages
              .filter((m) => m.role !== "SYSTEM")
              .map((m) => ({
                id: m.id,
                role: (m.role === "USER" ? "user" : "assistant") as "user" | "assistant",
                parts: [{ type: "text" as const, text: m.content }],
                createdAt: new Date(m.createdAt),
              }))
          );
        }
      )
      .catch(() => {});
  }, [threadId, setMessages]);

  // Re-fetch messages from DB so IDs match DB records (needed for merge-event indicators).
  // Same pattern as MainThread's refreshTrigger effect.
  useEffect(() => {
    if (!refreshTrigger) return;
    fetch(`/api/threads/${threadId}/messages`)
      .then((r) => r.json())
      .then(
        (dbMessages: Array<{ id: string; role: string; content: string; createdAt: string }>) => {
          setMessages(
            dbMessages
              .filter((m) => m.role !== "SYSTEM")
              .map((m) => ({
                id: m.id,
                role: (m.role === "USER" ? "user" : "assistant") as "user" | "assistant",
                parts: [{ type: "text" as const, text: m.content }],
                createdAt: new Date(m.createdAt),
              }))
          );
        }
      )
      .catch(() => {});
  }, [refreshTrigger, threadId, setMessages]);

  const displayMessages = messages.map((m) => ({
    id: m.id,
    role: m.role,
    content:
      m.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("") || "",
  }));

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <MessageList
        messages={displayMessages}
        threadId={threadId}
        isStreaming={status === "streaming"}
        mergeEvents={mergeEvents}
        onOpenTangent={onOpenTangent}
        activeChildMessageId={activeChildMessageId}
        activeHighlightedText={activeHighlightedText}
        conversationId={conversationId}
      />
      <ChatInput
        onSend={(text) => sendMessage({ text })}
        isLoading={isLoading}
        placeholder={displayMessages.length === 0 ? "Ask a question…" : undefined}
        conversationId={conversationId}
      />
    </div>
  );
}
