"use client";

import { useTextSelection } from "@/hooks/use-text-selection";
import { MarkdownContent } from "./MarkdownContent";
import { TextSelectionMenu } from "./TextSelectionMenu";
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
  onOpenTangent: (
    threadId: string,
    messageId: string,
    selectedText: string,
    rect: DOMRect
  ) => void;
}

export function MessageBubble({
  message,
  threadId,
  compact,
  conversationId,
  onOpenTangent,
}: MessageBubbleProps) {
  const { ref, selectedText, selectionRect, clearSelection } = useTextSelection();

  if (message.role === "system") return null;

  const isUser = message.role === "user";

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      {/* Assistant avatar dot */}
      {!isUser && (
        <div
          className={cn(
            "flex-shrink-0 rounded-full mt-1 mr-3",
            compact ? "h-5 w-5" : "h-6 w-6"
          )}
          style={{ background: "var(--color-accent)", opacity: 0.85 }}
        />
      )}

      <div
        ref={ref}
        className={cn(
          "relative",
          isUser
            ? cn(
                "rounded-2xl text-white",
                compact ? "px-3 py-2 text-sm max-w-[85%]" : "px-4 py-3 max-w-[75%]"
              )
            : cn(
                compact ? "max-w-[95%]" : "max-w-[85%]"
              )
        )}
        style={isUser ? { background: "#2B2B2B" } : undefined}
      >
        {isUser ? (
          <p className={cn("whitespace-pre-wrap break-words leading-relaxed", compact ? "text-sm" : "text-[0.9375rem]")}>
            {message.content}
          </p>
        ) : (
          <MarkdownContent content={message.content} compact={compact} conversationId={conversationId} />
        )}

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
}
