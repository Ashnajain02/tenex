"use client";

import { useEffect, useState } from "react";
import { MarkdownContent } from "./MarkdownContent";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";

interface ThreadHistoryViewerProps {
  threadId: string;
  onClose: () => void;
}

interface HistoryMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

interface ThreadDetails {
  highlightedText: string | null;
}

export function ThreadHistoryViewer({
  threadId,
  onClose,
}: ThreadHistoryViewerProps) {
  const [messages, setMessages] = useState<HistoryMessage[]>([]);
  const [thread, setThread] = useState<ThreadDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/threads/${threadId}`).then((r) => r.json()),
      fetch(`/api/threads/${threadId}/messages`).then((r) => r.json()),
    ]).then(([threadData, messagesData]) => {
      setThread(threadData);
      setMessages(messagesData);
      setLoading(false);
    });
  }, [threadId]);

  return (
    <Modal
      onClose={onClose}
      title={
        thread?.highlightedText
          ? `Tangent: "${thread.highlightedText}"`
          : "Tangent History"
      }
    >
      <div
        className="max-h-[60vh] overflow-y-auto p-4"
        style={{ background: "var(--color-bg-base)" }}
      >
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner className="h-6 w-6" />
          </div>
        ) : messages.length === 0 ? (
          <p
            className="py-4 text-center text-sm"
            style={{ color: "var(--color-text-muted, #9B9B9B)" }}
          >
            No messages in this tangent.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {messages
              .filter((msg) => msg.role !== "SYSTEM")
              .map((msg) => {
                const isUser = msg.role === "USER";
                return (
                  <div
                    key={msg.id}
                    className={cn("flex", isUser ? "justify-end" : "justify-start")}
                  >
                    {!isUser && (
                      <div
                        className="h-5 w-5 flex-shrink-0 rounded-full mt-1 mr-2"
                        style={{ background: "var(--color-accent)", opacity: 0.85 }}
                      />
                    )}
                    <div
                      className={cn(
                        "rounded-2xl text-sm",
                        isUser ? "px-3 py-2 max-w-[85%]" : "max-w-[90%]"
                      )}
                      style={isUser ? { background: "#2B2B2B", color: "white" } : undefined}
                    >
                      {isUser ? (
                        <p className="whitespace-pre-wrap break-words leading-relaxed">
                          {msg.content}
                        </p>
                      ) : (
                        <MarkdownContent content={msg.content} compact />
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </Modal>
  );
}
