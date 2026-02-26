"use client";

import React from "react";
import { MessageBubble } from "./MessageBubble";
import { MergeIndicator } from "./MergeIndicator";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import type { MergeEvent } from "@/types";
import { cn } from "@/lib/utils";

interface MessageListProps {
  messages: Array<{
    id: string;
    role: string;
    content: string;
  }>;
  threadId: string;
  isStreaming: boolean;
  compact?: boolean;
  mergeEvents?: MergeEvent[];
  /** ID of the message that spawned the next tangent panel — highlighted with an accent indicator */
  activeChildMessageId?: string;
  conversationId?: string;
  onOpenTangent: (
    threadId: string,
    messageId: string,
    selectedText: string,
    rect: DOMRect
  ) => void;
}

export function MessageList({
  messages,
  threadId,
  isStreaming,
  compact,
  mergeEvents = [],
  activeChildMessageId,
  conversationId,
  onOpenTangent,
}: MessageListProps) {
  const scrollRef = useAutoScroll(messages.length);

  // Map afterMessageId → MergeEvent[]
  const mergeMap = new Map<string, MergeEvent[]>();
  for (const event of mergeEvents) {
    const existing = mergeMap.get(event.afterMessageId) || [];
    existing.push(event);
    mergeMap.set(event.afterMessageId, existing);
  }

  return (
    <div
      ref={scrollRef}
      className={cn("flex-1 overflow-y-auto", compact ? "py-3 px-3" : "py-8")}
      style={{ background: "var(--color-bg-base)" }}
    >
      {/* Centered column for main thread */}
      <div className={cn(compact ? "" : "mx-auto w-full max-w-2xl px-4")}>
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center py-20">
            {!compact && (
              <>
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-full"
                  style={{ background: "var(--color-accent)", opacity: 0.9 }}
                >
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-base font-medium" style={{ color: "var(--color-text-primary)" }}>
                  How can I help you today?
                </p>
                <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
                  Highlight any response text to open a tangent thread
                </p>
              </>
            )}
            {compact && (
              <p className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                Start a tangent conversation...
              </p>
            )}
          </div>
        )}

        <div className={cn("flex flex-col", compact ? "gap-3" : "gap-6")}>
          {messages.map((message) => (
            <div
              key={message.id}
              className="relative"
              style={
                message.id === activeChildMessageId
                  ? { borderLeft: "3px solid var(--color-accent)", paddingLeft: "8px", marginLeft: "-11px", borderRadius: "2px" }
                  : undefined
              }
            >
              <MessageBubble
                message={message}
                threadId={threadId}
                compact={compact}
                conversationId={conversationId}
                onOpenTangent={onOpenTangent}
              />
              {mergeMap.get(message.id)?.map((event) => (
                <MergeIndicator key={event.id} mergeEvent={event} />
              ))}
            </div>
          ))}
        </div>

        {/* Typing indicator */}
        {isStreaming && messages[messages.length - 1]?.role === "user" && (
          <div className={cn("flex items-center", compact ? "mt-3 gap-2" : "mt-6 gap-3")}>
            {!compact && (
              <div
                className="h-6 w-6 rounded-full flex-shrink-0"
                style={{ background: "var(--color-accent)", opacity: 0.85 }}
              />
            )}
            <div className="flex gap-1 py-2">
              <div className="h-2 w-2 animate-bounce rounded-full" style={{ background: "var(--color-text-muted, #9B9B9B)", animationDelay: "0ms" }} />
              <div className="h-2 w-2 animate-bounce rounded-full" style={{ background: "var(--color-text-muted, #9B9B9B)", animationDelay: "150ms" }} />
              <div className="h-2 w-2 animate-bounce rounded-full" style={{ background: "var(--color-text-muted, #9B9B9B)", animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
