"use client";

import React, { useMemo } from "react";
import Image from "next/image";
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
  /** The specific text to highlight within the active-child message */
  activeHighlightedText?: string;
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
  activeHighlightedText,
  conversationId,
  onOpenTangent,
}: MessageListProps) {
  const scrollRef = useAutoScroll(messages.length);

  // Map afterMessageId → MergeEvent[]
  const mergeMap = useMemo(() => {
    const map = new Map<string, MergeEvent[]>();
    for (const event of mergeEvents) {
      const existing = map.get(event.afterMessageId) || [];
      existing.push(event);
      map.set(event.afterMessageId, existing);
    }
    return map;
  }, [mergeEvents]);

  return (
    <div
      ref={scrollRef}
      className={cn("flex-1 overflow-y-auto", compact ? "py-3 px-3" : "py-8")}
      style={{ background: "var(--color-bg-base)" }}
    >
      {/* Centered column for main thread */}
      <div className={cn(compact ? "" : "mx-auto w-full max-w-2xl px-4")}>
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center py-24">
            {!compact && (
              <>
                <div className="mb-6">
                  <Image src="/logo.svg" alt="" width={40} height={40} className="h-10 w-10 opacity-60" />
                </div>
                <p className="text-lg font-medium" style={{ color: "var(--color-text-primary)" }}>
                  How can I help you today?
                </p>
                <p className="mt-2 text-sm" style={{ color: "var(--color-text-muted)" }}>
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

        <div className={cn("flex flex-col", compact ? "gap-3" : "gap-5")}>
          {messages.map((message) => {
            // Skip empty assistant messages while streaming — show typing dots instead
            if (
              isStreaming &&
              message.role === "assistant" &&
              !message.content.trim() &&
              message.id === messages[messages.length - 1]?.id
            ) {
              return null;
            }

            return (
              <div
                key={message.id}
                className="relative"
                style={
                  message.id === activeChildMessageId
                    ? { borderLeft: "2px solid var(--color-accent)", paddingLeft: "10px", marginLeft: "-12px", borderRadius: "2px" }
                    : undefined
                }
              >
                <MessageBubble
                  message={message}
                  threadId={threadId}
                  compact={compact}
                  conversationId={conversationId}
                  highlightedText={
                    message.id === activeChildMessageId
                      ? activeHighlightedText
                      : undefined
                  }
                  onOpenTangent={onOpenTangent}
                />
                {mergeMap.get(message.id)?.map((event) => (
                  <MergeIndicator key={event.id} mergeEvent={event} />
                ))}
              </div>
            );
          })}
        </div>

        {/* Typing indicator — shows while AI is processing before text appears */}
        {isStreaming && (!messages[messages.length - 1]?.content.trim() || messages[messages.length - 1]?.role === "user") && (
          <div className={cn("flex items-center", compact ? "mt-3 gap-2" : "mt-6 gap-3")}>
            <Image
              src="/logo.svg"
              alt=""
              width={compact ? 20 : 24}
              height={compact ? 20 : 24}
              className={cn("flex-shrink-0", compact ? "h-5 w-5" : "h-6 w-6")}
            />
            <div className="flex items-center gap-1">
              <span className="typing-dot" style={{ animationDelay: "0ms" }} />
              <span className="typing-dot" style={{ animationDelay: "150ms" }} />
              <span className="typing-dot" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
