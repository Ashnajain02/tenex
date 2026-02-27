"use client";

import { useEffect, useRef } from "react";
import { useThreadChat } from "@/hooks/use-thread-chat";
import { useConversationStore } from "@/store/conversation-store";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { SandboxStatus } from "./SandboxStatus";
import type { MergeEvent } from "@/types";

interface MainThreadProps {
  threadId: string;
  conversationId: string;
  mergeEvents?: MergeEvent[];
  /** ID of the message that spawned the currently visible tangent panel */
  activeChildMessageId?: string;
  /** The highlighted text within the active-child message */
  activeHighlightedText?: string;
  onOpenTangent: (
    threadId: string,
    messageId: string,
    selectedText: string,
    rect: DOMRect
  ) => void;
  initialMessages?: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
  }>;
  refreshTrigger?: number;
}

export function MainThread({
  threadId,
  conversationId,
  mergeEvents = [],
  activeChildMessageId,
  activeHighlightedText,
  onOpenTangent,
  initialMessages,
  refreshTrigger,
}: MainThreadProps) {
  const { messages, sendMessage, status, setMessages } =
    useThreadChat(threadId);
  const { fetchConversations } = useConversationStore();
  const prevStatusRef = useRef(status);

  // Load initial messages from DB on mount
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0 && messages.length === 0) {
      setMessages(
        initialMessages.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          parts: [{ type: "text" as const, text: m.content }],
          createdAt: new Date(),
        }))
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessages, setMessages]);

  // Refresh sidebar title once streaming finishes (server may have auto-titled the conversation)
  useEffect(() => {
    if (prevStatusRef.current === "streaming" && status === "ready") {
      fetchConversations();
    }
    prevStatusRef.current = status;
  }, [status, fetchConversations]);

  // After a merge, re-fetch messages from DB so IDs match the merge event's afterMessageId
  useEffect(() => {
    if (!refreshTrigger) return;
    fetch(`/api/threads/${threadId}/messages`)
      .then((r) => r.json())
      .then((dbMessages: Array<{ id: string; role: string; content: string; createdAt: string }>) => {
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
      })
      .catch(() => {});
  }, [refreshTrigger, threadId, setMessages]);

  const isLoading = status === "submitted" || status === "streaming";

  // Extract text content from UIMessage parts
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
    <div className="flex h-full flex-col">
      <SandboxStatus conversationId={conversationId} />
      <MessageList
        messages={displayMessages}
        threadId={threadId}
        isStreaming={status === "streaming"}
        mergeEvents={mergeEvents}
        activeChildMessageId={activeChildMessageId}
        activeHighlightedText={activeHighlightedText}
        conversationId={conversationId}
        onOpenTangent={onOpenTangent}
      />
      <ChatInput
        onSend={(text) => sendMessage({ text })}
        isLoading={isLoading}
        conversationId={conversationId}
      />
    </div>
  );
}
