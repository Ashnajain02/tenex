"use client";

import { useEffect, useMemo } from "react";
import {
  useFloating,
  offset,
  flip,
  shift,
} from "@floating-ui/react";

interface TextSelectionMenuProps {
  selectedText: string;
  rect: DOMRect;
  threadId: string;
  messageId: string;
  onOpenTangent: (
    threadId: string,
    messageId: string,
    selectedText: string,
    rect: DOMRect
  ) => void;
  onClose: () => void;
}

export function TextSelectionMenu({
  selectedText,
  rect,
  threadId,
  messageId,
  onOpenTangent,
  onClose,
}: TextSelectionMenuProps) {
  const virtualElement = useMemo(
    () => ({
      getBoundingClientRect: () => rect,
    }),
    [rect]
  );

  const { refs, floatingStyles } = useFloating({
    middleware: [offset(8), flip(), shift({ padding: 8 })],
  });

  // Set the virtual reference for positioning
  useEffect(() => {
    refs.setPositionReference(virtualElement);
  }, [refs, virtualElement]);

  return (
    <div
      ref={refs.setFloating} // eslint-disable-line react-hooks/refs -- callback ref from floating-ui, not a .current access
      style={{ ...floatingStyles, background: "var(--color-bg-elevated)", border: "1px solid var(--color-border)" }}
      className="z-50 rounded-xl p-1.5 shadow-lg"
    >
      <button
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors"
        style={{ color: "var(--color-text-primary)" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-bg-hover)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        onClick={() => {
          onOpenTangent(threadId, messageId, selectedText, rect);
          onClose();
        }}
      >
        <svg
          className="h-4 w-4"
          style={{ color: "var(--color-text-secondary)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 5l7 7-7 7M5 5l7 7-7 7"
          />
        </svg>
        Open tangent
      </button>
    </div>
  );
}
