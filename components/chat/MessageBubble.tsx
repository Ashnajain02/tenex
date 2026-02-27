"use client";

import { memo, useRef } from "react";
import { useTextSelection } from "@/hooks/use-text-selection";
import { useTextHighlight } from "@/hooks/use-text-highlight";
import { MarkdownContent } from "./MarkdownContent";
import { TextSelectionMenu } from "./TextSelectionMenu";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: {
    id: string;
    role: string;
    content: string;
  };
  threadId: string;
  compact?: boolean;
  conversationId?: string;
  highlightedText?: string;
  onOpenTangent: (
    threadId: string,
    messageId: string,
    selectedText: string,
    rect: DOMRect
  ) => void;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  threadId,
  compact,
  conversationId,
  highlightedText,
  onOpenTangent,
}: MessageBubbleProps) {
  const { ref, selectedText, selectionRect, clearSelection } = useTextSelection();
  const contentRef = useRef<HTMLDivElement>(null);

  // Apply DOM-based text highlighting
  useTextHighlight(contentRef, highlightedText, message.content);

  if (message.role === "system") return null;

  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      {/* Assistant avatar — logo */}
      {!isUser && (
        <Image
          src="/logo.svg"
          alt=""
          width={compact ? 20 : 24}
          height={compact ? 20 : 24}
          className={cn("flex-shrink-0 mt-1.5 mr-3", compact ? "h-5 w-5" : "h-6 w-6")}
        />
      )}

      <div
        ref={ref}
        className={cn(
          "relative",
          isUser
            ? cn(
                "rounded-2xl",
                compact ? "px-3.5 py-2.5 text-sm max-w-[85%]" : "px-5 py-3.5 max-w-[75%]"
              )
            : cn(
                "flex-1 min-w-0",
                compact ? "max-w-[95%]" : ""
              )
        )}
        style={isUser ? { background: "var(--color-bg-user-msg)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-subtle)" } : undefined}
      >
        <div ref={contentRef}>
          {isUser ? (
            <p className={cn("whitespace-pre-wrap break-words leading-relaxed", compact ? "text-sm" : "text-[0.9375rem]")}>
              {message.content}
            </p>
          ) : (
            <MarkdownContent content={message.content} compact={compact} conversationId={conversationId} />
          )}
        </div>

        {selectedText && selectionRect && (
          <TextSelectionMenu
            selectedText={selectedText}
            rect={selectionRect}
            threadId={threadId}
            messageId={message.id}
            onOpenTangent={onOpenTangent}
            onClose={clearSelection}
          />
        )}
      </div>
    </div>
  );
});
