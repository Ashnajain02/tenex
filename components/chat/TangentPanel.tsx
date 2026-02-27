"use client";

import { TangentThread } from "./TangentThread";
import type { TangentWindowState, MergeEvent } from "@/types";

interface TangentPanelProps {
  tangent: TangentWindowState;
  conversationId: string;
  /** ID of the message in this panel that spawned the next deeper tangent */
  activeChildMessageId?: string;
  /** The highlighted text within the active-child message */
  activeHighlightedText?: string;
  /** All sibling tangents (children of the same parent) — shown as tabs */
  siblings?: TangentWindowState[];
  /** Called when the user clicks a sibling tab */
  onSelectSibling?: (threadId: string) => void;
  /** Increment to trigger a messages re-fetch from DB (e.g. after a child merges into this thread) */
  refreshTrigger?: number;
  /** Merge events targeting this thread — displayed as inline indicators */
  mergeEvents?: MergeEvent[];
  onOpenTangent: (
    threadId: string,
    messageId: string,
    selectedText: string,
    rect: DOMRect
  ) => void;
  onMerge: (threadId: string) => void;
  onBranch: (threadId: string) => void;
  onClose: (threadId: string) => void;
}

export function TangentPanel({
  tangent,
  conversationId,
  activeChildMessageId,
  activeHighlightedText,
  siblings,
  onSelectSibling,
  refreshTrigger,
  mergeEvents,
  onOpenTangent,
  onMerge,
  onBranch,
  onClose,
}: TangentPanelProps) {
  return (
    <div
      className="flex flex-col h-full"
      style={{ borderLeft: "3px solid var(--color-accent)" }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 px-4 py-3"
        style={{
          background: "var(--color-bg-sidebar)",
          borderBottom: "1px solid var(--color-border)",
        }}
      >
        {/* Sibling tabs — shown when there are multiple children of the same parent */}
        {siblings && siblings.length > 1 && (
          <div className="flex gap-1 mb-2.5 overflow-x-auto pb-0.5">
            {siblings.map((s) => (
              <button
                key={s.threadId}
                onClick={() => onSelectSibling?.(s.threadId)}
                className="rounded px-2 py-0.5 text-xs font-medium flex-shrink-0 max-w-[140px] truncate transition-colors"
                style={{
                  background:
                    s.threadId === tangent.threadId
                      ? "var(--color-accent)"
                      : "var(--color-bg-base)",
                  color:
                    s.threadId === tangent.threadId
                      ? "white"
                      : "var(--color-text-secondary)",
                  border: "1px solid var(--color-border)",
                }}
                title={s.highlightedText}
              >
                &ldquo;{s.highlightedText.slice(0, 20)}
                {s.highlightedText.length > 20 ? "…" : ""}&rdquo;
              </button>
            ))}
          </div>
        )}

        <div className="flex items-start gap-2">
          {/* Accent dot */}
          <div
            className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full"
            style={{ background: "var(--color-accent)" }}
          />

          {/* Highlighted text */}
          <p
            className="flex-1 text-xs leading-relaxed break-words"
            style={{ color: "var(--color-text-secondary)" }}
          >
            &ldquo;{tangent.highlightedText}&rdquo;
          </p>

          {/* Action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            {/* Merge */}
            <button
              onClick={() => onMerge(tangent.threadId)}
              className="rounded-md px-2 py-1 text-xs font-medium transition-colors"
              style={{ background: "#16A34A", color: "white" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#15803D")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#16A34A")}
              title="Merge back into parent thread"
            >
              Merge
            </button>

            {/* Branch */}
            <button
              onClick={() => onBranch(tangent.threadId)}
              className="rounded-md px-2 py-1 text-xs font-medium transition-colors"
              style={{ background: "#2563EB", color: "white" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#1D4ED8")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#2563EB")}
              title="Branch into its own conversation"
            >
              Branch
            </button>

            {/* Close */}
            <button
              onClick={() => onClose(tangent.threadId)}
              className="rounded-md p-1 transition-colors"
              style={{ color: "var(--color-text-secondary)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#FEE2E2";
                e.currentTarget.style.color = "#EF4444";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--color-text-secondary)";
              }}
              title="Close"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Chat content */}
      <TangentThread
        threadId={tangent.threadId}
        parentThreadId={tangent.parentThreadId}
        conversationId={conversationId}
        activeChildMessageId={activeChildMessageId}
        activeHighlightedText={activeHighlightedText}
        refreshTrigger={refreshTrigger}
        mergeEvents={mergeEvents}
        onOpenTangent={onOpenTangent}
      />
    </div>
  );
}
