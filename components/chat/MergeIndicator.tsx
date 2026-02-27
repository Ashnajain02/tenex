"use client";

import { useState } from "react";
import type { MergeEvent } from "@/types";
import { ThreadHistoryViewer } from "./ThreadHistoryViewer";

export function MergeIndicator({ mergeEvent }: { mergeEvent: MergeEvent }) {
  const [showHistory, setShowHistory] = useState(false);

  return (
    <>
      <div className="flex items-center gap-3 py-2">
        <div className="h-px flex-1" style={{ background: "var(--color-border)" }} />
        <button
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all"
          style={{
            background: "var(--color-bg-base)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--color-bg-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "var(--color-bg-base)";
          }}
        >
          {/* Merge icon */}
          <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"
            style={{ color: "var(--color-text-muted)" }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          <span>
            Tangent merged
            {mergeEvent.summary ? (
              <span className="ml-1 opacity-80">— {mergeEvent.summary}</span>
            ) : (
              <span className="ml-1 opacity-60">· click to view history</span>
            )}
          </span>
          {/* Arrow */}
          <svg className="h-3 w-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div className="h-px flex-1" style={{ background: "var(--color-border)" }} />
      </div>

      {showHistory && (
        <ThreadHistoryViewer
          threadId={mergeEvent.sourceThreadId}
          onClose={() => setShowHistory(false)}
        />
      )}
    </>
  );
}
